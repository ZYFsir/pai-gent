import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_USER = process.env.AUTH_USER || "admin";
const AUTH_PASS = process.env.AUTH_PASS || "changeme";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (username !== AUTH_USER || password !== AUTH_PASS) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Create session cookie (expires 24h)
    const payload = JSON.stringify({
      user: AUTH_USER,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    });
    const token = Buffer.from(payload).toString("base64");

    const response = NextResponse.json({ success: true });
    response.cookies.set("pi_session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 86400, // 24h
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("pi_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
