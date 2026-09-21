import { sha256Bytes } from "../bootstrap/checksum";

/**
 * SHA-256 digests of documentation files packaged by published CLI releases.
 * `atlas enable docs` replaces a file only when its full contents hash-match one
 * of these known shipped copies. Phrase matching is not used.
 */
export const KNOWN_SHIPPED_CONSUMER_DOCUMENTATION: Record<string, string[]> = {
  "AGENTS.md": [
    // @blitzcraftlabs/atlas@1.1.0 assets/bootstrap/files/AGENTS.md
    "sha256:e1ea920e70457e2469c8f8eeb6640a241ff1560a1a26d46d67cf37c67329d99b",
  ],
  "docs/how-we-build/agents.md": [
    // @blitzcraftlabs/atlas@1.1.0 assets/bootstrap/files/docs/how-we-build/agents.md
    "sha256:515f11601221ab7fee576be2e716dfd8143b7bacf82e02f10a12165ab3978049",
  ],
  "docs/how-we-build/folder-structure.md": [
    // @blitzcraftlabs/atlas@1.1.0 assets/bootstrap/files/docs/how-we-build/folder-structure.md
    "sha256:064b5395b07c886c09cbe81365364e823408b01dfff7a18e93e8f96ab239212f",
  ],
  "docs/how-we-build/examples.md": [
    // @blitzcraftlabs/atlas@1.1.0 assets/bootstrap/files/docs/how-we-build/examples.md
    "sha256:45027ea185991467055dee49e92c3283d691a05cfa7ca8f943ce6c05b2b90bef",
  ],
};

export function isKnownShippedConsumerDocumentation(destination: string, content: string): boolean {
  const known = KNOWN_SHIPPED_CONSUMER_DOCUMENTATION[destination];
  if (!known || known.length === 0) {
    return false;
  }
  const digest = sha256Bytes(Buffer.from(content, "utf8"));
  return known.includes(digest);
}
