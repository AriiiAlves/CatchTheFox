---
title: "Assembly CheatSheet"
sidebar_position: 1
---

- **Registradores** - Memória no processador que armazena informação
    - `rbp`: Base Pointer, aponta para a **base do stack** frame atual
    - `rsp`: Stack Pointer, aponta para o **topo da stack** frame atual
    - `rip`: Instruction Pointer, aponta para a **instrução a ser executada**
    - Prefixos: `r` - 8 bytes. `e` - 4 bytes. `nada` - 2 bytes. Sufixo `l` - Lower byte
- Words
    - `word` - 2 bytes
    - `dword` - 4 bytes
    - `qword` - 8 bytes
- **Stack** - Região de memória com operações push/pop, onde variáveis locais são armazenadas. Cresce negativamente (topo é endereço menor, base é endereço maior).
- **Instruções**
    - `mov` - **Move dados de um registrador para outro** (segundo para o primeiro).
    - `dereference` - **colchetes [ ] referenciam dados ao qual um ponteiro aponta**.
    - `lea` - **Calcula o endereço do segundo operando**, e move para o primeiro.
    - `add` - **Adiciona dois valores** e armazena no primeiro operando.
    - `sub` - **Subtrai o segundo operando do primeiro** e armazena no primeiro.
    - `xor` - **Faz o xor nos dois argumentos**, e armazena no primeiro operando. and e or são semelhantes.
    - `push` - **Cresce a stack em 8 ou 4 bytes** (para x64, ou 4 para x86), **depois** **adiciona o conteúdo do registrador para o topo da stack.**
    - `pop` - Tira 8 bytes do topo da stack e armazena no argumento. Depois encolhe a stack.
    - `jmp` - **Pula para um endereço de instrução**. Redireciona a execução do código.
    - `call` - Redução dos comandos `push RIP` e `jmp function`. Utilizado sempre que se chama uma função.
    - `ret` - Redução do comando `pop RIP` (desempilha topo da stack para voltar para a execução de código antes da chamada de função, e atribui o valor do pop ao RIP).
    - `cmp` - **Compara dois operandos, faz o primeiro menos o segundo e checa se o resultado é maior/menor/igual a zero**. Dependendo do valor, **define uma flag** de acordo.
    - `jnz/jz` -  (jump if not zero/jump if zero) Similar ao jmp. Mas apenas **executa dependendo do status da zero flag**. Existem outros jumps.
