---
title: "Buffer Overflow - Variáveis"
sidebar_position: 1
---

Sobrescrevemos a Stack. Podemos sobrescrever variáveis ou o `return address`.


1. Identifique se é possível fazer BOF
2. Verifique se a variável que queremos sobrescrever está **entre a variável do input e o `rbp` na stack**
3. Se estiver, podemos sobrescrever. **Calcule a distância para chegar no início da variável desejada, e sobrescreva com caracteres quaisquer**.
   1. Basicamente, teremos nosso input como `rbp-0x10`, por exemplo, e a outra variável em `rbp-0x5`. Isso quer dizer que a distância entre eles é `0x10 - 0x5 = 0xb = 11`. Ou seja, para chegarmos no **início** de `rbp-0x5`, precisamos sobrescrever a stack com 11 bytes quaisquer.
   2. Geralmente, usamos caracteres, pois cada caractere = 1 byte e fica fácil de contabilizar.
4. Ao final da string, **coloque o que você deseja que seja sobrescrito na variável**.
