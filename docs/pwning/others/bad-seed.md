---
title: "Bad Seed"
sidebar_position: 3
---

Uma "bad seed" é quando um gerador de números pseudoaleatórios (PRNG) é inicializado com uma semente previsível ou insuficientemente aleatória, permitindo que todos os números gerados possam ser previstos. 

Caso você não saiba, as funções que geram números aleatórios não são realmente aleatórias. Elas capturam dados aleatórios e transformam em números através de um algoritmo, como data e hora, temperatura do processador, etc. Se dermos um número inicial, uma "seed" ao pseudogerador, ele sempre irá gerar os mesmos números aleatórios em sequência. Se você descobrir a seed, você descobre todos os números gerados.

Exemplos de seeds:

```c
srand(getpid());   // Process ID: poucas possibilidades (32768 por padrão, até ~4 milhões em sistemas 64 bits)
srand(12345);      // Sempre a mesma sequência
srand(time(NULL)); // Previsível: é o horário atual em segundos, igual no cliente e no servidor
rand();            // Sem srand() nenhum: a seed é sempre 1, e a sequência é sempre a mesma
```

O ataque consiste em descobrir a seed ou como ela é gerada. Com isso podemos prever tokens de sessão, quebrar chaves criptográficas derivadas de PRNGs fracos e até mesmo prever cartas/resultados de cassinos online.

## Na prática (CTF)

O cenário clássico: o programa faz `srand(time(NULL))` e pede para você adivinhar `N` números gerados por `rand()`. Como o `rand()` da glibc é determinístico para uma dada seed, basta rodar o **mesmo** gerador com a **mesma** seed. O jeito mais simples é chamar a própria libc pelo Python, com `ctypes`:

```py
from pwn import *
from ctypes import CDLL
import time

libc = CDLL("libc.so.6")           # a libc da sua máquina (o rand() da glibc é igual em todas as versões)
p = process("./jogo")              # ou remote(...)

libc.srand(int(time.time()))       # mesma seed que o servidor (se o relógio estiver sincronizado)
for _ in range(10):
    p.sendline(str(libc.rand()).encode())   # os mesmos números que o programa vai gerar

p.interactive()
```

Detalhes que costumam aparecer:

- Se o programa faz `rand() % 100`, faça o mesmo módulo.
- Se o tempo de rede atrasar e a seed ficar 1 segundo diferente, rode de novo (ou tente `time.time() ± 1`).
- Se a seed é um valor pequeno (PID, um `short`, um número de 0 a 65535), faça **força bruta**: para cada seed possível, gere os primeiros números e compare com os que o programa já mostrou.
- Se não há `srand()`, a seed é `1`: `libc.srand(1)` e pronto.
- Em binários **estáticos** ou com outro gerador (ex: `random()` do Python, Mersenne Twister), use o mesmo algoritmo. Para o Mersenne Twister, com 624 saídas de 32 bits consecutivas é possível reconstruir o estado inteiro e prever tudo, sem saber a seed (ferramentas como `randcrack` fazem isso).

Para identificar o padrão no binário: procure chamadas a `srand`/`time`/`rand` no Ghidra (ou `strings`/`objdump -T | grep rand`).