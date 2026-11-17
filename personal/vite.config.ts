import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
export default defineConfig({
  root: path.resolve(__dirname),
  base: "./",
  publicDir: false,
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "../src") } },
  server: { host: "0.0.0.0", port: 5181 },
  build: { outDir: "dist", emptyOutDir: true },
});
