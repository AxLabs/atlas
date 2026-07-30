import { ArrowRight, Database, FileText } from "lucide-react";
import Link from "next/link";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@atlas/ui";

const examples = [
  {
    href: "/examples/data",
    title: "Data fetching",
    icon: Database,
    description: "React Query hooks with loading, empty, error, and success states.",
  },
  {
    href: "/examples/form",
    title: "Forms & validation",
    icon: FileText,
    description: "React Hook Form, Zod, and server field error mapping.",
  },
];

export default function ExamplesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Reference examples</h1>
        <p className="text-muted-foreground">
          Minimal, copy-friendly patterns for common platform workflows. Delete this route group
          when you start building your product.
        </p>
      </div>

      <div className="grid gap-4">
        {examples.map((example) => {
          const Icon = example.icon;
          return (
            <Card key={example.href}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Icon className="text-primary h-5 w-5" />
                  <CardTitle className="text-lg">{example.title}</CardTitle>
                </div>
                <CardDescription>{example.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm">
                  <Link href={example.href}>
                    View example
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
