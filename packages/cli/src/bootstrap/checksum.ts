import { createHash } from "node:crypto";

import { CHECKSUM_PREFIX } from "./constants";

export function sha256Bytes(content: Buffer): string {
  return `${CHECKSUM_PREFIX}${createHash("sha256").update(content).digest("hex")}`;
}

export function formatPosixMode(mode: number): string {
  return (mode & 0o777).toString(8).padStart(3, "0").padStart(4, "0");
}
