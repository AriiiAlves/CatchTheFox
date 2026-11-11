---
title: Malloc Maleficarum
---

Em 2001, dois papers foram publicados na mesma revista [Phrack](https://phrack.org): [Vudo malloc tricks](https://phrack.org/issues/57/8) e [Once upon a free()](https://phrack.org/issues/57/9). Phrack é uma revista eletrônica criada por e para hackers, e documentou muitas inovações, como buffer overflows (como [Smashing The Stack For Fun And Profit](https://phrack.org/issues/49/14)), ROP e heap exploitation.

Por volta de 2005, a glibc foi aprimorada e tornou alguns ataques obsoletos. Nesse contexto, o próximo paper de heap exploitation a obter sucesso foi [The Malloc Maleficarum](https://seclists.org/bugtraq/2005/Oct/118), um artigo seminal escrito por 'Phantasmal Phantasmagoria' que sistematizou 5 técnicas avançadas de exploração de heap na glibc. O nome é latim para "Malloc Maligno" e é uma referência ao "Malleus Maleficarum" (Martelo das Bruxas). Em 2009, o usuário blackngel publicou [Malloc Des-Maleficarum](https://phrack.org/issues/66/10), com implementações práticas de todas as técnicas.

The Malloc Maleficarum possui uma coleção de técnicas nomeadas com _House_:

| Técnica | Ideia | Hoje |
|---|---|---|
| [The House of Prime](./house-of-prime.mdx) | Dois `free` com `size` controlado trocam a arena por uma falsa | Morta (glibc 2.3.x) |
| [The House of Mind](./house-of-mind.mdx) | Bit `A` ligado faz o `free` usar uma arena forjada | Variante fastbin ainda funciona |
| [The House of Force](./house-of-force.mdx) | `size` do top chunk gigante → `malloc` em qualquer endereço | Morta na 2.29 |
| [The House of Lore](./house-of-lore.mdx) | `bk` corrompido na small bin → `malloc` devolve chunk falso | Funciona (com ajustes para o tcache) |
| [The House of Spirit](./house-of-spirit.mdx) | `free` em um chunk falso → `malloc` devolve o chunk falso | Funciona em todas as versões |
| The House of Chaos | Não é uma técnica: é a conclusão do paper, sobre o que ainda estava por vir | |

Para manter a tradição, os heap exploits modernos possuem o nome _House_ na frente. Alguns dos mais citados:

| House | Ano | Ideia |
|---|---|---|
| House of Einherjar | 2016 | Off-by-null no `size` + `prev_size` falso → consolidação para trás e chunks sobrepostos |
| House of Orange | 2016 | Sem `free`: encolher o top chunk para ele ir à unsorted bin; depois FSOP via `_IO_list_all` |
| House of Roman | 2018 | Fastbin dup + partial overwrite, sem leak (brute force de 12 bits) |
| House of Botcake | 2019 | Double free entre tcache e unsorted bin, contornando a tcache key |
| House of Husk | 2020 | Tabelas de especificadores customizados do `printf` como alvo |
| House of Kiwi / Emma / Apple | 2021 a 2022 | FSOP moderno: `__malloc_assert`, `_IO_cookie_jumps`, `_IO_wfile_jumps` |
| House of Banana | 2022 | `link_map` falso em `_rtld_global` → `_dl_fini` chama o que você quiser |
| House of Tangerine | 2023 | House of Orange adaptado ao tcache |
| House of Water | 2024 | Controle do tcache sem leak |

A [Checklist de Pwning](../../checklist.mdx#houses) acompanha quais delas já têm página aqui.