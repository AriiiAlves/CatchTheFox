---
title: "Buffer Overflow - Call Function"
sidebar_position: 2
---

Sobrescrevemos o `return address` com um endereço de nossa escolha, de qualquer lugar do código.

1. Identifique se é possível fazer BOF
2. **Calcule a distância entre o início do input e do endereço de retorno** `rbp+0x8` (x64) ou `ebp+0x4` (x32)
   1. Ex: Se a variável está em `rbp-0x10`, a distância é `0x10 + 0x8 = 0x18`.
3. Em uma string, coloque caracteres para preencher essa distância. Ao final, **adicione o endereço de algum lugar do programa onde você queira executar instruções. Pode ser uma função ou qualquer outra coisa**.

Nota: Em alguns executáveis raros, o `return address` pode ser diferente de `rbp+0x8` (x64) ou `ebp+0x4` (x32). Sempre verifique.

## Evitando desalinhamento de Stack com PUSH RBP (fraco)

- Se você quer ir a uma instrução no endereço `0x00000001`, substitua por `0x00000001 + 1`. A instrução PUSH RBP que desalinha a stack ocupa 1 byte de memória, e você irá pular ela.

## Evitando desalinhamento de Stack com ROP de ret

- Ache o endereço de um `ret`.
  - Com ROPgadget: `ROPgadget`: `ROPgadget -- binary meu_programa | grep "ret"`
  - Ou com pwntools:

```py
from pwn import *

elf = ELF('./vuln')
rop = ROP(elf)

# Encontra endereço de gadget ret
ret_gadgets = rop.find_gadget(['ret'])
print(f"Ret gadget: {hex(ret_gadgets.address)}") # Imprime endereço do gadget
```

- No buffer overflow, coloque **padding + RET Gadget (endereço) + Função alvo (endereço)**:

```
[RBP-0x20] = AAAA...          (bytes de padding)
[RBP+0x00] = RBP antigo        (8 bytes) 
[RBP+0x08] = RET gadget        ← Colocar Gadget aqui. (RIP vai aqui primeiro)
[RBP+0x10] = Função alvo       ← Colocar função alvo aqui. (RIP vai aqui depois)
```
