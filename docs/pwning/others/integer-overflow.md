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

## Exemplo

```c
int array[10];
int index;

printf("Índice: ");
scanf("%d", &index);

// Verificação contra overflow positivo
if(index < 10){
    // MAS e se index for NEGATIVO e GRANDE?
    int offset = index * sizeof(int);  // index muito negativo → overflow para positivo!
    printf("%d", array[offset]); // Acesso arbitrário a depois do array
}
```