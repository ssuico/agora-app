import { defineMiddleware } from 'astro:middleware';
import { decodeJWT } from './lib/jwt';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

export const onRequest = defineMiddleware(({ url, cookies }, next) => {
  const isPublic = PUBLIC_PATHS.some(
    (p) => url.pathname === p || url.pathname.startsWith(p + '/')
  );
  if (isPublic) return next();

  const isApiRoute = url.pathname.startsWith('/api/');

  const token = cookies.get('agora_token')?.value;
  if (!token) {
    if (isApiRoute) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return Response.redirect(new URL('/login', url));
  }

  const payload = decodeJWT(token);
  if (!payload) {
    cookies.delete('agora_token', { path: '/' });
    return Response.redirect(new URL('/login', url));
  }

  const { role } = payload;
  const path = url.pathname;

  if (path.startsWith('/admin') && role !== 'admin') {
    return Response.redirect(new URL('/login', url));
  }

  if (path.startsWith('/store/') && role !== 'store_manager' && role !== 'admin') {
    return Response.redirect(new URL('/login', url));
  }

  const customerPaths =
    path.startsWith('/shop/') ||
    path === '/select-location' ||
    path.startsWith('/select-store') ||
    path === '/purchases';

  if (customerPaths && role !== 'customer' && role !== 'admin') {
    return Response.redirect(new URL('/login', url));
  }

  return next();
});
