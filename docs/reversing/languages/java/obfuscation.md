---
title: "Ofuscação e código nativo"
sidebar_position: 2
---

Como o bytecode é fácil de decompilar, desafios de Java que querem dificultar usam **ofuscação**: renomeiam tudo, cifram strings, escondem chamadas atrás de reflexão ou `invokedynamic`, embaralham o fluxo de controle, ou movem a lógica para código nativo. O princípio para lidar com todas elas é o mesmo: **não desfaça à mão o que a JVM vai desfazer sozinha em tempo de execução**.

## Renomeação (ProGuard, R8, yGuard)

Classes, métodos e campos viram `a`, `b`, `c`, `aa`... ou nomes impossíveis (`\u0001`, palavras reservadas, nomes iguais com assinaturas diferentes).

- A **estrutura** não muda: herança, chamadas, tipos. E a API do Java **não pode ser renomeada**: `javax.crypto.Cipher`, `java.util.Base64`, `MessageDigest`, `System.in`, `String.equals` continuam com nome. Siga essas chamadas.
- Renomeie você mesmo conforme entende (`a` → `decrypt`): Recaf e IntelliJ fazem *rename* consistente em todo o projeto.
- Nomes que quebram o decompilador (unicode, reservados): CFR tem `--renameillegalidents true`; Recaf tem um *mapping* automático para nomes ilegais.
- Se o `.jar` vier com `mapping.txt`/`proguard.map` (às vezes esquecido dentro do pacote), o ProGuard `retrace` reverte os nomes.

## Strings cifradas

Cada literal vira uma chamada: `a.b("ãñ\u0012...")` ou `Strings.get(17)`. O método decifrador é pequeno (XOR com chave, `StringBuilder` ao contrário, `Base64` + algo), e aparece **em todo lugar**.

Três jeitos, do mais lento para o mais rápido:

1. Entender o decifrador e portar para Python. Funciona para XOR simples.
2. **Chamar o decifrador**: ele é um método estático público (ou acessível por reflexão). Escreva uma classe de teste no mesmo classpath e imprima cada string. Ou, no Recaf, insira um `System.out.println` dentro do próprio decifrador e rode o programa.
3. **Debugger**: breakpoint no `return` do decifrador (`jdb`: `stop in a.b`; depois `step up` e `print` do retorno; IntelliJ mostra direto). Rode o programa e anote tudo o que for decifrado.

Para ofuscadores comerciais (Zelix KlassMaster, Allatori, Stringer) o decifrador usa o *stack trace* (nome da classe e método chamador) como parte da chave, então chamá-lo de fora devolve lixo: use o debugger ou um agente.

## Reflexão e `invokedynamic`

```java
Class.forName("java.lang.Runtime").getMethod("exec", String.class).invoke(rt, cmd);
```

A chamada some do grafo de referências, mas os nomes estão em strings (talvez cifradas). `grep` por `forName`, `getMethod`, `getDeclaredField`, `MethodHandles.lookup`. Em tempo de execução, um breakpoint em `java.lang.reflect.Method.invoke` mostra cada chamada com o alvo resolvido.

`invokedynamic` com *bootstrap* customizado (todo método do programa chamado via `indy`): o decompilador mostra `(Object)indy(...)`. Leia o bootstrap method (está em `javap -v`, atributo `BootstrapMethods`): ele recebe índices ou strings e devolve um `MethodHandle`. Normalmente é mais fácil interceptar: breakpoint no bootstrap e leitura do `MethodHandle` retornado, ou `-Djava.lang.invoke.MethodHandle.DUMP_CLASS_FILES=true`.

## Fluxo de controle

- **Opaque predicates**: `if (x * x >= 0)` sempre verdadeiro, com um ramo morto cheio de lixo. O decompilador preserva; ignore o ramo que nunca executa.
- **Flattening**: o método vira um `while(true) switch(state)`. Siga a variável de estado; cada `case` é um bloco básico do código original. Ferramentas como `java-deobfuscator` ou `threadtear` desfazem alguns padrões.
- **Exceções como `goto`**: `throw` dentro de `try` com `catch` que continua o fluxo. Leia a tabela de exceções no `javap`.
- **Bytecode inválido para Java** (mas válido para a JVM): `goto` para dentro de loops, `monitorenter` sem par, pilha não vazia em saltos. CFR mostra comentários `/* ... */`; Krakatau sempre desmonta.

