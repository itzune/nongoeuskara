import { defineConfig } from "vite";

// GitHub Pages deploys to /zeineuski-wasm/
const base = "/zeineuski-wasm/";

export default defineConfig({
  base,
  server: {
    port: 3000,
  },
  optimizeDeps: {
    exclude: ["fasttext.wasm.js"],
  },
  build: {
    target: "esnext",
    outDir: "dist",
  },
  // Plugin to serve .wasm with correct MIME type in dev
  plugins: [
    {
      name: "wasm-mime-fix",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith(".wasm")) {
            res.setHeader("Content-Type", "application/wasm");
          }
          next();
        });
      },
    },
  ],
});
