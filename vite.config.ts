import { defineConfig } from "vite";
import { resolve } from "node:path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts({ rollupTypes: false })],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        register: resolve(__dirname, "src/register.ts"),
        "sse/sse-client": resolve(__dirname, "src/sse/sse-client.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: ["streaming-markdown", "dompurify"],
      output: {
        preserveModules: false,
        entryFileNames: "[name].js",
      },
    },
    target: "es2022",
    sourcemap: true,
    minify: false,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
