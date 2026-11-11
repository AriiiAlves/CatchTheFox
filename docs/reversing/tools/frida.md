---
title: "Frida"
sidebar_position: 6
---

Frida é um framework de **instrumentação dinâmica**: injeta um motor JavaScript dentro de um processo em execução, e a partir dali você intercepta funções (nativas, Java no Android, Objective-C no iOS, .NET), lê e altera argumentos e retornos, chama funções do programa com os argumentos que quiser e lê memória. É debug sem debugger: nada de breakpoints manuais, e scripts reutilizáveis. Funciona em Windows, Linux, macOS, Android e iOS.

- **Download**: `pip install frida-tools` (instala `frida`, `frida-trace`, `frida-ps`...). Documentação e binários: [frida.re/docs/installation](https://frida.re/docs/installation/). Para Android, o `frida-server` da mesma versão está nos [releases do GitHub](https://github.com/frida/frida/releases).
- **objection** (`pip install objection`): camada de comandos prontos sobre o Frida para apps móveis (bypass de root detection, SSL pinning, dump de memória).

## Conceitos

- **Spawn** (`-f programa`): o Frida inicia o processo pausado, injeta o script e então libera, para pegar o que acontece no começo. **Attach** (`-p pid` / `-n nome`): entra em um processo que já roda.
- **Script**: um arquivo `.js` com `Interceptor.attach`, `Java.perform`, etc. Carregado com `-l script.js`. Também dá para usar a API em Python (`frida.attach(...).create_script(...)`) para automatizar.
- **REPL**: `frida -p <pid>` sem script abre um console interativo onde você digita as mesmas chamadas.

```bash
frida-ps                                  # processos locais
frida-ps -Ua                              # apps no dispositivo USB
frida -f ./chall -l hook.js               # spawn + script (local)
frida -U -f com.ctf.app -l hook.js        # spawn no Android via USB
frida-trace -i "strcmp" -i "memcmp" ./chall          # gera hooks automáticos para essas funções
frida-trace -U -j 'com.ctf.app.*!*' -f com.ctf.app   # todos os métodos Java do pacote
```

## Hooks em código nativo

```js
// Interceptar strcmp e mostrar os argumentos
Interceptor.attach(Module.getExportByName(null, "strcmp"), {
    onEnter(args) {
        this.a = args[0].readUtf8String();
        this.b = args[1].readUtf8String();
    },
    onLeave(retval) {
        console.log(`strcmp("${this.a}", "${this.b}") = ${retval}`);
        retval.replace(0);                       // força "iguais"
    }
});

// Função do próprio binário, sem símbolo: base do módulo + offset (do Ghidra)
const base = Module.getBaseAddress("chall");     // Process.enumerateModules() lista os nomes
Interceptor.attach(base.add(0x1234), {
    onEnter(args) {
        console.log("check(" + args[0].readCString() + ")");
        console.log(hexdump(args[1], {length: 32}));   // bytes de um buffer
    },
    onLeave(retval) { console.log("→ " + retval); }
});

// Substituir a função inteira
Interceptor.replace(base.add(0x1234), new NativeCallback(() => 1, "int", ["pointer"]));

// Chamar uma função do programa com argumentos seus (keygen sem reimplementar)
const decrypt = new NativeFunction(base.add(0x2000), "pointer", ["pointer", "int"]);
const buf = Memory.alloc(64); buf.writeByteArray([0x41, 0x42]);
console.log(decrypt(buf, 2).readCString());

// Ler e escrever memória
console.log(base.add(0x4040).readPointer());     // um global
base.add(0x4040).writeU32(1337);
Memory.scanSync(base, 0x10000, "66 6c 61 67 7b").forEach(m => console.log(m.address));  // "flag{"
```

`args[n]` e `retval` são `NativePointer`: `.toInt32()`, `.readUtf8String()`, `.readByteArray(n)`, `.add()`. Em `onEnter`, `this` guarda estado para o `onLeave`. `Thread.backtrace(this.context).map(DebugSymbol.fromAddress)` imprime a pilha de chamadas.

## Hooks em Java (Android)

```js
Java.perform(() => {
    const Check = Java.use("com.ctf.app.Check");
    // sobrecarga: use .overload("java.lang.String") se houver mais de uma
    Check.verify.implementation = function (s) {
        const r = this.verify(s);               // chama a original
        console.log(`verify(${s}) = ${r}`);
        return true;
    };

    // campos e métodos estáticos
    console.log(Check.SECRET.value);
    console.log(Check.decode("..."));

    // instância existente na memória
    Java.choose("com.ctf.app.Check", {
        onMatch(obj) { console.log(obj.secret.value); },
        onComplete() {}
    });

    // ver todas as comparações de string do app
    const S = Java.use("java.lang.String");
    S.equals.implementation = function (o) {
        const r = this.equals(o);
        if (o !== null && o.toString().length > 3) console.log(`"${this}".equals("${o}") = ${r}`);
        return r;
    };
});
```

Setup no Android: aparelho/emulador rooteado, `adb push frida-server /data/local/tmp/`, `adb shell "su -c /data/local/tmp/frida-server &"`, e `frida-ps -U` para testar. Sem root, re-empacote o APK com o `frida-gadget` (objection faz isso: `objection patchapk -s app.apk`).

## Casos de uso em CTF

| Objetivo | Como |
|---|---|
| Ver o que é comparado com o input | Hook em `strcmp`/`memcmp`/`String.equals`/`Arrays.equals` (ou `frida-trace -i "*cmp*"`) |
| Pular uma checagem (anti-debug, root, licença) | `retval.replace(1)` em `onLeave`, ou `Interceptor.replace` |
| Extrair uma chave calculada em runtime | Hook em `onLeave` da função que a gera; ou `Memory.scanSync` pela assinatura |
| Chamar o decifrador do programa com todos os inputs | `NativeFunction`/`Java.use(...).metodo()` em loop |
| Descobrir qual função trata o input | `frida-trace -i "*"` filtrado por módulo, ou `Stalker` para um trace de instruções |
| Dumpar memória (código desempacotado, .NET carregado) | `Memory.readByteArray(base, size)` e `send()` para o Python salvar; ou `objection memory dump all` |

## Dicas

- Erros de "unable to intercept function" em funções muito curtas (menos de 5 bytes em x86): use um endereço interno ou `Interceptor.replace`.
- Programas com anti-Frida procuram `frida-server` na porta 27042, a string `frida` em `/proc/self/maps` ou threads com nomes do gjs: renomeie o `frida-server`, use `-f` (spawn) para hookar as checagens antes de rodarem, ou patch.
- `console.log` de muitos hooks fica lento; filtre em JS antes de imprimir.
- `frida -l script.js` recarrega o script automaticamente quando o arquivo muda, o que torna a iteração rápida.

## Referências

- [Frida - JavaScript API](https://frida.re/docs/javascript-api/) - Referência de `Interceptor`, `Memory`, `Java`, `Stalker`...
- [Frida - Android](https://frida.re/docs/android/) - Instalação do `frida-server` e exemplos.
- [Frida CodeShare](https://codeshare.frida.re/) - Scripts prontos (bypass de root, SSL pinning, dump de classes).
- [objection](https://github.com/sensepost/objection) - Comandos prontos para apps móveis.
