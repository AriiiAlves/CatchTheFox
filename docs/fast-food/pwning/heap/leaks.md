---
title: "Leaks"
sidebar_position: 2
---

Em heap, você normalmente precisa de dois leaks: **heap** (para o Safe Linking e para forjar ponteiros) e **libc** (para os alvos). Os dois vêm de ler chunks liberados ([UAF](./uaf.md) de leitura, ou um `malloc` que não limpa o conteúdo antigo).

## Heap

Libere um chunk de tcache cujo `fd` seja `NULL` (o primeiro liberado daquele tamanho) e leia:

- **glibc < 2.32**: libere dois chunks do mesmo tamanho e leia o segundo: o `fd` dele aponta para os dados do primeiro.
- **glibc ≥ 2.32** (Safe Linking): o `fd` do primeiro liberado vale `heap >> 12` (a chave do Safe Linking). `heap_base ≈ valor << 12`. Esse valor já é a `key` que você vai usar no [Tcache Poisoning](./tcache-poisoning.md).
- **glibc 2.29 a 2.33**: a `key` (bytes 8-15 dos dados) é o endereço da `tcache_perthread_struct`, que é o início da heap (`+0x10`).

```py
free(0)
leak = u64(show(0)[:8].ljust(8, b'\0'))
heap_base = leak << 12            # glibc >= 2.32
```

## Libc

Leve um chunk à **unsorted bin** e leia `fd`:

```
aloque 8 chunks de 0x90 (malloc(0x80)) + 1 barreira
libere os 8  → 7 vão para o tcache, o 8º para a unsorted bin
leia o 8º    → fd = main_arena + 96  → libc.address = leak - (libc.sym['main_arena'] + 96)
```

Alternativa com menos alocações: um único `malloc(0x500)` (maior que o tcache) + barreira, liberado direto.

Se não houver símbolo `main_arena`, descubra o offset uma vez no GDB: `leak - base da libc` em `vmmap` (costuma ser `__malloc_hook + 0x70` em glibc < 2.34). A base calculada termina em `000`.

```py
alloc(0, 0x500); alloc(1, 0x18)    # 1 = barreira, para o 0 não ser absorvido pelo top
free(0)
libc.address = u64(show(0)[:8].ljust(8, b'\0')) - (libc.sym['main_arena'] + 96)
```

## Sem UAF de leitura

- `malloc` não zera: aloque um chunk do mesmo tamanho por cima de um liberado e **leia sem escrever** (ou escreva só 1 byte, se o programa exige input). O resto do `fd`/`bk` continua lá.
- Com overflow de leitura (`printf("%s")` em string sem `\0`), encoste no `fd` do chunk vizinho.
- Chunk `mmap` (`malloc(0x30000)`): o endereço dele fica a uma distância constante da libc, então o próprio ponteiro é um leak de libc se o programa o imprimir.
