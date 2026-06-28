import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'auth_token';
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/);

  if (isPublic) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'changeme-use-env-var'
    );
    const { payload } = await jwtVerify(token, secret);
    const role = (payload.role as string) ?? 'user';

    // /approved → adminsuper เท่านั้น
    if (pathname.startsWith('/approved') && role !== 'adminsuper') {
      return NextResponse.redirect(new URL('/account', req.url));
    }

    // admin + adminsuper เข้าถึงได้
    const adminPaths = ['/fileapa', '/pdf-upload', '/musyaend/obsidian', '/musyaend/db-explorer'];
    if (adminPaths.some((p) => pathname.startsWith(p))) {
      if (role !== 'admin' && role !== 'adminsuper') {
        return NextResponse.redirect(new URL('/account?forbidden=1', req.url));
      }
    }

    // /musyaend (root + sub-paths ที่ไม่ใช่ obsidian/db-explorer) → adminsuper เท่านั้น
    if (
      pathname.startsWith('/musyaend') &&
      !pathname.startsWith('/musyaend/obsidian') &&
      !pathname.startsWith('/musyaend/db-explorer')
    ) {
      if (role !== 'adminsuper') {
        return NextResponse.redirect(new URL('/account?forbidden=1', req.url));
      }
    }

    return NextResponse.next();
  } catch {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
