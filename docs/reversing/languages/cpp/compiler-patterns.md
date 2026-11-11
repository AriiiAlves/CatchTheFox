---
title: "Padrões do compilador"
sidebar_position: 4
---

Além de classes e STL, o C++ tem recursos que geram código sem correspondência direta no fonte: exceções, templates, lambdas, construtores de globais. São o que mais confunde o decompilador. Esta página é um catálogo de como cada um aparece e de onde procurar o que interessa.

## Name mangling

Toda função C++ tem um nome codificado com namespace, classe, nome e tipos dos parâmetros (o retorno não entra, exceto em templates). GCC e Clang seguem a Itanium ABI:

| Símbolo | Decodificado | Como ler |
|---|---|---|
| `_Z3addii` | `add(int, int)` | `_Z` + tamanho e nome + tipos: `i` int, `l` long, `c` char, `b` bool, `v` void, `P` ponteiro, `R` referência, `K` const |
| `_ZN3Ex18get_var1Ev` | `Ex1::get_var1()` | `N...E` delimita o nome qualificado |
| `_ZN3Ex1C1Ev` / `C2Ev` | construtor | `C1` completo, `C2` base (idênticos sem herança virtual) |
| `_ZN3Ex1D1Ev` / `D0Ev` / `D2Ev` | destrutor | `D0` chama `delete` depois |
| `_ZNK3Ex13getEv` | `Ex1::get() const` | `K` depois de `N` = método const |
| `_Z3addIiET_S0_S0_` | `int add<int>(int, int)` | `I...E` = argumentos de template; `T_`, `S0_` = substituições |
| `_ZNSt7__cxx1112basic_stringIcSt11char_traitsIcESaIcEEC1EPKcRKS3_` | `std::string::string(const char*, const allocator&)` | `St` = `std::`, `Sa` = `allocator`, `Ss` = string antiga |
| `_ZTV4Nome`, `_ZTI4Nome`, `_ZTS4Nome` | vtable, typeinfo, nome da classe | `_ZTS` é uma **string legível** no binário |
| `_ZZ4mainE5count` | `main::count` | variável `static` local |
| `_GLOBAL__sub_I_main` | inicializador estático | roda antes da `main` |

```bash
echo _ZNK3Ex13getEv | c++filt
nm -C ./bin                       # tudo traduzido
objdump -d -C -M intel ./bin      # disassembly com nomes traduzidos
```

Ghidra e IDA traduzem automaticamente. Em binário stripped, só sobram os símbolos importados (`_Znwm`, `__cxa_throw`, métodos da libstdc++ não inlinados) e as strings `_ZTS`.

## Exceções

`throw` e `catch` não são saltos: usam tabelas de *unwinding* (`.eh_frame`, `.gcc_except_table`) interpretadas pela libgcc em tempo de execução.

```nasm
; throw std::runtime_error("bad")
mov    edi, 0x10
call   __cxa_allocate_exception        ; aloca o objeto da exceção
mov    rdi, rax ; ...
call   _ZNSt13runtime_errorC1EPKc      ; constrói
mov    edx, _ZNSt13runtime_errorD1Ev   ; destrutor
mov    esi, _ZTISt13runtime_error      ; typeinfo (qual tipo foi lançado)
mov    rdi, rbx
call   __cxa_throw                     ; nunca retorna
```

- **Onde está o `catch`**: no fim da função que o contém, em um bloco que nenhum `jmp` alcança. Começa com `call __cxa_begin_catch` e termina com `call __cxa_end_catch`. O Ghidra mostra esse código solto, às vezes como uma função separada ou "não alcançável"; o IDA o liga com setas tracejadas.
- O tipo capturado está na tabela (`.gcc_except_table`), não no código. Para saber qual `catch` pega qual `throw`, compare o `_ZTI` passado ao `__cxa_throw` com os da tabela, ou rode com `catch throw` no GDB.
- `noexcept` violado, `throw` sem `catch` e `std::terminate` imprimem `terminate called after throwing an instance of 'X'` e abortam: essa mensagem é o jeito mais rápido de saber **o tipo** de uma exceção não tratada.
- Desafios usam exceções para esconder o fluxo: a checagem "errada" lança, e o `catch` imprime "Wrong". O caminho certo é o que não lança.

