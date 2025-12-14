import * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center",
        className
      )}
    >
      {icon && <div className="text-muted-foreground mb-4">{icon}</div>}
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground mb-4 text-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export { EmptyState };
