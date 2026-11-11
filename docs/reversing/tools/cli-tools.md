---
title: "Utilitários de linha de comando"
sidebar_position: 9
---

Antes de abrir o Ghidra, cinco minutos com as ferramentas de linha de comando do Linux resolvem a triagem e, muitas vezes, o desafio inteiro. Todas vêm nos pacotes `binutils`, `coreutils`, `ltrace`, `strace` e `binwalk` da sua distro.

## Identificar

```bash
file chall                     # tipo, arquitetura, linkagem, stripped
file -k chall                  # não para na primeira assinatura
xxd chall | head               # magic bytes: 7f 45 4c 46 (ELF), 4d 5a (PE), 50 4b (Zip/JAR/APK), ca fe ba be (.class)
```

## Strings

```bash
strings -n 8 chall             # strings de 8+ caracteres (o padrão 4 gera muito lixo)
strings -el chall              # UTF-16LE (strings de programas Windows)
strings -t x chall | grep -i flag   # com o offset em hex
strings chall | grep -iE "flag|ctf|password|correct|wrong|key"
```

Strings que **não aparecem** mas o programa usa estão cifradas, montadas em runtime (stack strings) ou comprimidas: [FLOSS](https://github.com/mandiant/flare-floss) acha boa parte delas (`floss chall`), e `ltrace` mostra as que passam por funções da libc.

## Cabeçalhos e símbolos (ELF)

```bash
readelf -h chall               # entry point, tipo (EXEC = sem PIE, DYN = PIE)
readelf -S chall               # seções, tamanhos, permissões
readelf -l chall               # segmentos (GNU_STACK com E = stack executável; RELRO)
readelf -s chall | grep FUNC   # símbolos (tabela completa, se não for stripped)
readelf -d chall               # dynamic: bibliotecas (NEEDED), RPATH/RUNPATH, BIND_NOW
nm -C chall                    # símbolos com nomes C++ traduzidos
nm -D chall                    # só os dinâmicos (funcionam em stripped)
ldd chall                      # bibliotecas e onde foram achadas (não rode em binário suspeito: ldd pode executá-lo)
objdump -d -M intel chall | less               # disassembly de tudo
objdump -d -M intel --no-show-raw-insn -C chall | grep -A30 "<main>:"
objdump -s -j .rodata chall    # dump de uma seção
objdump -R chall               # relocations: entradas da GOT
pwn checksec chall             # proteções
```

Para PE no Linux: `objdump -x chall.exe` (cabeçalhos e imports), `winedump -j import chall.exe`, `readpe` (pev), ou `pefile` em Python.

## Comportamento em execução

```bash
ltrace ./chall                 # chamadas de biblioteca com argumentos: strcmp("AAAA", "s3cr3t"), strlen, ...
ltrace -C ./chall              # traduz nomes C++
ltrace -i -e 'strcmp+memcmp' ./chall     # só essas, com endereço de retorno
strace ./chall                 # syscalls: open("flag.txt"), read, write, connect...
strace -f -e trace=file,network ./chall  # segue filhos; só arquivos e rede
strace -s 200 ./chall          # strings maiores na saída
```

`ltrace` só vê chamadas que passam pela PLT: binários estáticos ou com funções inlinadas não mostram nada. `strace` sempre funciona. Em binários que detectam `ptrace` (os dois usam), o programa pode se comportar diferente.

```bash
echo "AAAA" | ltrace ./chall 2>&1 | grep -i cmp       # a maneira mais rápida de ver com o que seu input é comparado
LD_PRELOAD=./fake.so ./chall   # substitua uma função da libc (rand, time, strcmp, ptrace) por uma sua
```

## Arquivos embutidos e dados

```bash
binwalk chall                  # assinaturas de arquivos dentro do arquivo (zip, png, ELF, gzip...)
binwalk -e chall               # extrai (cuidado: rode em diretório isolado)
binwalk -E chall               # gráfico de entropia: onde há dados comprimidos/cifrados
dd if=chall of=parte.bin bs=1 skip=$((0x1234)) count=$((0x100))   # recortar por offset
xxd -s 0x1234 -l 64 chall      # hex de um trecho
xxd -r -p <<< "deadbeef"       # hex → bytes
cmp -l a b | head              # bytes diferentes entre dois arquivos
radiff2 a b                    # diff de binários (radare2)
```

## Patch rápido

```bash
# trocar bytes no offset do arquivo (converta VA → offset com readelf -S ou objdump -h)
printf '\x90\x90' | dd of=chall bs=1 seek=$((0x1234)) conv=notrunc
# ou com Python
python3 -c "d=bytearray(open('chall','rb').read()); d[0x1234:0x1236]=b'\x90\x90'; open('chall_p','wb').write(d)"
# montar instruções para o patch
pwn asm -c amd64 "xor eax, eax; ret"          # pwntools
rasm2 -a x86 -b 64 "jmp 0x10"                  # radare2
```

Para o offset: `VA - VirtualAddr(seção) + Offset(seção)`, ou, em binários sem PIE com `.text` padrão, `objdump -F` mostra o *file offset* de cada função.

## Outros

| Ferramenta | Para quê |
|---|---|
| `c++filt` | Traduzir nomes mangled de C++ |
| `gdb -batch -ex "disassemble main" ./chall` | Disassembly sem entrar no GDB |
| `ROPgadget`, `ropper` | Gadgets (pwn) |
| `one_gadget` | Endereços de `execve("/bin/sh")` em uma libc |
| `upx -d` | [Desempacotar](./upx.md) |
| `qemu-aarch64 -L /usr/aarch64-linux-gnu ./chall` | Rodar binários de outra arquitetura; `-g 1234` abre um stub de GDB para o `gdb-multiarch` |
| `hexdump -C`, `xxd`, `hexyl` | Hex dump (o `hexyl` é colorido) |
| `ent` | Entropia de um arquivo |
| `exiftool` | Metadados de imagens e documentos (forense) |
| `uncompyle6`/`pycdc`, `jadx`, `ilspycmd` | Decompiladores de linha de comando de [Python](./python-tools.md), [Java](../languages/java/bytecode.md) e .NET |

## Referências

- [GNU Binutils - Documentação](https://sourceware.org/binutils/docs/binutils/) - `objdump`, `readelf`, `nm`, `strings`, `c++filt`.
- [strace](https://strace.io/) e [ltrace (man)](https://man7.org/linux/man-pages/man1/ltrace.1.html) - Opções de filtro e formato.
- [binwalk](https://github.com/ReFirmLabs/binwalk) - Assinaturas e extração.
