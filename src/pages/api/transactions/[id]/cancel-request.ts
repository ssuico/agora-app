import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

async function forward(method: 'POST' | 'PATCH', id: string | undefined, token: string, request: Request) {
  const body = await request.json().catch(() => ({}));
  const res = await fetch(`${API_URL}/api/transactions/${id}/cancel-request`, {
    method,
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
}

/** Customer asks to cancel their own order. */
export const POST: APIRoute = async ({ params, cookies, request }) =>
  forward('POST', params.id, cookies.get('agora_token')?.value ?? '', request);

/** Store manager approves or declines the request. */
export const PATCH: APIRoute = async ({ params, cookies, request }) =>
  forward('PATCH', params.id, cookies.get('agora_token')?.value ?? '', request);
