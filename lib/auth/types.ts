export type AuthProvider = "github" | "google" | "local";

export interface AuthUser {
  name: string;
  avatarUrl: string;
}

export interface AuthSession {
  provider: AuthProvider;
  user: AuthUser;
  githubToken?: string;
}
