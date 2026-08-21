import { InboxIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty";

export interface EmptyStateProps extends React.ComponentProps<typeof Empty> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

function EmptyState({ className, title, description, icon, actions, ...props }: EmptyStateProps) {
  const media = icon !== undefined ? icon : <InboxIcon />;

  return (
    <Empty data-slot="empty-state" className={cn(className)} {...props}>
      <EmptyHeader>
        {media ? <EmptyMedia variant="icon">{media}</EmptyMedia> : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {actions ? <EmptyContent>{actions}</EmptyContent> : null}
    </Empty>
  );
}

export { EmptyState };
