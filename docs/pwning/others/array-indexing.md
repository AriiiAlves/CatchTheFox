---
title: "Array indexing"
sidebar_position: 1
---

Arrays são blocos de memórias sequenciais, onde podemos acessar um bloco por meio de um índice. 

A variável de um array sempre é um **ponteiro para o primeiro elemento**.

Quando fazemos um array de inteiros (cada inteiro, em geral, ocupa 4 bytes) `array[1]`, somamos +4 bytes ao endereço `array = 0x7ffd1234` (endereço de exemplo). `array[n] = 0x7ffd1234 + (n) * 0x4`. Isso funciona pois os índices do array estão juntos na memória.

```
int arr[10];  // Aloca 10 * sizeof(int) bytes na stack
// Exemplo: arr está em 0x7ffd1234
// arr[0] está em 0x7ffd1234
// arr[1] está em 0x7ffd1238 (int = 4 bytes)
// arr[2] está em 0x7ffd123c 
```

Isso também funciona com ponteiros.

```
int arr[5] = {0};
int *ptr = &arr[2];

// Índice negativo é válido para ponteiros!
ptr[-1] = 0xdeadbeef;  // Escreve em arr[1]
ptr[-2] = 0xdeadbeef;  // Escreve em arr[0]
```

Fique atento se o array é de `int`, `float`, etc, pois o tamanho de cada bloco se altera, e fazer array[1] pode pular 1, 2, 4, 8 ou 16 bytes na memória.

## Out-of-Bounds

Basicamente, acessar os índices de um array de inteiros é colocar um "gancho" em um endereço de memória e ir somando 4 bytes para chegar a cada índice, certo?

Porém, se acessarmos o índice -1, o programa irá ler: `array[-1] = 0x7ffd1234 + (-1) * 0x4 = 0x7ffd1230`. Estaremos acessando uma parte da memória que não tem nada a ver com o array, pois passamos do limite dele (de 0 a n-1). O C não verifica limites de array: o compilador só gera a conta `base + índice * tamanho`, e o processador acessa o que estiver lá. Se o programa imprime esse valor, temos um vazamento de informação (*information leak*).

Isso só pode ser explorado se pudermos manipular o índice do array:

```c
int main() {
    int arr[5] = {0};  // 5 elementos: índices 0-4
    int index;
    
    printf("Digite índice: ");
    scanf("%d", &index);
    
    printf("Valor: %d\n", arr[index]);  // VULNERÁVEL!
    
    return 0;
}
```

Lembre-se de que o array está no Stack Frame da função, assim como toda variável declarada. Assim, usando os índices, estamos navegando pela stack: índices negativos vão para endereços menores (outras variáveis locais, outros frames) e índices maiores que `n-1` vão para endereços maiores (Canary, `RBP` salvo, `return address`, argumentos...). Se o array for global (na `.bss`), navegamos pela `.bss`/`.data` e podemos alcançar a GOT, por exemplo.

Com `int` (4 bytes), `arr[index]` alcança o endereço `arr + 4 * index`. Para calcular o índice de um alvo: `index = (alvo - arr) / 4`. Ex: se `arr` está em `rbp-0x30` e o `return address` em `rbp+0x8`, o índice é `(0x30 + 0x8) / 4 = 14`.

> Nota: Nem sempre as variáveis ficam na stack na ordem em que foram declaradas. Otimizações/Paddings (alinhamento de stack) na compilação podem alterar essa ordem. Sempre verifique no GDB ou no Ghidra.

## Consequências do Out-of-Bounds

### Read (vazar endereços)

Podemos vazar endereços.

```c
int secret = 1337;
int arr[3] = {1, 2, 3}; // de arr[0] a arr[2]

// Acessando além do array
printf("%d\n", arr[3]);  // Obtemos o dado "secret"
```

### Write (escrever stack)

Podemos escrever na stack. Se tivermos controle do valor, podemos escrever o que quisermos na stack.

```c
int admin_flag = 0;
int arr[3] = {0};

arr[10] = 1;  // Pode sobrescrever admin_flag!
```

Se o programa deixa escolher **índice e valor** (`arr[index] = value`), isso é uma escrita quase arbitrária na stack (ou na `.bss`): dá para sobrescrever o `return address` com o endereço de uma função `win` sem nenhum Buffer Overflow, e sem tocar no Canary (pulamos por cima dele). Em 64 bits, um endereço de 8 bytes ocupa dois `int`s: escreva a metade baixa em `arr[i]` e a metade alta em `arr[i+1]`.

### Verificações incompletas

O erro de programação mais comum é verificar só um lado do limite:

```c
if (index < 10) {        // esquece de checar index < 0
    arr[index] = value;  // index = -5 passa!
}

if (index <= 10) {       // off-by-one: índices válidos vão de 0 a 9
    arr[index] = value;  // index = 10 passa e escreve logo depois do array
}
```

Outro clássico é a mistura de tipos: a verificação é feita com `int` (com sinal, então `-5 < 10` passa), mas o índice é usado em uma conta sem sinal ou como `size_t`, virando um número gigante. Veja [Integer Overflow](./integer-overflow.md).