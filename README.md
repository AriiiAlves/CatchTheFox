# CatchTheFox

Manual de **Engenharia Reversa e Pwning em Português**, construído com o intuito de auxiliar nas aulas da frente de Engenharia Reversa/Pwning do grupo [Ganesh - ICMC USP](https://ganesh.icmc.usp.br/en).

🌐 **Site:** https://ariiialves.github.io/CatchTheFox/

O conteúdo vai do básico (assembly, stack, GDB, Ghidra, pwntools) até técnicas de exploração de binários usadas em CTFs (buffer overflow, format strings, ROP, heap e mais).

## Estrutura do repositório

```
docs/                     ← todos os artigos (.md ou .mdx)
├── intro.md              ← página inicial do site
├── introduction/         ← Introdução: assembly, endianness, Ghidra, GDB, IDA, pwntools
├── pwning/               ← Pwning: proteções, stack, heap e outros
├── reversing/            ← Engenharia Reversa (em construção)
├── fast-food/            ← versão resumida, direto ao ponto
├── writeups/             ← resoluções de desafios
└── extra/                ← tabelas e materiais de consulta
static/
├── docs-img/             ← imagens usadas nos artigos
├── bins/                 ← binários de exemplo
└── challs/               ← arquivos de desafios (writeups)
docusaurus.config.js      ← configuração do site (SEO, redirects, navbar...)
sidebars.js               ← sidebar (gerada automaticamente, não precisa editar)
```

**O caminho do arquivo é o caminho da URL.** Por exemplo, a página
`https://ariiialves.github.io/CatchTheFox/pwning/protections/` está em `docs/pwning/protections.mdx`.

## Contribuindo

Correções e novos artigos são muito bem-vindos! Você pode:

- Abrir um **Pull Request** com a alteração; ou
- Abrir uma **Issue** com o label `invalid` (para correções) ou `documentation` (para sugerir um novo artigo, que pode ser escrito em Markdown na própria Issue).

### Corrigindo um artigo

Encontre o arquivo pelo caminho da URL (veja acima), edite e abra um Pull Request.

### Adicionando um artigo

1. Crie um arquivo `.md` (ou `.mdx`, se for usar componentes/JSX) na pasta da categoria. Use um nome curto, em minúsculas e com hífens, pois ele vira a URL (ex: `docs/pwning/heap/house-of-spirit.mdx`).
2. Coloque o front matter no topo do arquivo:

   ```md
   ---
   title: House of Spirit
   sidebar_position: 3
   ---

   Texto do artigo...
   ```

   - `title`: título da página e nome na sidebar.
   - `sidebar_position`: posição do artigo dentro da categoria (números menores aparecem primeiro).
   - Opcional: `unlisted: true` para a página existir sem aparecer na sidebar, ou `draft: true` para ela só aparecer rodando localmente (bom para artigos em construção).
3. Pronto! A sidebar é gerada automaticamente, **não é preciso editar o `sidebars.js`**.

### Criando uma nova categoria (pasta)

1. Crie a pasta dentro de `docs/`.
2. Crie um `_category_.json` com o nome e a posição da categoria na sidebar:

   ```json
   {
     "label": "Kernel",
     "position": 5
   }
   ```

3. (Opcional) Crie um `index.md` na pasta: ele vira a página de entrada da categoria, aberta ao clicar no nome dela.

### Imagens e arquivos

- Coloque imagens em `static/docs-img/` e use caminho absoluto: `![Descrição](/docs-img/minha-imagem.png)`.
- Arquivos para download (desafios, binários) ficam em `static/` (ex: `static/challs/`). Para linkar, use o prefixo `pathname://`: `[Baixar](pathname:///challs/desafio.zip)`. Sem esse prefixo, o Docusaurus trata o arquivo como uma página, e o download quebra.
- Para linkar outro artigo, use o caminho relativo do arquivo (ex: `[Format Strings](../stack/format-strings.md)`). Assim, o build avisa se o link quebrar.

### Movendo ou renomeando um artigo

Como o caminho do arquivo é a URL, mover um arquivo muda o link. Adicione a URL antiga na lista de `redirects` do plugin `@docusaurus/plugin-client-redirects`, em [docusaurus.config.js](./docusaurus.config.js), para os links antigos continuarem funcionando.

## Rodando localmente

O site é construído com [Docusaurus](https://docusaurus.io/) e precisa do Node.js 20 ou superior.

```bash
git clone https://github.com/AriiiAlves/CatchTheFox.git
cd CatchTheFox
npm install       # instala as dependências
npm start         # abre o site em http://localhost:3000/CatchTheFox/ com recarga automática
```

Antes de abrir um Pull Request, rode `npm run build`: ele falha se houver links ou imagens quebrados.

## Deploy

O site é publicado no GitHub Pages (branch `gh-pages`) com:

```bash
GIT_USER=<seu-usuario-do-github> npm run deploy
```

## Licença

[MIT](./LICENSE)
