"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Smartphone, Wallet } from "lucide-react";
import { GitHubIcon } from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isGitHubConfigured,
  isGoogleConfigured,
} from "@/lib/auth/config";
import { loginWithGitHubToken, startGitHubLogin } from "@/lib/auth/github-oauth";
import { loginWithGoogle } from "@/lib/auth/google-oauth";
import { useAppStore } from "@/lib/store/app-store";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
      <path d="M21.6 12.23c0-.7-.06-1.37-.18-2.02H12v3.82h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.32Z" />
      <path d="M12 21.95c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.58-4.1H3.07v2.58A10 10 0 0 0 12 21.95Z" />
      <path d="M6.42 13.88a6 6 0 0 1 0-3.82V7.48H3.07a10 10 0 0 0 0 8.98l3.35-2.58Z" />
      <path d="M12 5.95c1.47 0 2.78.5 3.82 1.5l2.86-2.87A9.97 9.97 0 0 0 12 1.99a10 10 0 0 0-8.93 5.5l3.35 2.57C7.2 7.7 9.4 5.95 12 5.95Z" />
    </svg>
  );
}

export function LoginScreen() {
  const router = useRouter();
  const status = useAppStore((state) => state.status);
  const signIn = useAppStore((state) => state.signIn);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "ready") router.replace("/");
  }, [status, router]);

  const handleGitHub = () => {
    if (!isGitHubConfigured()) {
      setTokenDialogOpen(true);
      return;
    }
    startGitHubLogin(`${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/auth/callback/`);
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const session = await loginWithGoogle();
      await signIn(session);
      router.replace("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleToken = async () => {
    if (!token.trim()) return;
    setBusy(true);
    try {
      const session = await loginWithGitHubToken(token.trim());
      await signIn(session);
      router.replace("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleLocal = async () => {
    setBusy(true);
    try {
      await signIn({
        provider: "local",
        user: { name: "You", avatarUrl: "" },
      });
      router.replace("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-24">
      <div>
        <div className="mb-8 flex size-14 items-center justify-center rounded-2xl border border-border bg-card">
          <Wallet aria-hidden className="size-7" />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">Ledger</h1>
        <p className="mt-3 max-w-xs text-lg leading-relaxed text-muted-foreground">
          Budgets, expenses, and bill splitting. Your data lives in your own
          private GitHub repository.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button size="lg" onClick={handleGitHub} disabled={busy}>
          <GitHubIcon />
          Continue with GitHub
        </Button>
        {isGoogleConfigured() && (
          <Button size="lg" variant="secondary" onClick={handleGoogle} disabled={busy}>
            <GoogleIcon />
            Continue with Google
          </Button>
        )}
        <Button size="lg" variant="secondary" onClick={handleLocal} disabled={busy}>
          <Smartphone aria-hidden />
          Continue on this device
        </Button>
        <button
          type="button"
          onClick={() => setTokenDialogOpen(true)}
          className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KeyRound aria-hidden className="size-3.5" />
          Sign in with a GitHub token
        </button>
      </div>

      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>GitHub personal access token</DialogTitle>
            <DialogDescription>
              Use a fine-grained token with repository read and write access.
              It stays on this device.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleToken();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="github-token">Token</Label>
              <Input
                id="github-token"
                type="password"
                autoComplete="off"
                placeholder="github_pat_…"
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy || !token.trim()}>
              Sign in
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
