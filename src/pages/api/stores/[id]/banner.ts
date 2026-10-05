import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

const jsonError = (message: string, status: number) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async ({ params, cookies }) => {
  try {
    const token = cookies.get('agora_token')?.value ?? '';
    const res = await fetch(`${API_URL}/api/stores/${params.id}/banner`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ message: 'Banner not available' }));
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(await res.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': res.headers.get('Cache-Control') || 'private, max-age=86400',
      },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Proxy error', 502);
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('agora_token')?.value ?? '';
    const body = await request.json();
    const res = await fetch(`${API_URL}/api/stores/${params.id}/banner`, {
      method: 'PUT',
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
    return jsonError(err instanceof Error ? err.message : 'Proxy error', 502);
  }
};