## Templates

Cada combinação de tipos vira uma função distinta, com o tipo no nome. `std::vector<int>::push_back` e `std::vector<long>::push_back` são duas funções. Consequências:

- O binário fica grande e repetitivo. Identifique a lógica em **uma** instanciação e assuma que as outras são iguais.
- Código de template não inlinado da STL aparece como funções locais com nomes imensos. Dê nomes curtos no Ghidra (`vec_push`) e siga em frente.
- Uma função template do próprio desafio (`check<Key>`) com `T` como `int`, `long` e `char` indica que o mesmo algoritmo roda sobre tamanhos diferentes.

## Lambdas

Uma lambda é uma **classe anônima** com `operator()`. As capturas são os campos.

```cpp
int k = 3;
auto f = [k](int x) { return x * k; };
// gera: struct main::{lambda(int)#1} { int k; int operator()(int x) const; };
```

- Símbolo: `_ZZ4mainENKUliE_clEi` = `main::{lambda(int)#1}::operator()(int) const`.
- Sem capturas, a lambda é conversível para ponteiro de função e pode aparecer como uma função solta.
- Em `std::for_each`, `std::transform`, `std::sort` com lambda, o algoritmo está inlinado na instanciação do template e a lambda é uma função separada chamada no meio do loop.

## Inicialização de globais

Objetos globais com construtor (uma `std::string` global, um `std::map` com dados) são construídos **antes da `main`**, por funções `_GLOBAL__sub_I_xxx` registradas na `.init_array`. O Ghidra as lista; o GDB para nelas com `b _GLOBAL__sub_I_main` ou `starti` + `ni` até `__libc_start_main`.

Se um valor "aparece pronto" na `main` sem ninguém ter escrito, procure aqui. Flags montadas em um construtor global ou em um `static` local (reconhecível pelo par `__cxa_guard_acquire`/`__cxa_guard_release`) são comuns.

Destrutores de globais e `atexit` rodam depois da `main`, em `__run_exit_handlers`: outro lugar onde um desafio pode imprimir ou verificar algo.

## Otimizações que atrapalham

- **Inlining**: com `-O2`, métodos pequenos (getters, `operator[]`, `size()`) somem e viram acessos a offsets. Procure os offsets consistentes para reconstruir a struct.
- **Return value optimization**: funções que retornam objetos recebem um **ponteiro escondido** para onde construir o resultado, como primeiro argumento (`rdi`), antes mesmo do `this` (que vai para `rsi`). Um método que parece receber dois ponteiros e retornar `void` provavelmente retorna um objeto.
- **Devirtualização**: se o compilador sabe o tipo exato, a chamada virtual vira direta, mesmo com `virtual` no fonte.
- **Strings constantes**: `std::string s = "literal"` guarda o literal na `.rodata`, igual ao C. `std::string_view` é só `{ptr, size}`.
- **Tail calls** e **`switch` por tabela de saltos** aparecem como em C.

## Checklist de reversing em C++

1. `nm -C`/símbolos do Ghidra: liste classes e métodos. Sem símbolos, liste as strings `_ZTS` e as vtables.
2. Para cada classe: tamanho pelo `new`, campos pelos offsets no construtor, vtable pelo vptr escrito no construtor.
3. Reconstrua as structs no Ghidra e aplique nos parâmetros `this`.
4. Ache a entrada de dados (`cin >>`, `getline`, `read`) e a comparação (`compare`, `==`, `memcmp`).
5. Antes de ler o algoritmo, tente `ltrace -C` e um breakpoint na comparação.
6. Se há exceções, mapeie os `__cxa_throw` e os blocos `catch`: o fluxo real pode estar neles.

## Referências

- [Itanium C++ ABI](https://itanium-cxx-abi.github.io/cxx-abi/abi.html) - Mangling, vtables, exceções e layout usados por GCC e Clang.
- [C++ exception handling internals (Monoinfinito)](https://monoinfinito.wordpress.com/series/exception-handling-in-c/) - Como `throw`/`catch` funcionam por baixo.
- [Compiler Explorer](https://godbolt.org/) - Compile trechos de C++ e veja o assembly gerado, o jeito mais rápido de aprender um padrão novo.
