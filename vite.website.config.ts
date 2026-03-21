import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

/** Marketing site only: never follow .env VITE_SERVER_URL into server adapter. */
const websiteEnvDefine = {
  __VITE_BACKEND__: JSON.stringify("mock"),
  "import.meta.env.VITE_BACKEND": JSON.stringify("mock"),
  "import.meta.env.VITE_SERVER_URL": JSON.stringify(""),
} as const;

function websiteRootRedirect(): Plugin {
  return {
    name: "rebebuca-website-root-redirect",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url === "/" || url === "/index.html") {
          res.statusCode = 302;
          res.setHeader("Location", "/website.html");
          res.end();
          return;
        }
        next();
      });
    },
  };
}

// Website-specific Vite config
export default defineConfig({
  define: { ...websiteEnvDefine },

  plugins: [
    websiteRootRedirect(),
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
