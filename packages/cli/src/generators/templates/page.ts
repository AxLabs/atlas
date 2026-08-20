export interface PageTemplateContext {
  route: string;
  pageTitle: string;
  componentName: string;
}

export function renderPage(context: PageTemplateContext): string {
  return `export default function ${context.componentName}() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">${context.pageTitle}</h1>
        <p className="text-muted-foreground">
          Replace this page with product-specific composition from the matching feature module.
        </p>
      </div>
    </div>
  );
}
`;
}
