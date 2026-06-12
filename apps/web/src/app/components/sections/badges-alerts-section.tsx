"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
} from "@atlas/ui";

export function BadgesAlertsSection() {
  return (
    <>
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Badges & Avatars</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>DM</AvatarFallback>
          </Avatar>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Alerts</h2>
        <Alert>
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>This is a default alert with some information.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Something went wrong. Please try again.</AlertDescription>
        </Alert>
      </section>
    </>
  );
}
