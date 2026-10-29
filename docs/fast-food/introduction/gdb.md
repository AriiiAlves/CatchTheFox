---
title: "GDB CheatSheet"
sidebar_position: 4
---

Baixe com: `bash -c "$(wget https://gef.blah.cat/sh -O -)"`

E execute com: `gdb ./meu_programa`

Para navegação:

- `break main` , `run`  - Define ponto de parada e roda
- `continue` - Avança até encontrar um breakpoint ou fim do programa. Não para entre instruções.
- `next` - Executa próxima linha do código fonte, mas pula chamadas de função
- `step`  - Executa próxima linha do código fonte, mas entra em chamadas de função
- `stepi`  - Avança instrução por instrução Assembly, entrando em chamadas de função

Para visualizar informação:

- `disass main` - Mostra código assembly
- `b *main+25` (+25 é relativo ao início do código) ou `b *0x08048414` (endereço de memória da instrução)
- `info breakpoints` - Mostra breakpoints
- `delete 2`  ou `d 2` - Deleta breakpoint
- `b *puts`  e `r`  - Coloca breakpoint em função
- `x`  - Mostra o conteúdo do endereço dado:
    - `x/a` - Endereço
    - `x/x` - Hexadecimal
    - `x/10c` - Número de caracteres
    - `x/s`  - String
    - `x/g`  - Qword
    - `x/w`  - Dword
    - `x/s $rbp - 0xc` - Valor do endereço rbp-0xc
- `p` - Imprime conteúdo
    - `/d` - Inteiro
    - `/x` - Hex
- `info registers` - Visualizar o conteúdo dos registradores:

Para ver o stack frame (seção da stack alocada para uma única função)

- `info frame` - Mostra frame da stack da função atual
- `info files` - Mostra arquivos do programa
- `set 0x08048451 = 0xfacade` - Muda valor armazenado no endereço
- `!command`  - Executa comandos de shell normais, como `!clear` ou `!ls`

Abas

- **Registers** - Conteúdo dos registradores da CPU
- **Stack** - Stack do programa na memória. Mostra apenas o Stack Frame da função atual.
- **Code** - Código em assembly. Mostra linha a ser executada
- **Arguments** - Funções prestes a serem chamadas
- **Threads** - Informações de threads relacionadas ao SO
- **Trace** - Mostra pilha de chamadas de funções (call stack)