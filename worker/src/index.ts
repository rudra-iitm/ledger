import { computePrices, parsePriceQuery } from "./prices";
import {
  handleSubscribe,
  handleUnsubscribe,
  runScheduled,
  type PushEnv,
} from "./push";
import { handleGroups, type GroupsEnv } from "./groups";

interface Env extends PushEnv, GroupsEnv {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ALLOWED_ORIGINS?: string;
}

interface TokenRequest {
  code?: string;
  redirect_uri?: string;
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin =
    allowed.includes("*") || (origin && allowed.includes(origin))
      ? (origin ?? "*")
      : allowed[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function handlePrices(
  url: URL,
  ctx: ExecutionContext,
  cors: Record<string, string>,
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(
    `https://prices.cache${url.pathname}${url.search}`,
  );
  const cached = await cache.match(cacheKey);
  if (cached) {
    return json(await cached.json(), 200, cors);
  }
  const prices = await computePrices(parsePriceQuery(url));
  const body = { prices, asOf: new Date().toISOString() };
  ctx.waitUntil(
    cache.put(
      cacheKey,
      new Response(JSON.stringify(body), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "max-age=600",
        },
      }),
    ),
  );
  return json(body, 200, cors);
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true }, 200, cors);
    }

    if (request.method === "GET" && url.pathname === "/prices") {
      return handlePrices(url, ctx, cors);
    }

    if (request.method === "POST" && url.pathname === "/push/subscribe") {
      const status = await handleSubscribe(request, env);
      return json(status === 200 ? { ok: true } : { error: "Subscribe failed" }, status, cors);
    }

    if (request.method === "POST" && url.pathname === "/push/unsubscribe") {
      const status = await handleUnsubscribe(request, env);
      return json(status === 200 ? { ok: true } : { error: "Unsubscribe failed" }, status, cors);
    }

    if (url.pathname === "/groups" || url.pathname.startsWith("/groups/")) {
      const result = await handleGroups(request, env, url.pathname);
      return json(result.body, result.status, cors);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return json({ error: "Worker is not configured" }, 500, cors);
    }

    let payload: TokenRequest;
    try {
      payload = (await request.json()) as TokenRequest;
    } catch {
      return json({ error: "Invalid JSON body" }, 400, cors);
    }

    if (!payload.code) {
      return json({ error: "Missing code" }, 400, cors);
    }

    const githubResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: payload.code,
          ...(payload.redirect_uri ? { redirect_uri: payload.redirect_uri } : {}),
        }),
      },
    );

    if (!githubResponse.ok) {
      return json({ error: "GitHub token exchange failed" }, 502, cors);
    }

    const data = (await githubResponse.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (data.error || !data.access_token) {
      return json(
        { error: data.error_description ?? data.error ?? "No access token" },
        400,
        cors,
      );
    }

    return json({ access_token: data.access_token }, 200, cors);
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runScheduled(env));
  },
};
