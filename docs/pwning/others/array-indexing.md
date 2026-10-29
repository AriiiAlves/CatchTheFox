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

Porém, se acessarmos o índice -1, o compilador irá ler: `array[-1] = 0x7ffd1234 (-1) * 0x4`. Estaremos acessando uma parte da memória que não tem nada a ver com o array, pois passamos do limite dele (de 0 a n). É um vazamento de memória (memory leak).

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

Lembre-se de que o array está no Stack Frame da função, assim como toda variável declarada. Assim, usando os índices, estamos navegando pela stack.

> Nota: Nem sempre as variáveis ficam na stack na ordem em que foram declaradas. Otimizações/Paddings (alinhamento de stack) na compilação podem alterar essa ordem. Sempre verifique.

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