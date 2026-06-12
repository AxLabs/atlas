"use client";

import { toast } from "sonner";

import { Button } from "@atlas/ui";

import { ensureToasterMounted } from "@/lib/notifications/toaster-host";

export function ButtonsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Buttons</h2>
      <div className="flex flex-wrap gap-4">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button
          onClick={() => {
            ensureToasterMounted();
            toast.success("Button clicked!");
          }}
        >
          Toast Notification
        </Button>
      </div>
    </section>
  );
}
