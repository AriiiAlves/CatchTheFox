---
title: "Heap"
sidebar_position: 7
---

Programas com `malloc`/`free` controlados pelo usuário (estilo *notes*: criar, ler, editar, deletar). Os ataques dependem da **versão da glibc** (`strings libc.so.6 | grep "GNU C Library"`, ou `./libc.so.6`). Rode local com a libc do desafio: `pwninit` (gera `vuln_patched`).

## O essencial

- `malloc(n)` em x64 cria um chunk de `(n + 8)` arredondado para 16, mínimo `0x20`. O ponteiro devolvido aponta 0x10 bytes depois do header (`prev_size`, `size`)
- Chunk liberado: os primeiros bytes dos **dados** viram metadados (`fd`, e `bk`/`key`). Ler um chunk liberado = **leak**. Escrever = **controlar a lista**
- **tcache** (glibc ≥ 2.26): 7 chunks por tamanho, até `0x410`. LIFO, sem verificações até 2.28. `fd` aponta para os **dados** do próximo chunk
- **fastbin**: tamanhos até `0x80`, quando o tcache está cheio. LIFO. `fd` aponta para o **header** do próximo chunk
- **unsorted bin**: chunks maiores (ou tcache cheio). Um chunk sozinho nela tem `fd = bk = endereço dentro da libc` (`main_arena`)
- Um chunk liberado que encosta no **top chunk** é absorvido por ele. Mantenha um chunk alocado depois do seu alvo ("barreira")
- No pwndbg: `heap`, `bins`, `vis`, `tcache`. Sem símbolos da libc, use `vmmap heap` + `telescope <heap> 100`

## Use-After-Free

