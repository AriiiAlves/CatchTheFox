---
title: "Engenharia Reversa de C++"
---

Binários escritos em C++ são mais difíceis de ler do que os de C: o compilador gera código "extra" para recursos como classes, herança, métodos virtuais, templates e exceções, e os nomes das funções aparecem codificados (*name mangling*). Por baixo, continua sendo C: classes são structs, métodos são funções com um argumento a mais e a STL é só código compilado junto.

Nesta seção, vemos como esses recursos aparecem no assembly, para reconhecê-los no Ghidra, IDA ou GDB.

Pré-requisitos: [Assembly](../../../introduction/assembly/index.mdx) e [Stack em Assembly](../../../introduction/assembly/stack.mdx).

## Como reconhecer um binário de C++

- `ldd ./bin` lista `libstdc++.so.6` (GCC/Clang) ou `msvcp140.dll` (MSVC).
- `strings` mostra `GLIBCXX_3.4.x`, `CXXABI_1.3`, `std::`, `basic_string`, "terminate called after throwing".
- Símbolos começando com `_Z` (`nm ./bin | grep _Z`), funções `__cxa_*` e `_Znwm`/`_ZdlPv` (`operator new`/`delete`).
- Mesmo stripped, as strings de `typeinfo` (`_ZTS4Nome` guarda o nome da classe em texto) e as mensagens da libstdc++ sobrevivem.

## Páginas

| Página | Assunto |
|---|---|
| [Classes e Objetos](./classes.mdx) | Layout do objeto, ponteiro `this`, `new`/`delete`, name mangling |
| [Herança e Vtables](./vtables.mdx) | Métodos virtuais, chamadas indiretas, como achar a função chamada |
| [STL na memória](./stl.mdx) | `std::string`, `std::vector`, `std::map` e como ler cada um no GDB |
| [Padrões do compilador](./compiler-patterns.md) | Exceções, templates, lambdas, inicialização de globais, otimizações |

## Fluxo de trabalho sugerido

1. `nm -C` ou o painel de símbolos do Ghidra: a lista de classes e métodos (já traduzida) é um mapa do programa.
2. Ache os construtores (`Classe::Classe`) e o `operator new` que os antecede: isso dá o **tamanho** de cada objeto.
3. Crie a struct de cada classe no Ghidra e aplique ao `this`. O decompilado passa de `*(int *)(param_1 + 8)` para `this->campo`.
4. Para a checagem de flag, procure `std::string::compare`, `operator==` de `std::string`, `memcmp`, ou um `std::equal`. `ltrace -C ./bin` lista essas chamadas com argumentos sem precisar de GDB.
