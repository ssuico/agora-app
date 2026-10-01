import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as { email?: string };
    const res = await fetch(`${API_URL}/api/auth/forgot-password/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body?.email }),
    });
    const data = (await res.json()) as { message?: string; retryAfterSeconds?: number; email?: string };
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ message: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
