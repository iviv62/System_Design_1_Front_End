import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Serve index.html for all routes so the SPA router handles them.
    historyApiFallback: true,
    proxy: {
      "/ws": {
        target: "http://127.0.0.1:8000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
