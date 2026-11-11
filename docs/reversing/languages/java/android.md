---
title: "Android: APK e DEX"
sidebar_position: 3
---

Aplicativos Android são Java (ou Kotlin) compilados para **bytecode Dalvik**, empacotados em um `.apk`. As ferramentas mudam, mas a reversa é a mesma do Java: decompilar, achar a checagem, inverter ou instrumentar. A diferença é que o programa roda dentro do Android, então o dinâmico exige um emulador ou aparelho.

## O que tem em um APK

`.apk` é um Zip:

| Arquivo | Conteúdo |
|---|---|
| `classes.dex`, `classes2.dex`... | O bytecode Dalvik de todas as classes (multidex quando passa de 64k métodos) |
| `AndroidManifest.xml` | Componentes do app (activities, services, receivers), permissões. Em formato binário: só legível depois do `apktool` ou no jadx |
| `res/`, `resources.arsc` | Layouts, strings (`res/values/strings.xml`), imagens. Também binários |
| `assets/` | Arquivos arbitrários do app, como estão: lugar favorito para flags, bancos SQLite, scripts |
| `lib/<abi>/*.so` | Código nativo (JNI) por arquitetura: `arm64-v8a`, `armeabi-v7a`, `x86_64` |
| `META-INF/` | Assinatura do APK |
| `kotlin/`, `okhttp3/`... | Bibliotecas. Ignore |

## Ferramentas

```bash
jadx-gui app.apk                 # decompila DEX → Java, com busca de texto, XREF e manifest legível. Comece aqui
apktool d app.apk -o out/        # smali (assembly do Dalvik) + recursos e manifest decodificados. Para editar e remontar
d2j-dex2jar app.apk              # converte para .jar, se quiser usar CFR/Recaf
```

- **jadx**: `jadx app.apk -d src/` para a linha de comando. Use *Deobfuscation* no menu quando os nomes forem `a/b/c`; e, para código que ele não decompila, o botão *Smali* mostra o bytecode.
- **apktool**: `apktool b out/ -o patched.apk` remonta; depois é preciso assinar (`uber-apk-signer -a patched.apk` ou `apksigner sign --ks chave.jks`) para instalar.
- **Emulador**: Android Studio (AVD) ou Genymotion. `adb install app.apk`, `adb logcat` para ver `Log.d` do app (flags impressas no log não são raras), `adb shell` para olhar `/data/data/<pacote>/`.

## Por onde começar

1. **Manifest**: o `package` é o prefixo das classes do app (o resto é biblioteca). A `activity` com `<action android:name="android.intent.action.MAIN"/>` é a tela inicial.
2. **Strings**: `res/values/strings.xml` e o painel de busca do jadx (`Ctrl+Shift+F`) por "flag", "correct", "wrong", "success".
3. **A checagem**: em `onClick`, `onCreate`, ou em um método chamado por eles. Em Kotlin, ignore o ruído (`Intrinsics.checkNotNullParameter`, `Companion`, `$default`, `lambda$onCreate$0`).
4. **Recursos e assets**: `assets/` e arquivos em `res/raw/`. Bancos `.db` abrem com `sqlite3`.
5. **Nativo**: se a função decisiva é `native`, extraia `lib/arm64-v8a/lib*.so` e abra no Ghidra (veja [JNI](./obfuscation.md#jni-código-nativo)). Prefira a versão `x86_64` se existir: é mais fácil de rodar e de ler.

## Smali

Smali é o assembly do Dalvik, que tem **registradores** (`v0`, `v1`... e `p0` = `this`, `p1`... parâmetros) em vez de pilha. Você vai ler smali quando o jadx falhar ou quando for editar o app.

```smali
.method public check(Ljava/lang/String;)Z
    .registers 4
    invoke-virtual {p1}, Ljava/lang/String;->length()I
    move-result v0
    const/16 v1, 0x8
    if-ne v0, v1, :wrong
    const/4 v0, 0x1
    return v0
    :wrong
    const/4 v0, 0x0
    return v0
.end method
```

- `invoke-virtual/static/direct {regs}, Classe->metodo(desc)ret` + `move-result vN` para pegar o retorno.
- `const/4`, `const/16`, `const-string v0, "texto"`.
- `if-eq`, `if-ne`, `if-eqz` (compara com zero), `goto :label`.
- `iget`/`iput` (campos de instância), `sget`/`sput` (estáticos), `aget`/`aput` (arrays), `xor-int/2addr v0, v1` (`v0 ^= v1`).

Patch típico: trocar `if-ne` por `if-eq`, ou inserir `invoke-static {v0}, Landroid/util/Log;->e(...)` para logar um valor. Depois `apktool b`, assinar e instalar.

## Instrumentação com Frida

Em vez de alterar o APK, injete JavaScript no processo em execução (aparelho rooteado ou emulador com `frida-server`, ou APK re-empacotado com o gadget):

```js
// frida -U -f com.ctf.app -l hook.js
Java.perform(() => {
    const Check = Java.use("com.ctf.app.Check");
    Check.verify.implementation = function (s) {
        console.log("verify(" + s + ")");
        const r = this.verify(s);
        console.log(" → " + r);
        return true;                      // ou force o resultado
    };
    const Str = Java.use("java.lang.String");
    Str.equals.implementation = function (o) {   // veja todas as comparações
        console.log("equals: " + this + " vs " + o);
        return this.equals(o);
    };
});
```

`frida-trace -U -j 'com.ctf.app.*!*' -f com.ctf.app` gera hooks para todos os métodos do pacote, o que mostra a ordem das chamadas e os argumentos. Para métodos nativos: `Interceptor.attach(Module.findExportByName("libcheck.so", "Java_com_ctf_app_Check_verify"), {...})`.

## Proteções comuns em apps

- **Detecção de root/emulador/debugger**: `Build.FINGERPRINT`, `/system/bin/su`, `Debug.isDebuggerConnected()`, `ApplicationInfo.FLAG_DEBUGGABLE`. Retorne o valor "limpo" com Frida ou apague no smali.
- **Verificação de assinatura** (`PackageManager.GET_SIGNATURES`): o app detecta que foi re-empacotado. Faça o método devolver a assinatura original, ou use Frida em vez de patch.
- **Pinning de certificado** (para desafios com rede): `objection --gadget com.ctf.app explore` e `android sslpinning disable`.
- **Ofuscação R8** e strings cifradas: igual ao [Java](./obfuscation.md), com o jadx fazendo o papel do CFR.

## Referências

- [jadx](https://github.com/skylot/jadx) - Decompilador de DEX.
- [Apktool](https://apktool.org/) - Decodificar e remontar APKs.
- [Frida - Android](https://frida.re/docs/android/) - Instalação do `frida-server` e exemplos de hooks em Java.
- [Smali/Baksmali - Registers](https://github.com/JesusFreke/smali/wiki/Registers) - Convenção de registradores do Dalvik.
- [OWASP MASTG](https://mas.owasp.org/MASTG/) - Guia de análise de apps, com capítulos de reversing e anti-tamper.
