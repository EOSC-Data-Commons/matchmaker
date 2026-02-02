import {defineConfig} from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(({isSsrBuild}) => ({
    server: {
        host: "localhost",
        port: 5173,
        // Note: API proxying is handled by server.ts for SSR
    },
    build: {
        outDir: isSsrBuild ? "dist/server" : "dist/client",
        rollupOptions: isSsrBuild ? {
            input: "./src/entry-server.tsx",
        } : {
            input: "./index.html",
        },
    },
    ssr: {
        // Bundle these dependencies for SSR to avoid ESM/CJS compatibility issues
        // and ensure proper handling of CSS imports and client-side code
        noExternal: isSsrBuild ? [
            // UI libraries that import CSS or have browser-specific code
            'lucide-react',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@tanstack/react-query',
            'class-variance-authority',
            'tailwind-merge',
            'tailwindcss-animate',
            'react-icons',
            '@tailwindcss/vite',
        ] : undefined,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
}));
