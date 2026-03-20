import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    const token = cookies.get('agora_token')?.value ?? '';
    const params = new URLSearchParams();
    const storeId = url.searchParams.get('storeId');
    if (storeId) params.set('storeId', storeId);
    const query = params.toString() ? `?${params}` : '';
    const res = await fetch(`${API_URL}/api/inventory/listing-history${query}`, {
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
