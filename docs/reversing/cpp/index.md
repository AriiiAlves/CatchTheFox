---
title: "Engenharia Reversa de C++"
unlisted: true
---

Binários escritos em C++ são mais difíceis de ler do que os de C: o compilador gera código "extra" para recursos como classes, herança, métodos virtuais, templates e exceções, e os nomes das funções aparecem codificados (*name mangling*).

Nesta seção, vemos como esses recursos aparecem no assembly, para reconhecê-los no Ghidra, IDA ou GDB.

Pré-requisitos: [Assembly](../../introduction/assembly/index.mdx) e [Stack em Assembly](../../introduction/assembly/stack.mdx).
