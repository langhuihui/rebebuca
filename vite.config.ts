import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";

// Check if building for web demo
const isWebBuild = process.env.VITE_BUILD_TARGET === 'web';
// Check if building the server-mode app (for npx rebebuca)
const isServerAppBuild = process.env.VITE_BUILD_TARGET === 'server';

// Get backend type from environment
const backendType = process.env.VITE_BACKEND || '';

console.log('[Vite Config] VITE_BACKEND:', backendType);

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    vue(),
    AutoImport({
      imports: [
        "vue",
        {
          "naive-ui": [
            "useDialog",
            "useMessage",
            "useNotification",
            "useLoadingBar"
          ]
        }
      ]
    }),
    Components({
      resolvers: [NaiveUiResolver()]
    }),
  ],
  
  // Define environment variables - use 'process.env.VITE_BACKEND' for replacement
  define: {
    '__VITE_BACKEND__': JSON.stringify(backendType),
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  
  build: isWebBuild ? {
    outDir: 'dist/web',
  } : isServerAppBuild ? {
    outDir: 'dist/server',
  } : {
    outDir: 'dist',
  },

  clearScreen: false,
  server: {
    port: 6173,
    strictPort: false,
    proxy: (backendType === 'server' || process.env.NODE_ENV !== 'production') ? {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:3000',
        ws: true,
        changeOrigin: true,
      },
    } : undefined,
  },
}));
