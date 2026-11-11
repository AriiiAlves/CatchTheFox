---
title: "GDB CheatSheet"
sidebar_position: 4
---

GEF: `bash -c "$(wget https://gef.blah.cat/sh -O -)"` e execute com `gdb ./meu_programa`

pwndbg: `curl -qsL 'https://install.pwndbg.re' | sh -s -- -t pwndbg-gdb` e execute com `pwndbg ./meu_programa`

Para navegação:

- `break main` , `run`  - Define ponto de parada e roda
- `start` / `starti` - Roda e para na `main` / na primeira instrução (`_start`). Útil em binários stripped ou com PIE (os endereços só existem depois de iniciar)
- `run < input.txt`, `run arg1` - Entrada e argumentos, como no shell
- `continue` - Avança até encontrar um breakpoint ou fim do programa. Não para entre instruções.
- `next` / `step` - Próxima linha do código fonte (só com debug symbols). `next` pula chamadas de função, `step` entra
- `nexti` (`ni`) - Próxima instrução Assembly, pulando chamadas de função
- `stepi` (`si`) - Próxima instrução Assembly, entrando em chamadas de função
- `finish` - Executa até a função atual retornar

Para visualizar informação:

- `disass main` - Mostra código assembly
- `b *main+25` (+25 é relativo ao início da função) ou `b *0x08048414` (endereço de memória da instrução)
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
    - `x/s $rbp-0xc` - String no endereço rbp-0xc
    - `x/20gx $rsp` - 20 qwords em hexadecimal a partir do topo da stack (formatos podem ser combinados)
    - `x/10i $rip` - 10 instruções a partir do rip
- `p` - Imprime conteúdo
    - `/d` - Inteiro
    - `/x` - Hex
- `info registers` - Visualizar o conteúdo dos registradores:

Para ver o stack frame (seção da stack alocada para uma única função)

- `info frame` - Mostra frame da stack da função atual
- `info files` - Mostra arquivos do programa
- `set *0x08048451 = 0xfacade` - Muda valor armazenado no endereço (4 bytes. Para 8: `set {long}0x08048451 = 0xfacade`)
- `set $rax = 0x10` - Muda valor de registrador
- `bt` - Backtrace (pilha de chamadas)
- `watch *(long *)0x404040` - Para quando o endereço for escrito (`rwatch` lido, `awatch` ambos)
- `set disable-randomization off` - Liga o ASLR dentro do GDB (desligado por padrão)
- `vmmap` (pwndbg/GEF) - Mapa da memória (base da libc, heap, stack e permissões)
- `search AAAA` (pwndbg) - Procura bytes na memória (útil para achar seu input)
- `cyclic 200` / `cyclic -l 0x61616173` (pwndbg) - Gera padrão De Bruijn / acha o offset
- `heap`, `bins`, `vis` (pwndbg) - Visualizar chunks e bins da heap
- `checksec` (pwndbg/GEF) - Proteções do binário
- `!command`  - Executa comandos de shell normais, como `!clear` ou `!ls`

Abas

- **Registers** - Conteúdo dos registradores da CPU
- **Stack** - Memória a partir do topo da stack (`rsp`), 8 bytes por linha (4 em 32 bits).
- **Code** - Código em assembly. Mostra linha a ser executada
- **Arguments** - Funções prestes a serem chamadas
- **Threads** - Informações de threads relacionadas ao SO
- **Trace** - Mostra pilha de chamadas de funções (call stack)

(No pwndbg, as abas se chamam REGISTERS, DISASM, STACK e BACKTRACE. No `gdb` puro, use `info registers`, `x/10i $rip`, `x/20gx $rsp` e `bt`.)