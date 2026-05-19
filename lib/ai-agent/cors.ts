// Public agent endpoints get permissive CORS so they can be hit from any
// client-site embed or from any AI agent crawler.
export const PUBLIC_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Site-Key',
  'Access-Control-Max-Age': '86400',
};

export function withCors(init: ResponseInit = {}): ResponseInit {
  return {
    ...init,
    headers: { ...PUBLIC_CORS_HEADERS, ...(init.headers as Record<string, string> | undefined) },
  };
}
