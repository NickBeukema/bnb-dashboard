import { NextResponse } from "next/server";
import { BUILD_ID } from "@/lib/version";

/** Which build the server is running. Open boards compare it with their own to offer a refresh. */
export function GET() {
  return NextResponse.json({ version: BUILD_ID }, { headers: { "Cache-Control": "no-store" } });
}
