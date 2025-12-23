import { cva, type VariantProps } from "class-variance-authority";
import { Loader2Icon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const loaderVariants = cva("animate-spin", {
  variants: {
    size: {
      sm: "size-4",
      md: "size-6",
      lg: "size-8",
    },
    variant: {
      spinner: "",
      dots: "",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "spinner",
  },
});

export interface LoaderProps
  extends Omit<React.ComponentProps<"div">, "children">,
    VariantProps<typeof loaderVariants> {
  label?: string;
}

function Loader({
  className,
  size,
  variant = "spinner",
  label = "Loading",
  ...props
}: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("inline-flex items-center", className)}
      {...props}
    >
      <Loader2Icon className={cn(loaderVariants({ size, variant }))} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function InlineLoader({
  className,
  label = "Loading",
  ...props
}: Omit<LoaderProps, "size" | "variant">) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("inline-flex items-center", className)}
      {...props}
    >
      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export interface PageLoaderProps extends React.ComponentProps<"div"> {
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
}

function PageLoader({ className, title, description, size = "lg", ...props }: PageLoaderProps) {
  let sizeClass = "size-8";
  if (size === "sm") sizeClass = "size-4";
  else if (size === "md") sizeClass = "size-6";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={title || "Loading page"}
      data-slot="page-loader"
      className={cn("flex min-h-100 flex-col items-center justify-center gap-4 p-6", className)}
      {...props}
    >
      <Loader2Icon className={cn("animate-spin", sizeClass)} aria-hidden="true" />
      {title && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-foreground text-sm font-medium">{title}</p>
          {description && <p className="text-muted-foreground max-w-md text-sm">{description}</p>}
        </div>
      )}
      <span className="sr-only">{title || "Loading page"}</span>
    </div>
  );
}

export { InlineLoader, Loader, loaderVariants, PageLoader };
