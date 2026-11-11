---
title: "Pwning"
---

Pwning (binary exploitation) é transformar um bug de memória em controle do programa: ler o que não devia, escrever onde não devia e, no fim, executar o que você quiser. Esta seção assume que você já passou pela [Introdução a Pwn/Rev](../introduction/index.md) (assembly, stack, GDB, Ghidra e pwntools).

:::tip Índice
A [Checklist de Pwning](./checklist.mdx) lista todos os tópicos, o que já está escrito e o que ainda falta.
:::

## Reconhecimento de um binário

Antes de procurar o bug, levante o básico:

| Passo | Comando | O que você descobre |
|---|---|---|
| 1 | `file ./chall` | Arquitetura (32/64 bits), linkagem estática ou dinâmica, stripped ou não |
| 2 | `pwn checksec ./chall` | [Proteções](./protections.mdx) ativas, que definem quais ataques são viáveis |
| 3 | `strings ./chall` | Strings úteis (`/bin/sh`, `flag.txt`, menus, format strings) |
| 4 | Ghidra / IDA | Lógica do programa e onde está a vulnerabilidade |
| 5 | `./libc.so.6` ou `strings libc.so.6 \| grep "GNU C"` | Versão da glibc, se o desafio fornece uma (essencial em [heap](./heap/glibc-versions.mdx)) |
| 6 | GDB + pwntools | Confirmar offsets, layout de memória e desenvolver o exploit |

## O raciocínio de um exploit

Quase todo exploit segue a mesma sequência. As páginas desta seção são formas diferentes de cumprir cada etapa.

1. **Bug**: o erro do programa (overflow, format string, UAF, índice sem validação...).
2. **Primitiva**: o que o bug permite fazer, em termos de leitura e escrita. Ex: "escrevo 8 bytes em qualquer endereço", "leio a stack".
3. **Leak**: com PIE/ASLR, é preciso vazar um endereço de cada região que você vai usar (binário, libc, heap, stack).
4. **Controle do fluxo**: sobrescrever algo que o programa usa para decidir para onde ir (return address, GOT, ponteiro de função, hook).
5. **Payload final**: `system("/bin/sh")`, ROP chain, shellcode, ou só ler a flag.

## Por onde começar

1. [Proteções de binários](./protections.mdx)
2. [Stack](./stack/index.md): Buffer Overflow, Format Strings, GOT Overwrite e ROP
3. [Heap](./heap/index.mdx)
4. [Outros](./others/index.md): bugs de índice, inteiros e ferramentas de apoio
