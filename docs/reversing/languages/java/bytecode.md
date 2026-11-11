---
title: "Decompilando e lendo bytecode"
sidebar_position: 1
---

Na maior parte dos casos, um decompilador devolve Java legível e a leitura do bytecode nem é necessária. Mas decompiladores falham em código ofuscado, em construções que não existem em Java (bytecode escrito à mão) e em versões muito novas. Aí é preciso ler o `javap`.

## Ferramentas

| Tarefa | Ferramenta | Observação |
|---|---|---|
| Decompilar e navegar | [JD-GUI](http://java-decompiler.github.io/) | Visual, rápido, bom para olhar; falha em código moderno |
| Decompilar em lote | [CFR](https://www.benf.org/other/cfr/) | `java -jar cfr.jar app.jar --outputdir src`. O mais robusto para Java novo e ofuscado |
| IDE | IntelliJ IDEA | Abra o `.jar` como biblioteca ou arraste um `.class`: usa o Fernflower, e permite debugar |
| Decompilar **e editar** | [Recaf](https://github.com/Col-E/Recaf) | Edita Java ou bytecode e salva o `.jar`. A ferramenta de patch |
| Bytecode cru | `javap -c -p -v` | Vem com o JDK. `-c` desmonta, `-p` inclui privados, `-v` mostra o constant pool |
| Montar/desmontar | [Krakatau](https://github.com/Storyyeller/Krakatau) | Desmonta para um assembly textual e remonta: patches cirúrgicos e classes que nenhum decompilador aceita |
| Debug | `jdb`, IntelliJ | Breakpoints por classe/método, `print` de variáveis, sem precisar do fonte |

Ordem prática: IntelliJ ou JD-GUI para ler; CFR quando um método falhar; `javap` quando o CFR falhar; Recaf para alterar.

## Estrutura de um `.class`

```
magic 0xCAFEBABE
minor, major version          (61 = Java 17)
constant pool                 strings, nomes, tipos, números, referências a classes/métodos
access flags, this, super
interfaces
fields                        nome, tipo, flags, valor constante
methods                       nome, descritor, flags, atributo Code (o bytecode)
attributes                    SourceFile, LineNumberTable, BootstrapMethods (invokedynamic)...
```

O **constant pool** é onde moram as strings literais e os números grandes. `javap -v Main.class` lista tudo; `strings Main.class` também pega as strings (UTF-8 "modificado": `\0` vira `C0 80`). Em código ofuscado, é a primeira coisa a olhar: strings que não parecem texto são strings cifradas.

**Descritores** codificam tipos: `I` int, `J` long, `Z` boolean, `B` byte, `C` char, `[B` byte[], `Ljava/lang/String;` objeto, `(I[B)Ljava/lang/String;` = método `String f(int, byte[])`.

## A máquina de pilha

A JVM não tem registradores. Cada método tem um **array de variáveis locais** (slots numerados; em métodos de instância o slot 0 é `this`, os seguintes são os parâmetros) e uma **pilha de operandos**. As instruções empilham, operam no topo e desempilham.

```java
public boolean check(String s) {
    return s.length() == 8 && s.charAt(0) == 'f';
}
```

```
 0: aload_1                   // empilha s (slot 1; slot 0 é this)
 1: invokevirtual #7          // String.length()  → consome s, empilha int
 4: bipush        8           // empilha 8
 6: if_icmpne     22          // desempilha dois ints; se diferentes, pula para 22
 9: aload_1
10: iconst_0
11: invokevirtual #13         // String.charAt(int) → char
14: bipush        102         // 'f'
16: if_icmpne     22
19: iconst_1                  // true
20: ireturn
22: iconst_0                  // false
23: ireturn
```

### Instruções que importam

| Família | Exemplos | O que fazem |
|---|---|---|
| Constantes | `iconst_0`..`iconst_5`, `bipush 42`, `sipush 1000`, `ldc #n` | Empilham um valor (`ldc` pega do constant pool: strings, ints, floats, classes) |
| Locais | `iload_1`, `aload 4`, `istore_2`, `astore 5` | Pilha ↔ slot. Prefixo: `i` int, `l` long, `f`/`d` float/double, `a` referência |
| Arrays | `newarray int`, `iaload`, `baload`, `bastore`, `arraylength` | `xaload` empilha `arr[i]` (consome `arr`, `i`); `b` serve para byte e boolean |
| Aritmética | `iadd`, `isub`, `imul`, `idiv`, `irem`, `ineg`, `iinc 1, 1` | `irem` é `%`; `iinc slot, n` incrementa um local sem passar pela pilha (loops) |
| Bits | `iand`, `ior`, `ixor`, `ishl`, `ishr`, `iushr` | `ishr` com sinal, `iushr` sem (`>>>`) |
| Conversão | `i2b`, `i2c`, `i2l`, `l2i` | `i2b` trunca para byte com sinal: aparece depois de cada XOR em byte[] |
| Comparação e salto | `if_icmpeq/ne/lt/ge/gt/le`, `ifeq/ifne/iflt...`, `if_acmpeq`, `ifnull`, `goto` | `if_icmp*` compara dois ints da pilha; `if*` compara o topo com zero (`ifeq` = "se false") |
| `switch` | `tableswitch`, `lookupswitch` | Tabela de saltos |
| Objetos | `new`, `dup`, `getfield`, `putfield`, `getstatic`, `putstatic`, `checkcast`, `instanceof` | `new` + `dup` + `invokespecial <init>` é `new X()`. `getstatic System.out` precede um `println` |
| Chamadas | `invokevirtual`, `invokestatic`, `invokespecial`, `invokeinterface`, `invokedynamic` | Argumentos saem da pilha (e `this` por baixo deles), resultado volta para ela. `invokespecial` = construtores, `super`, privados |
| Retorno | `ireturn`, `areturn`, `return` | |
| Exceções | `athrow`, tabela `Exception table` no fim do método | O `catch` é um offset na tabela, não uma instrução |

`invokedynamic` (Java ≥ 7) resolve o alvo em tempo de execução por um *bootstrap method*. No código normal aparece em lambdas (`LambdaMetafactory`) e em concatenação de strings (`StringConcatFactory.makeConcatWithConstants`, Java ≥ 9). Ofuscadores usam para esconder todas as chamadas.

### Lendo um loop típico de CTF

```
 0: iconst_0        istore_2              // i = 0
 2: iload_2         aload_1  arraylength  if_icmpge 25   // while (i < input.length)
 9: aload_1  iload_2  aload_1  iload_2  baload           // input[i]
16: bipush 42  ixor  i2b  bastore                        // input[i] = (byte)(input[i] ^ 42)
21: iinc 2, 1       goto 2
25: aload_1  getstatic Main.SECRET  invokestatic Arrays.equals  ireturn
```

Isso é `for (i...) input[i] ^= 42; return Arrays.equals(input, SECRET);`. A flag é `SECRET[i] ^ 42`, e `SECRET` está no `<clinit>` (inicializador estático da classe) ou no constant pool.

## Onde as coisas ficam

- **`<clinit>`**: inicializador estático. Arrays `static final byte[] KEY = {...}` são preenchidos aqui, elemento por elemento (`dup, iconst_n, bipush v, bastore`). É longo e chato de ler no bytecode; o decompilador reconstrói o array.
- **`<init>`**: construtor.
- **Campos `static final` primitivos ou `String`** vão como atributo `ConstantValue` do campo, visíveis em `javap -v` sem precisar do `<clinit>`.
- **Recursos** (`getResourceAsStream("/key.bin")`): arquivos dentro do `.jar`, no mesmo caminho.
- **Nomes de locais** só existem se compilado com `-g` (atributo `LocalVariableTable`); sem ele, o decompilador inventa `var1`, `var2`.

## Patch

Com o Recaf: abra o `.jar`, vá ao método, mude o Java e salve (ele recompila), ou edite o bytecode direto na aba de assembly. Patches comuns: trocar `if_icmpne` por `if_icmpeq` (inverte a checagem), trocar `ifeq` por `goto`, inserir `getstatic System.out` + `swap` + `invokevirtual println` depois do valor esperado ser calculado.

Com o Krakatau: `krak2 dis --out out/ app.jar`, edite o `.j`, `krak2 asm --out patched/ out/Main.j`, e substitua a classe no `.jar` (`zip -u app.jar Main.class`, respeitando o caminho do pacote). Se o `.jar` for assinado (`META-INF/*.SF`, `*.RSA`), apague as assinaturas ou a JVM rejeita a classe alterada.

## Referências

- [JVM Specification - Instruction Set](https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-6.html) - Referência completa das instruções.
- [javap (Oracle)](https://docs.oracle.com/en/java/javase/17/docs/specs/man/javap.html) - Opções do desmontador oficial.
- [Krakatau](https://github.com/Storyyeller/Krakatau) - Assembler/disassembler de bytecode, com a sintaxe usada nos arquivos `.j`.
