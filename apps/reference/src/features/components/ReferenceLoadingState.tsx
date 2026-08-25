import { InlineLoader } from "@atlas/ui";

export interface ReferenceLoadingStateProps {
  label?: string;
}

export function ReferenceLoadingState({ label = "Loading session" }: ReferenceLoadingStateProps) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-sm">
      <InlineLoader label={label} />
      <span aria-hidden>{label}…</span>
    </div>
  );
}
