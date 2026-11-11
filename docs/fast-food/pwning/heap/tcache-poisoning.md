---
title: "Tcache Poisoning"
sidebar_position: 3
---

Sobrescrever o `fd` de um chunk que está no tcache faz o 2º `malloc` daquele tamanho devolver o endereço que quisermos: **escrita arbitrária**. Requer glibc ≥ 2.26 e uma escrita no chunk livre ([UAF](./uaf.md) de escrita ou [overflow](./heap-overflow.md) no vizinho). Teoria em [Tcache](../../../pwning/heap/tcache.mdx).

```
A = malloc(0x40); B = malloc(0x40)
free(A); free(B)            → tcache: B -> A
edit(B, fd = alvo)          → tcache: B -> alvo        (UAF de escrita)
malloc(0x40)                → devolve B
C = malloc(0x40)            → devolve alvo!  edit(C, ...) escreve em alvo
```

## Por versão

- **glibc 2.26 a 2.28**: `fd = alvo` direto. Sem UAF, `free(A); free(A);` funciona (double free sem checks). Depois `malloc` → escreve `fd` → `malloc` → `malloc` = alvo
- **glibc ≥ 2.29**: o double free é detectado pela `key` (bytes 8-15 dos dados). Com UAF de escrita, nem precisa de double free (acima). Se precisar, sobrescreva a `key` com qualquer outro valor antes do 2º `free`
- **glibc ≥ 2.30**: o `malloc` só pega do tcache se o contador do bin for > 0. Com dois chunks liberados (como acima), o contador está certo
- **glibc ≥ 2.32** (Safe Linking): `fd = (endereço_do_chunk_B >> 12) ^ alvo`. Precisa do [leak da heap](./leaks.md). E `alvo` deve ser **múltiplo de 16** (`malloc(): unaligned tcache chunk detected`)

```py
# pwntools, glibc >= 2.32
key = heap_leak                      # valor lido do fd de um chunk com next = NULL (já é heap >> 12)
edit(B, p64(key ^ target))           # target alinhado em 16
```

Se o endereço de B não for `heap_base + algo` conhecido, use `(addr_B >> 12)` mesmo: para chunks na mesma página que o leak, `addr_B >> 12 == heap_leak`.

## Erros comuns

- `malloc(): unaligned tcache chunk detected` → alvo não é múltiplo de 16. Mire em `alvo & ~0xf` e compense com padding
- `free(): double free detected in tcache 2` → a `key` ainda está lá. Sobrescreva os bytes 8-15 antes do 2º `free`
- O 2º `malloc` não devolve o alvo → contador do bin em 0 (libere 2 chunks antes de envenenar), ou o `malloc` é de tamanho diferente (o tcache é por tamanho exato de chunk)
- Depois de pegar o alvo, o tcache daquele tamanho fica corrompido (`fd` do alvo vira a cabeça). Não libere mais chunks desse tamanho, ou garanta que o alvo tenha `0` nos primeiros 8 bytes

O que escrever no alvo: veja [Alvos](./targets.md).
