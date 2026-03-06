import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    const token = cookies.get('agora_token')?.value ?? '';
    const params = new URLSearchParams();
    for (const key of ['storeId', 'date']) {
      const val = url.searchParams.get(key);
      if (val) params.set(key, val);
    }
    const query = params.toString() ? `?${params}` : '';
    const res = await fetch(`${API_URL}/api/reports/inventory${query}`, {
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
