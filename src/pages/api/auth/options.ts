import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

const API_URL = getApiBase();

export const GET: APIRoute = async () => {
  try {
    const res = await fetch(`${API_URL}/api/auth/options`);
    const data = (await res.json()) as { emailVerificationEnabled?: boolean; message?: string };
    return new Response(JSON.stringify({ emailVerificationEnabled: data.emailVerificationEnabled === true }), {
      status: res.ok ? 200 : res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ emailVerificationEnabled: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
