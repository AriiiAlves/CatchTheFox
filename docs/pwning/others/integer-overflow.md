---
title: "Integer Overflow"
sidebar_position: 2
---

Cada variável possui um tamanho limite no código. Um inteiro, em geral, suporta 4 bytes, com range de `-2,147,483,648 a 2,147,483,647.`

Se for `unsigned int` (sem negativos), temos um range de `0 a 4,294,967,295`.

Se somarmos 1 a um número máximo, temos um overflow:

```c
int a = 2147483647; // Inteiro com valor máximo
    printf("%d\n", a); // 2147483647
    
    a += 1;
    printf("%d", a); // -2147483648
```

Isso mostra que, se uma variável tiver seu tamanho máximo atingido, ela simplesmente volta "do outro lado", como se tivesse passado por um portal.

Do mesmo modo, podemos ter um underflow:

```c
int a = -2147483648; // Inteiro com valor mínimo
    printf("%d\n", a); // -2147483648
    
    a -= 1;
    printf("%d", a); // 2147483647
```

Por que isso acontece? Vamos ver como as coisas estão armazenadas na memória (lembrando, 8 bits = 1 byte):

```
2147483647 decimal = 0x7FFFFFFF em hex = binário:
0111 1111 1111 1111 1111 1111 1111 1111
↑
Bit de sinal (0 = positivo)
```

Ao somar 1:

```
Antes:  0111 1111 1111 1111 1111 1111 1111 1111  = 2147483647
Somar 1: 1000 0000 0000 0000 0000 0000 0000 0000  = -2147483648
```

Em C, o overflow de inteiros **sem sinal** (`unsigned`) é bem definido e sempre dá a volta. O overflow de inteiros **com sinal** (`int`) é, tecnicamente, comportamento indefinido, mas na prática os compiladores geram a mesma instrução `add` e o resultado dá a volta do mesmo jeito (a diferença é que o compilador pode assumir que isso "nunca acontece" ao otimizar).

## Onde isso vira vulnerabilidade

### Conversão entre signed e unsigned

O caso mais comum em CTFs. Um número negativo passa em uma verificação feita com `int`, mas vira um número gigante quando usado como `size_t` (sem sinal):

```c
char buffer[64];
int size;

scanf("%d", &size);

if (size > 64) {              // -1 > 64? Não. Passa na verificação!
    puts("Muito grande");
    return;
}

read(0, buffer, size);        // read espera size_t: -1 vira 0xffffffffffffffff
                              // Lê o quanto mandarmos: Buffer Overflow!
```

O mesmo acontece com `memcpy`, `strncpy`, `malloc`, índices de array, etc. Sempre que vir uma verificação `if (x > LIMITE)` sem o `x < 0`, teste um número negativo.

### Overflow em contas de tamanho

```c
unsigned int count;
scanf("%u", &count);

unsigned int total = count * 4;     // count = 0x40000001 → 0x40000001 * 4 = 0x1_0000_0004
if (total > 1024) {                 // truncado para 32 bits = 4. Passa!
    return;
}
int *buf = malloc(total);           // malloc(4)
for (int i = 0; i < count; i++)     // ...mas o loop roda 0x40000001 vezes
    buf[i] = getchar();             // Heap Overflow
```

(Em 64 bits, cuidado ao reproduzir: `count * sizeof(int)` seria calculado em 64 bits, sem truncar. O truncamento acontece quando o resultado é guardado em uma variável de 32 bits ou quando os dois operandos são de 32 bits.)

### Comparação de tamanhos com soma

```c
unsigned int len;
scanf("%u", &len);
if (len + 1 > 64) return;    // len = 0xffffffff → len + 1 = 0. Passa!
char buf[64];
read(0, buf, len);           // read(0, buf, 0xffffffff)
```

### Como identificar no binário

No assembly, a dica é o tipo do jump depois do `cmp`: `jg`/`jl`/`jge`/`jle` comparam **com sinal**, e `ja`/`jb`/`jae`/`jbe` comparam **sem sinal** (veja [Assembly](../../introduction/assembly/index.mdx#jnzjz-jump-if-not-zerojump-if-zero)). Uma verificação de tamanho feita com `jle` seguida de um `read`/`memcpy` é quase sempre explorável com um número negativo. No Ghidra, procure por casts como `(ulong)` ou `(uint)` perto de verificações, e por variáveis `int` sendo passadas para funções que esperam `size_t`.

Para testar: envie `-1`, `2147483648` (`0x80000000`), `4294967295` (`0xffffffff`) e veja o que acontece.