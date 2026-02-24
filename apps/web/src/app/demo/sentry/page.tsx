/**
 * Sentry Demo Page
 *
 * Tests both client-side and server-side Sentry error capture.
 * Shows diagnostic info to help debug integration issues.
 */

"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryDemoPage() {
  const [results, setResults] = useState<string[]>([]);

  const log = (msg: string) =>
    setResults((prev) => [...prev, `[${new Date().toISOString()}] ${msg}`]);

  const testClientDirect = () => {
    const client = Sentry.getClient();
    if (!client) {
      log("❌ Sentry client NOT initialised — Sentry.getClient() returned undefined");
      return;
    }

    const options = client.getOptions();
    log(`ℹ️ DSN: ${options.dsn ? "set" : "MISSING"}`);
    log(
      `ℹ️ Tunnel: ${(options as Record<string, unknown>).tunnel ?? "not set (SDK handles via tunnelRoute)"}`
    );
    log(`ℹ️ Environment: ${options.environment}`);
    log(`ℹ️ Debug: ${options.debug}`);

    const eventId = Sentry.captureException(new Error("Client test error — this is intentional"), {
      tags: { testType: "client-direct", page: "sentry-demo" },
    });
    log(`✅ captureException returned eventId: ${eventId}`);
    log("→ Check your Sentry dashboard and browser console (debug mode) for confirmation");
  };

  const testClientMessage = () => {
    const eventId = Sentry.captureMessage("Client test message — this is intentional", {
      level: "info",
      tags: { testType: "client-message", page: "sentry-demo" },
    });
    log(`✅ captureMessage returned eventId: ${eventId}`);
  };

  const testServerDirect = async () => {
    log("→ Calling /api/sentry-test-server…");
    try {
      const res = await fetch("/api/sentry-test-server");
      const data = await res.json();
      log(`Server response (${res.status}): ${JSON.stringify(data)}`);
    } catch (err) {
      log(`❌ Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const testTunnelDirect = async () => {
    log("→ Sending test envelope directly to /monitoring tunnel…");
    try {
      // Construct a minimal Sentry envelope to test the tunnel rewrite
      const dsn = Sentry.getClient()?.getOptions()?.dsn;
      if (!dsn) {
        log("❌ No DSN available");
        return;
      }

      const res = await fetch("/monitoring?o=4510607618605056&p=4510607623848016&r=de", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: `{"dsn":"${dsn}","sent_at":"${new Date().toISOString()}"}\n{"type":"event"}\n{"event_id":"${crypto.randomUUID().replace(/-/g, "")}","timestamp":${Date.now() / 1000},"platform":"javascript","exception":{"values":[{"type":"Error","value":"Tunnel direct test"}]}}\n`,
      });
      log(`Tunnel response: ${res.status} ${res.statusText}`);
      const text = await res.text();
      if (text) log(`Tunnel body: ${text}`);
    } catch (err) {
      log(`❌ Tunnel fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sentry Integration Test</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Use these buttons to test each layer of the Sentry pipeline. Check your{" "}
            <strong>browser console</strong> for Sentry debug output.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Client-Side</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={testClientDirect}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm"
            >
              captureException (direct)
            </button>
            <button
              onClick={testClientMessage}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-md px-4 py-2 text-sm"
            >
              captureMessage
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Server-Side</h2>
          <button
            onClick={testServerDirect}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm"
          >
            Server captureException + flush
          </button>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Tunnel</h2>
          <button
            onClick={testTunnelDirect}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm"
          >
            POST raw envelope to /monitoring
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Results</h2>
              <button
                onClick={() => setResults([])}
                className="text-muted-foreground text-xs hover:underline"
              >
                Clear
              </button>
            </div>
            <pre className="bg-muted max-h-96 overflow-auto rounded-lg p-4 font-mono text-xs">
              {results.join("\n")}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
