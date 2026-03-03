import type { APIRoute } from 'astro';

const API_URL = import.meta.env.API_URL;

export const GET: APIRoute = async ({ params, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const res = await fetch(`${API_URL}/api/stores/by-location/${params.locationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
