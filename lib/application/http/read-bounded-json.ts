export async function readBoundedJson(
  request: Request,
  maximumBytes = 16_384,
): Promise<unknown | null> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    return null;
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maximumBytes) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
