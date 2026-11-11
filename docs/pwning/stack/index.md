---
title: Stack
---

A stack guarda as variáveis locais, o `rbp` salvo e o endereço de retorno de cada função (revisão em [Stack em Assembly](../../introduction/assembly/stack.mdx)). Como dados controlados pelo usuário e dados de controle do programa ficam lado a lado, é o lugar mais direto para transformar um bug de memória em controle do fluxo.

| Página | Bug / técnica | O que se ganha |
|---|---|---|
| [Buffer Overflow](./buffer-overflow/index.md) | Escrita além do buffer | Sobrescrever variáveis, `rbp` salvo e endereço de retorno |
| [Format Strings](./format-strings.md) | `printf(input)` | Leitura da stack, leitura e escrita arbitrárias |
| [GOT Overwrite](./got-overwrite.md) | Escrita arbitrária na GOT | Trocar uma função da libc por outra |
| [ROP](./rop/index.mdx) | Controle do endereço de retorno com NX | Executar código arbitrário reutilizando gadgets |

Ordem sugerida: Buffer Overflow (variáveis → return address → shellcode), Format Strings, GOT Overwrite e, por fim, ROP e suas variações.
