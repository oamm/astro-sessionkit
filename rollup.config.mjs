import typescript from "@rollup/plugin-typescript";

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
                declaration: true,
                declarationDir: "dist",
            }),
        ]
    },
];