import { defineConfig } from 'vitepress';

// Site URL used for sitemap generation and canonical/OpenGraph tags.
const siteUrl = 'https://leighton-tidwell.github.io/agentic-asana-cli/';

export default defineConfig({
  title: 'Agentic Asana CLI',
  description: 'A JSON-first Asana CLI (asn) designed for coding agents.',
  lang: 'en-US',

  // GitHub Pages project-site base path: https://<user>.github.io/agentic-asana-cli/
  base: '/agentic-asana-cli/',

  cleanUrls: true,

  // Emits sitemap.xml into the build output automatically.
  sitemap: {
    hostname: siteUrl,
  },

  head: [
    ['link', { rel: 'icon', href: '/agentic-asana-cli/favicon.svg' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Agentic Asana CLI' }],
    ['meta', { property: 'og:title', content: 'Agentic Asana CLI' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'A JSON-first Asana CLI (asn) designed for coding agents.',
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary' }],
  ],

  themeConfig: {
    siteTitle: 'Agentic Asana CLI',
    logo: '/logo.svg',

    nav: [
      { text: 'Usage', link: '/usage/' },
      { text: 'Commands', link: '/commands/' },
      { text: 'Configuration', link: '/configuration/' },
      {
        text: 'GitHub',
        link: 'https://github.com/leighton-tidwell/agentic-asana-cli',
      },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Usage', link: '/usage/' },
          { text: 'Commands', link: '/commands/' },
          { text: 'Configuration', link: '/configuration/' },
        ],
      },
    ],

    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/leighton-tidwell/agentic-asana-cli',
      },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Leighton Tidwell',
    },

    search: {
      provider: 'local',
    },
  },
});
