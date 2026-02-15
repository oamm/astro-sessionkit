import { defineMiddleware } from 'astro:middleware';
import { setSession } from 'astro-sessionkit/server';

export const onRequest = defineMiddleware(async (context, next) => {
  // Simple session mock for testing
  const sessionData = context.cookies.get('__session_mock__')?.json();
  
  if (sessionData && context.session) {
    setSession(sessionData);
  }
  
  return next();
});
