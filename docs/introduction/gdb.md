---
title: "Debugging com GDB"
sidebar_position: 4
---

GDB, o debugger do GNU, é uma ótima ferramenta para **analisar binários em execução**, permitindo analisar o código em assembly, ler variáveis na memória, ler a stack, etc. É realmente essencial para se trabalhar com rev.

Normalmente, o combo é Ghidra + GDB: Abra o Ghidra para ter uma ideia do que o código faz e use o GDB para tentar explorar as vulnerabilidades e analisar o binário em execução.

## Instalando e executando

Há três "versões" do `gdb`: o `gdb` clássico e duas extensões (plugins) que rodam por cima dele. O `gdb` clássico pode ser instalado com `sudo apt install gdb`.

O `gdb-gef` (gdb enhanced features), por sua vez, estende as funcionalidades do `gdb` padrão, e é muito mais útil para análise de software por engenharia reversa. Essa é a versão utilizada no tutorial do Nightmare, por isso abordei ela aqui. O repositório do projeto pode ser encontrado [aqui](https://github.com/hugsy/gef).

Baixe o `gdb-gef` com: `bash -c "$(wget https://gef.blah.cat/sh -O -)"`

E execute com: `gdb ./meu_binario`

Já a terceira versão é o `pwndbg`, que provavelmente é a melhor das três, e a mais completa. O repositório do `pwndbg` pode ser encontrado [aqui](https://github.com/pwndbg/pwndbg?tab=readme-ov-file).

Baixe o `pwndbg-gdb` com: `curl -qsL 'https://install.pwndbg.re' | sh -s -- -t pwndbg-gdb`

E execute com: `pwndbg ./meu_binario`

## Como usar

O intuito do GDB é parar a execução do programa em certos lugares, analisar e prosseguir.

Para navegar na execução do programa no GDB:

- `continue` - Para somente em breakpoints e no fim do programa
- `next` - Linha por linha, mas pula chamadas de função como puts
- `step` - Linha por linha, mas entra em chamadas de função
- `nexti` - Instrução por instrução, pulando chamadas de função
- `stepi` - Instrução por instrução, entrando em chamadas de função

(`next` e `step` andam por linhas do código-fonte, então só funcionam direito em binários com debugging symbols. Em binários de CTF, normalmente usamos `nexti`/`ni` e `stepi`/`si`.)

Para ver uma função em assembly, digite `disassemble` (ou `disass`) mais o nome da função. Vamos dar um disassemble (ou seja, ver o código em assembly) da main:

- `disass main`

```nasm
gef➤  disass main
Dump of assembler code for function main:
   0x080483fb <+0>:	lea    ecx,[esp+0x4]
   0x080483ff <+4>:	and    esp,0xfffffff0
   0x08048402 <+7>:	push   DWORD PTR [ecx-0x4]
   0x08048405 <+10>:	push   ebp
   0x08048406 <+11>:	mov    ebp,esp
   0x08048408 <+13>:	push   ecx
   0x08048409 <+14>:	sub    esp,0x4
   0x0804840c <+17>:	sub    esp,0xc
   0x0804840f <+20>:	push   0x80484b0
   0x08048414 <+25>:	call   0x80482d0 <puts@plt>
   0x08048419 <+30>:	add    esp,0x10
   0x0804841c <+33>:	mov    eax,0x0
   0x08048421 <+38>:	mov    ecx,DWORD PTR [ebp-0x4]
   0x08048424 <+41>:	leave  
   0x08048425 <+42>:	lea    esp,[ecx-0x4]
   0x08048428 <+45>:	ret    
End of assembler dump.
```
### Breakpoints

No GDB podemos usar breakpoints, que são lugares onde o GDB **para a execução** para permitir examinar o programa. O mais comum é colocarmos o **primeiro breakpoint na main** (a função principal que contém todo o código fonte). Podemos colocar `break main`  ou `b main` .

Agora, suponha que queremos dar um break na call do puts (função que imprime texto na tela), podemos fazer isso colocando um breakpoint para a instrução:

- `b *main+25` (+25 é relativo ao início da função main) ou `b *0x08048414` (endereço de memória da instrução)

**Ainda não rodamos o binário**, apenas estabelecemos onde o GDB deve parar para que possamos analisar o código. Quando rodarmos o binário, o processo vai pausar e mostrar o debugger exatamente na instrução assembly onde colocamos os breakpoints (com `b *main`, paramos exatamente na primeira instrução da função. Já com `b main`, sem o `*`, o GDB costuma parar um pouco depois, logo após o prólogo da função).

Para **executar o código desde o começo**, execute `run` (ou `r`). Isso vai parar no primeiro breakpoint. Para **prosseguir**, execute `continue` (ou `c`). Esse comando continua a execução até encontrar um breakpoint, fim do programa ou sinal (como segfault).

Para mostrar os breakpoints que colocamos:

- `info breakpoints`

Para deletar um breakpoint:

- `delete 2`  ou `d 2`

 Podemos colocar breakpoints em funções como `puts` :

- `b *puts` (* significa endereço)  e `run`

### Console de debug

Quando rodamos o binário com `run` e o GDB tenta executar a instrução na qual colocamos o break, o processo vai pausar e nos mostrar o **console de debug**:

```nasm
gef➤  r
Starting program: /home/devey/nightmare/modules/02-intro_tooling/hello_world 
[ Legend: Modified register | Code | Heap | Stack | String ]
────────────────────────────────────────────────────────────────────── registers ────
$eax   : 0xf7fb9dd8  →  0xffffd19c  →  0xffffd389  →  "CLUTTER_IM_MODULE=xim"
$ebx   : 0x0       
$ecx   : 0xffffd100  →  0x00000001
$edx   : 0xffffd124  →  0x00000000
$esp   : 0xffffd0d0  →  0x080484b0  →  "hello world!"
$ebp   : 0xffffd0e8  →  0x00000000
$esi   : 0xf7fb8000  →  0x001d4d6c
$edi   : 0x0       
$eip   : 0x08048414  →  0xfffeb7e8  →  0x00000000
$eflags: [zero carry PARITY ADJUST SIGN trap INTERRUPT direction overflow resume virtualx86 identification]
$cs: 0x0023 $ss: 0x002b $ds: 0x002b $es: 0x002b $fs: 0x0000 $gs: 0x0063 
────────────────────────────────────────────────────────────────────────── stack ────
0xffffd0d0│+0x0000: 0x080484b0  →  "hello world!"	 ← $esp
0xffffd0d4│+0x0004: 0xffffd194  →  0xffffd34e  →  "/home/devey/nightmare/modules/02-intro_tooling/hel[...]"
0xffffd0d8│+0x0008: 0xffffd19c  →  0xffffd389  →  "CLUTTER_IM_MODULE=xim"
0xffffd0dc│+0x000c: 0x08048451  →  <__libc_csu_init+33> lea eax, [ebx-0xf8]
0xffffd0e0│+0x0010: 0xf7fe59b0  →   push ebp
0xffffd0e4│+0x0014: 0xffffd100  →  0x00000001
0xffffd0e8│+0x0018: 0x00000000	 ← $ebp
0xffffd0ec│+0x001c: 0xf7dfbe81  →  <__libc_start_main+241> add esp, 0x10
──────────────────────────────────────────────────────────────────── code:x86:32 ────
    0x8048409 <main+14>        sub    esp, 0x4
    0x804840c <main+17>        sub    esp, 0xc
    0x804840f <main+20>        push   0x80484b0
 →  0x8048414 <main+25>        call   0x80482d0 <puts@plt>
   ↳   0x80482d0 <puts@plt+0>     jmp    DWORD PTR ds:0x80496bc
       0x80482d6 <puts@plt+6>     push   0x0
       0x80482db <puts@plt+11>    jmp    0x80482c0
       0x80482e0 <__gmon_start__@plt+0> jmp    DWORD PTR ds:0x80496c0
       0x80482e6 <__gmon_start__@plt+6> push   0x8
       0x80482eb <__gmon_start__@plt+11> jmp    0x80482c0
──────────────────────────────────────────────────────────── arguments (guessed) ────
puts@plt (
   [sp + 0x0] = 0x080484b0 → "hello world!",
   [sp + 0x4] = 0xffffd194 → 0xffffd34e → "/home/devey/nightmare/modules/02-intro_tooling/hel[...]"
)
──────────────────────────────────────────────────────────────────────── threads ────
[#0] Id 1, Name: "hello_world", stopped 0x8048414 in main (), reason: BREAKPOINT
────────────────────────────────────────────────────────────────────────── trace ────
[#0] 0x8048414 → main()
─────────────────────────────────────────────────────────────────────────────────────

Breakpoint 1, 0x08048414 in main ()
gef➤  
```

O console de debug se divide em abas. Veremos o que cada uma mostra de informação.

#### Registers

Aqui podemos ver o conteúdo dos registradores da CPU. Eles serão usados o tempo inteiro.

```nasm
────────────────────────────────────────────────────────────────────── registers ────
$eax   : 0xf7fb9dd8  →  0xffffd19c  →  0xffffd389  →  "CLUTTER_IM_MODULE=xim"
$ebx   : 0x0       
$ecx   : 0xffffd100  →  0x00000001
$edx   : 0xffffd124  →  0x00000000
$esp   : 0xffffd0d0  →  0x080484b0  →  "hello world!"
$ebp   : 0xffffd0e8  →  0x00000000
$esi   : 0xf7fb8000  →  0x001d4d6c
$edi   : 0x0       
$eip   : 0x08048414  →  0xfffeb7e8  →  0x00000000
$eflags: [zero carry PARITY ADJUST SIGN trap INTERRUPT direction overflow resume virtualx86 identification]
$cs: 0x0023 $ss: 0x002b $ds: 0x002b $es: 0x002b $fs: 0x0000 $gs: 0x0063 
```

No exemplo acima, temos, por exemplo:

- **$eax: 0xf7fb9dd8 → 0xffffd19c → 0xffffd389 → "CLUTTER_IM_MODULE=xim"**
    - `eax` contém o endereço `0xf7fb9dd8`
    - `0xf7fb9dd8` contém o endereço `0xffffd19c`
    - `0xffffd19c` contém o endereço `0xffffd389`
    - `0xffffd389` contém a string "`CLUTTER_IM_MODULE=xim`" (uma variável de ambiente, não relevante aqui)
- **$ebx**
    - 0x0 - Vazio
- **$esp (stack pointer): 0xffffd0d0 → 0x080484b0 → "hello world!"**
    - `esp` contém o endereço `0xffffd0d0` (topo da stack atual)
    - `0xffffd0d0` contém o endereço `0x080484b0`
    - `0x080484b0` aponta para a string "Hello World!"
- **$ebp (base pointer): 0xffffd0e8  →  0x00000000**
    - `ebp` contém o endereço 0xffffd0e8 (base da stack atual)
    - `0xffffd0e8` contém o valor 0x0 (zero)

Além disso, temos o **registrador com as flags**:

- **$eflags: [zero carry PARITY ADJUST SIGN trap INTERRUPT direction overflow resume virtualx86 identification]**

Se a flag é mostrada, seu valor é 1. Se não for mostrada, seu valor é 0. Como, por exemplo: 

- `zero` aparece - Última operação resultou em zero

#### Stack

A stack é um dos pontos mais importantes do programa, pois uma série de vulnerabilidades envolvem explorar a maneira como a stack funciona. Nela estarão as variáveis locais, chamadas de função, retorno, etc.

```
────────────────────────────────────────────────────────────────────────── stack ────
Endereço    Offset  Valor → Conteúdo
0xffffd0d0│+0x0000: 0x080484b0  →  "hello world!"	 ← $esp
0xffffd0d4│+0x0004: 0xffffd194  →  0xffffd34e  →  "/home/devey/nightmare/modules/02-intro_tooling/hel[...]"
0xffffd0d8│+0x0008: 0xffffd19c  →  0xffffd389  →  "CLUTTER_IM_MODULE=xim"
0xffffd0dc│+0x000c: 0x08048451  →  <__libc_csu_init+33> lea eax, [ebx-0xf8]
0xffffd0e0│+0x0010: 0xf7fe59b0  →   push ebp
0xffffd0e4│+0x0014: 0xffffd100  →  0x00000001
0xffffd0e8│+0x0018: 0x00000000	 ← $ebp
0xffffd0ec│+0x001c: 0xf7dfbe81  →  <__libc_start_main+241> add esp, 0x10
```

Acima, podemos ver:

- **`0xffffd0d0│+0x0000: 0x080484b0 → "hello world!"    ← $esp` (topo da stack)**
    - `$esp` está apontando para este endereço, `0xffffd0d0`. Lembra que o mesmo endereço estava nos registradores `$esp`, visto anteriormente?
    - Mesmo que seja o primeiro valor a ser mostrado, esse é o **topo da stack**. Lembre-se que **`$esp` sempre aponta para o topo da stack**.
    - Temos um offset **+0x0000**. Isso quer dizer quantos bytes estamos longe do primeiro endereço, `0xffffd0d0` (topo da stack).
    - `0xffffd0d0` (endereço da stack) contém `0x080484b0`, que aponta para a string "Hello World!".
- **`0xffffd0e8│+0x0018: 0x00000000	 ← $ebp`**
    - `$ebp` aponta para este endereço da stack, `0xffffd0e8`.
    - `0xffffd0e8` contém `0x0`, ou seja, zero. Esse é o **ebp salvo da função anterior**, e ele é nulo. Isso acontece porque estamos na **main**: quem a chamou foi a `__libc_start_main`, que não usa o `ebp` como base de stack frame, e o `_start` (primeira função do programa) zera o `ebp` justamente para marcar que não existe nenhum frame antes dele.
- **`0xffffd0ec│+0x001c: 0xf7dfbe81  →  <__libc_start_main+241> add esp, 0x10`**
    - Note que estamos falando de registradores com prefixo `e`, ou seja, x86 = 32 bits. **Isso significa que a stack está de 4 em 4 bytes**, como podemos ver. Isso também quer dizer que o **endereço de retorno para a função anterior** sempre estará em **ebp+0x4**. E cá estamos: em `0xffffd0e8` temos `ebp`, e em `0xffffd0ec` (`0xffffd0e8 + 0x4`) temos o endereço da função `<__libc_start_main+241>`. Esta é a função que chama a main.

Note também que a **stack realmente cresce negativamente**, indo desde endereços mais altos (`ebp`) até endereços mais baixos (`esp`).

#### Code

É aqui onde fica o **código em Assembly**. Em cima podemos ver a arquitetura do programa: x86 = 32 bits, ou 4 bytes.

A **setinha** mostra em qual instrução paramos (esta instrução **não foi executada ainda, mas será a próxima** a ser executada).

```nasm
──────────────────────────────────────────────────────────────────── code:x86:32 ────
    0x8048409 <main+14>        sub    esp, 0x4
    0x804840c <main+17>        sub    esp, 0xc
    0x804840f <main+20>        push   0x80484b0
 →  0x8048414 <main+25>        call   0x80482d0 <puts@plt>
   ↳   0x80482d0 <puts@plt+0>     jmp    DWORD PTR ds:0x80496bc
       0x80482d6 <puts@plt+6>     push   0x0
       0x80482db <puts@plt+11>    jmp    0x80482c0
       0x80482e0 <__gmon_start__@plt+0> jmp    DWORD PTR ds:0x80496c0
       0x80482e6 <__gmon_start__@plt+6> push   0x8
       0x80482eb <__gmon_start__@plt+11> jmp    0x80482c0
```

#### Arguments (guessed)

Essa aba aparece quando o GDB deduz que uma função está prestes a ser chamada.

```nasm
──────────────────────────────────────────────────────────── arguments (guessed) ────
puts@plt (
   [sp + 0x0] = 0x080484b0 → "hello world!",
   [sp + 0x4] = 0xffffd194 → 0xffffd34e → "/home/devey/nightmare/modules/02-intro_tooling/hel[...]"
)
```

- **[sp + 0x0] = 0x080484b0 → "hello world!"**
     - Primeiro argumento (`sp+0`). Está em `$esp+0x0`, que é o ponteiro `0x080484b0` que aponta para a string "hello world".
     - Segundo argumento (`sp+4`). Provavelmente é um artefato na stack (lixo de memória), e não um argumento real, pois `puts()` só recebe um argumento (a string).

#### Threads

Exibe informações de threads relacionadas ao sistema operacional.

```
[#0] Id 1, Name: "hello_world", stopped 0x8048414 in main (), reason: BREAKPOINT
```

- `#0` - Thread número 0 (thread principal)
- `id 1` - ID do thread no sistema operacional
- `Name: "hello_world"` - Nome do programa/thread
- `stopped 0x8048414 in main ()` - Parado no endereço 0x8048414 na função main()
- `reason: BREAKPOINT` - Motivo da parada: breakpoint atingido

#### Trace

Backtrace da execução. Mostra pilha de chamadas (call stack)

```
────────────────────────────────────────────────────────────────────────── trace ────
[#0] 0x8048414 → main()
```

- `#0` - Frame atual: executando `main()` no endereço 0x8048414

Se houvesse mais funções, mostraria algo como:

```
[#0] 0x... → função_atual()
[#1] 0x... → função_chamadora()
[#2] 0x... → main()
```
### Visualizando

É possível ver que o registrador `esp`  armazena o valor `0xffffd0d0` , que é um ponteiro. (visível no começo, na aba de registradores)

```nasm
$esp   : 0xffffd0d0  →  0x080484b0  →  "hello world!"
```

Para examinar as coisas com `x` , você tem que especificar o que vai ser examinado, e ele mostra o conteúdo:

- `x/a` - Endereço, `x/10c` - Número de caracteres, `x/s` - String, `x/g` - Qword, `x/w` - Dword, `x/x` - Hexadecimal, `x/10i` - 10 instruções
- Os formatos podem ser combinados: `x/20gx $rsp` mostra 20 qwords em hexadecimal a partir do topo da stack.

Para visualizar o conteúdo dos registradores:

- `info registers`

Para ver o stack frame (seção da stack alocada para uma única função)

- `info frame`

### Mudando valores

Se quisermos mudar o valor armazenado em `0x08048451`  para `0xfacade` :

- `set *0x08048451 = 0xfacade` (escreve 4 bytes. Para 8 bytes, use `set {long long}0x08048451 = 0xfacade`)

Para mudar o valor de um registrador:

- `set $eax = 0x10`

Assim, podemos manipular a memória e os registradores do jeito que quisermos.

## Arquivos compilados e Debugging symbols

Debugging symbols são **metadados** embutidos no arquivo executável (binário) que fornecem **informações de mapeamento entre o código binário e o código fonte original**. Caso essas informações não estejam presentes no arquivo, a análise fica um pouco mais difícil, pois perdemos algumas informações.

### Compilando com -g

No comando abaixo, estamos compilando o arquivo `main.c`, que pode ser qualquer coisa, como um simples `printf("Hello World!")`. 

```bash
gcc -g -o meu_programa main.c
```

Note que usamos a opção `-g`. Essa opção **ativa os metadados de Debugging Symbols**. É bem útil para desenvolvimento de programas, de modo que fica mais fácil debugar o código.

Ao usar `-g`:

- Inclui informações de debugging no executável
- Mapeamento completo entre código fonte e assembly
```
Debug Symbol: 
Endereço 0x8048410 → programa.c:15 (linha no código fonte)
```
- Nomes de variáveis, funções, structs são preservados
- Arquivo maior em tamanho

Comandos principais para navegar no GDB em um executável com `-g`:

```
(gdb) list              # Mostra código fonte
(gdb) break main        # Breakpoint por nome de função
(gdb) break 10          # Breakpoint por linha
(gdb) print variavel    # Mostra valor de variáveis
(gdb) next              # Próxima linha de código
(gdb) step              # Entra em funções
(gdb) info locals       # Variáveis locais
(gdb) info args         # Argumentos da função
```

### Compilando sem -g

Sem `-g`:

- Sem informações de debugging
- Apenas código executável
- Arquivo menor (a otimização depende de flags como `-O2`, e não do `-g`)
- Uso de strip adicional: `strip program`

Comandos principais para navegar no GDB em um executável sem `-g`:

```
(gdb) break *0x8048400    # Breakpoint por endereço
(gdb) info functions      # Lista funções (limitado)
(gdb) disas main          # Disassembly da função
(gdb) nexti               # Próxima instrução assembly
(gdb) stepi               # Entra em calls
(gdb) info registers      # Registradores
(gdb) x/10i $eip          # Examina instruções
```

É importante também saber que **alguns comandos não funcionam (ou não funcionam como esperado)** quando o programa é compilado sem `-g`:

- `break linha_codigo_fonte`
- `print variável`
- `next`
- `info locals`

### Compilando sem -g + stripped

Outra ocasião é quando o arquivo foi completamente `stripped` - Todos os símbolos foram removidos, incluindo os símbolos básicos das funções. As funções perdem seus nomes, inclusive a `main`. Assim, `b main` não irá funcionar.

```
gcc -o teste teste.c
strip --strip-all teste
```

Antes do strip, tínhamos algumas seções no executável:

```
.text    → Código executável
.data    → Dados inicializados  
.rodata  → Strings constantes
.symtab  → Tabela de símbolos
.strtab  → Tabela de strings
```

Depois do strip, as seções de símbolos somem, e sobram as seções necessárias para executar o programa:

```
.text      (código ainda funciona)
.data   
.rodata 
.dynsym    (símbolos dinâmicos)
```

Por isso, mesmo em um binário stripped, funções de bibliotecas dinâmicas (como `puts@plt`) continuam com nome: elas ficam na `.dynsym`, necessária para o programa encontrar as funções da libc.

Para navegar com o GDB em arquivos assim, você terá que usar o entry point:

```
(gdb) break *entry_point
(gdb) si/ni para navegar
```

Entry point é o endereço de memória onde o sistema começa a executar um programa. É a primeira instrução do código que será executada (geralmente a função `_start`, e não a `main`). Você pode encontrá-lo com `readelf -h ./binario` (campo *Entry point address*) ou, dentro do GDB, com `info file`.

### Verificando nível de strip de um binário

Para verificar, use o comando `file arquivo`

Com símbolos, no final haverá **not stripped** (e, se compilado com `-g`, também **with debug_info**):

```
ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, with debug_info, not stripped
```

Sem debugging symbols, mas com a tabela de símbolos: `..., not stripped` (sem o `with debug_info`)

Stripped (sem tabela de símbolos): `..., stripped`

## Observação: Códigos não iniciam na main

Os códigos não começam direto na função `main`, que é a primeira que o programador escreve. O entry point é a função `_start`, que chama a `__libc_start_main` (da libc), que só então chama a `main`. Nesse caminho, temos:

1. **Inicialização do ambiente C** (Libc)
    - Inicializar alocador de memória (malloc/free)
    - Configurar buffers de I/O (Input/Output) (stdin, stdout, stderr)
    - Inicializar variáveis globais da libc
    - Setup de localization (locale)
2. **Processamento de argumentos** (do kernel para main, por exemplo)
3. **Inicialização de variáveis globais** (fora da `main`)
4. **Construtores de objetos C++**
5. **Alinhamento e Setup da Stack**
6. **Segurança e ASLR** - Há algumas proteções que dificultam a vida dos ganeshers como nós. Aprenderemos elas mais para frente.