/**
 * GET /api/auth/vps-token
 *
 * Issues a short-lived JWT for authenticating with the VPS generate-server.
 * The token contains the user's ID and is signed with API_KEY.
 * Valid for 10 minutes.
 *
 * Dev mode: If API_KEY is not set, returns a "dev" placeholder token.
 */

import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const secret = process.env.API_KEY;
  if (!secret) {
    // Dev mode — no signing key, return a dev placeholder
    return NextResponse.json({ token: "dev" });
  }

  const key = new TextEncoder().encode(secret);

  const token = await new SignJWT({ sub: session.user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);

  return NextResponse.json({ token });
}
