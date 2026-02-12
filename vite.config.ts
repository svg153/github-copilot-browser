import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [crx({ manifest }), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        panel: "src/panel/index.html",
        popup: "src/popup/index.html",
        "content-script": "src/content/content-script.ts",
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "content-script") {
            return "content-script.js";
          }
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
