"use client";

import Link from "next/link";

import { buttonVariants, Skeleton } from "@atlas/ui";

import { useSession } from "@/lib/auth";

export function ReferenceUserArea() {
  const { status, user } = useSession();

  if (status === "loading") {
    return <Skeleton className="h-8 w-28" />;
  }

  if (status === "unauthenticated" || !user) {
    return (
      <Link
        href="/reference/harness"
        className={buttonVariants({
          variant: "outline",
          size: "sm",
        })}
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground hidden max-w-[12rem] truncate sm:inline">
        {user.name ?? user.email}
      </span>
      <Link
        href="/reference/profile"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
        })}
      >
        Profile
      </Link>
    </div>
  );
}
