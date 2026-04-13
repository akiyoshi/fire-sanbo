import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: "/fire-sanbo/",
  plugins: [react(), tsconfigPaths()],
  worker: {
    format: "es",
    plugins: () => [tsconfigPaths()],
  },
});
