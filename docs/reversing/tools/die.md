---
title: "DIE (Detect It Easy)"
sidebar_position: 1
---

DIE identifica **o que é** um arquivo antes de você abrir qualquer outra coisa: formato (PE, ELF, Mach-O, .class, APK...), compilador e versão, linker, linguagem, e principalmente **packers e protetores** (UPX, Themida, VMProtect, PyInstaller, .NET obfuscators). É o substituto moderno do PEiD, com assinaturas atualizadas e suporte a ELF.

- **Download**: [github.com/horsicq/Detect-It-Easy/releases](https://github.com/horsicq/Detect-It-Easy/releases) (Windows, Linux e macOS; há versão portátil e `die-lite`). Linux: também via `apt install detect-it-easy` em algumas distros, ou AppImage nos releases.
- **Linha de comando**: `diec` vem junto; útil em scripts.

## Uso básico

1. Abra o arquivo (arraste para a janela ou `File → Open`).
2. A janela principal mostra as detecções, uma por linha: `PE64`, `Compiler: Microsoft Visual C/C++ (2019)`, `Linker: ...`, `Packer: UPX (3.96)`. Cada linha tem um botão `S` (assinatura que casou) e `?` (informações do tipo).
3. **Entropy**: gráfico da entropia por seção. Entropia perto de 8 em uma seção de código significa comprimido ou cifrado (packer); código normal fica entre 5 e 6.5. Uma seção enorme de alta entropia com uma seção pequena de código é o padrão de "stub + payload".
4. **Strings**: lista as strings com filtro e tamanho mínimo. Procure nomes de API (`VirtualAlloc`, `IsDebuggerPresent`), mensagens e URLs.
5. **Hex**, **Disasm**: visão rápida sem abrir outro programa. O Disasm abre no entry point.
6. Em PE, a aba de **Import** mostra as DLLs e funções importadas. Binário "empacotado" costuma importar só `LoadLibraryA` e `GetProcAddress` (o stub resolve o resto em runtime).

```bash
diec ./arquivo              # detecções em texto
diec -e ./arquivo           # entropia por seção
diec -d ./arquivo           # modo "deep scan"
```

## O que fazer com cada resultado

| DIE mostra | Próximo passo |
|---|---|
| `Packer: UPX` | `upx -d` ([UPX](./upx.md)). Se falhar, o UPX foi modificado: [unpacking manual](./scylla.md) |
| `Protector: Themida / VMProtect / Enigma` | Difícil. Rode e dumpe da memória (x64dbg + Scylla), ou procure a lógica fora do código virtualizado |
| `Packer: PyInstaller` / `py2exe` | [pyinstxtractor + pycdc](./python-tools.md) |
| `.NET`, `Library: .NET` | [dnSpy](./dnspy.md). Se houver `Protector: ConfuserEx`, use `de4dot` ou um unpacker específico antes |
| `Compiler: Go`, `Rust`, `Nim`, `Delphi` | Ghidra/IDA com os scripts de recuperação de símbolos da linguagem |
| `Compiler: MinGW` / `GCC` em um PE | Convenções e strings de Linux; `objdump` funciona |
| `Overlay` (dados depois do fim do PE) | Algo está anexado: instalador, arquivo embutido, payload. `binwalk` ou extraia pelo offset mostrado |
| Nada de packer, entropia normal | Vá direto para o disassembler |

## Assinaturas e falsos negativos

As detecções são heurísticas baseadas em bytes do entry point, nomes de seções e imports. Um packer customizado de CTF não vai aparecer, mas os sinais indiretos sim: entropia alta, poucos imports, seções com nomes estranhos ou com permissão de escrita e execução (RWX), entry point fora de `.text`. Use o DIE para esses sinais, não só para o nome do packer.

O DIE também tem um **modo de scanner recursivo** (`Tools → Scan directory`) para triagem de muitos arquivos, e um editor de assinaturas em JavaScript caso queira adicionar a sua.

## Referências

- [Documentação do DIE](https://github.com/horsicq/Detect-It-Easy#readme) - Opções, assinaturas e `diec`.
- [Malware Unicorn - RE101](https://malwareunicorn.org/workshops/re101.html) - Workshop que usa DIE/PEiD na etapa de triagem.
