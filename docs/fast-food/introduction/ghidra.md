---
title: "Ghidra"
sidebar_position: 3
---

Ghidra é um **decompilador open source** elaborado pela NSA. Um decompilador transforma código executável em código de alto nível (converte 110101001 para print("Hello, World!");)

Além do Ghidra, temos opções como IDA, porém o Ghidra é de graça e open-source.

Requer: **Java Development Kit (JDK)** e **Python3**.

## 4.1 Baixando (Linux)

1. **Baixe o JDK** de acordo com a arquitetura do seu PC (x64 ou x82)
2. **Descomprima o arquivo** com `tar -xyf file.tar.gz`
3. **Baixe o zip do GHIDRA** e dê `unzip file`
4. Digite o comando `vi ~/.bashrc` - No fim do arquivo, adicione o diretório bin de JDK para a variável PATH: `export PATH=<path_JDK>/bin:$PATH`. Ache o caminho com para JDK com o comando `pwd`.
5. Digite `java --version` para testar.
6. Na pasta do ghidra, **rode o arquivo ghidraRun**

## 4.1 Baixando (Windows)

1. **Baixe o JDK** de acordo com a arquitetura do seu PC (x64 ou x82)
2. **Execute o instalador**
3. **Baixe o zip do GHIDRA** e descomprima
4. Crie um atalho para o arquivo **ghidraRun** na sua área de trabalho

## 4.2 Usando

1. Crie um projeto em **New Project**
2. **File > Import File** (ou drag and drop file)
3. **Importe o binário** que você quer analisar. Ao importar, clicar em **Ok**
4. Em **Tool Chest**, drag and drop file. Ou apenas dê um double-click no seu arquivo.
5. Se pedir para analisar, clique em **Yes**. Selecione opções desejadas e clique em **analyze** (Se desejar, apenas clique em analyze, pois as opções padrão já são de bom tamanho)


### Interface
- Em cima à esquerda, há a **Program Tree**. Mostra a estrutura de programas (que **foram separados de acordo com os blocos do arquivo compilado original**).
- À esquerda, há a **symbol tree**. Permite encontrar **símbolos** na navegação.
- Embaixo à esquerda, há o Data Type Manager. Permite **achar, aplicar e criar tipos de dados**.
- Aperte **'G'** para navegar para um endereço ou palavra.
- No meio, mostra a **visualização em assembly** do programa. Selecione linhas, e elas serão mostradas à direita, no **C decompiller**. Em qualquer lugar do Assembly que você clique, irá ser mostrado o mesmo código em C à direita (próximo do código original).

### Utilidades gerais
- Use **L para renomear uma variável**.
- Use **Ctrl+L para renomear um tipo de variável**.