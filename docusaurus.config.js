// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'CatchTheFox',
  tagline: 'Manual de Engenharia Reversa e Pwning em Português',
  favicon: 'img/logo.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://ariiialves.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/CatchTheFox/',
  // O GitHub Pages serve as páginas com "/" no final. Deixar isso explícito
  // evita redirecionamentos e URLs duplicadas (canonical diferente da URL real).
  trailingSlash: true,

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'ariiialves', // Usually your GitHub org/user name.
  projectName: 'CatchTheFox', // Usually your repo name.

  // Links quebrados fazem o build falhar: assim ninguém publica um link errado sem perceber
  onBrokenLinks: 'throw',
  deploymentBranch: 'gh-pages',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'pt-BR',
    locales: ['pt-BR'],
  },


  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
      onBrokenMarkdownImages: 'throw',
    }
  },

  headTags: [
    // og:title, og:description, og:url, og:image e twitter:image são gerados
    // automaticamente pelo Docusaurus para CADA página (a partir do título,
    // da descrição e de `themeConfig.image`). Não os defina aqui, senão todas
    // as páginas ficam com o mesmo título/descrição na prévia do link.
    {
      tagName: 'meta',
      attributes: { property: 'og:type', content: 'website' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:site_name', content: 'CatchTheFox' },
    },
    // A logo é quadrada (500x500): informar o tamanho ajuda as prévias de link
    {
      tagName: 'meta',
      attributes: { property: 'og:image:width', content: '500' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:image:height', content: '500' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:image:alt', content: 'Logo do CatchTheFox' },
    },
    {
      tagName: 'meta',
      attributes: { name: 'apple-mobile-web-app-title', content: 'CatchTheFox' },
    },
    {
      tagName: 'meta',
      attributes: { name: 'application-name', content: 'CatchTheFox' },
    },
    // Dados estruturados: ajudam o Google a mostrar "CatchTheFox" como nome do site
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'CatchTheFox',
        alternateName: ['Catch The Fox', 'CatchTheFox - Engenharia Reversa e Pwning'],
        url: 'https://ariiialves.github.io/CatchTheFox/',
        inLanguage: 'pt-BR',
        description: 'Manual em português de engenharia reversa, pwning e exploração de binários para CTFs.',
      }),
    },
  ],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          /*editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',*/
        },
          // ATIVAR BLOG SÓ DEPOIS
          // blog: {
          //   showReadingTime: true,
          //   feedOptions: {
          //     type: ['rss', 'atom'],
          //     xslt: true,
          //   },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          /*editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',*/
          // Useful options to enforce blogging best practices
        //   onInlineTags: 'warn',
        //   onInlineAuthors: 'warn',
        //   onUntruncatedBlogPosts: 'warn',
        // },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
        }
      }),
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        // URLs antigas (antes da reorganização das pastas) -> URLs novas.
        // Mantém funcionando os links já indexados pelo Google e compartilhados por aí.
        // Ao renomear ou mover um artigo, adicione aqui a URL antiga.
        redirects: [
          {from: '/introduction/beginning', to: '/introduction/'},
          {from: '/introduction/assembly/assembly', to: '/introduction/assembly/'},
          {from: '/introduction/assembly/2-1-coding-assembly', to: '/introduction/assembly/coding-assembly/'},
          {from: '/introduction/assembly/2-2-stack', to: '/introduction/assembly/stack/'},
          {from: '/introduction/assembly/2-3-assembly-pratica', to: '/introduction/assembly/analise-pratica/'},
          {from: '/pwning/beginning', to: '/pwning/'},
          {from: '/pwning/1-1-protections', to: '/pwning/protections/'},
          {from: '/pwning/stack/intro', to: '/pwning/stack/'},
          {from: '/pwning/stack/bof/2-0-bof', to: '/pwning/stack/buffer-overflow/'},
          {from: '/pwning/stack/bof/2-1-bof-variables', to: '/pwning/stack/buffer-overflow/variables/'},
          {from: '/pwning/stack/bof/2-2-bof-callfunction', to: '/pwning/stack/buffer-overflow/return-address/'},
          {from: '/pwning/stack/bof/2-3-bof-shellcode', to: '/pwning/stack/buffer-overflow/shellcode/'},
          {from: '/pwning/stack/bof/debruijn', to: '/pwning/stack/buffer-overflow/debruijn/'},
          {from: '/pwning/stack/got', to: '/pwning/stack/got-overwrite/'},
          {from: '/pwning/stack/rop/8-1-rop', to: '/pwning/stack/rop/'},
          {from: '/pwning/stack/rop/8-2-partial-overwrite', to: '/pwning/stack/rop/partial-overwrite/'},
          {from: '/pwning/stack/rop/8-3-stack-pivoting', to: '/pwning/stack/rop/stack-pivoting/'},
          {from: '/pwning/stack/rop/8-4-sigrop', to: '/pwning/stack/rop/sigrop/'},
          {from: '/pwning/stack/rop/8-5-ret2libc', to: '/pwning/stack/rop/ret2libc/'},
          {from: '/pwning/heap/malloc_consolidate', to: '/pwning/heap/malloc-consolidate/'},
          {from: '/pwning/heap/malloc-maleficarum/intro', to: '/pwning/heap/malloc-maleficarum/'},
          {from: '/pwning/others/intro', to: '/pwning/others/'},
          {from: '/fast-food/beginning', to: '/fast-food/'},
          {from: '/fast-food/pwning/beginning', to: '/fast-food/pwning/'},
          {from: '/fast-food/pwning/bof', to: '/fast-food/pwning/bof-variables/'},
          {from: '/fast-food/pwning/bof-callfunction', to: '/fast-food/pwning/bof-return-address/'},
          {from: '/fast-food/pwning/pwning_handbook', to: '/fast-food/pwning/handbook/'},
          {from: '/writeups/intro', to: '/writeups/'},
          {from: '/extra/intro', to: '/extra/'},
          {from: '/extra/syscall-tb', to: '/extra/syscall-table/'},
          {from: '/extra/shellcraft-li', to: '/extra/shellcraft/'},
          {from: '/reversing/cpp-reversing/beginning', to: '/reversing/cpp/'},
          {from: '/reversing/cpp-reversing/cpp-classes', to: '/reversing/cpp/classes/'},
        ],
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      metadata: [
        { name: 'keywords', content: 'catchthefox, catch the fox, engenharia reversa, pwning, pwn, exploração de binários, binary exploitation, exploit development, ctf, ctf em português, buffer overflow, rop, heap exploitation, format string, assembly, gdb, ghidra, pwntools, ganesh, icmc'},
        { name: 'description', content: 'CatchTheFox é um manual em português de engenharia reversa, pwning e exploração de binários para CTFs: assembly, buffer overflow, ROP, heap e muito mais.'},
        // Logo quadrada: o card "summary" mostra a imagem inteira (o "summary_large_image" cortaria)
        { name: 'twitter:card', content: 'summary'}
      ],
      tableOfContents: {
        maxHeadingLevel: 5, // Inclui até ##### (h5)
      },
      // Replace with your project's social card
      image: 'img/logo.png',
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'CatchTheFox',
        logo: {
          alt: 'Logo do CatchTheFox',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Guia',
          },
          /*{to: '/blog', label: 'Blog', position: 'left'},*/ // Ativar futuramente caso queira fazer um blog
          {
            href: 'https://github.com/AriiiAlves/CatchTheFox',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Aprenda',
            items: [
              {
                label: 'Guia',
                to: '/',
              },
            ],
          },
          {
            title: 'Comunidade',
            items: [
              {
                label: 'Discord',
                href: 'https://discord.gg/pFSq368vu7',
              }
            ],
          },
          {
            title: 'Mais',
            items: [
              /*{
                label: 'Blog',
                to: '/blog',
              },*/
              {
                label: 'GitHub',
                href: 'https://github.com/AriiiAlves/CatchTheFox',
              },
            ],
          },
        ],
        /*copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,*/
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
