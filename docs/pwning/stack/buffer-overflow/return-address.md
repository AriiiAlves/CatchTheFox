---
title: "Buffer Overflow - Return Address"
sidebar_position: 2
---

Na stack, vimos que há um endereço de retorno. Em `x64`, esse endereço de retorno fica em `rbp+0x8`. Em `x86` (32 bits), esse endereço de retorno fica em `ebp+0x4`.

Sempre que uma função chega ao final, ela chama a instrução `ret`, que desempilha esse endereço de retorno, extrai o endereço que está ali guardado, e atribui ao `rip`, de modo que o programa começa a ler instruções a partir daquele endereço.

Podemos utilizar Buffer Overflow para **sobrescrever esse endereço de retorno e ir para o lugar que quisermos no código**. Sim, podemos chamar qualquer função, mesmo que ela nunca seja chamada no código (ela só precisa existir).

Para fazer um Buffer Overflow Return Address:

1. Verifique informações do arquivo com `file arquivo`
2. Abra o programa no Ghidra ou Debugger
3. **Calcule a distância entre o início do input e do endereço de retorno** `rbp+0x8` (x64) ou `ebp+0x4` (x86). Se não quiser calcular na mão, use uma [sequência de De Bruijn](./debruijn.mdx)
   1. Ex: Se a variável está em `rbp-0x10`, a distância é `0x10 + 0x8 = 0x18`.
4. Em uma string, coloque caracteres para preencher essa distância. Ao final, **adicione o endereço de algum lugar do programa**.

