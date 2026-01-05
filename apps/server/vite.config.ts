import build from "@hono/vite-cloudflare-pages";
import adapter from "@hono/vite-dev-server/cloudflare";
import honox from "honox/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  if (mode === "client") {
    return {
      build: {
        rollupOptions: {
          onwarn(warning, warn) {
            if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
              return;
            }
            warn(warning);
          },
          input: ["./app/client.ts", "@mantine/core/styles.css"],
          output: {
            entryFileNames: "static/client.js",
            chunkFileNames: "static/assets/[name]-[hash].js",
            assetFileNames: "static/assets/[name].[ext]",
          },
        },
        emptyOutDir: true,
      },
    };
  }

  return {
    plugins: [honox({ devServer: { adapter } }), build()],
    ssr: {
      external: [
        "react",
        "react-dom",
        "@freee-line-notifier/prisma",
        "@mantine/core",
        "@mantine/form",
        "@line/liff",
        "@line/bot-sdk",
      ],
    },
  };
});
