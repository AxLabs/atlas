import { cn } from "@/lib/utils";

export interface ErrorMessageProps {
  error?: Error | string | null;
  title?: string;
  className?: string;
  retry?: () => void;
}

function ErrorMessage({
  error,
  title = "Something went wrong",
  className,
  retry,
}: ErrorMessageProps) {
  if (!error) return null;

  const message = typeof error === "string" ? error : error.message;

  return (
    <div
      role="alert"
      className={cn("border-destructive/50 bg-destructive/10 rounded-lg border p-4", className)}
    >
      <h3 className="text-destructive mb-1 font-medium">{title}</h3>
      {message && <p className="text-destructive/90 text-sm">{message}</p>}
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="text-destructive mt-3 text-sm font-medium underline-offset-4 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export { ErrorMessage };
