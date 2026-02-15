import type { APIRoute } from 'astro';
import { setSession } from 'astro-sessionkit/server';

export const POST: APIRoute = async (context) => {
    const { request, cookies, redirect } = context;
    const formData = await request.formData();
    const role = formData.get('role');
    const email = formData.get('email');

    if (email) {
        const sessionData = {
            userId: 'user_123',
            email: email as string,
            role: (role as string) || 'user'
        };

        cookies.set('__session_mock__', sessionData, { path: '/' });
        
        if (context.session) {
            setSession(sessionData);
        }

        return redirect('/dashboard');
    }

    return redirect('/login?error=missing_email');
};
