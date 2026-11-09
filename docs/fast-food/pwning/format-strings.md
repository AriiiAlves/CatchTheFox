---
title: "Format Strings"
sidebar_position: 4
---
Exploração de `printf`/`sprintf`/`fprintf` que aceitam a entrada do usuário diretamente como string de formato: `printf(buffer)` em vez de `printf("%s", buffer)`. Permite **vazar** memória (`%p`, `%s`) e **escrever** em qualquer endereço (`%n`).

## Leak

Permite vazar a pilha: o `printf` pega os "argumentos" dos registradores e depois da stack, sem saber quantos existem de verdade.

1. Identifique se há `printf` onde o primeiro argumento é seu input
2. Se houver, use format strings como input: `%p %p %p %p` (ou `%p.%p.%p.%p`, para separar)
   1. `%p` - Mostra um ponteiro inteiro (8 bytes em x64) com `0x` na frente. **Use este para leaks**
   2. `%x` - Mostra 4 bytes em hexadecimal
   3. `%s` - Trata o valor como ponteiro e imprime a string que está lá até `\0` (leitura arbitrária, se o ponteiro for seu)
   4. `%n` - Escreve no endereço apontado o número de bytes impressos até agora. (`printf("Hello%n", &count);` => count = 5). `%hn` escreve 2 bytes, `%hhn` 1 byte
3. Parâmetro direto -> `%6$p` imprime o 6º parâmetro, sem precisar de 6 `%p`
4. Em x64: parâmetros 1 a 5 são `rsi, rdx, rcx, r8, r9` (lixo dos registradores). **O 6º é o primeiro valor da stack**. Em x86: o 1º já é a stack

O que procurar nos leaks:

- `0x7ffc...` / `0x7ffd...` → endereço da **stack**
- `0x7f...` terminado em um offset conhecido → endereço da **libc** (`libc.address = leak - offset`, offset descoberto no GDB com `vmmap`)
- `0x55...` / `0x56...` → endereço do **binário** com PIE
- Um valor de 8 bytes aleatório terminado em `00` → **canary**

Achar onde o seu buffer está: envie `AAAAAAAA%6$p`, `AAAAAAAA%7$p`, ... até aparecer `0x4141414141414141`. Esse `N` é o **offset** do buffer.

## Escrita (%n)

Com o buffer no parâmetro `N`, colocamos um endereço no buffer e apontamos `%N$n` para ele. O pwntools monta o payload:

```py
from pwn import *
elf = context.binary = ELF('./vuln')
p = process()

offset = 6   # posição do buffer (descoberta acima)
payload = fmtstr_payload(offset, {elf.got['puts']: elf.sym['win']})   # {onde: o que}
p.sendline(payload)
p.interactive()
```

Alvos comuns: entrada da **GOT** (ver [GOT Overwrite](./got-overwrite.md), precisa de `Partial RELRO`), uma variável global (`is_admin`), o **return address** (precisa de leak da stack), ou `__malloc_hook`/`__free_hook` em glibc < 2.34.

Se o pwntools não achar o offset de jeito nenhum, a classe `FmtStr(execute_fmt=funcao_que_envia_e_retorna_saida)` descobre sozinha e expõe `.write(addr, value)` e `.execute_writes()`.

Cuidados:

- Em x64, os endereços têm `\x00`: o `fmtstr_payload` já os coloca no **fim** do payload. Não coloque nada depois deles
- Se o `printf` só roda uma vez, você precisa de leak e escrita no mesmo payload, ou de um loop no programa
- `Fortify Source` ativo bloqueia `%n` e `%N$` com parâmetros pulados