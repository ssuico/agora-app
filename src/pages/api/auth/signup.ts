import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: body?.name,
        email: body?.email,
        password: body?.password,
      }),
    });
    const data = (await res.json()) as {
      token?: string;
      role?: string;
      name?: string;
      storeIds?: string[];
      message?: string;
      verificationRequired?: boolean;
      email?: string;
    };

    if (!res.ok) {
      return new Response(JSON.stringify({ message: data.message ?? 'Could not create account' }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (data.verificationRequired) {
      return new Response(
        JSON.stringify({
          verificationRequired: true,
          message: data.message,
          email: data.email,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    cookies.set('agora_token', data.token!, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    return new Response(JSON.stringify({ role: data.role, name: data.name, storeIds: data.storeIds }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ message: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
