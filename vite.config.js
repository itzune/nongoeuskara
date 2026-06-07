import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    cors: true,
  },
  // Copy the WASM files to the public dir
  optimizeDeps: {
    exclude: ["fasttext.wasm.js"],
  },
  build: {
    target: "esnext",
  },
});
