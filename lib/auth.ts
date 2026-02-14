import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function getAuthSession() {
  return await auth();
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Authentication required" },
    { status: 401 }
  );
}

export function insufficientCreditsResponse(required: number, balance: number) {
  return NextResponse.json(
    { error: "Insufficient credits", required, balance },
    { status: 402 }
  );
}
