"use client";

import {
  Activity,
  FlaskConical,
  Home,
  Menu,
  Settings,
  Shield,
  UserCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button, cn, Sheet, SheetContent, SheetHeader, SheetTitle, ThemeToggle } from "@atlas/ui";

import { AppBreadcrumbs } from "@/components/navigation/AppBreadcrumbs";

import { ReferenceBanner } from "./ReferenceBanner";
import { ReferenceUserArea } from "./ReferenceUserArea";

const referenceRoutes = [
  { href: "/", label: "Overview", icon: Home, exact: true },
  { href: "/users", label: "Users", icon: Users, exact: false },
  { href: "/profile", label: "Profile", icon: UserCircle, exact: false },
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
  { href: "/authorization", label: "Authorization", icon: Shield, exact: false },
  { href: "/platform", label: "Platform", icon: Activity, exact: false },
  { href: "/harness", label: "Harness", icon: FlaskConical, exact: false },
];

export interface ReferenceShellProps {
  children: React.ReactNode;
}

function isRouteActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function ReferenceNavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {referenceRoutes.map((route) => {
        const Icon = route.icon;
        const isActive = isRouteActive(pathname, route.href, route.exact);

        return (
          <Link
            key={route.href}
            href={route.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{route.label}</span>
          </Link>
        );
      })}
    </>
  );
}

export function ReferenceShell({ children }: ReferenceShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <ReferenceBanner />

      <header className="bg-background border-border sticky top-0 z-50 flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="md:hidden"
            aria-label="Open navigation menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Link href="/" className="text-lg font-semibold">
            Atlas
          </Link>
          <span className="text-muted-foreground hidden sm:inline">/</span>
          <span className="text-muted-foreground hidden text-sm sm:inline">
            Reference application
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ReferenceUserArea />
          <ThemeToggle />
        </div>
      </header>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-border border-b p-4">
            <SheetTitle>Reference application</SheetTitle>
          </SheetHeader>
          <nav aria-label="Reference application" className="flex flex-col gap-1 p-4">
            <ReferenceNavLinks pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1">
        <aside className="bg-background border-border hidden w-56 shrink-0 border-r md:block">
          <nav aria-label="Reference application" className="flex flex-col gap-1 p-4">
            <ReferenceNavLinks pathname={pathname} />
          </nav>
        </aside>

        <main className="flex-1">
          <AppBreadcrumbs />
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
