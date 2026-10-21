import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const GET: APIRoute = async ({ url, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const storeId = url.searchParams.get('storeId') ?? '';
  const res = await fetch(`${API_URL}/api/transactions/activity?storeId=${encodeURIComponent(storeId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
