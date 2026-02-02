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
        noExternal: isSsrBuild ? [] : undefined,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@shared": path.resolve(__dirname, "./shared"),
        },
    },
}));
