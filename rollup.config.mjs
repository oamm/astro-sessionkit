import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

export default [
    {
        input: {
            index: "src/index.ts",
            server: "src/server.ts",
            middleware: "src/middleware.ts",
            guard: "src/guard.ts",
        },
        output: {
            dir: "dist",
            format: "esm",
            preserveModules: true,
            preserveModulesRoot: "src",
            entryFileNames: "[name].js",
            sourcemap: true,
        },
        external: [
            // Node.js built-ins
            "node:async_hooks",
            "node:crypto",

            // Astro
            "astro",
            "astro:middleware",
        ],
        plugins: [
            typescript({
                tsconfig: "./tsconfig.json",
                declaration: false,
                declarationMap: false,
                sourceMap: true,
            }),
        ]
    },
    {
        input: "src/index.ts",
        output: {
            file: "dist/index.d.ts",
            format: "esm",
        },
        external: ["astro", "astro:middleware"],
        plugins: [dts()],
    },
    {
        input: "src/server.ts",
        output: {
            file: "dist/server.d.ts",
            format: "esm",
        },
        external: ["astro", "astro:middleware"],
        plugins: [dts()],
    },
    {
        input: "src/middleware.ts",
        output: {
            file: "dist/middleware.d.ts",
            format: "esm",
        },
        external: ["astro", "astro:middleware"],
        plugins: [dts()],
    },
    {
        input: "src/guard.ts",
        output: {
            file: "dist/guard.d.ts",
            format: "esm",
        },
        external: ["astro", "astro:middleware"],
        plugins: [dts()],
    },
];