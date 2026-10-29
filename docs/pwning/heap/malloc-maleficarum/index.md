---
title: Malloc Maleficarum
---

Em 2001, dois papers foram publicados na mesma revista [Phrack](https://phrack.org): [Vudo malloc tricks](https://phrack.org/issues/57/8) e [Once upon a free()](https://phrack.org/issues/57/9). Phrack é uma revista eletrônica criada por e para hackers, e documentou muitas inovações, como buffer overflows (como [Smashing The Stack For Fun And Profit](https://phrack.org/issues/49/14)), ROP e heap exploitation.

Por volta de 2005, a glibc foi aprimorada e tornou alguns ataques obsoletos. Nesse contexto, o próximo paper de heap exploitation a obter sucesso foi [The Malloc Maleficarum](https://seclists.org/bugtraq/2005/Oct/118), um artigo seminal escrito por 'Phantasmal Phantasmagoria' que sistematizou 5 técnicas avançadas de exploração de heap na glibc. O nome é latim para "Malloc Maligno" e é uma referência ao "Malleus Maleficarum" (Martelo das Bruxas). Em 2009, o usuário blackngel publicou [Malloc Des-Maleficarum](https://phrack.org/issues/66/10), com implementações práticas de todas as técnicas.

The Malloc Maleficarum possui uma coleção de técnicas nomeadas com _House_:

- The House of Prime
- The House of Mind
- The House of Force
- The House of Lore
- The House of Spirit
- The House of Chaos

Para manter a tradição, os heap exploits modernos possuem o nome _House_ na frente.