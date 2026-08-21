import path from "node:path";

import { resolveAtlasProject, serializeResolvedAtlasProject } from "../src";

const repoRoot = path.resolve(__dirname, "../../..");
const resolved = resolveAtlasProject(repoRoot);
process.stdout.write(serializeResolvedAtlasProject(resolved));
