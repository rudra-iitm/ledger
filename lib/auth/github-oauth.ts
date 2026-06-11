import { authConfig } from "./config";
import type { AuthSession } from "./types";

const STATE_KEY = "ledger:oauth-state";

export function startGitHubLogin(redirectUri: string): void {
  const state = crypto.randomUUID();
  window.sessionStorage.setItem(STATE_KEY, state);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", authConfig.githubClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "repo");
  url.searchParams.set("state", state);
  window.location.assign(url.toString());
}

export async function completeGitHubLogin(
  code: string,
  state: string,
): Promise<AuthSession> {
  const expectedState = window.sessionStorage.getItem(STATE_KEY);
  window.sessionStorage.removeItem(STATE_KEY);
  if (!expectedState || expectedState !== state) {
    throw new Error("OAuth state mismatch. Please try signing in again.");
  }

  const response = await fetch(authConfig.githubTokenExchangeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) {
    throw new Error("Token exchange failed. Please try signing in again.");
  }
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("GitHub did not return an access token.");
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${payload.access_token}` },
  });
  if (!userResponse.ok) {
    throw new Error("Could not load your GitHub profile.");
  }
  const user = (await userResponse.json()) as {
    login: string;
    name: string | null;
    avatar_url: string;
  };

  return {
    provider: "github",
    user: { name: user.name ?? user.login, avatarUrl: user.avatar_url },
    githubToken: payload.access_token,
  };
}

export async function loginWithGitHubToken(token: string): Promise<AuthSession> {
  const response = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Invalid GitHub token.");
  }
  const user = (await response.json()) as {
    login: string;
    name: string | null;
    avatar_url: string;
  };
  return {
    provider: "github",
    user: { name: user.name ?? user.login, avatarUrl: user.avatar_url },
    githubToken: token,
  };
}
