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
  tagline: 'Cyber HandBook em Português',
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

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'ariiialves', // Usually your GitHub org/user name.
  projectName: 'CatchTheFox', // Usually your repo name.

  onBrokenLinks: 'ignore',
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
      onBrokenMarkdownImages: 'throw'
    }
  },

  headTags: [
    {
      tagName: 'meta',
      attributes: { property: 'og:title', content: 'CatchTheFox - Manual de Pwning' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:description', content: 'Manual completo de técnicas de pwning e exploit development para CTFs em Português-BR' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:image', content: 'https://ariiialves.github.io/manual-pwning/img/logo.png' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:url', content: 'https://ariiialves.github.io/manual-pwning/' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:type', content: 'website' },
    },
    {
      tagName: 'meta',
      attributes: { property: 'og:locale', content: 'pt_BR' },
    },
    {
      tagName: 'meta',
      attributes: { name: 'twitter:card', content: 'summary_large_image' },
    },
    {
      tagName: 'meta',
      attributes: { name: 'twitter:image', content: 'https://ariiialves.github.io/manual-pwning/img/logo.png' },
    },
    // Meta tag adicional para o título
    {
      tagName: 'meta',
      attributes: { name: 'apple-mobile-web-app-title', content: 'CatchTheFox' },
    },
    {
      tagName: 'meta',
      attributes: { name: 'application-name', content: 'CatchTheFox' },
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

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      metadata: [
        { name: 'keywords', content: 'catchthefox, catch the fox, pwning, cybersecurity, ctf, binary exploitation, hacking'},
        { name: 'description', content: 'CatchTheFox é um cyber handbook em português de técnicas de pwning e exploit development para CTFs.'}
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
          alt: 'My Site Logo',
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
            href: 'https://github.com/ariiialves/manual-pwning',
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
                href: 'https://github.com/ariiialves/manual-pwning',
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
