import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "three",
      "three/addons/controls/OrbitControls.js",
      "three/addons/loaders/GLTFLoader.js",
    ],
  },
  server: {
    proxy: { "/api": process.env.FLOWPILOT_API_URL ?? "http://127.0.0.1:8000" },
  },
});
