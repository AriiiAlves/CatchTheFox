---
title: "Pwntools CheatSheet"
sidebar_position: 5
---

- Instalação: `python3 -m pip install --upgrade pwntools` (se der erro de *externally-managed-environment*, use um venv: `python3 -m venv venv && source venv/bin/activate`)

Fluxo de uso:

1. Estabelecer target (`remote` para servidores e `process` para executáveis locais)
2. (Opcional) Anexar o GDB com `gdb.attach()` ou iniciar direto nele com `gdb.debug()` (os breakpoints e outros comandos vão em `gdbscript`)
3. Gerar dados, empacotar com `p64()` ou `p32()` e enviar com `target.send()` ou `target.sendline()`
4. Acesso manual com `target.interactive()`

```py
from pwn import *
# Conecta a um servidor:porta ao invés de fazê-lo no terminal
target = remote("github.com", 9000);
# Roda um binário (programa!)
target = process("./challenge")
# Adicionar o gdb debugger ao processo, dando comandos iniciais (b main e b my_function)
gdb.attach(target, gdbscript='''
b main
b my_function
''')
# Ou iniciar o processo já dentro do gdb (mais confiável para breakpoints no início):
# target = gdb.debug("./challenge", gdbscript='b main')
# Enviar variável x (bytes) ao target como input
target.send(x)
# Enviar variável seguida de um \n
target.sendline(x)
# Printar linha única de texto do target
print(target.recvline())
# Printar tudo do target até a string desejada
print(target.recvuntil(b"out"))
# Receber tudo que estiver disponível (com timeout)
print(target.clean())
'''
- x86 e x86-64 armazenam dados em little endian
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
# Leak de 6 bytes (endereço impresso com puts/printf %s) -> inteiro:
# u64(leak.ljust(8, b'\0'))

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

Outros atalhos úteis:

```py
elf = context.binary = ELF('./challenge')   # define arquitetura automaticamente
elf.sym['win'], elf.plt['puts'], elf.got['puts']   # endereços de funções, PLT e GOT
libc = ELF('./libc.so.6'); libc.address = base      # libc com base conhecida -> libc.sym['system']
next(libc.search(b'/bin/sh\0'))                     # endereço de "/bin/sh" na libc
cyclic(200), cyclic_find(0x61616173)                # achar offset de buffer overflow
asm(shellcraft.sh())                                # shellcode
fmtstr_payload(offset, {addr: value})               # payload de format string (%n)
ROP(elf)                                            # montar ROP chain (ver ROP)
```