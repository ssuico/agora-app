import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const POST: APIRoute = async ({ url, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const params = new URLSearchParams();
  const storeId = url.searchParams.get('storeId');
  if (storeId) params.set('storeId', storeId);
  const dateFrom = url.searchParams.get('dateFrom');
  if (dateFrom) params.set('dateFrom', dateFrom);
  const dateTo = url.searchParams.get('dateTo');
  if (dateTo) params.set('dateTo', dateTo);
  const query = params.toString() ? `?${params}` : '';
  const res = await fetch(`${API_URL}/api/transaction-reports/generate${query}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
