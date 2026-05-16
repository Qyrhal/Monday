import { NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

async function handler(req: NextRequest) {
  const url = new URL(req.url);
  const upstream = `${BACKEND}${url.pathname.replace("/api/proxy", "")}${url.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const res = await fetch(upstream, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    // @ts-expect-error — Node fetch supports duplex
    duplex: "half",
  });

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
