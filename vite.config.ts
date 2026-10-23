import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { isPublicSupabaseKey } from "./src/domain.ts";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const key = env.VITE_BACKEND_ENABLED !== "false" ? env.VITE_SUPABASE_ANON_KEY : "";
  if (key && !isPublicSupabaseKey(key)) {
    throw new Error(
      "VITE_SUPABASE_ANON_KEY phải là anon JWT hoặc publishable key; không đưa secret/service-role key vào frontend.",
    );
  }
  return {
    plugins: [react()],
    server: { host: "127.0.0.1", port: 4173, strictPort: true },
    build: { outDir: "dist", emptyOutDir: true },
    test: { include: ["tests/**/*.test.ts"] },
  };
});
