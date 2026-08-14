'use client';

import { API_BASE_URL, API_PREFIX, ApiError } from './api';

async function fetchPdf(url: string): Promise<Response> {
  const response = await fetch(url, { credentials: 'include' });
  if (response.status !== 401) return response;
  // One refresh-and-retry, mirroring the JSON client's behavior.
  const refreshed = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!refreshed.ok) return response;
  return fetch(url, { credentials: 'include' });
}

function filenameFrom(response: Response, fallback: string): string {
  const header = response.headers.get('content-disposition') ?? '';
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]);
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ?? fallback;
}

/** Downloads the project report PDF, surfacing API errors as ApiError. */
export async function downloadProjectPdf(projectId: string, locale: string): Promise<void> {
  const url = `${API_BASE_URL}${API_PREFIX}/projects/${projectId}/export/pdf?locale=${encodeURIComponent(locale)}`;
  const response = await fetchPdf(url);

  if (!response.ok) {
    let code = 'INTERNAL';
    let message = 'PDF export failed';
    try {
      const body = (await response.json()) as { code?: string; message?: string };
      code = body.code ?? code;
      message = body.message ?? message;
    } catch {
      // Non-JSON error body — keep the generic shape.
    }
    throw new ApiError({ statusCode: response.status, code, message });
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filenameFrom(response, `archai-${projectId}.pdf`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Give the browser a beat to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000);
  }
}
