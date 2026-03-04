import { defineMiddleware } from 'astro:middleware';
import { decodeJWT } from './lib/jwt';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

function redirect(path: string) {
  return new Response(null, { status: 302, headers: { Location: path } });
}

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
    return redirect('/login');
  }

  const payload = decodeJWT(token);
  if (!payload) {
    cookies.delete('agora_token', { path: '/' });
    return redirect('/login');
  }

  const { role } = payload;
  const path = url.pathname;

  if (path.startsWith('/admin') && role !== 'admin') {
    return redirect('/login');
  }

  if (path.startsWith('/store/') && role !== 'store_manager' && role !== 'admin') {
    return redirect('/login');
  }

  const customerPaths =
    path.startsWith('/shop/') ||
    path === '/select-location' ||
    path.startsWith('/select-store') ||
    path === '/purchases';

  if (customerPaths && role !== 'customer' && role !== 'admin') {
    return redirect('/login');
  }

  return next();
});
