import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { SESSION_COOKIE_NAME } from "./lib/session-constants";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PAGES = ["/login", "/register"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes skip locale handling entirely (configured in matcher too).
  const response = intlMiddleware(request);

  const pathWithoutLocale = pathname.replace(/^\/(nl|en)(?=\/|$)/, "") || "/";
  const isPublic = PUBLIC_PAGES.some((page) => pathWithoutLocale.startsWith(page));
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  // Cookie presence gate only — real verification happens server-side per request.
  if (!isPublic && !hasSession) {
    const locale = pathname.match(/^\/(nl|en)(?=\/|$)/)?.[1] ?? routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }
  if (isPublic && hasSession) {
    const locale = pathname.match(/^\/(nl|en)(?=\/|$)/)?.[1] ?? routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
