import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const token = req.cookies.get("accessToken")?.value;
  const { pathname } = req.nextUrl;


  if (pathname === "/") {
    if (token) {
      return NextResponse.redirect(new URL("/chat", req.url));
    }
    return NextResponse.next();
  }
  if (pathname === "/login") {
    if (token) {
      return NextResponse.redirect(new URL("/chat", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/chat")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/chat", "/chat/:path*"],
};
