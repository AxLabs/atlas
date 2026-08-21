import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils";

import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty";

export interface ErrorFallbackProps extends React.ComponentProps<typeof Empty> {
  title?: string;
  description?: string;
  error?: unknown;
  correlationId?: string;
  onRetry?: () => void;
  actions?: React.ReactNode;
  variant?: "default" | "inline";
}

function isApiError(error: unknown): error is {
  shape: {
    code: string;
    message: string;
    userMessage?: string;
    correlationId?: string;
    details?: unknown;
  };
  status?: number;
} {
  if (typeof error !== "object" || error === null || !("shape" in error)) {
    return false;
  }

  const errorWithShape = error as { shape: unknown };
  if (typeof errorWithShape.shape !== "object" || errorWithShape.shape === null) {
    return false;
  }

  const shape = errorWithShape.shape as Record<string, unknown>;
  return "message" in shape;
}

function getUserMessage(error: unknown): string | undefined {
  if (isApiError(error)) {
    return error.shape.userMessage;
  }
  if (error instanceof Error && process.env.NODE_ENV !== "production") {
    return error.message;
  }
  return undefined;
}

function getCorrelationId(error: unknown): string | undefined {
  if (isApiError(error)) {
    return error.shape.correlationId;
  }
  return undefined;
}

function ErrorFallback({
  className,
  variant = "default",
  title = "Something went wrong",
  description,
  error,
  correlationId: providedCorrelationId,
  onRetry,
  actions,
  ...props
}: ErrorFallbackProps) {
  const userMessage = getUserMessage(error);
  const errorCorrelationId = getCorrelationId(error) || providedCorrelationId;
  const finalDescription = userMessage || description;

  return (
    <Empty
      role="alert"
      data-slot="error-fallback"
      className={cn(
        variant === "default" && "border-destructive/20 min-h-[400px] border border-dashed",
        variant === "inline" && "min-h-0 border-0 p-6",
        className
      )}
      {...props}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertTriangleIcon className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle>
          <h2>{title}</h2>
        </EmptyTitle>
        {finalDescription ? <EmptyDescription>{finalDescription}</EmptyDescription> : null}
      </EmptyHeader>

      {errorCorrelationId ? (
        <Alert variant="destructive" className="max-w-md text-left">
          <AlertTitle>Reference ID</AlertTitle>
          <AlertDescription>
            <code className="font-mono text-xs">{errorCorrelationId}</code>
          </AlertDescription>
        </Alert>
      ) : null}

      {(onRetry || actions) && (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onRetry ? (
              <Button type="button" onClick={onRetry}>
                <RefreshCwIcon />
                Try again
              </Button>
            ) : null}
            {actions}
          </div>
        </EmptyContent>
      )}
    </Empty>
  );
}

export { ErrorFallback };
