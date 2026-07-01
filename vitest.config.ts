import {defineConfig} from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Separate from vite.config.ts on purpose: the reactRouter() plugin used for
// the app build is not compatible with the Vitest runner.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(process.cwd(), "./src"),
        },
    },
    test: {
        environment: "happy-dom",
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.test.{ts,tsx}"],
        coverage: {
            provider: "v8",
            include: ["src/lib/**", "src/hooks/**"],
            // Server-side gRPC client is exercised via the express server, not the browser bundle
            exclude: ["src/lib/server/**"],
            // Ratchet up, never down.
            thresholds: {
                "src/lib/**": {
                    lines: 80,
                },
                "src/hooks/**": {
                    lines: 70,
                },
            },
        },
    },
});
