import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as { email?: string; code?: string; newPassword?: string };
    const res = await fetch(`${API_URL}/api/auth/forgot-password/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: body?.email,
        code: body?.code,
        newPassword: body?.newPassword,
      }),
    });
    const data = (await res.json()) as { message?: string };
    return new Response(JSON.stringify({ message: data.message ?? 'Could not reset password' }), {
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
