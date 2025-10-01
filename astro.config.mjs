import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

import netlify from '@astrojs/netlify';

export default defineConfig({
  integrations: [tailwind(), react()],
  output: 'server',
  adapter: netlify(),
  vite: {
    resolve: {
      alias: {
        '@': '/src',
        '@ui': '/src/components/ui',
        '@images': '/src/lib/images',
      },
    },
  },
});