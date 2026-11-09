export function isSameOriginPost(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
