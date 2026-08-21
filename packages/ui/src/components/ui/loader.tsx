import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils";

import { Spinner } from "./spinner";

const loaderVariants = cva("", {
  variants: {
    size: {
      sm: "size-4",
      md: "size-6",
      lg: "size-8",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export interface LoaderProps
  extends Omit<React.ComponentProps<"div">, "children">,
    VariantProps<typeof loaderVariants> {
  label?: string;
}

function Loader({ className, size, label = "Loading", ...props }: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("inline-flex items-center", className)}
      {...props}
    >
      <Spinner className={cn(loaderVariants({ size }))} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function InlineLoader({ className, label = "Loading", ...props }: Omit<LoaderProps, "size">) {
  return <Loader className={className} size="sm" label={label} {...props} />;
}

export interface PageLoaderProps extends React.ComponentProps<"div"> {
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
}

function PageLoader({ className, title, description, size = "lg", ...props }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={title || "Loading page"}
      data-slot="page-loader"
      className={cn("flex min-h-100 flex-col items-center justify-center gap-4 p-6", className)}
      {...props}
    >
      <Spinner className={cn(loaderVariants({ size }))} aria-hidden="true" />
      {title ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-foreground text-sm font-medium">{title}</p>
          {description ? (
            <p className="text-muted-foreground max-w-md text-sm">{description}</p>
          ) : null}
        </div>
      ) : null}
      <span className="sr-only">{title || "Loading page"}</span>
    </div>
  );
}

export { InlineLoader, Loader, loaderVariants, PageLoader };
