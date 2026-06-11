"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPicker } from "@/components/fields/emoji-picker";
import { SPACE_ICONS, type Space } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";

export function SpaceSheet({
  open,
  space,
  onClose,
}: {
  open: boolean;
  space?: Space;
  onClose: () => void;
}) {
  const addSpace = useAppStore((state) => state.addSpace);
  const updateSpace = useAppStore((state) => state.updateSpace);
  const deleteSpace = useAppStore((state) => state.deleteSpace);
  const currency = useAppStore((state) => state.data.settings.currency);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [icon, setIcon] = useState(SPACE_ICONS[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (space) {
      setName(space.name);
      setDescription(space.description ?? "");
      setBudget(space.budget > 0 ? String(space.budget) : "");
      setIcon(space.icon);
    } else {
      setName("");
      setDescription("");
      setBudget("");
      setIcon(SPACE_ICONS[0]);
    }
    setError(null);
  }, [open, space]);

  const submit = () => {
    if (!name.trim()) {
      setError("Add a name");
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      budget: Math.max(0, Number(budget) || 0),
      icon,
    };
    if (space) {
      updateSpace(space.id, payload);
      toast.success("Space updated");
    } else {
      addSpace({ ...payload, archived: false });
      toast.success("Space created");
    }
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{space ? "Edit space" : "New space"}</SheetTitle>
        </SheetHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label>Icon</Label>
            <EmojiPicker value={icon} onChange={setIcon} options={SPACE_ICONS} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="space-name">Name</Label>
            <Input
              id="space-name"
              placeholder="Shimla Trip"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="space-budget">Budget (optional)</Label>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3.5">
              <span className="text-muted-foreground">{currency}</span>
              <input
                id="space-budget"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="20000"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                className="h-10 w-full bg-transparent text-base outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="space-description">Description (optional)</Label>
            <Textarea
              id="space-description"
              placeholder="What is this space for?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-1 flex flex-col gap-2">
            <Button type="submit" size="lg">
              {space ? "Save changes" : "Create space"}
            </Button>
            {space && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    updateSpace(space.id, { archived: !space.archived });
                    toast.success(space.archived ? "Space restored" : "Space archived");
                    onClose();
                  }}
                >
                  {space.archived ? "Restore space" : "Archive space"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  onClick={() => {
                    deleteSpace(space.id);
                    toast.success("Space deleted");
                    onClose();
                  }}
                >
                  Delete space
                </Button>
              </>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
