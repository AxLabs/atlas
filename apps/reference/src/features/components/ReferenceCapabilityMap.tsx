"use client";

import Link from "next/link";

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@atlas/ui";

import {
  getCapabilitiesByGroup,
  type ReferenceCapabilityStatus,
} from "@/lib/reference/capabilities";

function statusLabel(status: ReferenceCapabilityStatus): string {
  switch (status) {
    case "demonstrated":
      return "Demonstrated";
    case "infrastructure":
      return "Infrastructure";
    case "external":
      return "External";
  }
}

function statusVariant(status: ReferenceCapabilityStatus): "default" | "secondary" | "outline" {
  switch (status) {
    case "demonstrated":
      return "default";
    case "infrastructure":
      return "secondary";
    case "external":
      return "outline";
  }
}

export function ReferenceCapabilityMap() {
  const groups = getCapabilitiesByGroup();

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <Card key={group.group}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
            <CardDescription>{group.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {group.capabilities.map((capability) => (
                <li
                  key={capability.id}
                  className="border-border flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1">
                    {capability.route ? (
                      <Link
                        href={capability.route}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {capability.label}
                      </Link>
                    ) : (
                      <span className="font-medium">{capability.label}</span>
                    )}
                    <p className="text-muted-foreground text-sm">{capability.description}</p>
                  </div>
                  <Badge variant={statusVariant(capability.status)} className="shrink-0">
                    {statusLabel(capability.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
