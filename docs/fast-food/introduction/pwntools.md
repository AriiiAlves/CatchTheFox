---
title: "Pwntools CheatSheet"
sidebar_position: 5
---

- Instalação: `sudo pip install pwn`

Fluxo de uso:

1. Estabelecer target (`remote` para servidores e `process` para executáveis locais)
2. Enviar comandos iniciais ao programa com `gdb.attach()` (já estabelecemos os breakpoints e quaisquer outros comandos em `gdbscript`)
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
b my_function')
'''
# Enviar variável x ao target como input
target.send(x)
# Enviar variável seguida de um \n
target.sendline(x)
# Printar linha única de texto do target
print target.recvline()
# Printar tudo do target até a string desejada
print target.recvuntil("out")
'''
- Arquivos ELFs (assembly) armazenam dados através de least endian
- Isso que significa que os dados são armazenados com o byte menos significativo primeiro. (contraŕio)
- (inteiro -> 0x109F D7B4 9C2D 0135 // Armazenado na memória -> 35 01 2D 9C B4 D7 9F 10)
- Em algumas situações em que escaneamos um inteiro, precisamos levar isso em conta.
- Precisamos empacotar o inteiro (human readable -> binário)
'''
# Para empacotar número inteiro como least endian (sequência de bytes)
p64(x) # QWORD (x64 = 64 bits  = 8 bytes)
p32(x) # DWORD (x86 = 32 bits = 4 bytes)
# Para desempacotar least endian (sequência de bytes) como inteiro
u64(x) # QWORD
u32(x) # DWORD

# Interage manualmente com o target no terminal
target.interactive()
```

Exemplo de endianness com pwntools:
```py
# Big endian
p64(0x41424344, endian='big')  # b'\x00\x00\x00\x00ABCD'
u64(b'ABCD\x00\x00\x00\x00', endian='big')  # 0x41424344

# Little endian (padrão)
p64(0x41424344)  # b'DCBA\x00\x00\x00\x00'

```

Temos que trabalhar com `b''`, um byteArray do python, e não strings padrão `''`. Isso cria uma sequência de bytes no Python, essencial para trabalhar com binários, pois binários trabalham com bytes e não strings. Comandos como `p64` retornam byteArrays.

```py
from pwn import *

# Payload em bytes
payload = b'A' * 64 + p64(0x401234)
conn.send(payload)
```