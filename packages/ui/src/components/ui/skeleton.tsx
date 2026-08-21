import * as React from "react";

import { cn } from "../../lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export interface SkeletonTextProps extends React.ComponentProps<"div"> {
  lines?: number;
  lineClassName?: string;
}

function SkeletonText({ className, lines = 3, lineClassName, ...props }: SkeletonTextProps) {
  return (
    <div data-slot="skeleton-text" className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-4 w-full", index === lines - 1 && "w-4/5", lineClassName)}
        />
      ))}
    </div>
  );
}

export interface SkeletonListProps extends React.ComponentProps<"div"> {
  count?: number;
  variant?: "list" | "card";
  renderItem?: (index: number) => React.ReactNode;
}

function renderSkeletonListItem(
  index: number,
  variant: "list" | "card",
  renderItem?: (index: number) => React.ReactNode
) {
  if (renderItem) {
    return renderItem(index);
  }

  if (variant === "card") {
    return (
      <div key={index} className="space-y-3 rounded-lg border p-4">
        <Skeleton className="h-5 w-1/3" />
        <SkeletonText lines={2} />
      </div>
    );
  }

  return (
    <div key={index} className="flex items-center gap-3">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

function SkeletonList({
  className,
  count = 5,
  variant = "list",
  renderItem,
  ...props
}: SkeletonListProps) {
  return (
    <div
      data-slot="skeleton-list"
      className={cn(variant === "list" ? "space-y-3" : "grid gap-4 sm:grid-cols-2", className)}
      {...props}
    >
      {Array.from({ length: count }, (_, index) =>
        renderSkeletonListItem(index, variant, renderItem)
      )}
    </div>
  );
}

export { Skeleton, SkeletonList, SkeletonText };
