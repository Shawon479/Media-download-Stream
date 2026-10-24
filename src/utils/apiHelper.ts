/**
 * Safely fetches an API endpoint and parses JSON.
 * Throws a clean, human-readable error if the server returns non-JSON text (e.g., HTML error pages).
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, options);
  const text = await res.text();
  let data: any;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const cleanText = text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const snippet = cleanText.length > 120 ? `${cleanText.slice(0, 120)}...` : cleanText;
    throw new Error(
      !res.ok
        ? `Server Error (HTTP ${res.status}): ${snippet || 'Invalid server response'}`
        : 'Received non-JSON response from server.'
    );
  }

  return { ok: res.ok, status: res.status, data };
}
