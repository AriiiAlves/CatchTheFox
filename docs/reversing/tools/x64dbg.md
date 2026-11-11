---
title: "x64dbg"
sidebar_position: 2
---

x64dbg é o debugger de modo usuário padrão para Windows: código aberto, interface clara, suporte a x86 (`x32dbg.exe`) e x64 (`x64dbg.exe`), e um ecossistema de plugins que inclui o [Scylla](./scylla.md) (reconstrução de imports) e o ScyllaHide (anti-anti-debug). Para reversing em Windows, ele faz o papel que o GDB faz no Linux.

- **Download**: [x64dbg.com](https://x64dbg.com/) (snapshots diários; baixe o `.zip`, extraia e rode `release/x96dbg.exe`, que escolhe a versão certa pelo arquivo).
- **Plugins**: [ScyllaHide](https://github.com/x64dbg/ScyllaHide/releases) (copie para `release/x64/plugins/` e `x32/plugins/`); o Scylla já vem embutido (`Plugins → Scylla`).

## Interface

A aba **CPU** tem quatro painéis: disassembly (esquerda, com a instrução atual destacada), registradores e flags (direita), dump de memória (embaixo à esquerda) e stack (embaixo à direita). Outras abas que importam:

| Aba | Para quê |
|---|---|
| **Breakpoints** | Lista e gerencia breakpoints (software, hardware, memória) |
| **Memory Map** | Regiões do processo com permissões e módulos; clique direito → *Dump memory to file* ou *Set page memory rights* |
| **Symbols** | Módulos carregados e suas exportações; clique duplo em uma função coloca o cursor nela |
| **References / Strings** | Resultado de buscas por strings e chamadas (clique direito no disassembly → *Search for*) |
| **Call Stack** | Pilha de chamadas |
| **Log** | Saída de comandos e do programa |
| **Handles / Threads** | Arquivos abertos, threads |

Barra de comandos no rodapé: aceita comandos de texto (`bp kernel32.CreateFileW`, `dump esp`, `find eip, "48 8B 05"`), que também servem para scripts.

## Comandos do dia a dia

| Ação | Tecla | Comando |
|---|---|---|
| Executar | `F9` | `run` / `g` |
| Pausar | `F12` | `pause` |
| Step into / over | `F7` / `F8` | `sti` / `sto` |
| Executar até retorno | `Ctrl+F9` | `rtr` |
| Executar até o cursor | `F4` | |
| Breakpoint na linha | `F2` | `bp endereço` |
| Breakpoint em API | | `bp CreateFileW`, `bp kernel32.VirtualAlloc` |
| Hardware breakpoint (execução/escrita/leitura) | clique direito → *Breakpoint → Hardware* | `bph endereço, w` |
| Breakpoint de memória (acesso a uma página) | clique direito no Memory Map | `bpm endereço, 0, x` |
| Ir para endereço | `Ctrl+G` | |
| Seguir em dump / stack | clique direito → *Follow in Dump* | `dump endereço` |
| Buscar strings referenciadas | clique direito → *Search for → Current Module → String references* | |
| Buscar chamadas entre módulos | *Search for → Intermodular calls* | |
| Patch de bytes | `Ctrl+E` (edit) ou barra de espaço (assemble) | |
| Salvar binário com patches | *File → Patch file* (`Ctrl+P`) | |
| Tracing | *Trace → Trace into/over* com condição | `TraceIntoConditional eip == 0x...` |

Ao abrir um arquivo, o x64dbg para no **System breakpoint** (dentro do `ntdll`) e depois no **entry point** do módulo (`Options → Preferences → Events` controla onde parar; marque *Entry Breakpoint* e desmarque *System Breakpoint* para ir direto ao programa).

## Roteiro para uma checagem de flag

1. Rode até o programa pedir o input (`F9`). Digite algo reconhecível (`AAAABBBB`).
2. `Ctrl+F9`/pause e procure a comparação: *Search for → String references* pela mensagem de erro, ou breakpoints em APIs de comparação e leitura: `bp lstrcmpA`, `bp strcmp`, `bp memcmp`, `bp ReadConsoleA`, `bp ReadFile`, `bp GetDlgItemTextA` (programas com janela).
3. Quando parar, `Ctrl+F9` para voltar à função chamadora e veja os argumentos na stack/registradores (`rcx`, `rdx` em x64; `[esp+4]`, `[esp+8]` em x86).
4. Alternativa sem API: *Search for → Intermodular calls* e dê breakpoint em tudo de `msvcrt`/`ucrtbase` que pareça entrada ou comparação.
5. Patch: na instrução `jne` depois do `cmp`, barra de espaço → troque por `je` ou `nop`. *Patch file* salva um executável novo.

## Anti-debug

Programas de CTF em Windows frequentemente checam se estão sendo debugados. Os truques e a resposta:

| Técnica | Como aparece | Solução |
|---|---|---|
| `IsDebuggerPresent`, `CheckRemoteDebuggerPresent`, `NtQueryInformationProcess` | Chamada a essas APIs; `PEB.BeingDebugged` (`fs:[30]+2` / `gs:[60]+2`) | ScyllaHide com perfil *Basic* ou *VMProtect*; ou zere o byte do PEB (comando `set BeingDebugged 0` não existe, use o dump: `dump peb()` e edite) |
| `NtSetInformationThread(ThreadHideFromDebugger)` | Thread some do debugger | ScyllaHide |
| Timing (`rdtsc`, `GetTickCount`, `QueryPerformanceCounter`) | Comparações de tempo entre dois pontos | Breakpoint na comparação e ajuste do valor; ScyllaHide tem hook de timing |
| Exceções (`int 3`, `int 2d`, `SEH`) | O programa gera exceções e espera que o handler rode | *Options → Exceptions*: ignore o range `00000000-FFFFFFFF`, ou passe a exceção com `Shift+F9` |
| Checagem de software breakpoint (`0xCC`) | O código se lê | Use hardware breakpoints (não alteram a memória) |
| `OutputDebugString`, `FindWindow("x64dbg")`, nomes de processo | | ScyllaHide; renomear o executável do debugger |

Com ScyllaHide instalado: *Plugins → ScyllaHide → Options*, marque um perfil e *Apply*. Ele injeta hooks nessas APIs ao iniciar o processo.

## Dicas

- `Ctrl+Shift+F9` (Run to user code) sai de dentro de DLLs do sistema e volta para o código do programa.
- Clique direito em um registrador → *Follow in Disassembler/Dump*. Clique duplo em um valor da stack segue o ponteiro.
- *Graph* (`G`) mostra o grafo de blocos de uma função, como o IDA.
- Comentários (`;`) e labels (`:`) são salvos no banco (`.dd64`) junto do executável.
- Para seguir um processo filho (`CreateProcess`), use o plugin de *child process debugging* ou `bp CreateProcessW` e altere a flag `dwCreationFlags` para `CREATE_SUSPENDED`, depois anexe outra instância ao filho.
- O x64dbg não decompila. Use o Ghidra/IDA ao lado para ler e o x64dbg para confirmar valores. A opção *Copy → Address* + `Ctrl+G` no Ghidra (com a base ajustada, `Window → Memory Map → Set Image Base` igual à do processo) mantém os dois sincronizados.

## Referências

- [Documentação do x64dbg](https://help.x64dbg.com/) - Comandos, scripts e atalhos.
- [ScyllaHide](https://github.com/x64dbg/ScyllaHide) - Lista de técnicas anti-debug que ele cobre.
- [Anti-Debug Tricks (Check Point)](https://anti-debug.checkpoint.com/) - Catálogo de técnicas anti-debug com código e mitigação.
