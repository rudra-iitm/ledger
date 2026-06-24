"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/empty-state";
import { fetchRemoteGroup, type SharedGroup } from "@/lib/groups/sync";
import { useAppStore } from "@/lib/store/app-store";

export function JoinGroupView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code");
  const joinGroup = useAppStore((state) => state.joinGroup);
  const existing = useAppStore((state) =>
    state.data.groups.find((group) => group.remoteId === code),
  );

  const [preview, setPreview] = useState<SharedGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }
    let active = true;
    fetchRemoteGroup(code)
      .then((group) => {
        if (active) {
          setPreview(group);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code]);

  const submit = async () => {
    if (!code || !name.trim()) return;
    setJoining(true);
    const localId = await joinGroup(code, name.trim());
    setJoining(false);
    if (localId) {
      toast.success("Joined group");
      router.replace(`/group/?id=${localId}`);
    } else {
      toast.error("Couldn't join this group");
    }
  };

  if (!code) {
    return (
      <EmptyState
        icon={Users}
        title="Invalid invite"
        description="This invite link is missing its code."
      />
    );
  }

  if (loading) {
    return (
      <EmptyState
        icon={Users}
        title="Loading invite…"
        description="Fetching the group details."
      />
    );
  }

  if (!preview) {
    return (
      <EmptyState
        icon={Users}
        title="Group not found"
        description="This invite may have expired, or sharing isn't configured."
      />
    );
  }

  if (existing) {
    return (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {preview.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            You&apos;re already in this group.
          </p>
        </section>
        <Button size="lg" onClick={() => router.replace(`/group/?id=${existing.id}`)}>
          Open group
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">{preview.name}</h2>
        <p className="text-sm text-muted-foreground">
          {preview.members.length}{" "}
          {preview.members.length === 1 ? "member" : "members"} ·{" "}
          {preview.expenses.length}{" "}
          {preview.expenses.length === 1 ? "expense" : "expenses"}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {preview.members.map((member) => (
            <span
              key={member.id}
              className="rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground"
            >
              {member.name}
            </span>
          ))}
        </div>
      </section>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="join-name">Your name in this group</Label>
          <Input
            id="join-name"
            placeholder="You"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit" size="lg" disabled={!name.trim() || joining}>
          {joining ? "Joining…" : "Join group"}
        </Button>
      </form>
    </div>
  );
}
