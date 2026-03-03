import type { APIRoute } from 'astro';

export const POST: APIRoute = ({ cookies }) => {
  cookies.delete('agora_token', { path: '/' });
  return new Response(null, {
    status: 302,
    headers: { Location: '/login' },
  });
};
