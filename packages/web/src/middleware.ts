import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = ["/chat", "/admin", "/settings", "/onboarding"];

// Routes that are exclusively for unauthenticated users
const AUTH_ROUTES = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("truthseekers_token")?.value;

  // Check if current path matches any protected route
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Check if current path is an auth-only route
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Redirect unauthenticated users away from protected routes
  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/chat/new", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Only run middleware on page routes, not on API routes, static files, etc.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|logo-icon.png|manifest.json|maps/).*)",
  ],
};
