---
title: "Buffer Overflow - Return Address"
sidebar_position: 2
---

Na stack, vimos que há um endereço de retorno. Em `x64`, esse endereço de retorno fica em `rbp+0x8`. Em `x32`, esse endereço de retorno fica em `ebp+0x4`.

Sempre que uma função chega ao final, ela chama a instrução `ret`, que desempilha esse endereço de retorno, extrai o endereço que está ali guardado, e atribui ao `rip`, de modo que o programa começa a ler instruções a partir daquele endereço.

Podemos utilizar Buffer Overflow para **sobrescrever esse endereço de retorno e ir para o lugar que quisermos no código**. Sim, podemos chamar qualquer função, mesmo que ela nunca seja chamada no código (ela só precisa existir).

Para fazer um Buffer Overflow Return Address:

1. Verifique informações do arquivo com `file arquivo`
2. Abra o programa no Ghidra ou Debugger
3. **Calcule a distância entre o início do input e do endereço de retorno** `rbp+0x8` (x64) ou `ebp+0x4` (x32)
   1. Ex: Se a variável está em `rbp-0x10`, a distância é `0x10 + 0x8 = 0x18`.
4. Em uma string, coloque caracteres para preencher essa distância. Ao final, **adicione o endereço de algum lugar do programa**.

Para obter endereços, é recomendável **usar o Ghidra para explorar outras funções que podem existir no arquivo**. Mas há um porém. Existe uma segurança implementada por padrão que é a **randomização de memória**. Toda vez que um programa roda, essa segurança pega endereços aleatórios de memória RAM. Assim, mesmo que você tente um endereço que viu no Ghidra, não irá funcionar, pois outro endereço é que está ativo.

Para vencer esse obstáculo, você teria que vazar um endereço de memória, como vimos que pode ser feito tirando o \0 do fim da string. Mas isso é muito mais limitado do que navegar pelo Ghidra e achar a função com o endereço certinho.

Nesses desafios, essa proteção está desativada, e você pode apenas copiar e colar os endereços. Mais adiante abordaremos sobre isso.

## Cuidado ao sobrescrever Return Address: Desalinhamento de Stack

Existem algumas funções importantes que utilizam instruções que exigem que a Stack esteja alinhada, como, por exemplo, a função `system("./bin/sh")`. Se seu objetivo for chamar uma função que tenha essa função dentro, o programa vai resultar em falha de segmentação.

Para `x64`, a stack deve ter o tamanho sempre de um múltiplo de `16 bytes` antes de uma chamada de função `call`. Para `x86`, não há requisito rígido pré-chamada.

Em particular, instruções SSE exigem `[rsp] % 16 == 0`

```
; Instrução SSE
movaps xmm0, [rsp]    ; ⚠️ CRASH se [rsp] não for múltiplo de 16
```

Vamos verificar alinhamento de stack para `x64`, onde realmente isso pode causar problemas.

Se não estivéssemos fazendo o BOF para chamar uma função, o programa seguiria um padrão de instruções: 

- `call funcao` - `PUSH RIP` (`RSP = RSP - 8`) e `JMP 0xfuncaoaddr` (+8 bytes na stack) // **Desalinha** (8 bytes)
- `inicio_funcao` - `PUSH RBP` (`RSP = RSP - 8`) (+8 bytes na stack) // **Alinha** (16 bytes)

Isso resulta em uma stack alinhada.

Mas como estamos sobrescrevendo o Return Address para irmos ao lugar que quisermos, não existe call, e sim uma modificação do que se faz após `leave` e `ret` na função original (`main`). Segue o fluxo:

- `leave` - `MOV RSP, RBP`; `POP RBP` (`RSP = RSP + 8`) (-8 bytes na stack) // **Desalinha** (-8 bytes)
- `ret` - `POP RIP` (`RSP = RSP + 8`) (-8 bytes na stack) // **Alinha** (-16 bytes)
- `inicio_funcao` - `PUSH RBP` (`RSP = RSP - 8`) (+8 bytes na stack) // **Desalinha** (-8 bytes)

Isso vai resultar em **SEGSV (Segmentation Fault)**, e o programa vai crashar.

**Como evitar desalinhamento de stack**? Há duas maneiras.

### 1° - Evitando PUSH RBP

Suponha que a função para a qual queremos pular está em `0x00000001`. A instrução PUSH RBP ocupa 1 byte de memória. Portanto, para pular para a próxima, basta usar o endereço `0x00000002`.

```py
target_address = 0x401234 + 1  # Pula o push rbp
```

Ou você pode verificar o endereço da próxima instrução ao PUSH RBP no decompilador ou gdb.

### 2° - ROP com ret

Essa técnica é mais confiável e robusta. **[ROP (Return Oriented Programming)](/docs/pwning/rop/8-1-rop) é uma técnica de exploração que usa pedaços de códigos já existentes no programa (gadgets) para executar código malicioso**. 

Basicamente, vamos **achar o endereço na memória de uma instrução** `ret`, um **gadget**. Isso só é possível **se a proteção PIE/ASLR não estiver ativada** (randomização de memória),

#### Buscando gadget

Podemos usar o comando Linux (deve ser instalado) `ROPgadget`: `ROPgadget -- binary meu_programa | grep "ret"`.

Ou podemos usar **pwntools**: 

```py
from pwn import *

elf = ELF('./vuln')
rop = ROP(elf)

# Encontra gadgets ret
ret_gadgets = rop.find_gadget(['ret'])
print(f"Ret gadget: {hex(ret_gadgets.address)}") # Imprime endereço do gadget
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

Esse é o fluxo normal de sair de uma função e ir para outra. Isso deixa a stack alinhada. O efeito que o `ret` tem é de **tirar 8 bytes da stack**.

```
No assembly:

[RBP-0x20] = AAAA...          (bytes de padding)
[RBP+0x00] = RBP antigo        (8 bytes) <- RSP = RBP
[RBP+0x08] = RET gadget        ← RIP vai aqui
...
No RIP:
0x00000000ff ret -> Efeito: POP RIP (tira 8 bytes da stack)
```

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

E:

- `leave` - `MOV RSP, RBP`; `POP RBP` (`RSP = RSP + 8`) (-8 bytes na stack) // **Desalinha** (-8 bytes)
- `ret` - `POP RIP` (`RSP = RSP + 8`) (-8 bytes na stack) // **Alinha** (-16 bytes)
- Agora, o `ret` leva a um lugar que não era para levar (manipulado por nós)
- `ret` - `POP RIP` (`RSP = RSP + 16`) (-8 bytes na stack) // **Alinha** (-24 bytes)
- `inicio_funcao` - `PUSH RBP` (`RSP = RSP - 8`) (+8 bytes na stack) // **Desalinha** (-16 bytes)

Veja, alinhamos com 16 bytes agora.

#### Código em pwntools

```py

# Acha gadget
elf = ELF('./vuln')
rop = ROP(elf)
ret = rop.find_gadget(['ret'])

# Alinha com ret e entra na função
payload = b'A' * 40
payload += p64(ret)
payload += p64(func_addr)
```
