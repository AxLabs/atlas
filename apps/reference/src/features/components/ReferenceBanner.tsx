/**
 * Reference mode disclosure banner.
 *
 * Visible only when reference adapters are active.
 */

"use client";

import { useReferenceStatus } from "../queries";

export function ReferenceBanner() {
  const { data, isLoading } = useReferenceStatus();

  if (isLoading || !data?.enabled) {
    return null;
  }

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p className="font-medium">Reference mode active</p>
      <p className="mt-1 text-amber-900">
        {data.disclosure ??
          "Deterministic local fixtures — not production OAuth or API security evidence."}
      </p>
    </div>
  );
}
