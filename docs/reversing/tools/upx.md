---
title: "UPX e packers"
sidebar_position: 7
---

Um **packer** comprime (ou cifra) o executável original e o envolve em um pequeno programa, o *stub*, que na hora de rodar descomprime tudo em memória e pula para o código original. O arquivo em disco não tem o código legível: o disassembler mostra só o stub e uma massa de dados de alta entropia. UPX é o packer mais comum e o mais simples de desfazer; os outros exigem [unpacking manual](./scylla.md).

- **Download**: [upx.github.io](https://upx.github.io/) (Windows, Linux, macOS; também `apt install upx-ucl`). Código: [github.com/upx/upx](https://github.com/upx/upx/releases).

## Reconhecendo um binário empacotado

- [DIE](./die.md): `Packer: UPX (4.x)`, ou qualquer outro nome de packer/protetor.
- Seções com nomes `UPX0`, `UPX1`, `UPX2` (PE) ou um ELF com só 2 segmentos `LOAD` e sem seções (`readelf -S` vazio).
- Entropia alta (perto de 8) na seção que ocupa quase todo o arquivo, e uma seção de código minúscula.
- Imports quase vazios: `LoadLibraryA`, `GetProcAddress`, `VirtualProtect`, `ExitProcess`.
- Entry point na **última** seção, não na `.text`.
- `strings` mostra `UPX!`, `$Info: This file is packed with the UPX executable packer`, e quase nada mais.
- No Ghidra: a `main` não existe, o entry point é um loop pequeno (`pushad`, loops de descompressão com `lodsb`/`movsb`, `popad`, `jmp` para um endereço em outra seção).

## Desempacotar

```bash
upx -d chall -o chall.unpacked        # -d = decompress. Sem -o, sobrescreve
upx -t chall                          # testa se é UPX válido
upx -l chall                          # mostra tamanhos e versão
```

Se funcionar, o `chall.unpacked` é o binário original, com símbolos e tudo. Abra normalmente.

### Quando `upx -d` falha

Mensagens como `CantUnpackException: file is modified/hacked/protected` ou `not packed by UPX` significam que o autor **alterou os cabeçalhos** do UPX para quebrar a ferramenta, mas o stub continua funcionando. As modificações clássicas e o conserto:

| Modificação | Como ver | Conserto |
|---|---|---|
| Nomes das seções trocados (`UPX0` → `.text`) | `readelf -S` / PE-bear | Só cosmético; o UPX não usa os nomes. Se falhar, é outra coisa |
| Magic `UPX!` apagado (vira zeros ou outra string) | `strings` / hex: o `UPX!` fica logo antes do fim do arquivo (PE) ou no `l_info`/`p_info` no início (ELF) | Restaure `UPX!` (`55 50 58 21`) nas ocorrências: em ELF há uma no header `l_info` (offset ~`0xec` em x64) e uma no fim; em PE, no cabeçalho `PackHeader` perto do fim |
| Campos `p_info` zerados em ELF (`p_filesize`, `p_blocksize`) | Hex: 12 bytes depois do `UPX!` inicial, zeros | Copie o valor do `p_info` no fim do arquivo (a cópia do trailer) ou do tamanho descompactado |
| Versão do UPX inventada no header | `upx -l` erro | Edite o byte de versão para um valor válido (`0x0d`, `0x0e`) |
| Stub modificado (instruções extras, anti-debug no meio) | `upx -t` falha com erro de checksum | Unpacking manual: rode até o `jmp` para o OEP e dumpe |

Para ELF, o roteiro mais confiável quando os cabeçalhos estão bagunçados: `gdb ./chall`, `starti`, e coloque um **catchpoint** ou breakpoint depois da descompressão. O stub do UPX em ELF termina com um `jmp` para o OEP via um registrador; com pwndbg, `break *entry`... não serve (é o stub). Use `catch syscall munmap` (o stub desmapeia a si mesmo no fim) ou simplesmente `b *` em um endereço da região de alta entropia que virará código, e depois `dump memory` + reconstrução, ou mais simples: deixe o programa rodar até ler o input e `gcore` (o core tem o código descompactado para análise estática; não roda, mas o Ghidra abre).

Em PE, o roteiro é o do [Scylla](./scylla.md#roteiro-de-unpacking-manual): hardware breakpoint no `[esp]` após o `pushad`, `F9`, chegou no `popad`, segue o `jmp`, dump + fix IAT.

## Unpacking por execução (sem entender o stub)

Qualquer packer precisa descomprimir o código em memória para rodá-lo. Então, para análise estática, basta **rodar e dumpar a memória**:

- Linux: rode no GDB até depois do unpacking (um breakpoint em `read`/`puts`/`__libc_start_main` costuma bastar) e `gcore dump.core`, ou `dump memory saida.bin inicio fim` com os endereços de `vmmap`. O Ghidra abre o `.bin` como *raw binary* na base certa. Alternativa: `/proc/<pid>/mem` com um script Python.
- Windows: [pe-sieve](https://github.com/hasherezade/pe-sieve) (`pe-sieve64.exe /pid <pid> /imp 1`) dumpa e reconstrói imports em um comando. Ou x64dbg + Scylla.
- Emulação: [unipacker](https://github.com/unipacker/unipacker) e o próprio Qiling emulam o stub de packers conhecidos sem rodar nada de verdade.

Um dump não é um executável perfeito (imports, relocations e dados inicializados em runtime podem estar fora do lugar), mas para **ler a lógica** no Ghidra ele basta.

## Outros packers e protetores

| Nome | Tipo | Dificuldade | Caminho |
|---|---|---|---|
| UPX | Compressor | Fácil | `upx -d`, ou header fix |
| ASPack, PECompact, MPRESS, Petite | Compressores antigos (PE) | Fácil/média | Unpacking manual clássico (ESP trick) + Scylla; há unpackers prontos para a maioria |
| Themida/WinLicense, VMProtect, Enigma, Obsidium | Protetores com virtualização e anti-debug (PE) | Alta | Dump após execução para a parte não virtualizada; o código virtualizado exige devirtualização ou análise em runtime. Em CTF, a lógica importante costuma ficar fora da VM, ou o desafio é justamente a VM |
| PyInstaller, py2exe, Nuitka | "Packers" de Python | Fácil (PyInstaller) a alta (Nuitka compila para C) | [pyinstxtractor + pycdc](./python-tools.md) |
| ConfuserEx, .NET Reactor | Ofuscadores/packers .NET | Média | de4dot, unpackers específicos, [dnSpy](./dnspy.md) |
| Packers caseiros de CTF | XOR/RC4 do `.text` + `mprotect` | Média | O stub está ali no binário: leia a rotina de decifração e reproduza em Python, ou rode e dumpe |

## Referências

- [UPX - Documentação](https://upx.github.io/upx-doc.html) - Opções e formato.
- [Unpacking UPX manually (ELF)](https://github.com/upx/upx/blob/devel/doc/elf-format.txt) - Layout dos cabeçalhos `l_info`/`p_info` do UPX em ELF, para consertar headers.
- [OALabs - UPX unpacking](https://research.openanalysis.net/) - Artigos e vídeos sobre unpacking de packers reais.
