import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const GET: APIRoute = async ({ url, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const params = new URLSearchParams();
  const storeId = url.searchParams.get('storeId');
  const days = url.searchParams.get('days');
  if (storeId) params.set('storeId', storeId);
  if (days) params.set('days', days);
  const res = await fetch(`${API_URL}/api/reports/dashboard-analytics?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
