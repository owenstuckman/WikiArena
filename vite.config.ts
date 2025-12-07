import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  define: {
    // Fix for some libraries that check for process.env
    'process.env': {},
  },
  optimizeDeps: {
    exclude: ['@supabase/supabase-js'],
  },
});
