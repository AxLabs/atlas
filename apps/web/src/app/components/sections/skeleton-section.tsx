"use client";

import { Card, CardContent, CardHeader, Skeleton } from "@atlas/ui";

export function SkeletonSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Skeleton (Loading States)</h2>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-62.5" />
          <Skeleton className="h-4 w-50" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </section>
  );
}
