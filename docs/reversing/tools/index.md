---
title: "Ferramentas de Engenharia Reversa"
---

Nenhuma ferramenta faz tudo. O fluxo típico é: **identificar** o arquivo (DIE, `file`), **desempacotar** se preciso (UPX, Scylla), **analisar estaticamente** (Ghidra, IDA, dnSpy, jadx) e **confirmar dinamicamente** (x64dbg, GDB, Frida). Abaixo, as principais por categoria, com o link oficial de download. As que têm tutorial aqui no site estão linkadas na primeira coluna.

## Identificação e triagem

| Ferramenta | Para quê | Plataforma | Download |
|---|---|---|---|
| [DIE (Detect It Easy)](./die.md) | Identificar formato, compilador, linker, packer e protetor; entropia por seção; strings e cabeçalhos | Windows, Linux, macOS | [github.com/horsicq/Detect-It-Easy](https://github.com/horsicq/Detect-It-Easy/releases) |
| `file`, `strings`, `binwalk` | Tipo do arquivo, strings legíveis, arquivos embutidos ([utilitários de linha de comando](./cli-tools.md)) | Linux | Pacotes da distro; [binwalk](https://github.com/ReFirmLabs/binwalk) |
| [FLOSS](https://github.com/mandiant/flare-floss) | Extrair strings ofuscadas (montadas na stack, decodificadas em runtime) de PE/ELF | Multiplataforma | [github.com/mandiant/flare-floss](https://github.com/mandiant/flare-floss/releases) |
| [PE-bear](./pe-bear.md) | Visualizar e editar cabeçalhos, seções, imports e recursos de um PE; comparar antes/depois de um dump | Windows, Linux, macOS | [github.com/hasherezade/pe-bear](https://github.com/hasherezade/pe-bear/releases) |
| CFF Explorer | Mesmo papel do PE-bear, mais antigo; bom para editar imports e flags na mão | Windows | [ntcore.com/explorer-suite](https://ntcore.com/explorer-suite/) |
| Dependencies | Ver DLLs e funções importadas por um PE (sucessor do Dependency Walker) | Windows | [github.com/lucasg/Dependencies](https://github.com/lucasg/Dependencies/releases) |
| ImHex / HxD | Editor hexadecimal. ImHex tem *pattern language* para estruturas; HxD é leve | ImHex: multi; HxD: Windows | [imhex.werwolv.net](https://imhex.werwolv.net/), [mh-nexus.de/hxd](https://mh-nexus.de/en/hxd/) |
| CyberChef | Decodificar/encodar/cifrar no navegador (Base64, XOR, AES, compressão...) | Web | [gchq.github.io/CyberChef](https://gchq.github.io/CyberChef/) |

## Desempacotamento (unpacking)

| Ferramenta | Para quê | Plataforma | Download |
|---|---|---|---|
| [UPX](./upx.md) | O packer mais comum; `upx -d` desempacota binários não modificados | Multiplataforma | [upx.github.io](https://upx.github.io/) |
| [Scylla](./scylla.md) | Reconstruir a tabela de imports (IAT) depois de dumpar um executável desempacotado da memória | Windows | [github.com/NtQuery/Scylla](https://github.com/NtQuery/Scylla/releases) (já vem no x64dbg) |
| pe-sieve / hollows_hunter | Dumpar automaticamente código desempacotado ou injetado de processos em execução | Windows | [github.com/hasherezade/pe-sieve](https://github.com/hasherezade/pe-sieve/releases) |
| unipacker | Emula o unpacking de packers conhecidos sem rodar o binário | Multiplataforma (Python) | [github.com/unipacker/unipacker](https://github.com/unipacker/unipacker) |

## Análise estática (disassemblers e decompiladores)

| Ferramenta | Para quê | Plataforma | Download |
|---|---|---|---|
| Ghidra | Disassembler e decompilador gratuito da NSA, para quase toda arquitetura. O padrão para começar ([tutorial](../../introduction/ghidra.md)) | Multiplataforma (Java) | [ghidra-sre.org](https://ghidra-sre.org/) |
| IDA Free / IDA Pro | O disassembler clássico; a versão Free decompila x86/x64 ([tutorial](../../introduction/ida-pro.mdx)) | Multiplataforma | [hex-rays.com/ida-free](https://hex-rays.com/ida-free/) |
| Binary Ninja | Disassembler/decompilador com ótima API; a versão Free cobre o essencial | Multiplataforma | [binary.ninja](https://binary.ninja/free/) |
| radare2 / Cutter | Framework de linha de comando e sua interface gráfica, com decompilador ([tutorial](../../introduction/radare2.mdx)) | Multiplataforma | [rada.re](https://rada.re/n/radare2.html), [cutter.re](https://cutter.re/) |
| [dnSpy](./dnspy.md) / ILSpy | Decompilar, **editar** e debugar .NET (C#) | Windows (ILSpy também Linux/macOS) | [github.com/dnSpyEx/dnSpy](https://github.com/dnSpyEx/dnSpy/releases), [github.com/icsharpcode/ILSpy](https://github.com/icsharpcode/ILSpy/releases) |
| jadx, CFR, Recaf | Decompilar Java e Android; Recaf edita (veja [Java](../languages/java/bytecode.md)) | Multiplataforma (Java) | [jadx](https://github.com/skylot/jadx/releases), [CFR](https://www.benf.org/other/cfr/), [Recaf](https://github.com/Col-E/Recaf/releases) |
| [pyinstxtractor + pycdc](./python-tools.md) | Extrair e decompilar programas Python empacotados (PyInstaller, `.pyc`) | Multiplataforma | [pyinstxtractor](https://github.com/extremecoders-re/pyinstxtractor), [pycdc](https://github.com/zrax/pycdc) |
| `objdump`, `readelf`, `nm` | Disassembly e cabeçalhos de ELF na linha de comando ([utilitários](./cli-tools.md)) | Linux | binutils (pacote da distro) |

## Análise dinâmica (debuggers e instrumentação)

| Ferramenta | Para quê | Plataforma | Download |
|---|---|---|---|
| [x64dbg](./x64dbg.md) | Debugger de usuário para Windows (x86 e x64); plugins de unpacking (Scylla, ScyllaHide) | Windows | [x64dbg.com](https://x64dbg.com/) |
| GDB + pwndbg/GEF | Debugger do Linux ([tutorial](../../introduction/gdb.md)) | Linux | [pwndbg](https://pwndbg.re/), [GEF](https://hugsy.github.io/gef/) |
| [Frida](./frida.md) | Injetar JavaScript em processos: hook de funções, leitura de argumentos, alterar retornos. Desktop e Android/iOS | Multiplataforma | [frida.re](https://frida.re/docs/installation/) |
| `ltrace` / `strace` | Ver chamadas de biblioteca / syscalls com argumentos, sem debugger ([utilitários](./cli-tools.md)) | Linux | Pacotes da distro |
| Process Monitor, System Informer | Ver arquivos, registro, rede e processos tocados por um programa no Windows | Windows | [Sysinternals](https://learn.microsoft.com/sysinternals/downloads/procmon), [systeminformer.sourceforge.io](https://systeminformer.sourceforge.io/) |
| API Monitor | Registrar chamadas à API do Windows com argumentos | Windows | [apimonitor.com](http://www.rohitab.com/apimonitor) |
| QEMU | Rodar binários de outras arquiteturas (ARM, MIPS) e debugar com `gdb-multiarch` | Multiplataforma | [qemu.org](https://www.qemu.org/download/) |
| Qiling / Unicorn | Emular trechos de código ou binários inteiros em Python (para fuzzing, desofuscação, keygens) | Multiplataforma | [qiling.io](https://qiling.io/), [unicorn-engine.org](https://www.unicorn-engine.org/) |

## Resolução automática

| Ferramenta | Para quê | Download |
|---|---|---|
| Z3 | Resolver as restrições de uma checagem de flag ([tutorial](../../pwning/others/z3.md)) | [github.com/Z3Prover/z3](https://github.com/Z3Prover/z3) (`pip install z3-solver`) |
| angr | Execução simbólica de binários: achar o input que leva a um endereço | [angr.io](https://angr.io/) (`pip install angr`) |
| Triton, Miasm | Alternativas de execução simbólica e desofuscação | [triton-library.github.io](https://triton-library.github.io/), [github.com/cea-sec/miasm](https://github.com/cea-sec/miasm) |

## Qual usar

| Situação | Ferramenta |
|---|---|
| Não sei o que é o arquivo | DIE, `file`, `binwalk` |
| PE com entropia alta / seção `UPX0` / poucos imports | UPX, depois x64dbg + Scylla |
| ELF/PE compilado (C/C++/Rust/Go) | Ghidra ou IDA para ler; GDB/x64dbg para confirmar |
| .NET | dnSpy (e pronto: ele lê, edita e debuga) |
| Java / APK | jadx, CFR, Recaf |
| Python empacotado | pyinstxtractor + pycdc/decompyle3 |
| Quero ver o que o programa faz, sem ler o código | `ltrace`/`strace`, Procmon, Frida, API Monitor |
| A checagem é uma equação | Z3, angr |
