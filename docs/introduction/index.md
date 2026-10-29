---
title: "Introdução"
---

Pwning e engenharia reversa andam juntos. Engenharia reversa é o ato de abrir arquivos binários e dissecá-los, de modo a entender como eles funcionam. Isto nos permite aprender muitas coisas sobre como os programas realmente funcionam por trás dos panos, além de entender as vulnerabilidades associadas a isto (o que é o mais divertido, convenhamos).

Pwning é uma gíria que vem da escrita errada da palavra "owning", que significa "possuindo". As letras _o_ e _p_ estão próximas no teclado, e daí vem a palavra "pwning". Pwning é o uso de técnicas de baixo nível, que veremos aqui, para "possuir" um sistema ou obter o controle do programa. Usamos engenharia reversa para abrir e entender o arquivo e técnicas de pwning para explorar suas vulnerabilidades.

Engenharia Reversa é muito prática mas exige um conhecimento robusto, pois você estará lidando com arquivos binários. Qualquer bit a mais ou a menos poderá facilmente causar problemas. Além disso, você precisa entender como os programas funcionam por debaixo dos panos e como podemos trabalhar com vulnerabilidades em baixo nível na execução de programas.

Para isso, você será apresentado ao Assembly, linguagem que nos permite entender binários, e ferramentas indispensáveis como debuggers, decompiladores e o pwntools. É recomendado que você tenha uma máquina virtual de Linux ou um SO de Linux em seu computador, pois será o sistema operacional utilizado aqui para rodar, entender e analisar binários.

## Ordem sugerida

1. [Assembly](./assembly/index.mdx) - Registradores, flags e instruções básicas.
2. [Stack em Assembly](./assembly/stack.mdx) - Como as funções usam a memória.
3. [Análise prática de Assembly](./assembly/analise-pratica.mdx) - Lendo binários de verdade.
4. [Endianness](./endianness.mdx) - A ordem dos bytes na memória.
5. Ferramentas: [Ghidra](./ghidra.md) (ou [IDA](./ida-pro.mdx)) para análise estática, [GDB](./gdb.md) para análise dinâmica e [Pwntools](./pwntools.md) para automatizar a interação com o programa.

Boa sorte!

## Referências

- [Pwn - Wikipedia](https://en.wikipedia.org/wiki/Pwn) - Origem do termo.
- [Nightmare](https://guyinatuxedo.github.io/) - Curso de engenharia reversa e pwning em que a ordem dos tópicos deste guia é baseada.