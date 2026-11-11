---
title: "Engenharia Reversa de Java"
---

Java não compila para código de máquina. O `javac` transforma `.java` em **bytecode**, guardado em arquivos `.class` e empacotado em `.jar`, e a JVM (Java Virtual Machine) interpreta ou compila esse bytecode em tempo de execução. Como o bytecode precisa carregar nomes de classes, métodos, campos e tipos para a JVM funcionar, a decompilação recupera algo muito próximo do código original. Reversa de Java é, em grande parte, escolher a ferramenta certa e saber lidar com ofuscação.

Pré-requisito: ler Java (ou qualquer linguagem parecida). Assembly não é necessário, exceto para código nativo via [JNI](./obfuscation.md#jni-código-nativo).

## Como reconhecer

- `file App.jar` → `Java archive data (JAR)` ou `Zip archive data`. `file Main.class` → `compiled Java class data, version 61.0`.
- A versão do `.class` indica o JDK mínimo para rodar: 52 = Java 8, 55 = 11, 61 = 17, 65 = 21.
- `.jar` é um Zip: `unzip -l App.jar` lista as classes, e `META-INF/MANIFEST.MF` tem a `Main-Class`.
- Em `.apk` (Android), o código está em `classes.dex`, bytecode Dalvik: veja [Android](./android.md).
- Outros formatos: `.war` (aplicação web, também Zip), `.jmod`/`jlink` (runtime customizado), `.exe` gerado por `launch4j`/`jpackage` (um `.jar` embutido: `binwalk -e` ou `7z x` extraem).

## Páginas

| Página | Assunto |
|---|---|
| [Decompilando e lendo bytecode](./bytecode.md) | Ferramentas, estrutura de um `.class`, as instruções da JVM que você precisa reconhecer |
| [Ofuscação e código nativo](./obfuscation.md) | ProGuard, strings cifradas, reflexão, `invokedynamic`, JNI |
| [Android](./android.md) | APK, DEX, smali, jadx, Frida |

## Fluxo de trabalho

```bash
unzip -l app.jar                                  # o que tem dentro: classes, recursos, .so
unzip -p app.jar META-INF/MANIFEST.MF             # Main-Class
java -jar cfr.jar app.jar --outputdir src         # decompila tudo para src/
grep -rn "flag\|equals\|Base64\|MessageDigest\|Cipher\|xor\|\^" src/
```

1. **Ponto de entrada**: a `Main-Class` do manifest, ou `public static void main(String[] args)`.
2. **Recursos**: flags e chaves costumam estar em `.properties`, `.txt`, `.json` dentro do `.jar`, não no código. `unzip -l` antes de decompilar.
3. **A comparação**: `input.equals(x)`, `Arrays.equals`, `MessageDigest.isEqual`, `hashCode() == 0x...`, `String.compareTo`. Siga quem calcula `x`.
4. **Inverta em Python** ou **edite** o `.jar`: o Recaf permite trocar um `if`, inserir um `System.out.println` e salvar. Como não há ASLR, canary nem nada disso, patch em Java é trivial e muitas vezes mais rápido que inverter.
5. **Debugue** se precisar de valores em tempo de execução: `java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=5005 -jar app.jar` e conecte o IntelliJ (*Attach to Process*) ou o `jdb -attach 5005`.

## Armadilhas ao portar para Python

- `int` tem **32 bits com sinal** e `long` 64: `(a * 31 + c)` em Java faz wraparound. Em Python, aplique `& 0xffffffff` e converta para sinal quando comparar.
- `>>` propaga sinal, `>>>` não. `byte` vai de -128 a 127: `(byte) 0xff == -1`.
- `char` é UTF-16 (2 bytes): `(char)(c + 1)` é aritmética de 16 bits. `String.getBytes()` usa UTF-8 por padrão.
- `String.hashCode()` é `h = 31*h + c` sobre os chars, em `int`. Inversível caractere a caractere se o tamanho for conhecido, ou com Z3.
- `new Random(seed)` é um LCG determinístico (`seed * 0x5DEECE66D + 0xB`, 48 bits): replicável em Python sem a JVM.

## Referências

- [JVM Specification - The class File Format](https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-4.html) - Estrutura do `.class` e do constant pool.
- [JVM Specification - Instruction Set](https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-6.html) - Todas as instruções do bytecode.
- [Reverse Engineering for Beginners - Java](https://beginners.re/) - Capítulo sobre bytecode Java.
