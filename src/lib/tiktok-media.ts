const ORIGIN = 'https://delicacy-regime-herbs.ngrok-free.dev/webhook/tiktok-approved-media';
const MAX_BYTES = 64 * 1024 * 1024;
const securityHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
};

export async function serveTikTokMedia(request: Request, ticket: string | undefined, fetcher: typeof fetch = fetch): Promise<Response> {
  const deny = (status: number) => new Response(request.method === 'HEAD' ? null : 'Media unavailable', {
    status, headers: { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8', ...(status === 405 ? {Allow:'GET, HEAD'} : {}) },
  });
  if (!['GET','HEAD'].includes(request.method)) return deny(405);
  if (!ticket || !/^[a-f0-9]{64}$/.test(ticket) || new URL(request.url).search) return deny(404);
  const range = request.headers.get('Range');
  if (range && (range.length > 80 || !/^bytes=(\d+-\d*|-\d+)$/.test(range))) return deny(416);
  const headers: Record<string,string> = {'Accept':'video/mp4','ngrok-skip-browser-warning':'1'};
  if (range && request.method === 'GET') headers.Range=range;
  let upstream: Response | undefined;
  try {
    upstream = await fetcher(ORIGIN + (request.method === 'HEAD' ? '-head' : '') + '?ticket=' + ticket, {
      method: request.method, headers, redirect:'manual', cache:'no-store', signal:AbortSignal.timeout(110000),
    });
    if (![200,206].includes(upstream.status)) {
      await upstream.body?.cancel();
      return deny([404,410,416].includes(upstream.status) ? upstream.status : 502);
    }
    const lengthText=upstream.headers.get('Content-Length') || '';
    const length=Number(lengthText), type=upstream.headers.get('Content-Type')?.split(';')[0].trim();
    if (type !== 'video/mp4' || !/^\d+$/.test(lengthText) || length < 1 || length > MAX_BYTES) {
      await upstream.body?.cancel(); return deny(502);
    }
    const output = new Headers({...securityHeaders,'Content-Type':'video/mp4','Content-Length':lengthText,
      'Accept-Ranges':'bytes','Content-Disposition':'attachment; filename="approved-master.mp4"'});
    if (upstream.status===206) {
      const contentRange=upstream.headers.get('Content-Range') || '';
      const parts=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange);
      if (!parts || Number(parts[2])-Number(parts[1])+1 !== length || Number(parts[3])>MAX_BYTES ||
          Number(parts[1])>Number(parts[2]) || Number(parts[2])>=Number(parts[3])) {
        await upstream.body?.cancel(); return deny(502);
      }
      output.set('Content-Range',contentRange);
    }
    return new Response(request.method==='HEAD' ? null : upstream.body,{status:upstream.status,headers:output});
  } catch {
    await upstream?.body?.cancel().catch(()=>{});
    return deny(502);
  }
}
