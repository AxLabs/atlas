"use client";

import { useCallback, useState } from "react";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@atlas/ui";

import { analytics } from "@/lib/analytics";
import { apiGet } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";

export function ReferenceObservabilityDemo() {
  const [result, setResult] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const triggerControlledFailure = useCallback(async () => {
    setResult(null);
    setCorrelationId(undefined);
    setIsPending(true);

    try {
      await apiGet("/api/users?scenario=server-error");
      setResult("Unexpected success — server-error scenario should have failed.");
    } catch (error) {
      if (error instanceof ApiError) {
        setCorrelationId(error.shape.correlationId);
        setResult(error.shape.userMessage ?? error.shape.message);
        analytics.track("error.api", {
          endpoint: "/api/users",
          statusCode: error.status ?? 500,
          message: error.shape.message,
        });
      } else {
        setResult(error instanceof Error ? error.message : "Unknown error");
      }
    } finally {
      setIsPending(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Observability &amp; error correlation</CardTitle>
        <CardDescription>
          Triggers a deterministic server-error via the reference API harness. Correlation IDs flow
          through the standard ApiError shape and analytics contract.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" onClick={triggerControlledFailure} disabled={isPending}>
          {isPending ? "Triggering…" : "Trigger controlled failure"}
        </Button>
        {result ? (
          <div className="space-y-1 text-sm">
            <p>{result}</p>
            {correlationId ? (
              <p className="text-muted-foreground">
                Correlation ID: <code>{correlationId}</code>
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
