"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const knownTags = useAppStore((state) => state.data.settings.tags);
  const registerTag = useAppStore((state) => state.addTag);
  const [draft, setDraft] = useState("");

  const suggestions = useMemo(
    () =>
      knownTags
        .filter((tag) => !value.includes(tag))
        .filter((tag) =>
          draft ? tag.toLowerCase().includes(draft.toLowerCase()) : true,
        )
        .slice(0, 6),
    [knownTags, value, draft],
  );

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    registerTag(tag);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[13px] font-medium"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => onChange(value.filter((item) => item !== tag))}
                className="text-muted-foreground outline-none transition-colors hover:text-foreground"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        aria-label="Add tag"
        placeholder="Add a tag and press Enter"
        value={draft}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addTag(draft);
          }
        }}
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Plus aria-hidden className="size-3" />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
