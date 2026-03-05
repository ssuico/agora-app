import type { APIRoute } from 'astro';

const API_URL = import.meta.env.API_URL;

export const GET: APIRoute = async ({ url, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const storeId = url.searchParams.get('storeId');
  const query = storeId ? `?storeId=${storeId}` : '';
  const res = await fetch(`${API_URL}/api/transaction-reports${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
