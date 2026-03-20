import { defineMiddleware } from 'astro:middleware';
import { decodeJWT } from './lib/jwt';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

function redirect(path: string) {
  return new Response(null, { status: 302, headers: { Location: path } });
}

export const onRequest = defineMiddleware(async ({ url, cookies }, next) => {
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
    // When returning a custom redirect, Astro does not attach cookie changes to the response.
    // Send Set-Cookie to clear the token so the browser doesn't send it again (avoids redirect loop).
    const clearCookie =
      'agora_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' +
      (import.meta.env.PROD ? '; Secure' : '');
    return new Response(null, {
      status: 302,
      headers: { Location: '/login', 'Set-Cookie': clearCookie },
    });
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

  const response = await next();

  // Prevent the browser from caching authenticated pages in its back/forward
  // cache (bfcache). Without this, pressing the back button after logout serves
  // a stale cached page from memory — the server is never contacted and the
  // middleware never runs, so the user sees protected content while logged out.
  if (!isApiRoute) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
});
