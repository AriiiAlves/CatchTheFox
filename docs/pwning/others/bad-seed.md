---
title: "Bad Seed"
sidebar_position: 3
---

Uma "bad seed" é quando um gerador de números pseudoaleatórios (PRNG) é inicializado com uma semente previsível ou insuficientemente aleatória, permitindo que todos os números gerados possam ser previstos. 

Caso você não saiba, as funções que geram números aleatórios não são realmente aleatórias. Elas capturam dados aleatórios e transformam em números através de um algoritmo, como data e hora, temperatura do processador, etc. Se dermos um número inicial, uma "seed" ao pseudogerador, ele sempre irá gerar os mesmos números aleatórios em sequência. Se você descobrir a seed, você descobre todos os números gerados.

Exemplos de seeds:

```c
srand(getpid());  // Process ID tem apenas ~32k possibilidades
srand(12345); // Sempre a mesma sequência
srand(time(NULL)); // Previsível se o tempo for conhecido
```

O ataque consiste em descobrir a seed ou como ela é gerada. Com isso podemos prever tokens de sessão, quebrar chaves criptográficas derivadas de PRNGs fracos e até mesmo prever cartas/resultados de cassinos online.