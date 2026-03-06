import type { APIRoute } from 'astro';

const API_URL = import.meta.env.API_URL;

export const GET: APIRoute = async ({ url, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const params = new URLSearchParams();
  for (const key of ['storeId', 'date']) {
    const val = url.searchParams.get(key);
    if (val) params.set(key, val);
  }
  const query = params.toString() ? `?${params}` : '';
  const res = await fetch(`${API_URL}/api/inventory/daily/close-status${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
