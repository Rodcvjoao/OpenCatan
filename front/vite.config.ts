import { defineConfig } from "vite";

// Frontend is its own Vite project rooted at `front/`.
// Static assets (textures) live in `public/` and are served at `/assets/...`.
// Dev server port matches the README/AGENTS workflow.
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
});
