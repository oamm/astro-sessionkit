import type { APIRoute } from 'astro';
import {clearSession} from "astro-sessionkit/server.ts";

export const GET: APIRoute = ({ cookies, redirect }) => {
    clearSession();
    return redirect('/');
};
