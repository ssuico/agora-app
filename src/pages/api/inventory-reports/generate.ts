import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const POST: APIRoute = async ({ url, cookies }) => {
  try {
    const token = cookies.get('agora_token')?.value ?? '';
    const storeId = url.searchParams.get('storeId');
    const date = url.searchParams.get('date');
    const params = new URLSearchParams();
    if (storeId) params.set('storeId', storeId);
    if (date) params.set('date', date);
    const query = params.toString() ? `?${params}` : '';
    const res = await fetch(`${API_URL}/api/inventory-reports/generate${query}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return new Response(JSON.stringify({ message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
