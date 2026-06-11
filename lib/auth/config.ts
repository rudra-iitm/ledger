export const authConfig = {
  githubClientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ?? "",
  githubTokenExchangeUrl:
    process.env.NEXT_PUBLIC_GITHUB_TOKEN_EXCHANGE_URL ?? "",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
};

export const isGitHubConfigured = () =>
  authConfig.githubClientId !== "" && authConfig.githubTokenExchangeUrl !== "";

export const isGoogleConfigured = () => authConfig.googleClientId !== "";
