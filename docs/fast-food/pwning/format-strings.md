---
title: "Format Strings"
sidebar_position: 4
unlisted: true
---
Exploração de printf ou sprintf que aceitam a entrada do usuário diretamente como string de formato (`%s`, `%x`, `%n`). Permite vazar endereço ou escrever GOT/variáveis.

## printf

Permite vazar TODA a pilha, pois imprime em sequência tudo que estiver após ESP/RSP antes de chamar `printf`.

1. Identifique se há `printf` onde o primeiro argumento é seu input
2. Se houver, você pode usar format strings como input: `%x %x %x %x`
   1. `%x` - Mostra conteúdo do bloco de memória em hexadecimal. Se o conteúdo for um endereço, vai imprimir.
   2. `%s` - Imprime caracteres em vários blocos de memória até encontrar `\0`. Lê o valor no endereço de memória que foi passado ao %s.
   3. `%n` - Escreve no endereço o número de bytes impressos até agora. (`printf("Hello%n", &count);` => count = 5 no final)
   4. `%p` - Retorna a mesma coisa do `%x`, mas com `0x` na frente
3. Útil: parâmetro arbitrário -> `printf("%6$x);` imprime o 6º parâmetro (Ex: Sabemos que Canary está lá)