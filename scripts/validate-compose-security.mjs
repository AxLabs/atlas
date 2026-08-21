import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

/** @typedef {{ file: string, service: string, port: string }} InsecureBinding */

/**
 * Parse published ports from a compose YAML file and flag bindings exposed on all interfaces.
 * @param {string} filePath
 * @returns {InsecureBinding[]}
 */
export function findInsecureDevServiceBindings(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  /** @type {InsecureBinding[]} */
  const insecure = [];
  let currentService = null;

  for (const line of lines) {
    const serviceMatch = line.match(/^  ([a-z0-9_-]+):\s*$/i);
    if (serviceMatch) {
      currentService = serviceMatch[1];
      continue;
    }

    if (!currentService) {
      continue;
    }

    const portMatch = line.match(/^\s+-\s+"([^"]+)"\s*$/);
    if (!portMatch) {
      continue;
    }

    const binding = portMatch[1];
    const [host] = binding.split(":");
    if (host === "0.0.0.0" || host === "" || /^\d+$/.test(host)) {
      insecure.push({ file: filePath, service: currentService, port: binding });
    }
  }

  return insecure;
}

/**
 * Validate that example infrastructure services bind to loopback only.
 * @param {string} [repoRoot]
 */
export function validateComposeSecurity(repoRoot = REPO_ROOT) {
  const infraFile = path.join(repoRoot, "examples/compose/infra.yml");
  const insecure = findInsecureDevServiceBindings(infraFile);

  if (insecure.length > 0) {
    const details = insecure
      .map(({ service, port }) => `${service} publishes ${port} on all interfaces`)
      .join("; ");
    throw new Error(`Insecure development service bindings found: ${details}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    validateComposeSecurity();
    console.log("✓ Development infrastructure ports are loopback-only");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
