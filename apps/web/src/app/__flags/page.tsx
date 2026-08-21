/**
 * Feature Flags Dev Panel Page
 *
 * Development-only page for viewing and managing feature flags.
 *
 * @route /__flags
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@atlas/ui";

import {
  ALL_FEATURE_FLAGS,
  clearLocalOverrides,
  isKillSwitchFlag,
  readLocalOverrides,
  useFlags,
  writeLocalOverrides,
} from "@/lib/feature-flags";

import type { FeatureFlagKey, LocalOverrides } from "@/lib/feature-flags";

function SourceBadge({ source }: { source: string }) {
  return <Badge variant="secondary">{source}</Badge>;
}

function StatusBadge({ isKilled, isEnabled }: { isKilled: boolean; isEnabled: boolean }) {
  if (isKilled) {
    return <Badge variant="destructive">KILLED</Badge>;
  }

  if (isEnabled) {
    return <Badge>ON</Badge>;
  }

  return <Badge variant="outline">OFF</Badge>;
}

function FlagRow({
  flagKey,
  isEnabled,
  isKilled,
  source,
  localOverride,
  onOverrideChange,
  onClearOverride,
}: {
  flagKey: FeatureFlagKey;
  isEnabled: boolean;
  isKilled: boolean;
  source: string;
  localOverride: boolean | undefined;
  onOverrideChange: (value: boolean) => void;
  onClearOverride: () => void;
}) {
  const isKillSwitch = isKillSwitchFlag(flagKey);
  const hasOverride = localOverride !== undefined;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <code className="font-mono text-sm">{flagKey}</code>
          {isKillSwitch ? <Badge variant="destructive">KILL</Badge> : null}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <StatusBadge isKilled={isKilled} isEnabled={isEnabled} />
      </TableCell>
      <TableCell className="text-center">
        <SourceBadge source={source} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={localOverride ?? isEnabled}
            onCheckedChange={onOverrideChange}
            aria-label={`Toggle local override for ${flagKey}`}
          />
          {hasOverride ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClearOverride}>
              Clear
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function FeatureFlagsDevPanel() {
  const { isEnabled, isKilled, getSource, snapshot, refresh } = useFlags();
  const [localOverrides, setLocalOverrides] = useState<LocalOverrides>({ flags: {} });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocalOverrides(readLocalOverrides());
    setMounted(true);
  }, []);

  const handleOverrideChange = useCallback(
    (flagKey: FeatureFlagKey, value: boolean) => {
      const newOverrides: LocalOverrides = {
        ...localOverrides,
        flags: {
          ...localOverrides.flags,
          [flagKey]: value,
        },
      };
      writeLocalOverrides(newOverrides);
      setLocalOverrides(newOverrides);
      refresh();
    },
    [localOverrides, refresh]
  );

  const handleClearOverride = useCallback(
    (flagKey: FeatureFlagKey) => {
      const newFlags = { ...localOverrides.flags };
      delete newFlags[flagKey];
      const newOverrides: LocalOverrides = {
        ...localOverrides,
        flags: newFlags,
      };
      writeLocalOverrides(newOverrides);
      setLocalOverrides(newOverrides);
      refresh();
    },
    [localOverrides, refresh]
  );

  const handleClearAll = useCallback(() => {
    clearLocalOverrides();
    setLocalOverrides({ flags: {} });
    refresh();
  }, [refresh]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const hasOverrides = Object.keys(localOverrides.flags).length > 0;

  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feature Flags</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Development-only panel for viewing and managing feature flags.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Snapshot</CardTitle>
            <CardDescription>Current flag resolution source and refresh controls.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Source:</span>
                <SourceBadge source={snapshot.source} />
              </div>
              <div>
                <span className="text-muted-foreground">Updated:</span>{" "}
                <span className="font-mono">
                  {new Date(snapshot.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="grow" />
              <Button type="button" variant="secondary" onClick={refresh}>
                Refresh
              </Button>
              {hasOverrides ? (
                <Button type="button" variant="destructive" onClick={handleClearAll}>
                  Clear All Overrides
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flags</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flag Key</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Source</TableHead>
                  <TableHead>Local Override</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_FEATURE_FLAGS.map((flagKey) => (
                  <FlagRow
                    key={flagKey}
                    flagKey={flagKey}
                    isEnabled={isEnabled(flagKey)}
                    isKilled={isKilled(flagKey)}
                    source={getSource(flagKey)}
                    localOverride={localOverrides.flags[flagKey]}
                    onOverrideChange={(value) => handleOverrideChange(flagKey, value)}
                    onClearOverride={() => handleClearOverride(flagKey)}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              <li>Local overrides persist in localStorage and survive page reloads</li>
              <li>
                Use URL params for temporary overrides:{" "}
                <code className="bg-muted rounded px-1">?ff_example_feature=1</code>
              </li>
              <li>
                Kill switches (prefixed with <code>kill_</code>) have highest precedence
              </li>
              <li>This page is only accessible in development mode</li>
            </ul>
          </CardContent>
        </Card>

        <details>
          <summary className="text-muted-foreground cursor-pointer text-sm">
            View Raw Snapshot (Debug)
          </summary>
          <pre className="bg-muted mt-2 overflow-auto rounded-lg p-4 text-xs">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
