export interface DocumentationReference {
  id: string;
  path: string;
  title: string;
}

export const AGENT_WORKFLOW_DOC_PATH = "docs/how-we-build/agents.md";
export const AGENT_ENTRY_POINT_PATH = "AGENTS.md";

export const SOURCE_OF_TRUTH_HIERARCHY: string[] = [
  "atlas.config.json / resolved Atlas project contract (@atlas/project)",
  "Atlas CLI generators and command metadata",
  "atlas doctor diagnostics",
  "atlas upgrade plans and migration metadata",
  "ADRs and canonical architecture documentation",
  "AGENTS.md workflow and judgment guidance",
  "Vendor-specific adapters (for example .cursor/rules, .cursor/skills)",
];

export const AGENT_DOCUMENTATION_REFERENCES: DocumentationReference[] = [
  { id: "agents-workflow", path: AGENT_WORKFLOW_DOC_PATH, title: "Agent workflow" },
  {
    id: "architecture-ownership",
    path: "docs/how-we-build/architecture-ownership.md",
    title: "Architecture ownership",
  },
  {
    id: "atlas-contract",
    path: "docs/how-we-build/atlas-contract.md",
    title: "Atlas project contract",
  },
  { id: "cli", path: "docs/how-we-build/cli.md", title: "Atlas CLI" },
  { id: "doctor", path: "docs/how-we-build/doctor.md", title: "Atlas Doctor" },
  { id: "upgrades", path: "docs/how-we-build/upgrades.md", title: "Atlas upgrades" },
  { id: "api", path: "docs/how-we-build/api.md", title: "API and data fetching" },
  { id: "authorization", path: "docs/how-we-build/authorization.md", title: "Authorization" },
  { id: "testing", path: "docs/how-we-build/testing.md", title: "Testing" },
  {
    id: "folder-structure",
    path: "docs/how-we-build/folder-structure.md",
    title: "Folder structure",
  },
  { id: "examples", path: "docs/how-we-build/examples.md", title: "Example patterns" },
  { id: "security", path: "docs/how-we-build/security.md", title: "Security posture" },
  { id: "threat-model", path: "docs/security/threat-model.md", title: "Atlas threat model" },
];

export const AGENT_ADR_REFERENCES: DocumentationReference[] = [
  {
    id: "ADR-0007",
    path: "docs/adr/0007-architecture-ownership-model.md",
    title: "Architecture ownership model",
  },
  {
    id: "ADR-0008",
    path: "docs/adr/0008-atlas-project-contract.md",
    title: "Atlas project architecture contract",
  },
  {
    id: "ADR-0009",
    path: "docs/adr/0009-starter-reference-template-sync.md",
    title: "Starter/reference template sync",
  },
  {
    id: "ADR-0010",
    path: "docs/adr/0010-atlas-upgrades-downstream-propagation.md",
    title: "Atlas upgrades and downstream propagation",
  },
];

export function listAgentDocumentationReferences(): DocumentationReference[] {
  return [...AGENT_DOCUMENTATION_REFERENCES].sort((left, right) => left.id.localeCompare(right.id));
}

export function listAgentAdrReferences(): DocumentationReference[] {
  return [...AGENT_ADR_REFERENCES].sort((left, right) => left.id.localeCompare(right.id));
}
