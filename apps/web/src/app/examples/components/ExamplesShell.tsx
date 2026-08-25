"use client";

import { Database, FileText, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn, ThemeToggle } from "@atlas/ui";

import { AppBreadcrumbs } from "@/components/navigation/AppBreadcrumbs";

const exampleRoutes = [
  { href: "/examples", label: "Overview", icon: Home },
  { href: "/examples/data", label: "Data states", icon: Database },
  { href: "/examples/form", label: "Forms", icon: FileText },
];

export interface ExamplesShellProps {
  children: React.ReactNode;
}

export function ExamplesShell({ children }: ExamplesShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background border-border sticky top-0 z-50 flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold">
            Atlas
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">Examples</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex flex-1">
        <aside className="bg-background border-border hidden w-56 shrink-0 border-r md:block">
          <nav className="flex flex-col gap-1 p-4">
            {exampleRoutes.map((route) => {
              const Icon = route.icon;
              const isActive = pathname === route.href;
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{route.label}</span>
                </Link>
              );
            })}
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
