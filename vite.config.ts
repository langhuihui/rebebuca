import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

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
    })
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
  
  // Tauri build uses 'public', website build merges 'public' + 'public-website' via plugin
  
  // Build configuration based on target
  build: isWebBuild ? {
    // Web app build: outputs to dist/web  
    outDir: 'dist/web',
  } : isServerAppBuild ? {
    // Server-mode build: outputs to dist/server (for npx rebebuca)
    outDir: 'dist/server',
  } : {
    // Tauri app build: outputs to dist
    outDir: 'dist',
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    // Proxy API/WS to node-server in dev so /api/proxy and /ws work (backend must be on 3000)
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
