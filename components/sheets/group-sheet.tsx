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
import { useAppStore } from "@/lib/store/app-store";

export function GroupSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addGroup = useAppStore((state) => state.addGroup);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>(["", ""]);

  useEffect(() => {
    if (open) {
      setName("");
      setMembers(["", ""]);
    }
  }, [open]);

  const cleanMembers = members.map((member) => member.trim()).filter(Boolean);
  const valid = name.trim().length > 0 && cleanMembers.length >= 2;

  const submit = () => {
    if (!valid) return;
    addGroup(name.trim(), cleanMembers);
    toast.success(`Group "${name.trim()}" created`);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New group</SheetTitle>
          <SheetDescription>
            Add at least two people, including yourself.
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

          <Button type="submit" size="lg" disabled={!valid} className="mt-2">
            Create group
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
