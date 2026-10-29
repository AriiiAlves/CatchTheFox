---
title: "Pwning"
---

Antes de ler esse material, é importante você já ter visto o material introdutório a Rev, onde abordamos sobre como entender e utilizar assembly, debuggers e decompiladores como o Ghidra. Aqui, vamos aprender as vulnerabilidades e praticar em binários.

## Roteiro de preparo para pwning

Este roteiro ajuda a entender como lidar com o binário inicialmente:

1. `strings file` - Acha todas as strings no binário. Assim, você tem uma ideia do que está codado bruto.
2. `pwn checksec` - Verifica proteções ativadas do binário (aprenderemos elas mais para frente)
3. `(gdb) info functions` - Verifica funções existentes no arquivo
4. Abrir no decompilador, para entender o código do binário
5. Explorar vulnerabilidades com `pwntools` e `gdb`