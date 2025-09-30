import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind(), react()],
  output: 'server',
  adapter: node({ mode: 'standalone' }),
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
