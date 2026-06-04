// Root middleware — runs for every request (static assets + Functions).
// Canonicalizes the host: www.gge.ohwpstudios.org → gge.ohwpstudios.org (301),
// preserving path + query. Everything else passes straight through, where the
// api/_middleware.js (CORS, error boundary) and static asset handling take over.

export async function onRequest(context) {
  const url = new URL(context.request.url)
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4)
    return Response.redirect(url.toString(), 301)
  }
  return context.next()
}
