import { ReferenceBanner, ReferencePageClient } from "@/features/reference";

export const metadata = {
  title: "Reference Harness",
  description: "Deterministic local auth and API controls for Atlas reference platform",
};

export default function ReferencePage() {
  return (
    <div className="min-h-screen">
      <ReferenceBanner />
      <main className="container mx-auto max-w-3xl space-y-6 p-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Reference harness</h1>
          <p className="text-muted-foreground">
            Select deterministic auth personas and API scenarios without Google OAuth or external
            services. This path exercises the same session and API contracts as production
            integrations.
          </p>
        </header>
        <ReferencePageClient />
      </main>
    </div>
  );
}
