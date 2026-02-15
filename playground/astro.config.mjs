import {defineConfig} from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sessionkit from '../src/integration.ts';

// https://astro.build/config
export default defineConfig({
    output: 'server',
    adapter: {
        name: 'mock-adapter',
        hooks: {}
    },
    session: {
        driver: "memory",
        cookie: {
            name: "my-session-cookie",
            sameSite: "lax",
            secure: true,
        },
    },
    vite: {
        plugins: [tailwindcss()]
    },
    integrations: [
        sessionkit({
            loginPath: '/login',
            globalProtect: true,
            exclude: ['/', '/login', '/public/**', '/api/auth/login'],
            debug: true,
            protect: [
                {pattern: '/admin/**', role: 'admin'}
            ]
        })
    ]
});
