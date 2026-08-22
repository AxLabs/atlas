"use client";

import Link from "next/link";

import { Button, Skeleton } from "@atlas/ui";

import { useSession } from "@/lib/auth";

export function ReferenceUserArea() {
  const { status, user } = useSession();

  if (status === "loading") {
    return <Skeleton className="h-8 w-28" />;
  }

  if (status === "unauthenticated" || !user) {
    return (
      <Button variant="outline" size="sm" render={<Link href="/reference/harness" />}>
        Sign in
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground hidden max-w-[12rem] truncate sm:inline">
        {user.name ?? user.email}
      </span>
      <Button variant="ghost" size="sm" render={<Link href="/reference/profile" />}>
        Profile
      </Button>
    </div>
  );
}
