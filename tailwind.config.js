/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{astro,html,js,jsx,ts,tsx,vue,svelte}",
  ],
  theme: {
    extend: {},
  },
  corePlugins: {
    visibility: false, // disables .collapse, .visible, .invisible
  },
  plugins: [],
};
