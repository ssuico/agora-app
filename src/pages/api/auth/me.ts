import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const body = await request.json();
  const res = await fetch(`${API_URL}/api/auth/me`, {
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
