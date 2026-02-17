import {defineConfig} from "vite";
import {reactRouter} from "@react-router/dev/vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(() => ({
    server: {
        host: "localhost",
        port: 5173,
    },
    plugins: [tailwindcss(), reactRouter()],
    resolve: {
        alias: {
            "@": path.resolve(process.cwd(), "./src"),
        },
    },
}));
