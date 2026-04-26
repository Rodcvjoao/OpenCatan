import { defineConfig } from "vite";

// Frontend is its own Vite project rooted at `front/`.
// Static assets (textures) live in `public/` and are served at `/assets/...`.
// Dev server port matches the README/AGENTS workflow.
//
// `host: true` makes both `vite` (dev) and `vite preview` bind to
// 0.0.0.0 so the app is reachable from other PCs on the same LAN.
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
});
