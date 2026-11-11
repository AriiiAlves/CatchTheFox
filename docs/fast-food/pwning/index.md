---
title: "Introdução"
---

Este material é um handbook com os "macetes" para fazer pwning de forma prática, dividido em [Stack](./stack/bof-variables.md) e [Heap](./heap/index.md). A teoria completa está em [Pwning](../../pwning/index.md).

## Guia inicial

1. Verifique informações do arquivo com `file arquivo` (32/64 bits, stripped, dinâmico/estático)
2. Verifique strings úteis com `strings arquivo` (`/bin/sh`, `flag`, nomes de funções)
3. Verifique segurança com `pwn checksec arquivo`
4. Abra o programa no Ghidra ou Debugger e procure a vulnerabilidade
5. Monte o exploit com pwntools e teste local com `gdb.debug()`. Depois troque `process()` por `remote()`

## Qual ataque usar? (pelo checksec)

| Situação | Ataque |
|----------|--------|
| Input sem limite (`gets`, `scanf("%s")`, `read` maior que o buffer) | [Buffer Overflow](./stack/bof-variables.md) |
| BOF + função `win` no binário + `No PIE` | [BOF - Return Address](./stack/bof-return-address.md) |
| BOF + `NX disabled` | [BOF - Shellcode](./stack/bof-shellcode.md) |
| BOF + `NX enabled` | [ROP](./stack/rop.md) / [ret2libc](./stack/ret2libc.md) |
| BOF pequeno (só cabe o return address) | [Stack Pivoting](./stack/stack-pivoting.md) |
| BOF + `Canary` | Vazar o canary (format string, leitura fora do array) e mantê-lo no payload |
| BOF + `PIE` | Vazar um endereço do binário (format string) ou [Partial Overwrite](./stack/partial-overwrite.md) |
| `printf(input)` | [Format Strings](./stack/format-strings.md): leak (`%p`) e escrita (`%n`) |
| Format string + `Partial RELRO` | [GOT Overwrite](./stack/got-overwrite.md) |
| Binário estático pequeno, poucos gadgets | [SROP](./stack/srop.md) |
| `malloc`/`free` no programa (notes, etc) | [Heap](./heap/index.md) |
| Índice de array vindo do usuário | Out-of-bounds: índice negativo/grande para ler/escrever a stack ou a `.bss` |
| `srand(time(NULL))` / `rand()` | Bad seed: reproduza a sequência com `ctypes` (`libc.srand(seed); libc.rand()`) |