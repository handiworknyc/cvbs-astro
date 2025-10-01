// astro.config.mjs
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import netlify from "@astrojs/netlify/functions"; // ✅ use the Netlify Functions adapter

export default defineConfig({
  output: "server",               // SSR
  adapter: netlify(),
  integrations: [tailwind(), react()],
  trailingSlash: 'ignore', 
  vite: {
    resolve: {
      alias: {
        "@": "/src",
        "@ui": "/src/components/ui",
        "@images": "/src/lib/images",
      },
    },
  },
});
