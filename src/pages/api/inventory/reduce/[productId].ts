import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('agora_token')?.value ?? '';
    const body = await request.json();
    const res = await fetch(`${API_URL}/api/inventory/daily/${params.productId}/reduce`, {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return new Response(JSON.stringify({ message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
