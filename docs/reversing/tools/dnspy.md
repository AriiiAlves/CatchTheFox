---
title: "dnSpy e ILSpy (.NET)"
sidebar_position: 5
---

Programas em C#, VB.NET e F# compilam para **CIL** (Common Intermediate Language), um bytecode com metadados completos, como o Java. O dnSpy decompila esse bytecode de volta para C# legível, permite **editar** o código e recompilar o executável, e ainda **debuga** o programa com breakpoints no código decompilado. Para desafios .NET, ele costuma ser a única ferramenta necessária.

- **Download**: [github.com/dnSpyEx/dnSpy/releases](https://github.com/dnSpyEx/dnSpy/releases) (fork mantido; o dnSpy original parou em 2020). Windows. Baixe `dnSpy-net-win64.zip` para debugar programas de 64 bits e `win32` para 32 bits.
- **ILSpy**: [github.com/icsharpcode/ILSpy/releases](https://github.com/icsharpcode/ILSpy/releases). Só decompila (não edita nem debuga), mas roda em Linux/macOS (`ilspycmd` via `dotnet tool install -g ilspycmd`) e tem o decompilador mais atualizado. Alternativa: [dotPeek](https://www.jetbrains.com/decompiler/) (JetBrains, gratuito).

## Como reconhecer .NET

- `file app.exe` → `PE32 executable (console) Intel 80386 Mono/.Net assembly`.
- [DIE](./die.md) mostra `Library: .NET`, e a versão do framework.
- `strings` com `mscoree.dll`, `_CorExeMain`, `System.`, `#Strings`, `#Blob`. O PE importa **só** `mscoree.dll!_CorExeMain`.
- Programas .NET Core/5+ publicados como *single file* ou *self-contained* são um host nativo com os assemblies embutidos: o dnSpy abre direto (ele extrai), ou use `ilspycmd`.

## Uso básico

1. Arraste o `.exe`/`.dll` para o painel **Assembly Explorer**. O dnSpy carrega as dependências do mesmo diretório.
2. Expanda `app.exe → app.exe → {} Namespace → Classe` e clique em um método. O código C# aparece à direita. Para ver o CIL, troque `C#` por `IL` no menu suspenso da barra.
3. **Entry point**: clique direito no assembly → *Go to Entry Point*, ou procure `Main`.
4. **Busca** (`Ctrl+Shift+K`): por nome de método, string literal (`flag`, `Correct`), ou número. Em *Search for* escolha *Number/String*.
5. **Referências**: clique direito em um método/campo → *Analyze* mostra quem chama e quem é chamado.
6. **Strings e recursos**: `Resources` no assembly tem arquivos embutidos (imagens, `.resx`, bytes); clique direito → *Save*.

## Debugar

`Start` (`F5`) → escolha o executável e os argumentos. Breakpoints com `F9` no código decompilado funcionam como em uma IDE: `F10` step over, `F11` step into, painel *Locals* mostra variáveis com os valores, *Watch* avalia expressões, *Call Stack*.

Receita para uma checagem: breakpoint na linha `if (input == expected)` (ou em `string.Equals`, `SequenceEqual`, `string.op_Equality` via *Breakpoints → Add → Module breakpoint*), rode, digite qualquer coisa, e leia `expected` em *Locals*. Também dá para **alterar variáveis** em *Locals* durante o debug (clique duplo no valor), o que serve para forçar o caminho certo.

Para processos já em execução: *Debug → Attach to Process*.

## Editar e salvar

- **Editar C#**: clique direito no método → *Edit Method (C#)*. Altere, *Compile*. Erros de compilação aparecem embaixo (o decompilador nem sempre gera código que recompila; nesse caso edite só o que precisa, ou vá para o IL).
- **Editar IL**: clique direito → *Edit IL Instructions*. Trocar `brfalse` por `brtrue`, ou `ldc.i4.0` por `ldc.i4.1`, é um patch de dois cliques.
- **Salvar**: *File → Save Module* (`Ctrl+Shift+S`) grava um novo executável. Se o assembly era assinado (strong name), marque a opção de remover a assinatura ou a execução falha.

Também dá para adicionar um `Console.WriteLine(expected)` antes da comparação e salvar: patch que imprime a flag.

## Ofuscação em .NET

Ofuscadores comuns: ConfuserEx, .NET Reactor, Eazfuscator, SmartAssembly, Dotfuscator. Sinais: nomes de métodos em unicode ilegível, strings vazias substituídas por chamadas `<Module>.xxx(int)`, método `Main` que só descriptografa e carrega outro assembly (`Assembly.Load(byte[])`), fluxo de controle em `switch` gigante.

- **de4dot** ([github.com/de4dot/de4dot](https://github.com/de4dot/de4dot)): desofusca automaticamente os ofuscadores clássicos (`de4dot app.exe` gera `app-cleaned.exe`). Primeiro passo sempre.
- **ConfuserEx**: [ConfuserEx-Unpacker](https://github.com/ConfuserEx-Unpacker) / NoFuserEx e similares; a versão importa.
- **Strings cifradas** que o de4dot não pegou: debugue e leia o retorno do decifrador, igual ao [Java](../languages/java/obfuscation.md).
- **`Assembly.Load(byte[])`**: breakpoint em `System.Reflection.Assembly.Load`, veja o array em *Locals* e salve-o (clique direito → *Save*), ou use o dnSpy para abrir o assembly carregado em memória (*Debug → Windows → Modules* → clique direito → *Save Module*).
- **Código nativo misturado** (C++/CLI, ou métodos com `DllImport`): o dnSpy mostra a assinatura; a implementação está em uma DLL nativa, para o Ghidra.

## ILSpy na linha de comando

```bash
dotnet tool install -g ilspycmd
ilspycmd app.exe -o src/ -p          # projeto C# completo em src/
ilspycmd app.exe -il                 # IL
```

Útil em Linux e para `grep` em bases grandes.

## Referências

- [dnSpyEx](https://github.com/dnSpyEx/dnSpy) - README com atalhos e recursos.
- [ILSpy](https://github.com/icsharpcode/ILSpy) - Decompilador e `ilspycmd`.
- [ECMA-335 (CLI)](https://ecma-international.org/publications-and-standards/standards/ecma-335/) - Especificação do CIL e dos metadados.
- [de4dot](https://github.com/de4dot/de4dot) - Desofuscador para .NET.
