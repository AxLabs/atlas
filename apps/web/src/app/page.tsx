import { Button } from "@atlas/ui";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <main className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
          Frontend <span className="text-primary">Platform</span>
        </h1>
        <p className="text-muted-foreground text-center text-xl">
          Enterprise-grade monorepo with Next.js, TypeScript, and Tailwind CSS
        </p>
        <div className="flex gap-4">
          <Link href="/demo">
            <Button size="lg">View Demo</Button>
          </Link>
          <a
            href="https://github.com/thedanielmark/atlas"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="lg">
              GitHub
            </Button>
          </a>
        </div>
      </main>
    </div>
  );
}
