---
title: "Ghidra"
sidebar_position: 3
---

Ghidra é um **decompilador open source** elaborado pela NSA. Um compilador pega um código qualquer, como C, e converte isso para código de máquina. Um decompilador tenta fazer o **oposto**. Ele **pega código de máquina e gera código que se aproxima do código-fonte original**. Porém, esse processo de decompilação não é como uma função 1:1, e o código dado nem sempre é 100% correto. Mesmo assim, é muito eficiente e realmente reduz muito o tempo gasto em desafios de engenharia reversa.

Além do Ghidra, temos opções como IDA, porém o Ghidra é de graça e open-source.

Requer: **Java Development Kit (JDK)** 64-bit (as versões atuais do Ghidra pedem o JDK 21). O **Python3** é opcional, usado apenas para scripts com o PyGhidra.

## Baixando (Linux)

O jeito mais simples é instalar o JDK pelo gerenciador de pacotes (ex: `sudo apt install openjdk-21-jdk` no Ubuntu/Debian), baixar o zip do Ghidra na [página de releases](https://github.com/NationalSecurityAgency/ghidra/releases), descompactar e rodar o `ghidraRun`. Se preferir instalar o JDK manualmente:

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
- Em cima à esquerda, há a **Program Tree**. Mostra a estrutura do programa, **separada de acordo com os blocos de memória do arquivo compilado original** (as seções, como `.text` e `.data`).
- À esquerda, há a **symbol tree**. Permite encontrar **símbolos** na navegação.
- Embaixo à esquerda, há o Data Type Manager. Permite **achar, aplicar e criar tipos de dados**.
- Aperte **'G'** para navegar para um endereço ou palavra.
- No meio, mostra a **visualização em assembly** do programa. Selecione linhas, e elas serão mostradas à direita, no **Decompiler**. Em qualquer lugar do Assembly que você clique, irá ser mostrado o mesmo código em C à direita (próximo do código original).

### Utilidades gerais
- Clique em uma variável e **aperte L para renomeá-la** (as variáveis do código fonte, ao serem compiladas, perdem seus nomes. Mas você pode dar nome às variáveis que está analisando no código)
- Clique em uma variável e **aperte Ctrl+L para alterar seu tipo** (o decompilador pode interpretar um `char` como um `int`, o que é até bem comum)
- Clique em uma função, variável ou endereço e **aperte Ctrl+Shift+F** para ver as **referências** a ele (quem chama essa função, quem usa essa variável)
- **Aperte ; (ponto e vírgula)** para adicionar um comentário na linha
- Em **Window > Defined Strings**, vemos todas as strings do binário. Clicar duas vezes em uma leva até ela, e daí podemos ver quem a usa

## Referências

- [Ghidra - GitHub oficial](https://github.com/NationalSecurityAgency/ghidra) - Download e código-fonte.
- [Ghidra - Getting Started](https://github.com/NationalSecurityAgency/ghidra/blob/master/GhidraDocs/GettingStarted.md) - Requisitos (versão do JDK) e instalação.
- [Nightmare - Ghidra](https://guyinatuxedo.github.io/02-intro_tooling/ghidra/index.html) - Introdução ao Ghidra em que esta página se baseia.
- [Ghidra Cheat Sheet](https://ghidra-sre.org/CheatSheet.html) - Atalhos oficiais.
