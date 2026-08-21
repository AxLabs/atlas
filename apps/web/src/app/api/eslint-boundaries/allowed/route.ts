import { NextResponse } from "next/server";

export function GET() {
  void process.env.API_TOKEN;
  return fetch("https://example.com").then(() => NextResponse.json({ ok: true }));
}
