---
title: "Heap"
---

Programas com `malloc`/`free` controlados pelo usuário (estilo *notes*: criar, ler, editar, deletar). Os ataques dependem da **versão da glibc** (`strings libc.so.6 | grep "GNU C Library"`, ou `./libc.so.6`). Rode local com a libc do desafio: `pwninit` (gera `vuln_patched`). A teoria completa está em [Heap](../../../pwning/heap/index.mdx).

## O essencial

- `malloc(n)` em x64 cria um chunk de `(n + 8)` arredondado para 16, mínimo `0x20`. O ponteiro devolvido aponta 0x10 bytes depois do header (`prev_size`, `size`)
- Chunk liberado: os primeiros bytes dos **dados** viram metadados (`fd`, e `bk`/`key`). Ler um chunk liberado = **leak**. Escrever = **controlar a lista**
- **tcache** (glibc ≥ 2.26): 7 chunks por tamanho, até `0x410`. LIFO, sem verificações até 2.28. `fd` aponta para os **dados** do próximo chunk
- **fastbin**: tamanhos até `0x80`, quando o tcache está cheio. LIFO. `fd` aponta para o **header** do próximo chunk
- **unsorted bin**: chunks maiores (ou tcache cheio). Um chunk sozinho nela tem `fd = bk = endereço dentro da libc` (`main_arena`)
- Um chunk liberado que encosta no **top chunk** é absorvido por ele. Mantenha um chunk alocado depois do seu alvo ("barreira")
- No pwndbg: `heap`, `bins`, `vis`, `tcache`. Sem símbolos da libc, use `vmmap heap` + `telescope <heap> 100`

## Roteiro

Quase todo desafio de heap segue a mesma ordem. Cada etapa tem uma página:

| Etapa | Página | Quando |
|---|---|---|
| 1. Achar o bug | [Use-After-Free](./uaf.md), [Heap Overflow](./heap-overflow.md) | Sempre |
| 2. Vazar heap e libc | [Leaks](./leaks.md) | Sempre que houver PIE/ASLR (quase sempre) |
| 3. Alocar em endereço arbitrário | [Tcache Poisoning](./tcache-poisoning.md) (glibc ≥ 2.26), [Fastbin dup](./fastbin.md) (< 2.26 ou tcache cheio) | Para conseguir a escrita arbitrária |
| 4. Escolher o que sobrescrever | [Alvos](./targets.md) | Depende da versão da glibc |
| Alternativas | [House of Force](./house-of-force.md) (< 2.29), [Unlink](./unlink.md) | Quando o bug é overflow e não UAF |

## Por versão

| glibc | O que funciona |
|-------|----------------|
| < 2.26 | fastbin dup, unlink, unsorted bin attack, House of Force, hooks |
| 2.26 - 2.28 | tcache sem checks: double free e poisoning triviais, hooks |
| 2.29 - 2.31 | tcache key (contorne com UAF), top chunk check, hooks |
| 2.32 - 2.33 | + Safe Linking (precisa leak de heap) e alinhamento, hooks ainda existem |
| ≥ 2.34 | sem hooks: `environ` → ROP na stack, ou FSOP em `stdout`. GOT se `Partial RELRO` |

Detalhes em [Ataques por versão da glibc](../../../pwning/heap/glibc-versions.mdx).
