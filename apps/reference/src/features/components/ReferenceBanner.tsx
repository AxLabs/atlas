/**
 * Reference mode disclosure banner.
 *
 * Visible only when reference adapters are active.
 */

"use client";

import { Alert, AlertDescription, AlertTitle } from "@atlas/ui";

import { useReferenceStatus } from "../queries";

export function ReferenceBanner() {
  const { data, isLoading } = useReferenceStatus();

  if (isLoading || !data?.enabled) {
    return null;
  }

  return (
    <Alert role="status" className="rounded-none border-x-0 border-t-0">
      <AlertTitle>Reference mode active</AlertTitle>
      <AlertDescription>
        {data.disclosure ??
          "Deterministic local fixtures — not production OAuth or API security evidence."}
      </AlertDescription>
    </Alert>
  );
}
