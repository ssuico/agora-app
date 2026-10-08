import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const GET: APIRoute = async ({ url, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const params = new URLSearchParams();
  const storeId = url.searchParams.get('storeId');
  if (storeId) params.set('storeId', storeId);
  const query = params.toString() ? `?${params}` : '';
  const res = await fetch(`${API_URL}/api/preorders/history${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
