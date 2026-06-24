import type {
  DeleteResponse,
  ItemMetadata,
  ListItemsResponse,
  PatchItemRequest,
  PatchItemResponse,
  ProcessResponse,
  ReorderRequest,
  ReorderResponse,
  UploadResponse,
} from '@shared/types';

const TOKEN_KEY = 'klzt.authToken';

export function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setAuthToken(token: string): void {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const json = text ? safeParse(text) : null;

  if (!res.ok) {
    const msg =
      (json && typeof json === 'object' && 'error' in json
        ? String((json as { error: unknown }).error)
        : `Request failed: ${res.status}`) || `Request failed: ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return json as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  listItems(): Promise<ListItemsResponse> {
    return request<ListItemsResponse>('/api/items');
  },

  uploadFiles(files: File[]): Promise<UploadResponse> {
    const form = new FormData();
    for (const f of files) form.append('file', f, f.name);
    return request<UploadResponse>('/api/upload', {
      method: 'POST',
      body: form,
    });
  },

  reorder(ids: string[]): Promise<ReorderResponse> {
    const body: ReorderRequest = { ids };
    return request<ReorderResponse>('/api/items/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  process(id: string): Promise<ProcessResponse> {
    return request<ProcessResponse>(`/api/items/${encodeURIComponent(id)}/process`, {
      method: 'POST',
    });
  },

  patchItem(id: string, metadata: Partial<ItemMetadata>): Promise<PatchItemResponse> {
    const body: PatchItemRequest = { metadata };
    return request<PatchItemResponse>(`/api/items/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  delete(id: string): Promise<DeleteResponse> {
    return request<DeleteResponse>(`/api/items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

export { ApiError };
