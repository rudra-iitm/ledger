interface Env {
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true }, 200, cors);
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
};
