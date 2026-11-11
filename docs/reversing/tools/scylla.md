---
title: "Scylla e unpacking manual"
sidebar_position: 3
---

Scylla reconstrói a **tabela de imports** (IAT, *Import Address Table*) de um executável que você dumpou da memória. É a peça final do **unpacking manual**: quando um packer que o UPX não resolve descompacta o programa original em memória, você para no ponto certo, salva a memória em disco com o Scylla, e ele conserta a IAT para que o arquivo salvo rode e abra no Ghidra/IDA com os nomes das funções.

- **Download**: [github.com/NtQuery/Scylla/releases](https://github.com/NtQuery/Scylla/releases) (standalone, `Scylla_x64.exe` e `Scylla_x86.exe`). Também vem embutido no [x64dbg](./x64dbg.md) (`Plugins → Scylla`, `Ctrl+I`), que é a forma mais prática de usar.

## Por que a IAT quebra

Um executável normal tem uma tabela de imports que o loader do Windows preenche com os endereços reais das funções (`CreateFileW` → `0x7ff8...`). Um packer substitui essa tabela pela dele (só `LoadLibrary` e `GetProcAddress`), descompacta o código original em memória e **resolve os imports do original ele mesmo**, escrevendo os endereços em uma IAT nova, em algum lugar da memória. Quando você dumpa o processo:

1. O arquivo em disco tem os cabeçalhos do **packer**, que apontam para a IAT do stub, não para a do programa.
2. Os endereços da IAT nova são válidos só naquele processo (as DLLs mudam de base com ASLR).

O Scylla acha a IAT nova, descobre qual função cada endereço é (olhando as exportações das DLLs carregadas), e grava no dump uma tabela de imports nova e os cabeçalhos corrigidos.

## Roteiro de unpacking manual

### 1. Achar o OEP (Original Entry Point)

O OEP é a primeira instrução do programa original, executada depois que o stub terminou de descompactar. Os jeitos clássicos de chegar lá, do mais simples ao mais geral:

- **Packers com `pushad`/`popad`** (UPX e derivados): no entry point há um `pushad` (x86) ou uma sequência de `push` de todos os registradores. Coloque um **hardware breakpoint de acesso** no endereço de `[esp]` logo depois do `pushad` (clique direito no topo da stack → *Breakpoint → Hardware, Access → Dword*). Quando o stub fizer `popad` para restaurar os registradores, o breakpoint dispara, e logo depois vem um `jmp` grande para o OEP.
- **Breakpoint de memória na seção de código**: no Memory Map, clique direito na seção que vai receber o código descompactado (a primeira do módulo, geralmente vazia/RWX) → *Breakpoint → Execute*. O primeiro `jmp`/`call` para dentro dela é o OEP. Pode disparar antes do fim do unpacking; se o código ainda parecer lixo, `F9` de novo.
- **APIs de fim de unpacking**: `bp VirtualProtect` (packers trocam a permissão da seção de RW para RX ao terminar), `bp GetProcAddress` (o último lote de resoluções é a IAT nova; a chamada seguinte ao OEP). `Ctrl+F9` depois do breakpoint volta ao stub.
- **Reconhecer o OEP**: o código no OEP se parece com um começo de programa normal: `call __security_init_cookie; jmp __scrt_common_main` (MSVC), `push ebp; mov ebp, esp; push -1; push ...` (MSVC antigo), `sub rsp, 28h; call ...` (x64), `call GetModuleHandleA` / `call __main` (MinGW). Se o OEP cai dentro de uma região de alta entropia ou cheia de `jmp` para a própria região, ainda é o stub.

Pare exatamente no OEP (`F2` nele, `F9`, e não execute nada dele: o dump precisa do estado antes de o programa rodar).

### 2. Dumpar e reconstruir com o Scylla

No x64dbg parado no OEP: `Plugins → Scylla` (`Ctrl+I`).

1. **Attach to an active process**: já vem com o processo atual.
2. **OEP**: já vem com o `EIP`/`RIP` atual. Confira.
3. **IAT Autosearch**: o Scylla procura a tabela de ponteiros para funções de DLLs perto do OEP. Ele mostra `VA` e `Size`. Se perguntar sobre *advanced search*, aceite se a busca normal falhar.
4. **Get Imports**: lista as DLLs e funções encontradas. Entradas com ❌ são ponteiros inválidos (lixo ou funções redirecionadas pelo packer). Clique direito → *Cut thunk* nas inválidas que estiverem no início ou fim (ponteiros estranhos no meio indicam IAT ofuscada; veja abaixo).
5. **Dump**: salva a memória do módulo em `nome_dump.exe`.
6. **Fix Dump**: escolha o `nome_dump.exe` salvo; o Scylla grava `nome_dump_SCY.exe` com a nova seção de imports (`.scy`) e o entry point apontando para o OEP.

Teste rodando o `_SCY.exe`. Se abrir, pronto; se não, veja os problemas comuns.

### 3. Se precisar: ajustes no PE

Dumps às vezes precisam de retoques que o [PE-bear](./pe-bear.md) ou CFF Explorer fazem:

- **Raw = Virtual**: como o dump é uma imagem de memória, o offset de cada seção no arquivo deve ser igual ao seu RVA (o Scylla já faz isso com a opção *Section → Rebuild* ao dumpar; senão, iguale `Raw Address` a `Virtual Address` e `Raw Size` a `Virtual Size` em cada seção).
- **ImageBase**: se o processo foi carregado em uma base diferente (ASLR) e o dump mantiver relocations, pode falhar; desmarque `DYNAMIC_BASE` nas características do cabeçalho opcional ou ajuste a `ImageBase` para a base do processo.
- **Entry point** no OEP (RVA, não VA).

## Problemas comuns

| Sintoma | Causa | O que fazer |
|---|---|---|
| *IAT Autosearch* não acha nada | A IAT está longe do OEP ou é por módulo | Ache um `call [endereço]` no código original, siga o endereço no dump: ali é a IAT. Preencha `VA` e `Size` à mão (do primeiro ao último ponteiro, até a sequência de zeros) |
| Muitas entradas inválidas | IAT ofuscada: o packer aponta para *stubs* que pulam para a API real (Themida, VMProtect, Enigma) | Plugins de *IAT fixing* do Scylla (botão *Plugin Tracing*), ou resolva à mão: siga cada stub até a API e corrija o ponteiro no dump |
| Dump roda, mas falha em uma função específica | Uma entrada ficou errada | Debugue o dump até o crash: é um `call [ptr]` com ptr inválido; compare com o processo original |
| Programa checa se foi dumpado | Anti-dump: cabeçalho apagado em memória, `SizeOfImage` falso | Copie o cabeçalho do arquivo original para o dump; corrija os tamanhos no PE-bear |
| Código ainda cifrado em partes | Packer com descriptografia por função, sob demanda | Não dá para dumpar tudo de uma vez; analise em runtime ou force a execução de cada função |

Para x86 de 32 bits, use o `x32dbg` e o `Scylla_x86.exe`; o Scylla precisa ser da mesma arquitetura do processo.

## Alternativas

- **pe-sieve** (`pe-sieve64.exe /pid <pid> /imp 1`): dumpa módulos modificados em memória e reconstrói imports automaticamente. Ótimo primeiro tiro: rode o programa, espere ele descompactar, e dumpe.
- **OllyDumpEx** (Olly, Immunity, x64dbg): só dumpa; combine com o Scylla para a IAT.
- Em Linux, o equivalente é dumpar com `gcore`/GDB e reconstruir com ferramentas como `pedump`/`elfdump`, mas packers de ELF em CTF são quase sempre UPX.

## Referências

- [Scylla](https://github.com/NtQuery/Scylla) - README com as opções e o *plugin tracing*.
- [OALabs - Unpacking with x64dbg and Scylla](https://www.youtube.com/c/OALabs) - Vídeos de unpacking manual passo a passo.
- [Tuts4You - Unpacking tutorials](https://forum.tuts4you.com/) - Coleção histórica de tutoriais de unpacking de todo tipo de packer.
