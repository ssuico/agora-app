import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const POST: APIRoute = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('agora_token')?.value ?? '';
    const body = await request.text();
    const res = await fetch(`${API_URL}/api/store-sheets/export/store/${params.storeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body,
    });

    if (!res.ok) {
      const data = await res.text();
      return new Response(data, {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          res.headers.get('Content-Type') ||
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': res.headers.get('Content-Disposition') || 'attachment',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return new Response(JSON.stringify({ message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
