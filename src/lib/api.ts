function getBaseUrl(): string {
  if (import.meta.env.API_URL) return import.meta.env.API_URL as string;
  const port = typeof process !== 'undefined' && process.env?.PORT ? process.env.PORT : '3001';
  return `http://localhost:${port}`;
}

const BASE_URL = getBaseUrl();

export function createApiClient(token: string) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  return {
    async get<T = unknown>(path: string): Promise<T> {
      const res = await fetch(`${BASE_URL}${path}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error((err as { message: string }).message ?? `API error ${res.status}`);
      }
      return res.json() as Promise<T>;
    },

    async post<T = unknown>(path: string, body: unknown): Promise<T> {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error((err as { message: string }).message ?? `API error ${res.status}`);
      }
      return res.json() as Promise<T>;
    },

    async put<T = unknown>(path: string, body: unknown): Promise<T> {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error((err as { message: string }).message ?? `API error ${res.status}`);
      }
      return res.json() as Promise<T>;
    },

    async patch<T = unknown>(path: string, body: unknown): Promise<T> {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error((err as { message: string }).message ?? `API error ${res.status}`);
      }
      return res.json() as Promise<T>;
    },

    async del(path: string): Promise<void> {
      const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error((err as { message: string }).message ?? `API error ${res.status}`);
      }
    },
  };
}
