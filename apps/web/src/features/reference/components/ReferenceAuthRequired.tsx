"use client";

import Link from "next/link";

import { Button, EmptyState } from "@atlas/ui";

export interface ReferenceAuthRequiredProps {
  title?: string;
  description?: string;
}

export function ReferenceAuthRequired({
  title = "Sign in required",
  description = "Select a reference persona in the harness to access this area. No external OAuth credentials are needed.",
}: ReferenceAuthRequiredProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      actions={<Button render={<Link href="/reference/harness" />}>Open harness</Button>}
    />
  );
}
