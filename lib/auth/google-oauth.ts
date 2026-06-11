import { authConfig } from "./config";
import type { AuthSession } from "./types";

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}

interface GoogleTokenClient {
  requestAccessToken(): void;
}

interface GoogleIdentityServices {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
        error_callback?: (error: { message?: string }) => void;
      }): GoogleTokenClient;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

function loadGisScript(): Promise<GoogleIdentityServices> {
  return new Promise((resolve, reject) => {
    if (window.google) {
      resolve(window.google);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (window.google) resolve(window.google);
      else reject(new Error("Google Identity Services failed to load."));
    };
    if (existing) {
      existing.addEventListener("load", onLoad);
      return;
    }
    script.src = GIS_SRC;
    script.async = true;
    script.addEventListener("load", onLoad);
    script.addEventListener("error", () =>
      reject(new Error("Could not load Google sign-in script.")),
    );
    document.head.appendChild(script);
  });
}

export async function loginWithGoogle(): Promise<AuthSession> {
  const google = await loadGisScript();
  const accessToken = await new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: authConfig.googleClientId,
      scope: "openid profile email",
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error(response.error ?? "Google sign-in failed."));
      },
      error_callback: (error) =>
        reject(new Error(error.message ?? "Google sign-in was cancelled.")),
    });
    client.requestAccessToken();
  });

  const userResponse = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!userResponse.ok) {
    throw new Error("Could not load your Google profile.");
  }
  const user = (await userResponse.json()) as {
    name?: string;
    email?: string;
    picture?: string;
  };

  return {
    provider: "google",
    user: {
      name: user.name ?? user.email ?? "Google user",
      avatarUrl: user.picture ?? "",
    },
  };
}
