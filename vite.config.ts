import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Fix: VITE_SUPABASE_ANON_KEY in .env points to a stale project.
  // Force it to match the correct VITE_SUPABASE_PUBLISHABLE_KEY at build time.
  const env = { ...process.env };
  if (env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