Se um ofuscador conhecido foi usado, procure um deobfuscador específico antes de ler na mão: [java-deobfuscator](https://github.com/java-deobfuscator/deobfuscator) tem transformadores para Zelix, Allatori, Stringer, DashO e outros.

## Carregamento dinâmico de classes

O programa descriptografa um array de bytes e chama `ClassLoader.defineClass`, ou carrega um `.jar` de dentro de outro. A classe real nunca está no disco.

- Breakpoint em `java.lang.ClassLoader.defineClass` (ou `defineClass1`): o array `b` com `off`/`len` é o `.class`. Despeje para um arquivo com o IntelliJ (*Evaluate Expression* → `java.nio.file.Files.write(...)`).
- Ou um **Java agent** com `ClassFileTransformer` que grava toda classe carregada: `java -javaagent:dumper.jar -jar app.jar`. Existem prontos (`java-class-dumper`, módulo de dump do Recaf, que também se conecta a uma JVM viva e lista as classes carregadas).
- `-Xlog:class+load` (ou `-verbose:class`) mostra o nome e a origem de cada classe carregada, para saber o que procurar.

## JNI: código nativo

Métodos declarados `native` são implementados em uma biblioteca (`.so`, `.dll`, `.dylib`) que o programa extrai do `.jar` para um diretório temporário e carrega com `System.load`/`loadLibrary`. A lógica crítica (a checagem) muitas vezes está lá.

```bash
unzip -l app.jar | grep -E '\.(so|dll|dylib)$'
unzip app.jar lib/linux-x86-64/libcheck.so
nm -D libcheck.so | grep Java_          # ou JNI_OnLoad
```

- Símbolos seguem o padrão **`Java_pacote_Classe_metodo`** (`_` no nome vira `_1`, e sobrecargas ganham `__` + descritor). Se não houver símbolos `Java_`, o `JNI_OnLoad` registra os métodos com `RegisterNatives`: procure a tabela de `{nome, descritor, ponteiro}` passada a ele.
- Assinatura em C: `jtipo Java_X_m(JNIEnv *env, jobject this, args...)`. No Ghidra, os dois primeiros parâmetros são `JNIEnv *` e `jobject`; **aplique o tipo `JNIEnv *`** ao primeiro (o Ghidra tem a struct em `jni.h`, importe pelo *Data Type Manager* → *Parse C Source*) e as chamadas `(*env)->GetStringUTFChars(env, s, 0)` ficam legíveis em vez de `(**(code **)(*param_1 + 0x548))(...)`.
- As funções JNI mais vistas: `GetStringUTFChars`/`GetByteArrayElements` (lê o input), `NewStringUTF` (devolve string), `FindClass`/`GetMethodID`/`CallObjectMethod` (chama de volta o Java), `GetStaticFieldID`.
- Daí para frente é reversing de C normal: [Ghidra](../../../introduction/ghidra.md) e GDB (`gdb --args java -jar app.jar`, `set breakpoint pending on`, `b Java_com_ctf_Check_verify`; a JVM usa `SIGSEGV` internamente, então `handle SIGSEGV nostop noprint pass`).

## Checklist

1. `unzip -l`: recursos, bibliotecas nativas, `mapping.txt` esquecido, assinaturas.
2. Decompile com CFR. Se os nomes forem `a/b/c`, siga as chamadas à API do Java.
3. Strings estranhas no constant pool → ache o decifrador e **execute-o** (teste, patch ou debugger).
4. `forName`/`getMethod`/`invokedynamic` → breakpoint em `Method.invoke` ou no bootstrap.
5. `defineClass`/`loadLibrary` → despeje a classe ou extraia a `.so`.
6. Quando o estático empacar, rode com `-agentlib:jdwp` e um debugger: a JVM sempre acaba com os valores em claro.

## Referências

- [ProGuard Manual](https://www.guardsquare.com/manual/home) - O que cada opção de ofuscação faz (útil para reconhecer o padrão).
- [java-deobfuscator](https://github.com/java-deobfuscator/deobfuscator) - Transformadores para ofuscadores comuns.
- [JNI Specification](https://docs.oracle.com/en/java/javase/17/docs/specs/jni/index.html) - Funções do `JNIEnv` e regras de nomes dos símbolos.
