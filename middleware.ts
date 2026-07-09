import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_USER = process.env.AUTH_USER || "admin";
const AUTH_PASS = process.env.AUTH_PASS || "changeme";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and static assets
  if (pathname === "/login" || pathname.startsWith("/_next") || pathname.startsWith("/api/auth") || pathname === "/favicon.svg") {
    return NextResponse.next();
  }

  // Check session cookie
  const session = request.cookies.get("pi_session")?.value;
  if (session) {
    try {
      const decoded = Buffer.from(session, "base64").toString("utf-8");
      const { user, exp } = JSON.parse(decoded);
      if (user === AUTH_USER && exp > Date.now()) {
        return NextResponse.next();
      }
    } catch {
      // Invalid cookie, redirect to login
    }
  }

  // Redirect to login
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"],
};
