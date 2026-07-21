import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const AUTH_ROUTES = new Set(['/login', '/signup', '/forgot-password']);
const INVITE_ROUTES = new Set(['/login', '/signup']);
const PROTECTED_ROUTE_PREFIXES = ['/dashboard', '/inbox', '/contacts', '/pipelines', '/broadcasts', '/automations', '/settings'];

function matchesRoutePrefix(pathname: string, routePrefix: string) {
  return pathname === routePrefix || pathname.startsWith(`${routePrefix}/`);
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { pathname, searchParams } = request.nextUrl;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured');
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const withRefreshedCookies = <T extends NextResponse>(response: T): T => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  };

  if (user && AUTH_ROUTES.has(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    const inviteToken = searchParams.get('invite');

    if (inviteToken && INVITE_ROUTES.has(pathname)) {
      redirectUrl.pathname = `/join/${encodeURIComponent(inviteToken)}`;
    } else {
      redirectUrl.pathname = '/dashboard';
    }
    redirectUrl.search = '';

    return withRefreshedCookies(NextResponse.redirect(redirectUrl));
  }

  const isProtectedRoute = PROTECTED_ROUTE_PREFIXES.some((routePrefix) => matchesRoutePrefix(pathname, routePrefix));
  if (!user && isProtectedRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return withRefreshedCookies(NextResponse.redirect(redirectUrl));
  }

  const isWhatsAppApiRoute = pathname.startsWith('/api/whatsapp/');
  const isWhatsAppWebhook = pathname.includes('/webhook');
  if (!user && isWhatsAppApiRoute && !isWhatsAppWebhook) {
    return withRefreshedCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
