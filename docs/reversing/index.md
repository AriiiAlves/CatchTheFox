---
title: "Engenharia Reversa"
---

Engenharia reversa é entender o que um programa faz sem ter o código-fonte. Em CTF, isso quase sempre significa encontrar a lógica que valida um input (a flag) e invertê-la, ou descobrir o que o programa esconde. A base (assembly, GDB, Ghidra) está na [Introdução a Pwn/Rev](../introduction/index.md); esta seção trata do que vem depois: como cada **linguagem** aparece no binário, como atacar cada uma, e as **ferramentas** do ofício.

## Método

1. **Identifique o tipo do arquivo**: `file arquivo`. ELF, PE, `.class`/`.jar`, `.apk`, `.pyc`, script. Isso define a ferramenta.
2. **Descubra a linguagem**: `strings -n 8 arquivo | less`. Nomes de bibliotecas (`libstdc++`, `GLIBCXX`), mensagens do runtime (`rustc`, `Go build ID`, `java/lang`), e os próprios símbolos entregam a linguagem e, muitas vezes, a versão do compilador.
3. **Comece pelo fim**: ache a string de sucesso ("Correct!", "flag\{") e siga as referências (XREF) até a comparação com o seu input. A função que decide é quase sempre pequena.
4. **Copie a lógica, não entenda tudo**: reimplemente a checagem em Python e inverta. Se for um sistema de equações (vários bytes misturados), use [Z3](../pwning/others/z3.md). Se for pesado demais, aplique **patch** e deixe o programa imprimir o esperado.
5. **Dinâmico ganha de estático**: `ltrace`/`strace` e um breakpoint na comparação (`strcmp`, `memcmp`, `std::string::compare`, `String.equals`) mostram o valor esperado sem ler o algoritmo.

## Seções

- [Linguagens](./languages/cpp/index.md): como C++ e Java aparecem no binário e como atacar cada um.
- [Ferramentas](./tools/index.md): o que cada ferramenta faz, quando usar e tutoriais de uso (DIE, x64dbg, Scylla, PE-bear, dnSpy, Frida...).

## Por linguagem

| Sinal no binário | Linguagem | Onde ler |
|---|---|---|
| Símbolos `_ZN...`, `GLIBCXX`, `std::cout`, `__cxa_throw` | C++ | [C++](./languages/cpp/index.md) |
| `.class`, `.jar`, `java/lang/String`, `META-INF/` | Java | [Java](./languages/java/index.md) |
| `.apk`, `classes.dex`, `AndroidManifest.xml` | Android (Java/Kotlin) | [Android](./languages/java/android.md) |
| `Go build ID`, `runtime.main`, funções `main.xxx` | Go | Ghidra com o plugin de Go recupera nomes e strings; estático e enorme por padrão |
| `rustc`, `core::panicking`, `alloc::` | Rust | Mangling `_R`/`_ZN` (`rustfilt`); strings sem `\0`, fatiadas por tamanho |
| `.pyc`, `PyInstaller`, `_MEIPASS` | Python | `pyinstxtractor` para extrair, `pycdc`/`decompyle3` para decompilar |
| `mscoree.dll`, `System.`, `.NET` | C# | `dnSpy`/`ILSpy` decompilam e permitem editar |

## Referências

- [Nightmare](https://guyinatuxedo.github.io/) - Capítulos de reversing com desafios resolvidos.
- [Reverse Engineering for Beginners (Dennis Yurichev)](https://beginners.re/) - O livro de referência, gratuito, com capítulos sobre C++ e Java.
