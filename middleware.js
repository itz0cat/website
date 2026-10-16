const BANNED_IPS = new Set([
  '139.135.44.119'
]);

export default function middleware(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = (forwarded ? forwarded.split(',')[0].trim() : (realIp ? realIp.trim() : ''));

  if (ip && BANNED_IPS.has(ip)) {
    return new Response('403 Forbidden: Access Denied. Your IP address is blacklisted.', {
      status: 403,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  }
}

export const config = {
  matcher: '/:path*'
};
