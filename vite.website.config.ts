import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

// Website-specific Vite config
export default defineConfig({
  plugins: [
    vue({
      template: {
        transformAssetUrls: {
          // Don't transform absolute URLs starting with /
          // This prevents Vite from treating /logo.svg as a module import
          base: null,
          includeAbsolute: false,
        }
      }
    }),
    // Copy both public directories' assets to output during build
    viteStaticCopy({
      targets: [
        {
          src: 'public-website/*',
          dest: '.'
        },
        {
          src: 'public/*',
          dest: '.'
        }
      ]
    })
  ],
  
  // Use public-website as the primary public directory
  // Shared assets from public/ are symlinked to public-website/
  publicDir: 'public-website',
  
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
