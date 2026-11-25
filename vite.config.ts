import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { isHandledRouteLoadError } from "./shared/route-load-errors";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    runtimeErrorOverlay({
      filter: error => !isHandledRouteLoadError(error),
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("/node_modules/")) return undefined;
          const packagePath = id.split("/node_modules/").pop() ?? "";

          if (/^(react|react-dom|scheduler)(\/|$)/.test(packagePath)) return "vendor-react";
          if (/^@tanstack\/react-query(\/|$)/.test(packagePath)) return "vendor-query";
          if (/^(recharts|d3-[^/]+|victory-vendor)(\/|$)/.test(packagePath)) return "vendor-charts";
          if (/^@radix-ui\//.test(packagePath) || /^@floating-ui\//.test(packagePath)) return "vendor-ui";
          if (/^lucide-react(\/|$)/.test(packagePath)) return "vendor-icons";
          if (/^jspdf-autotable(\/|$)/.test(packagePath)) return "vendor-pdf-table";
          if (/^jspdf(\/|$)/.test(packagePath)) return "vendor-jspdf";
          if (/^html2canvas(\/|$)/.test(packagePath)) return "vendor-html-canvas";
          if (/^(canvg|svg2pdf\.js)(\/|$)/.test(packagePath)) return "vendor-pdf-render";
          if (/^date-fns(\/|$)/.test(packagePath)) return "vendor-dates";
          if (/^(zod|drizzle-orm|@hookform\/resolvers)(\/|$)/.test(packagePath)) return "vendor-data";

          return undefined;
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
