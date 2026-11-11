---
title: "Python: pyinstxtractor e pycdc"
sidebar_position: 8
---

Programas em Python distribuídos como executável (PyInstaller, py2exe, cx_Freeze) ainda carregam o **bytecode** dos scripts dentro do arquivo. Basta extraí-lo e decompilar para ter o código quase original. Quando a decompilação falha, o próprio bytecode é legível com o módulo `dis`.

- **pyinstxtractor**: [github.com/extremecoders-re/pyinstxtractor](https://github.com/extremecoders-re/pyinstxtractor) (um único `pyinstxtractor.py`; existe também o [pyinstxtractor-ng](https://github.com/pyinstxtractor/pyinstxtractor-ng), que não depende da versão do Python instalada).
- **pycdc** (Decompyle++): [github.com/zrax/pycdc](https://github.com/zrax/pycdc) (compile com CMake; suporta até Python 3.12 com limitações).
- **decompyle3** / **uncompyle6**: [github.com/rocky/python-decompile3](https://github.com/rocky/python-decompile3) (Python 3.7 e 3.8), [uncompyle6](https://github.com/rocky/python-uncompyle6) (até 3.8). Mais fiéis que o pycdc nas versões que suportam.
- **pydumpck**, **PyLingual** ([pylingual.io](https://pylingual.io/)): decompiladores para versões recentes (3.9+), o PyLingual online e baseado em modelos.

## Reconhecendo

- `strings` com `PyInstaller`, `_MEIPASS`, `pyi-`, `python3X.dll`/`libpython3.X.so`, `MEI\f\n\v\016`; [DIE](./die.md) detecta `PyInstaller` ou `py2exe`.
- Um overlay grande depois do fim do PE/ELF: é o arquivo `CArchive` do PyInstaller, com o magic `MEI\x0c\x0b\x0a\x0b\x0e` perto do fim.
- `.pyc` soltos: começam com um magic de 4 bytes que identifica a versão do Python (`55 0d 0d 0a` = 3.8, `61 0d 0d 0a` = 3.10, `a7 0d 0d 0a` = 3.11, `cb 0d 0d 0a` = 3.12).

## PyInstaller

```bash
python3 pyinstxtractor.py chall.exe          # ou o ELF
# [+] Python version: 3.10
# [+] Possible entry point: chall.pyc
# [+] Found 72 files in PYZ archive
ls chall.exe_extracted/
```

- Use um **Python da mesma versão** que o detectado para rodar o `pyinstxtractor.py` (ou o `-ng`), senão os `.pyc` do `PYZ` saem sem cabeçalho correto.
- O *entry point* indicado (`chall.pyc`) é o script principal. Os módulos próprios do programa ficam em `PYZ-00.pyz_extracted/`; a biblioteca padrão e dependências também, ignore-as.
- O extractor já conserta o cabeçalho dos `.pyc` do entry point (versões antigas exigiam copiar os 16 bytes de magic de outro `.pyc` à mão).

```bash
pycdc chall.exe_extracted/chall.pyc > chall.py
# ou, para Python 3.7/3.8:
decompyle3 chall.exe_extracted/chall.pyc
```

Se o `pycdc` imprimir `Unsupported opcode` ou `WARNING: Decompyle incomplete`, use o `pycdas` (desmontador que vem com ele) ou o `dis` abaixo para a função que faltou.

## py2exe e cx_Freeze

- **py2exe**: o bytecode fica em um recurso `PYTHONSCRIPT` do PE ou em `library.zip` ao lado. [unpy2exe](https://github.com/matiasb/unpy2exe) extrai os `.pyc`.
- **cx_Freeze**: `library.zip` ao lado do executável (ou embutido) com os `.pyc`: `unzip` e decompile.
- **Nuitka**: compila Python para C; não há bytecode. Trate como C++ no Ghidra: as strings e os nomes das funções Python sobrevivem como constantes, e a lógica está em chamadas à API do CPython (`PyObject_RichCompare`, `PyNumber_Xor`...).

## Lendo bytecode sem decompilar

Quando nenhum decompilador aceita o `.pyc` (Python muito novo, bytecode manipulado), o próprio Python desmonta:

```python
import marshal, dis, sys
with open("chall.pyc", "rb") as f:
    f.read(16)                         # cabeçalho (magic, flags, timestamp/hash, tamanho) em 3.7+
    code = marshal.load(f)             # precisa rodar no MESMO Python do .pyc
dis.dis(code)
print(code.co_consts)                  # strings, números e code objects aninhados
print(code.co_names)                   # nomes globais/atributos usados
```

```
  2           0 LOAD_CONST               1 ('flag{')
              2 STORE_NAME               0 (prefix)
  3           4 LOAD_NAME                1 (input)
              6 LOAD_CONST               2 ('> ')
              8 CALL_FUNCTION            1
             10 STORE_NAME               2 (s)
  4          12 LOAD_NAME                2 (s)
             14 LOAD_CONST               3 (b'\x12\x34...')
             ...
             30 COMPARE_OP               2 (==)
             32 POP_JUMP_IF_FALSE       40
```

A máquina é de pilha, como a JVM: `LOAD_*` empilha, `BINARY_*`/`CALL_*` consomem, `COMPARE_OP` + `POP_JUMP_IF_FALSE` é um `if`. As constantes (`co_consts`) costumam entregar a flag ou a chave direto. Funções aninhadas são code objects dentro de `co_consts`: `dis.dis(code.co_consts[i])`.

Bytecode "ofuscado" de CTF (opcodes remapeados, `marshal` com objetos modificados, `.pyc` com cabeçalho falso): compare o magic com a tabela de versões, tente `marshal.loads` nos bytes depois do cabeçalho, e, se os opcodes foram trocados, o interpretador customizado está junto do desafio (um `python` modificado ou um `opcode.py`): use-o ou reconstrua o mapeamento comparando um `.pyc` conhecido.

## Dicas

- Scripts `.py` empacotados com `exec(base64.b64decode(...))`, `compile(marshal.loads(...))` ou `zlib`: substitua o `exec` por `print` e rode. Camadas múltiplas são comuns; repita.
- Variáveis e nomes de função sobrevivem nos `.pyc` (são `co_names`/`co_varnames`), então a leitura costuma ser direta mesmo sem decompilar.
- `python -m pyinstxtractor`... não existe; é sempre `python pyinstxtractor.py arquivo`.
- Para instalar várias versões de Python lado a lado (necessário para os `.pyc` de versões diferentes): `pyenv` ou `uv python install 3.8`.

## Referências

- [pyinstxtractor - Wiki](https://github.com/extremecoders-re/pyinstxtractor/wiki) - Detalhes do formato `CArchive` e do `PYZ`.
- [Python `dis` - documentação](https://docs.python.org/3/library/dis.html) - Lista de opcodes por versão.
- [Magic numbers dos `.pyc`](https://github.com/python/cpython/blob/main/Lib/importlib/_bootstrap_external.py) - Tabela `MAGIC_NUMBER` por versão no código do CPython.
