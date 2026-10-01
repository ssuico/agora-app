import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const token = cookies.get('agora_token')?.value ?? '';
    const body = (await request.json()) as { role?: string };

    const res = await fetch(`${API_URL}/api/auth/switch-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role: body.role }),
    });

    const data = (await res.json()) as {
      token?: string;
      role?: string;
      roles?: string[];
      storeIds?: string[];
      message?: string;
    };

    if (!res.ok || !data.token) {
      return new Response(JSON.stringify({ message: data.message ?? 'Could not switch view' }), {
        status: res.status === 200 ? 500 : res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    cookies.set('agora_token', data.token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    return new Response(
      JSON.stringify({ role: data.role, roles: data.roles, storeIds: data.storeIds }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(JSON.stringify({ message: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