Para obter endereços, é recomendável **usar o Ghidra para explorar outras funções que podem existir no arquivo** (uma função `win`, `flag`, `shell`, etc). Mas há um porém. Existe uma proteção, ativada por padrão nos compiladores modernos, chamada [PIE](../../protections.mdx#pie-position-independent-executable--aslr-address-space-layout-randomization): com ela, o código do programa é carregado em um endereço base aleatório a cada execução. Assim, o endereço que você viu no Ghidra (algo como `0x1189`) é só um offset, e o endereço real será `base + 0x1189`, com a base mudando toda vez.

Para vencer esse obstáculo, você teria que vazar um endereço do programa (como vimos que pode ser feito tirando o `\0` do fim da string, ou com [Format Strings](../format-strings.md)) e somar o offset.

Nesses desafios, essa proteção está desativada (`pwn checksec` mostra `No PIE`), e você pode apenas copiar e colar os endereços que o Ghidra ou o GDB mostram.

## Cuidado ao sobrescrever Return Address: Desalinhamento de Stack

Existem algumas funções importantes que utilizam instruções que exigem que a Stack esteja alinhada, como, por exemplo, a função `system("/bin/sh")` (e também `printf` com floats, entre outras). Se seu objetivo for chamar uma função que tenha uma dessas dentro, e a stack estiver desalinhada, o programa vai resultar em falha de segmentação.

Para `x64`, a convenção de chamada exige que `rsp` seja múltiplo de `16 bytes` no momento do `call`. Para `x86` de 32 bits, esse problema praticamente não aparece em CTFs.

Em particular, instruções SSE exigem `[rsp] % 16 == 0`

```
; Instrução SSE
movaps xmm0, [rsp]    ; ⚠️ CRASH se [rsp] não for múltiplo de 16
```

Vamos verificar alinhamento de stack para `x64`, onde realmente isso pode causar problemas.

A regra é: **no momento do `call`, `rsp % 16 == 0`**. Como o `call` empilha o endereço de retorno (8 bytes), **toda função começa com `rsp % 16 == 8`**, e o compilador conta com isso: depois do `push rbp` do prólogo, a stack volta a ficar múltipla de 16, e a função gera o resto do código assumindo esse alinhamento.

Fluxo normal (com `call`):

- Antes do `call` - `rsp % 16 == 0` (o compilador garante isso)
- `call funcao` - `PUSH RIP` (`RSP = RSP - 8`) // `rsp % 16 == 8`
- `inicio_funcao` - `PUSH RBP` (`RSP = RSP - 8`) // `rsp % 16 == 0` **Alinhado**, como a função espera

Mas quando sobrescrevemos o Return Address, não existe `call`: chegamos na função através do `ret` da função original (`main`). O `ret` **tira** 8 bytes da stack em vez de colocar. Segue o fluxo, lembrando que, antes do `leave`, a stack da `main` estava alinhada (`rbp % 16 == 0`):

- `leave` - `MOV RSP, RBP`; `POP RBP` (`RSP = RSP + 8`) // `rsp % 16 == 8`
- `ret` - `POP RIP` (`RSP = RSP + 8`) // `rsp % 16 == 0` ← a função é iniciada aqui, mas ela esperava `rsp % 16 == 8`!
- `inicio_funcao` - `PUSH RBP` (`RSP = RSP - 8`) // `rsp % 16 == 8` **Desalinhado** (a função esperava 0)

Ou seja, entramos na função com a stack deslocada em 8 bytes em relação ao que ela espera. Quando alguma instrução SSE (`movaps`) for executada dentro dela (dentro do `system`, por exemplo), teremos **SIGSEGV (Segmentation Fault)**, e o programa vai crashar.

**Como evitar desalinhamento de stack**? Há duas maneiras.

### 1° - Evitando PUSH RBP

Suponha que a função para a qual queremos pular está em `0x401234`. A instrução `push rbp` ocupa 1 byte de memória (`0x55`). Portanto, para pular para a instrução seguinte (`mov rbp, rsp`), basta usar o endereço `0x401235`. Sem o `push rbp`, a stack entra na função com o alinhamento que ela espera.

```py
target_address = 0x401234 + 1  # Pula o push rbp
```

Cuidado: em binários modernos, a primeira instrução da função costuma ser `endbr64` (4 bytes), e só depois vem o `push rbp`. Nesse caso, o endereço seria `0x401234 + 5`. Sempre confira no GDB ou no Ghidra qual é o endereço da instrução logo após o `push rbp`.

### 2° - ROP com ret

Essa técnica é mais confiável e robusta. **[ROP (Return Oriented Programming)](../rop/index.mdx) é uma técnica de exploração que usa pedaços de códigos já existentes no programa (gadgets) para executar código malicioso**. 

Basicamente, vamos **achar o endereço na memória de uma instrução** `ret`, um **gadget**. Isso só é possível diretamente **se a proteção PIE não estiver ativada** (ou se já tivermos vazado a base do binário).

#### Buscando gadget

Podemos usar a ferramenta `ROPgadget` (instale com `pip install ROPgadget`): `ROPgadget --binary meu_programa | grep ": ret$"`. Qualquer `ret` serve, inclusive o `ret` do fim de qualquer função.

Ou podemos usar **pwntools**: 

```py
from pwn import *

elf = ELF('./vuln')
rop = ROP(elf)

# Encontra um gadget ret
ret_gadget = rop.find_gadget(['ret'])
print(f"Ret gadget: {hex(ret_gadget.address)}") # Imprime endereço do gadget
# (rop.find_gadget(['ret'])[0] também retorna o endereço)
```

Assim, podemos montar nosso payload.

Mas, antes de usarmos esse `ret`, vamos entender por que ele funciona.

#### Por que `ret`?

No **fim de uma função qualquer**, sempre teremos as instruções:
```
0x0000000000401208 <+124>:   leave
0x0000000000401209 <+125>:   ret
```

- `leave` - Comando compacto:
  - `MOV RSP, RBP` - `RBP` é copiado para `RSP`. Isso destrói o stack frame da função, descartando todas as variáveis locais. (agora, o próximo da stack é o `RBP` antigo)
  - `POP RBP` - O valor no topo da pilha (`RBP` antigo) é desempilhado para o registrador `RBP`. Isso faz o stack frame "voltar para trás". (agora, o próximo da stack é o `return address`)
- `ret` - Comando compacto:
  - `POP RIP` - O valor no topo da pilha (apontado pelo `RSP`) agora é `RBP+8`, o `return address` que tentamos sobrescrever. Como `RIP` é o registrador que indica a instrução atual ativa, estamos fazendo o programa "pular" para um endereço de memória salvo em `RBP+8`.

Esse é o fluxo normal de sair de uma função e voltar para quem a chamou. O efeito que cada `ret` tem é de **tirar 8 bytes da stack** (`RSP = RSP + 8`). E é exatamente isso que precisamos: estávamos 8 bytes "fora" do alinhamento esperado, então um `ret` a mais corrige a conta.

Se sobrescrevemos o `return address` com um endereço de um local do código com `ret`, teremos o seguinte fluxo:
- `leave` - Comando compacto:
  - `MOV RSP, RBP` - `RBP` é copiado para `RSP`. Isso destrói o stack frame da função, descartando todas as variáveis locais. (agora, o próximo da stack é o `RBP` antigo)
  - `POP RBP` - O valor no topo da pilha (`RBP` antigo) é desempilhado para o registrador `RBP`. Isso faz o stack frame "voltar para trás". (agora, o próximo da stack é o `return address`)
- `ret` - Comando compacto:
  - `POP RIP` - O valor no topo da pilha (apontado pelo `RSP`) agora é `RBP+0x8`, o `return address` que contém o ROP. Pulamos para um endereço de memória salvo em `RBP+8`.
- Somos levados a uma instrução `ret` novamente, que interage com a stack.
- `ret` - Comando compacto:
  - `POP RIP` - O valor no topo da pilha (apontado pelo `RSP`) agora é `RBP+0x10`, o `return address` que tentamos sobrescrever. Pulamos para um endereço de memória salvo em `RBP+0x10`, que é nossa função.

Assim, teremos a seguinte stack após um overflow:
```
[RBP-0x20] = AAAA...          (bytes de padding)
[RBP+0x00] = RBP antigo        (8 bytes) 
[RBP+0x08] = RET gadget        ← RIP vai aqui primeiro!
[RBP+0x10] = Função alvo       ← RIP vai aqui depois!
```

E, seguindo o `rsp` (lembrando que `rbp % 16 == 0` antes do `leave`):

- `leave` - `MOV RSP, RBP`; `POP RBP` (`RSP = RSP + 8`) // `rsp % 16 == 8`
- `ret` - `POP RIP` (`RSP = RSP + 8`) // `rsp % 16 == 0`. Vai para o gadget `ret`
- `ret` (gadget) - `POP RIP` (`RSP = RSP + 8`) // `rsp % 16 == 8`. Vai para a função alvo
- `inicio_funcao` - `PUSH RBP` (`RSP = RSP - 8`) // `rsp % 16 == 0` **Alinhado**

Veja, agora a função começa com `rsp % 16 == 8`, exatamente como se tivesse sido chamada com `call`.

#### Código em pwntools

```py

from pwn import *

elf = context.binary = ELF('./vuln')
p = process()

# Acha gadget
rop = ROP(elf)
ret = rop.find_gadget(['ret'])[0]   # endereço do gadget
func_addr = elf.sym['win']          # função alvo (pelo nome, se o binário não for stripped)

# Alinha com ret e entra na função
payload = b'A' * 40        # padding até o return address (buffer + rbp salvo)
payload += p64(ret)
payload += p64(func_addr)

p.sendline(payload)
p.interactive()
```

Dica: se o exploit funciona "na teoria" mas dá `SIGSEGV` dentro de `system`/`printf`, o problema quase sempre é alinhamento. Adicionar (ou remover) um `ret` no início da chain resolve.
