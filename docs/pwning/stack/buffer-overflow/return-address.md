---
title: "Buffer Overflow - Return Address"
sidebar_position: 2
---

A instrução `ret` no fim de toda função desempilha o endereço de retorno e o coloca no `rip`. Esse endereço fica na stack, em `rbp+0x8` (x86-64) ou `ebp+0x4` (x86), logo depois das variáveis locais. 

Sobrescrevendo-o com um Buffer Overflow, o `ret` leva a execução para onde quisermos, inclusive para funções que o programa nunca chama. O caso em que existe uma função pronta que imprime a flag ou abre uma shell é conhecido como **ret2win**.

## Passo a Passo

1. `file` e `pwn checksec`: Ver arquitetura, PIE e canary.
2. Ache a vulnerabilidade e a posição do buffer (Ghidra ou GDB).
3. Calcule o offset do início do buffer até o endereço de retorno. Se o buffer está em `rbp-0x20`, são `0x20 + 0x8 = 0x28` bytes. Para não calcular na mão, use uma [sequência de De Bruijn](./debruijn.mdx).
4. Payload: `padding + endereço`.

<Mem
  title="Payload para um buffer em rbp-0x20"
  top="endereços baixos"
  bottom="endereços altos"
  rows={[
    {addr: 'rbp-0x20', label: "b'A' * 0x20", kind: 'ctrl', h: 2, note: 'buffer'},
    {addr: 'rbp', label: "b'B' * 8", kind: 'ctrl', note: 'rbp salvo (lixo)'},
    {addr: 'rbp+0x8', label: 'p64(win)', kind: 'danger', note: 'return address → rip'},
  ]}
/>

```py
from pwn import *

elf = context.binary = ELF('./vuln')
p = process()

payload = b'A' * 0x28 + p64(elf.sym['win'])
p.sendline(payload)
p.interactive()
```

### Como conseguir o endereço de destino

- **Sem PIE** (`No PIE` no checksec): os endereços do binário são fixos. Use o que o Ghidra/GDB mostra, ou `elf.sym['win']`.
- **Com [PIE](../../protections.mdx#pie-position-independent-executable--aslr-address-space-layout-randomization)**: o que você vê no Ghidra (`0x1189`) é só um offset. É preciso vazar um endereço do binário, calcular a base e somar (`elf.address = leak - offset`; depois `elf.sym['win']` já vem corrigido), ou fazer um [Partial Overwrite](../rop/partial-overwrite.mdx).
- **Com canary**: O canary precisa ser vazado e recolocado na posição dele (veja [Proteções](../../protections.mdx#stack-canaryssp-stack-smashing-protector)).

## Alinhamento da stack {#cuidado-ao-sobrescrever-return-address-desalinhamento-de-stack}

Existe um problema comum ao fazer BOF - Return Address: o exploit chega na função certa, mas o programa morre com `SIGSEGV` dentro de `system`, `printf` ou `puts`, em uma instrução como `movaps XMMWORD PTR [rsp+0x50], xmm0`.

A ABI de x86-64 exige `rsp` múltiplo de 16 **no momento do `call`**. Como o `call` empilha 8 bytes, toda função começa com `rsp % 16 == 8`, e o compilador gera código contando com isso. Instruções SSE como `movaps` exigem operandos de memória alinhados em 16 e falham se a conta não fechar.

Quando chegamos a uma função por `ret` em vez de `call` (por meio de Buffer Overflow), ninguém empilhou o endereço de retorno, e a função começa com a stack 8 bytes fora do que espera:

| | Chegada por `call` (normal) | Chegada por `ret` (exploit) |
|---|---|---|
| Antes | `rsp % 16 == 0` | `rsp % 16 == 8` (apontando para o return address) |
| Instrução | `call` empilha 8 bytes | `ret` desempilha 8 bytes |
| Entrada da função | `rsp % 16 == 8` ✅ | `rsp % 16 == 0` ❌ |

Em 32 bits isso também pode ocorrer, mas é mais difícil.

Para corrigir essa falha é simples. Existem dois modos de correção.

### Correção 1: um gadget `ret` antes

Executar um `ret` a mais desempilha mais 8 bytes e devolve o alinhamento esperado. 

Basta colocar o endereço de qualquer instrução `ret` do binário antes do endereço da função. Ele vai simplesmente consumir o endereço atual (decrescentando rsp) e pular para o próximo.

<Mem
  title="Com o gadget ret, a função alvo começa com rsp % 16 == 8"
  top="endereços baixos"
  bottom="endereços altos"
  rows={[
    {label: 'padding', kind: 'ctrl', h: 1.4},
    {addr: 'rbp+0x8', label: 'endereço de um ret', kind: 'meta', note: '1º ret: pula para o gadget'},
    {addr: 'rbp+0x10', label: 'endereço de win', kind: 'danger', note: '2º ret (o do gadget): pula para win'},
  ]}
/>

```py
from pwn import *

elf = context.binary = ELF('./vuln')
p = process()

rop = ROP(elf)
ret = rop.find_gadget(['ret'])[0]      # endereço de um "ret" qualquer

payload  = b'A' * 0x28
payload += p64(ret)                    # alinha a stack
payload += p64(elf.sym['win'])

p.sendline(payload)
p.interactive()
```

Pelo obter endereços de [ROP](../rop/index.mdx) pelo terminal, use `ROPgadget`: `ROPgadget --binary ./vuln | grep ": ret$"`.

### Correção 2: pular o `push rbp`

Entrar na função apenas uma instrução depois do `push rbp` tem o mesmo efeito (um `push` a menos equivale a 8 bytes de diferença):

```py
target = elf.sym['win'] + 1    # push rbp tem 1 byte (0x55)
```

Em binários modernos a função começa com `endbr64` (4 bytes) e só depois vem o `push rbp`, então o salto é `+5`. Confira no disassembly o endereço da instrução logo após o `push rbp`.

:::tip
Se o exploit "deveria funcionar" e dá `SIGSEGV` dentro de uma função da libc, teste adicionar ou remover um `ret` antes de qualquer outra investigação.
:::
