---
title: "Ghidra"
sidebar_position: 3
---

Ghidra é um **decompilador open source** elaborado pela NSA. Um decompilador transforma código executável em código de alto nível (converte 110101001 para print("Hello, World!");)

Além do Ghidra, temos opções como IDA, porém o Ghidra é de graça e open-source.

Requer: **Java Development Kit (JDK)** 64-bit (versões atuais pedem o JDK 21). Python3 é opcional (só para scripts).

## Baixando (Linux)

Atalho: `sudo apt install openjdk-21-jdk`, baixe o zip na [página de releases](https://github.com/NationalSecurityAgency/ghidra/releases), descompacte e rode `./ghidraRun`. Ou, manualmente:

1. **Baixe o JDK** de acordo com a arquitetura do seu PC (x64 ou ARM64)
2. **Descomprima o arquivo** com `tar -xzf file.tar.gz`
3. **Baixe o zip do GHIDRA** e dê `unzip file`
4. Digite o comando `vi ~/.bashrc` - No fim do arquivo, adicione o diretório bin de JDK para a variável PATH: `export PATH=<path_JDK>/bin:$PATH`. Ache o caminho para o JDK com o comando `pwd`.
5. Digite `java --version` para testar.
6. Na pasta do ghidra, **rode o arquivo ghidraRun**

## Baixando (Windows)

1. **Baixe o JDK** de acordo com a arquitetura do seu PC (x64 ou ARM64)
2. **Execute o instalador**
3. **Baixe o zip do GHIDRA** e descomprima
4. Crie um atalho para o arquivo **ghidraRun** na sua área de trabalho

## Usando

1. Crie um projeto em **New Project**
2. **File > Import File** (ou drag and drop file)
3. **Importe o binário** que você quer analisar. Ao importar, clicar em **Ok**
4. Em **Tool Chest**, drag and drop file. Ou apenas dê um double-click no seu arquivo.
5. Se pedir para analisar, clique em **Yes**. Selecione opções desejadas e clique em **analyze** (Se desejar, apenas clique em analyze, pois as opções padrão já são de bom tamanho)


### Interface
- Em cima à esquerda, há a **Program Tree**. Mostra a estrutura do programa, **separada de acordo com os blocos de memória do arquivo compilado original** (seções como `.text` e `.data`).
- À esquerda, há a **symbol tree**. Permite encontrar **símbolos** na navegação.
- Embaixo à esquerda, há o Data Type Manager. Permite **achar, aplicar e criar tipos de dados**.
- Aperte **'G'** para navegar para um endereço ou palavra.
- No meio, mostra a **visualização em assembly** do programa. Selecione linhas, e elas serão mostradas à direita, no **Decompiler**. Em qualquer lugar do Assembly que você clique, irá ser mostrado o mesmo código em C à direita (próximo do código original).

### Utilidades gerais
- **L** - Renomear variável/função
- **Ctrl+L** - Alterar o tipo de uma variável (ex: `int` → `char`)
- **Ctrl+Shift+F** - Referências (quem chama a função / quem usa a variável)
- **;** - Comentário na linha
- **G** - Ir para endereço/símbolo
- **Window > Defined Strings** - Todas as strings do binário. Clique duas vezes e veja quem usa