"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { FOLDER_COLORS } from "@/lib/categories";

export function NewFolderForm() {
  const addFolder = useStore((s) => s.addFolder);
  const folderCount = useStore((s) => s.folders.length);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[folderCount % FOLDER_COLORS.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addFolder({ name: trimmed, color });
    setName("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium hover:bg-background"
      >
        <Plus className="h-4 w-4" />
        New folder
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-card p-3 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Folder name (e.g. Holiday 2026)"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setName("");
          }}
          aria-label="Cancel"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FOLDER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`h-6 w-6 rounded-full border-2 transition ${
                color === c ? "border-foreground" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-40"
        >
          Create
        </button>
      </div>
    </form>
  );
}
