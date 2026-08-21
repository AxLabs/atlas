import { pathToFileURL } from "node:url";

/**
 * Load an ESM module from CommonJS output without TypeScript downleveling `import()` to `require()`.
 */
export async function importEsmModule<T>(modulePath: string): Promise<T> {
  const moduleUrl = pathToFileURL(modulePath).href;
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string
  ) => Promise<T>;
  return dynamicImport(moduleUrl);
}
