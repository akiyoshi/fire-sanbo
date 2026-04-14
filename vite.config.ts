import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

function cspPlugin(): Plugin {
  return {
    name: "html-csp",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const csp = [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "connect-src 'self'",
          "worker-src 'self' blob:",
          "font-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; ");
        return html.replace(
          "<head>",
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp};" />`,
        );
      },
    },
  };
}

export default defineConfig({
  base: "/fire-sanbo/",
  plugins: [react(), tsconfigPaths(), cspPlugin()],
  worker: {
    format: "es",
    plugins: () => [tsconfigPaths()],
  },
});
