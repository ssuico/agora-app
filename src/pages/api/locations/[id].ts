import type { APIRoute } from 'astro';

const API_URL = import.meta.env.API_URL;

export const GET: APIRoute = async ({ params, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const res = await fetch(`${API_URL}/api/locations/${params.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const body = await request.json();
  const res = await fetch(`${API_URL}/api/locations/${params.id}`, {
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
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const token = cookies.get('agora_token')?.value ?? '';
  const res = await fetch(`${API_URL}/api/locations/${params.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
