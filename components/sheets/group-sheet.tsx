"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Group } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";

export function GroupSheet({
  open,
  group,
  onClose,
}: {
  open: boolean;
  group?: Group;
  onClose: () => void;
}) {
  const addGroup = useAppStore((state) => state.addGroup);
  const updateGroup = useAppStore((state) => state.updateGroup);
  const addMember = useAppStore((state) => state.addMember);
  const removeMember = useAppStore((state) => state.removeMember);
  const liveGroup = useAppStore((state) =>
    group ? state.data.groups.find((item) => item.id === group.id) : undefined,
  );
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>(["", ""]);
  const [newMember, setNewMember] = useState("");

  const editing = Boolean(group);

  useEffect(() => {
    if (open) {
      setName(group?.name ?? "");
      setMembers(["", ""]);
      setNewMember("");
    }
  }, [open, group]);

  const cleanMembers = members.map((member) => member.trim()).filter(Boolean);
  const valid = editing
    ? name.trim().length > 0
    : name.trim().length > 0 && cleanMembers.length >= 2;

  const submit = () => {
    if (!valid) return;
    if (editing && group) {
      updateGroup(group.id, { name: name.trim() });
      toast.success("Group updated");
    } else {
      addGroup(name.trim(), cleanMembers);
      toast.success(`Group "${name.trim()}" created`);
    }
    onClose();
  };

  const handleRemove = (memberId: string, memberName: string) => {
    if (!group) return;
    if (removeMember(group.id, memberId)) {
      toast.success(`Removed ${memberName}`);
    } else {
      toast.error(
        `${memberName} has expenses or settlements in this group and can't be removed.`,
      );
    }
  };

  const handleAddMember = () => {
    if (!group || !newMember.trim()) return;
    addMember(group.id, newMember.trim());
    setNewMember("");
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{editing ? "Edit group" : "New group"}</SheetTitle>
          <SheetDescription>
            {editing
              ? "Rename the group or manage members."
              : "Add at least two people, including yourself."}
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              placeholder="Goa trip"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {editing && liveGroup ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-muted-foreground">
                Members
              </legend>
              <ul className="flex flex-col gap-1.5">
                {liveGroup.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[15px]">
                      {member.name}
                      {liveGroup.selfMemberId === member.id ? " (you)" : ""}
                    </span>
                    {liveGroup.selfMemberId !== member.id && (
                      <button
                        type="button"
                        aria-label={`Remove ${member.name}`}
                        onClick={() => handleRemove(member.id, member.name)}
                        className="flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X aria-hidden className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                <Input
                  aria-label="New member name"
                  placeholder="Add member"
                  autoComplete="off"
                  value={newMember}
                  onChange={(event) => setNewMember(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddMember();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Add member"
                  disabled={!newMember.trim()}
                  onClick={handleAddMember}
                >
                  <Plus aria-hidden />
                </Button>
              </div>
            </fieldset>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-muted-foreground">
                Members
              </legend>
              {members.map((member, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    aria-label={`Member ${index + 1}`}
                    placeholder={index === 0 ? "You" : `Member ${index + 1}`}
                    autoComplete="off"
                    value={member}
                    onChange={(event) =>
                      setMembers((current) =>
                        current.map((value, i) =>
                          i === index ? event.target.value : value,
                        ),
                      )
                    }
                  />
                  {members.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove member ${index + 1}`}
                      onClick={() =>
                        setMembers((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X aria-hidden />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setMembers((current) => [...current, ""])}
              >
                <Plus aria-hidden />
                Add member
              </Button>
            </fieldset>
          )}

          <Button type="submit" size="lg" disabled={!valid} className="mt-2">
            {editing ? "Save changes" : "Create group"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
