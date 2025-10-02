// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
import tailwind from '@astrojs/tailwind';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));

if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export default defineConfig({
  integrations: [tailwind(), react()],
  output: 'server',
  adapter: netlify(),
  vite: {
    resolve: {
      alias: {
        '@': resolve(root, 'src'),
        '@ui': resolve(root, 'src/components/ui'),
        '@images': resolve(root, 'src/lib/images'),
      },
    },
  },
});
