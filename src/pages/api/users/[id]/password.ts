import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const body = await request.json();
  const res = await fetch(`${API_URL}/api/users/${params.id}/password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newPassword: body?.newPassword }),
  });
  const data = await res.json();
  return new Response(JSON.stringify({ message: data.message }), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