O `free` não zera o ponteiro. Se o programa ainda deixa **ler**/**editar** uma nota deletada, temos leak e escrita nos metadados do chunk livre. É a porta de entrada de quase tudo abaixo.

## Leaks

**Heap** (glibc ≥ 2.32, Safe Linking): libere um chunk de tcache cujo `fd` seja `NULL` (o primeiro liberado daquele tamanho) e leia: o valor é `heap >> 12` (a chave do Safe Linking). `heap_base ≈ valor << 12`.

**Libc**: leve um chunk à **unsorted bin** e leia `fd`:

```
aloque 8 chunks de 0x90 (malloc(0x80)) + 1 barreira
libere os 8  → 7 vão para o tcache, o 8º para a unsorted bin
leia o 8º    → fd = main_arena + 96  → libc.address = leak - (libc.sym['main_arena'] + 96)
```

(Se não houver símbolo `main_arena`, descubra o offset uma vez no GDB: `leak - base da libc` em `vmmap`.) Alternativa: um único `malloc(0x500)` (maior que o tcache) + barreira, liberado direto.

## Tcache Poisoning (escrita arbitrária)

Sobrescrever o `fd` de um chunk que está no tcache faz o 2º `malloc` daquele tamanho devolver o endereço que quisermos.

```
A = malloc(0x40); B = malloc(0x40)
free(A); free(B)            → tcache: B -> A
edit(B, fd = alvo)          → tcache: B -> alvo        (UAF de escrita)
malloc(0x40)                → devolve B
C = malloc(0x40)            → devolve alvo!  edit(C, ...) escreve em alvo
```

- **glibc < 2.32**: `fd = alvo` direto
- **glibc ≥ 2.32** (Safe Linking): `fd = (endereço_do_chunk_B >> 12) ^ alvo`. Precisa do leak da heap. E `alvo` deve ser múltiplo de 16
- **glibc ≥ 2.29**: o double free é detectado pela `key` (bytes 8-15 dos dados). Com UAF de escrita, nem precisa de double free (acima). Se precisar, sobrescreva a `key` antes do 2º `free`
- **glibc 2.26-2.28**: `free(A); free(A);` funciona direto. Depois `malloc` → escreve `fd` → `malloc` → `malloc` = alvo

```py
# pwntools, glibc >= 2.32
key = heap_leak                      # valor lido do fd de um chunk com next = NULL (já é heap >> 12)
edit(B, p64(key ^ target))
```

## Fastbin (glibc < 2.26, ou tcache cheio)

Mesma ideia, mas o `malloc` checa o `size` do chunk falso: em `alvo - 0x10 + 8` precisa haver um valor com o tamanho da fastbin (ex: `0x41` para chunks de `0x40`). Clássico: `__malloc_hook - 0x23` (aproveita o byte `0x7f` de um ponteiro vizinho como `size` de `0x70`). Double free: `free(A); free(B); free(A)` (a verificação só olha o topo da bin).

## O que escrever (alvos)

| glibc | Alvo | O que escrever |
|-------|------|----------------|
| < 2.34 | `__free_hook` | `system` → depois `free(chunk_com_"/bin/sh")` chama `system("/bin/sh")` |
| < 2.34 | `__malloc_hook` | `one_gadget` → depois `malloc()` |
| qualquer, `Partial RELRO`, `No PIE` | GOT (`free@got`, `puts@got`) | `system` / `win` |
| qualquer | ponteiro de função/struct do próprio programa na heap | endereço de `win`/`system` |
| ≥ 2.34 | `environ` (libc) → **leia** para vazar a stack | depois aloque em `return address` da função atual e escreva uma ROP chain (`pop rdi; ret`, `/bin/sh`, `system`, da libc). A `main` costuma terminar com `exit`, então mire no `ret` de uma função chamada pelo menu |
| ≥ 2.34 | `stdout` (`_IO_2_1_stdout_`) | FSOP: leak via `_IO_write_base` ou execução via vtable (avançado) |

Offsets: `libc.sym['__free_hook']`, `libc.sym['environ']`, `libc.sym['_IO_2_1_stdout_']`. A distância entre o valor de `environ` e o return address da função é fixa para o binário: meça uma vez no GDB (`x/gx &environ` para o valor, e o endereço do return address com `info frame` ou `telescope $rsp` dentro da função), e use `stack_leak - distancia` no exploit.

## Heap Overflow

Escrever além de um chunk alcança o **header e os dados do chunk vizinho**: sobrescreva um ponteiro de função, um ponteiro de conteúdo de outra nota (→ leitura/escrita arbitrária), ou o `fd` de um chunk livre vizinho (Tcache Poisoning sem UAF). Mantenha o `size` do vizinho válido se o programa ainda vai dar `free`/`malloc`.

## House of Force (glibc < 2.29)

Overflow até o `size` do **top chunk**: escreva `0xffffffffffffffff`. Depois `malloc(alvo - top_chunk - 0x20)` move o top até `alvo - 0x10`, e o próximo `malloc(x)` devolve `alvo`. Precisa de leak da heap e de um `malloc` que aceite tamanhos enormes. Morto em 2.29 (`malloc(): corrupted top size`).

## Unlink (glibc antiga ou chunks > 0x410)

Chunk falso dentro de `P` com `fd = &ptr - 0x18` e `bk = &ptr - 0x10` (`ptr` = ponteiro global para `P`), corrompa `prev_size`/`size` do chunk seguinte para que o `free` dele consolide com `P`. Resultado: `ptr = &ptr - 0x18`; editar `P` agora sobrescreve o array de ponteiros → leitura/escrita arbitrária.

## Por versão

| glibc | O que funciona |
|-------|----------------|
| < 2.26 | fastbin dup, unlink, unsorted bin attack, House of Force, hooks |
| 2.26 - 2.28 | tcache sem checks: double free e poisoning triviais, hooks |
| 2.29 - 2.31 | tcache key (contorne com UAF), top chunk check, hooks |
| 2.32 - 2.33 | + Safe Linking (precisa leak de heap) e alinhamento, hooks ainda existem |
| ≥ 2.34 | sem hooks: `environ` → ROP na stack, ou FSOP em `stdout`. GOT se `Partial RELRO` |
