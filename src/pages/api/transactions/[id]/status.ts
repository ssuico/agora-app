import type { APIRoute } from 'astro';

const API_URL = import.meta.env.API_URL;

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const body = await request.json();
  const res = await fetch(`${API_URL}/api/transactions/${params.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
