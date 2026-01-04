import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

// Website-specific Vite config
export default defineConfig({
  plugins: [
    vue(),
    // Copy website-only assets to output
    viteStaticCopy({
      targets: [
        {
          src: 'public-website/*',
          dest: '.'
        }
      ]
    })
  ],
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  
  // Build configuration for website
  build: {
    outDir: 'dist/website',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'website.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
  },

  // Dev server configuration
  server: {
    port: 5174,
    strictPort: true,
    open: '/website.html',
  },
});
