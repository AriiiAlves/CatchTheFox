---
title: "Use-After-Free"
sidebar_position: 1
---

O `free` não zera o ponteiro. Se o programa ainda deixa **ler**/**editar** uma nota deletada, temos leak e escrita nos metadados do chunk livre. É a porta de entrada de quase tudo em heap. Teoria em [Use-After-Free](../../../pwning/heap/uaf.mdx).

Como identificar: procure um `free(ptr)` sem `ptr = NULL` depois, e uma opção do menu que use o ponteiro sem checar se a nota existe (ler, editar, deletar de novo).

O que fazer com ele:

| Ação na nota liberada | Resultado |
|---|---|
| **Ler** | [Leak](./leaks.md): `fd` de um chunk no tcache/fastbin vaza a **heap**, `fd` de um chunk na unsorted bin vaza a **libc** |
| **Editar** | Sobrescrever o `fd` → [Tcache Poisoning](./tcache-poisoning.md) / [Fastbin dup](./fastbin.md): o `malloc` devolve um endereço arbitrário |
| **Deletar de novo** | Double free. Em glibc ≥ 2.29 o tcache detecta pela `key`; sobrescreva a `key` (bytes 8-15 dos dados) antes do 2º `free` |
| **Realocar como outro tipo** | Se o programa aloca structs com ponteiros de função do mesmo tamanho, aloque uma por cima da nota antiga e controle o ponteiro (confusão de tipos) |

Sem UAF de escrita, mas com [Heap Overflow](./heap-overflow.md)? O overflow em um chunk vizinho livre dá o mesmo efeito de editar o `fd`.
