import { defineConfig } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';

// Site URL used for sitemap generation and canonical/OpenGraph tags.
const siteUrl = 'https://leighton-tidwell.github.io/agentic-asana-cli/';

export default defineConfig({
  title: 'Agentic Asana CLI',
  description: 'A JSON-first Asana CLI (asn) designed for coding agents.',
  lang: 'en-US',

  // GitHub Pages project-site base path: https://<user>.github.io/agentic-asana-cli/
  base: '/agentic-asana-cli/',

  cleanUrls: true,

  vite: {
    plugins: [
      // Auto-generates a per-page LLM-readable markdown variant (<page>.md) plus a root
      // llms.txt router linking every page, regenerated from the markdown source on every
      // `docs:build` — never hand-maintained.
      // excludeIndexPage: false because our index.md is real landing-page content (not
      // an empty stub), so it should get an LLM-readable variant and a llms.txt entry too.
      llmstxt({ excludeIndexPage: false }),
    ],
  },

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
      { text: 'Upgrading', link: '/upgrading/' },
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
          { text: 'Upgrading', link: '/upgrading/' },
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
