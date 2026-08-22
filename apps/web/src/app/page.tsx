import { Button, Kbd } from "@atlas/ui";

import { LandingSelect } from "@/components/LandingSelect";
import { ThemeHotkey } from "@/components/ThemeHotkey";

export default function HomePage() {
  return (
    <>
      <ThemeHotkey />
      <div className="flex min-h-svh p-6">
        <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
          <div>
            <h1 className="font-medium">Project ready!</h1>
            <p>You may now add components and start building.</p>
            <p>We&apos;ve already added the button component for you.</p>
            <div className="mt-4 flex flex-col gap-4">
              <LandingSelect />
              <Button>Button</Button>
            </div>
          </div>
          <div className="text-muted-foreground font-mono text-xs">
            (Press <Kbd>d</Kbd> to toggle dark mode)
          </div>
        </div>
      </div>
    </>
  );
}
