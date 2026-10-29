# running notes (para o CHANGELOG final)

## intro.md
- link GitHub manual-pwning -> CatchTheFox; "ou mandando" -> "ou mandar"; "porque chineses ... ctf's" -> "por que os chineses ... CTFs"; ponto final.
## introduction/index.md
- "muito prático" -> "prática"; "execução de programa" -> "programas"
## endianness
- little-endian: "menor número" -> "byte menos significativo (menor endereço)" [conceitual]
- big-endian: não é "padrão"; é o network byte order; "poucos protocolos" estava errado [conceitual]
- dica LSB/MSB do `file`; imagem com caminho absoluto
## ghidra
- códígo de maquina; x82 -> x64/ARM64; tar -xyf -> -xzf [erro: -y não existe]; "caminho com para"; "C decompiller" -> Decompiler; Ctrl+L "renomear tipo" -> "alterar tipo"
- requisitos: JDK 21 64-bit; Python opcional (PyGhidra)
## ida
- menciona IDA Free
## radare2 (mantido unlisted, como antes)
- `@ main` não "vai para main" (é seek temporário) -> `s main`; `pd @ main` -> `pdf @ main`
- `Vp` não é modo gráfico -> `VV`; adicionado `V!`
- `izzq` (q = quiet) -> `izzj` (JSON); `/z flag` -> `/ flag` e `izz~flag`
- `iS` duplicado -> `iSj`; "Lsitar"; `axf` = refs *a partir* do endereço
- `db - 0x...` -> `db -0x...`; `dsi` não é step into -> `ds`; adicionado `dcu`
- `ood`/`doo` explicados corretamente; adicionado `aaa` (necessário) e dicas `?`, `j`, `~`
- nota: versão do apt é antiga
## assembly/index
- "cada hexadecimal = 1 byte" -> "cada par de dígitos hex" [conceitual]
- "todo código é compilado p/ código de máquina" -> nuance interpretadas [conceitual]
- tabela registradores: rcx=4º arg e rdx=3º (estavam trocados) [conceitual]
- flags: bit 15 é reservado, Resume Flag é bit 16; + VM, AC, ID; Interrupt Flag; IOPL [conceitual]
- cmp: nota sobre OF/CF em comparações com/sem sinal [complemento]
- BYTE na lista de words; mov também memória/imediato; "mov RIP" é pseudo
- leave: `mov rbp, rsp` -> `mov rsp, rbp` (2 lugares) [conceitual - ordem invertida]
- "push cresce 8 ou 4 (x64, ou 4 x86)" redundância
- typos: quealquer, memḿoria, CTF's, jumpt, "ao qual", "mudam", "A instrução"
## assembly/stack
- RBP-0x8 = "acrescentado" -> "subtraído" de 8 bytes [conceitual]; "todos os dados" -> "geralmente" (+ nota sobre RSP-relative)
- exemplo imprimir_soma(1,2) -> (1,2,3); aspas sobrando; "quando mais alto" -> "quanto"
- typos: enxer, chamados->chamadas, emplihamos, contém->contêm, recebido->recebidos, "A partir o", armazenados->armazenadas
## assembly/analise-pratica
- link quebrado do binário (./reversing-assembly/hello_world) -> ./bins/hello_world; + links if_then/loop
- ```assmebly; main_0x31 -> main+0x31; coteúdo; incremendado; frase "Após rodar o código, podemos rodá-lo"
- printf("%d") -> printf("%d ") (format string real do binário é "%d ", conferido no .rodata)
## assembly/coding-assembly
- links quebrados /docs/pwning/bof/... e /docs/extra/syscall-tb -> links relativos para arquivos
- "relocação": explica placeholder; exemplo `mov rsi, [0x0]` (load de memória) -> `mov rsi, 0x0` (endereço), coerente com `mov rsi, mensagem` [conceitual]
- fence ``` indentado no exemplo de struct
- "Arrays dinâmicos" (.bss) -> "não inicializados" [conceitual: .bss não é dinâmico]
- seção "Strings" estava vazia -> exemplo completado
- `eq` -> `equ`; assembler; "Quanto colocamos"; "Uso para constantes"; "essa guia"; facilitanto; Fillipo
- syscall x64: `mov r10, rcx`/`mov r8, r8` sem sentido -> arg4/5/6 + motivo do r10; x86 args 4-6
- exit(60) -> syscall 60 = exit(0)
- cabeçalho ELF: 0x1120 NÃO é tamanho do arquivo, é o offset da section header table (e_shoff); 0x40 = e_phoff [conceitual]
- .symtab vs .strtab; label local `_start.skip_string`
- objdump -D -> -d (+ -M intel, nota AT&T, e nota sobre TEST virar instruções)
- pipeline: .asm/.s; ELF/.exe
## gdb
- "gdb vem com o compilador" -> apt install gdb; GEF/pwndbg são extensões [conceitual]
- + nexti, nota next/step precisam de símbolos
- `b *main+25` relativo à função main, não "ao código"; `b main` para após prólogo vs `b *main` [conceitual]
- CLUTTER_IM_MODULE é variável de ambiente [conceitual]
- ebp salvo = 0: explicação corrigida (_start zera ebp; __libc_start_main chamou main) [conceitual]
- conta 0xffffd0ec+0x4 -> 0xffffd0e8+0x4; "inicializa a main" -> "chama a main"
- `set 0x... = ...` (sintaxe inválida) -> `set *0x... = ...`, `{long long}`, `set $eax` [conceitual]
- x/x, x/i, combinação de formatos
- "-g" não tem relação com otimização [conceitual]
- strip: .dynsym permanece (por isso puts@plt mantém nome) [complemento]
- `file`: não existe saída "no symbols"; níveis corrigidos (with debug_info / not stripped / stripped) [conceitual]
- entry point = _start; readelf -h / info file; cadeia _start -> __libc_start_main -> main
- typos: debbuger, extende, "utilizado", "dropar na ela", "a a string", contem, preste, "comando do", "seguranças"
## pwntools
- `pip install pwn` -> `pip install pwntools` (+ nota externally-managed-environment) [conceitual]
- fluxo: gdb.attach é opcional e manda comandos ao GDB, não ao programa
- gdbscript com aspas quebradas (código não executava) [erro de código]
- print Python 2 -> Python 3; recvuntil(b"out")
- "least endian" -> "little endian"; endianness é da arquitetura, não do ELF [conceitual]
- u64(b'ABCD\0\0\0\0', endian='big') = 0x4142434400000000, não 0x41424344 -> corrigido o exemplo [conceitual]
- b'' é `bytes`, não bytearray [conceitual]
- exemplo `conn` sem definição
- endereço 0x7f... é do ld-linux (loader), não da libc [conceitual]
- confirma a hipótese do autor sobre gdb.attach
- links quebrados para csaw18_boi
## pwning/index, stack/index
- decompillers, eistentes; link quebrado para Stack em Assembly; "aprenderá a como"
## protections
- checksec: comando certo para cada instalação (`pwn checksec` / `checksec --file=`); nota venv
- RELRO: PLT é código (sempre RO); RELRO protege GOT, .init_array, .fini_array, .dynamic [conceitual]
- Partial RELRO: "modifique antes da 2ª chamada" errado -> GOT fica gravável a execução toda [conceitual]
- Canary: fica na TLS (fs:0x28/gs:0x14); __stack_chk_fail; byte nulo [complemento]; "endereço de verificação" -> valor [conceitual]; brute force em fork
- PIE vs ASLR: sem PIE o binário fica fixo mesmo com ASLR [conceitual]; offsets constantes; link partial overwrite
- Fortify: "C/Python/Outro" -> C/C++ (Python não) [conceitual]; checagem é em runtime; efeito em %n / %N$ [complemento]
- IBT: faz parte do CET; protege JOP/COP, não ROP (ret) -> Shadow Stack; "limita 99% de ROP" errado; não aplicado em user space no Linux [conceitual]
- typos: processoador, "Impede com que", "um configuração"
