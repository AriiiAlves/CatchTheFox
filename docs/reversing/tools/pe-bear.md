---
title: "PE-bear"
sidebar_position: 4
---

PE-bear é um visualizador e editor de arquivos **PE** (executáveis e DLLs do Windows). Ele mostra os cabeçalhos, seções, imports, exports, recursos e relocations em abas, e permite editar qualquer campo e salvar. É a ferramenta para entender a estrutura de um PE, comparar um dump com o original e consertar arquivos quebrados depois do [unpacking](./scylla.md).

- **Download**: [github.com/hasherezade/pe-bear/releases](https://github.com/hasherezade/pe-bear/releases) (Windows, Linux e macOS). Página oficial: [hshrzd.wordpress.com/pe-bear](https://hshrzd.wordpress.com/pe-bear/).
- Alternativas: [CFF Explorer](https://ntcore.com/explorer-suite/) (Windows; mais antigo, também edita), `pefile` em Python para automação, [Dependencies](https://github.com/lucasg/Dependencies) só para imports.

## O que olhar em cada aba

| Aba | O que mostra | O que procurar |
|---|---|---|
| **DOS Hdr / File Hdr** | Assinatura `MZ`, arquitetura (`Machine`: `0x14c` x86, `0x8664` x64), número de seções, timestamp de compilação, `Characteristics` (EXE ou DLL) | Timestamp zerado ou futuro (packer); `Machine` que não bate com o `file` |
| **Optional Hdr** | `Entry Point` (RVA), `Image Base`, `Subsystem` (GUI = 2, Console = 3), `DLL Characteristics` (ASLR, DEP, CFG), **Data Directories** (onde estão imports, exports, recursos, relocations, TLS, .NET) | Entry point fora da `.text`; `DLL Characteristics` sem `DYNAMIC_BASE` (sem ASLR: endereços fixos); diretório **TLS** presente (callbacks de TLS rodam **antes** do entry point: anti-debug favorito); diretório **.NET** presente (abra no [dnSpy](./dnspy.md)) |
| **Section Hdrs** | Nome, `Raw Addr`/`Raw Size` (no arquivo), `Virtual Addr`/`Virtual Size` (na memória), `Characteristics` (R/W/X) | Seção com `Raw Size = 0` e `Virtual Size` grande (vai ser preenchida em runtime: packer); seção **RWX**; nomes `UPX0`, `.themida`, `.vmp0`, `.aspack`; entropia alta (o PE-bear mostra na coluna) |
| **Imports** | DLLs e funções importadas | Só `LoadLibraryA`/`GetProcAddress`/`VirtualAlloc`/`VirtualProtect` → empacotado. `IsDebuggerPresent`, `CheckRemoteDebuggerPresent`, `NtQueryInformationProcess` → anti-debug. `CryptDecrypt`, `BCrypt*` → criptografia da API |
| **Exports** | Funções exportadas (em DLLs) | Nomes com dica da função; ordinal sem nome |
| **Resources** | Ícones, diálogos, strings, manifestos, e qualquer dado embutido (`RCDATA`) | Recursos grandes de alta entropia: payload ou arquivo embutido. Clique direito → salvar |
| **BaseReloc** | Relocations (necessárias para ASLR) | Dump sem relocations precisa de `Image Base` fixa |
| **TLS** | Callbacks de TLS | Endereços executados antes do entry point: coloque breakpoint neles no x64dbg (`Options → Events → TLS Callbacks`) |
| **Disasm** | Disassembly rápido a partir de qualquer RVA | Olhar o entry point sem abrir o IDA |

A visão hex na parte de baixo acompanha a seleção: clique em um campo e ele é destacado nos bytes. Editar o campo (clique duplo) altera o arquivo; `File → Save executable as` grava.

## Tarefas comuns

### Converter entre RVA, VA e offset no arquivo

Na barra de baixo há a conversão: digite um valor em `RVA`, `raw` ou `VA` e os outros são calculados. Útil para levar um endereço visto no debugger (VA) até o byte correspondente no arquivo (raw) para um patch, ou vice-versa: `VA = ImageBase + RVA`; `raw = RVA - VirtualAddr(seção) + RawAddr(seção)`.

### Consertar um dump

Depois de dumpar um processo com o Scylla ou pe-sieve:

1. `Section Hdrs`: para cada seção, iguale `Raw Addr` a `Virtual Addr` e `Raw Size` a `Virtual Size` (o dump é uma imagem de memória, então os dois espaços coincidem). Clique direito na tabela → há a opção de fazer isso automaticamente.
2. `Optional Hdr`: `Entry Point` = OEP (em RVA). `Image Base` = base em que o processo estava, se você não for reconstruir as relocations; e desmarque `DYNAMIC_BASE` em `DLL Characteristics`.
3. `Imports`: confira se a tabela gerada pelo Scylla aparece e tem nomes; a seção `.scy` deve estar listada.
4. Salve e teste.

### Adicionar uma seção ou mudar permissões

`Section Hdrs` → clique direito → *Add section* cria uma seção nova (para injetar código ou uma nova tabela de imports). Para tornar uma seção gravável ou executável, edite `Characteristics` (bits `0x20000000` execute, `0x40000000` read, `0x80000000` write).

### Comparar dois arquivos

Abra os dois (o PE-bear mantém vários na árvore à esquerda) e use `Compare` para ver diferenças de cabeçalho e de bytes entre o original e um patch/dump.

## Lendo o PE sem o PE-bear

Para scripts ou Linux sem GUI:

```python
import pefile
pe = pefile.PE("app.exe")
print(hex(pe.OPTIONAL_HEADER.AddressOfEntryPoint), hex(pe.OPTIONAL_HEADER.ImageBase))
for s in pe.sections:
    print(s.Name, hex(s.VirtualAddress), hex(s.Misc_VirtualSize), s.get_entropy())
for d in pe.DIRECTORY_ENTRY_IMPORT:
    print(d.dll, [i.name for i in d.imports])
```

`objdump -x app.exe` e `readpe` (pev) também listam cabeçalhos e imports.

## Referências

- [PE Format (Microsoft)](https://learn.microsoft.com/windows/win32/debug/pe-format) - Especificação oficial dos cabeçalhos.
- [PE-bear (hasherezade)](https://hshrzd.wordpress.com/pe-bear/) - Página da ferramenta, com changelog e dicas.
- [corkami - PE101](https://github.com/corkami/pics/blob/master/binary/pe101/README.md) - Pôster com a estrutura do PE em uma página.
