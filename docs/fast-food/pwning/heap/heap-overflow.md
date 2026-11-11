---
title: "Heap Overflow"
sidebar_position: 6
---

Escrever além de um chunk alcança o **header e os dados do chunk vizinho**. Como os chunks são contíguos e o programa costuma alocá-los em ordem, o vizinho é previsível. Teoria em [Heap Overflow](../../../pwning/heap/heap-overflow.mdx).

Como identificar: `read(0, buf, N)` com `N` maior que o tamanho pedido no `malloc`, `strcpy`/`strcat`, loop até `\n` sem limite, ou off-by-one (`i <= size`).

## O que sobrescrever no vizinho

| Alvo no vizinho | Resultado |
|---|---|
| Ponteiro de função (struct com callback) | Controle de fluxo direto: aponte para `win`/`system`/one_gadget |
| Ponteiro de conteúdo de outra nota | Leitura/escrita arbitrária: a nota passa a "ler" e "editar" o endereço que você escolher (GOT, `environ`, hooks). É o mais comum em desafios de notes com `struct {char *buf; size_t len;}` |
| `fd` de um chunk **livre** vizinho | [Tcache Poisoning](./tcache-poisoning.md) sem UAF. Libere o vizinho antes de transbordar |
| `size` do vizinho | Chunk maior que o real → ao liberá-lo e realocar, ele **sobrepõe** os chunks seguintes (overlapping chunks). Precisa de um `size` plausível no fim do chunk falso para o `free` não reclamar (`free(): invalid next size`) |
| `size` do top chunk | [House of Force](./house-of-force.md) (glibc < 2.29) |

Mantenha o `size` do vizinho válido se o programa ainda vai dar `free`/`malloc` nele. Se o overflow só tem 1 byte, veja o item abaixo.

## Off-by-one / poison null byte

Um único byte além do chunk atinge o byte baixo do `size` do vizinho (o `prev_size` dele é usado como dados do chunk atual). Escrever `\0` ali encolhe o vizinho (ex: `0x111` → `0x100`) e limpa o `PREV_INUSE`; o alocador passa a acreditar que o chunk anterior está livre e, no `free` do vizinho, consolida para trás com um `prev_size` que você controla → chunks sobrepostos. Em glibc ≥ 2.29 há a checagem `prev_size == size do chunk anterior`, então o chunk falso precisa ter um `size` coerente.

## Receita: notes com ponteiro de conteúdo

```py
alloc(0, 0x18, b'A')                 # vítima do overflow
alloc(1, 0x18, b'B')                 # struct ou buffer da nota 1
edit(0, b'A' * 0x18 + p64(0x21) + p64(elf.got['free']))   # size do vizinho + ponteiro da nota 1
leak = u64(show(1)[:8])              # lê free@got → libc
edit(1, p64(libc.sym['system']))     # free@got = system
alloc(2, 0x18, b'/bin/sh\0'); free(2)
```
