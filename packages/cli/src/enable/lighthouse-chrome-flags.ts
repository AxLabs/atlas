export const LIGHTHOUSERC_DESTINATION = "lighthouserc.json";

/** Exact `chromeFlags` array shipped in Atlas 1.1.0 `lighthouserc.json`. */
export const LEGACY_ATLAS_110_CHROME_FLAGS = [
  "--no-sandbox",
  "--disable-gpu",
  "--headless=new",
] as const;

export const CANONICAL_CHROME_FLAGS = "--no-sandbox --disable-gpu --headless=new";

export const LEGACY_CHROME_FLAGS_REASON = "Convert known Atlas 1.1.0 chromeFlags array to a string";

export const CUSTOM_CHROME_FLAGS_REASON =
  'chromeFlags is a custom value; Atlas can only auto-convert the 1.1.0 array ["--no-sandbox","--disable-gpu","--headless=new"] to "--no-sandbox --disable-gpu --headless=new". Update lighthouserc.json manually so Lighthouse CI receives a string.';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isLegacyAtlas110ChromeFlags(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === LEGACY_ATLAS_110_CHROME_FLAGS.length &&
    value.every((entry, index) => entry === LEGACY_ATLAS_110_CHROME_FLAGS[index])
  );
}

export function getLighthouseCollectSettings(parsed: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(parsed)) {
    return undefined;
  }
  const ci = parsed.ci;
  if (!isPlainObject(ci)) {
    return undefined;
  }
  const collect = ci.collect;
  if (!isPlainObject(collect)) {
    return undefined;
  }
  const settings = collect.settings;
  if (!isPlainObject(settings)) {
    return undefined;
  }
  return settings;
}

export type LighthouseChromeFlagsObservation = "missing" | "match" | "replaceable" | "conflict";

export function observeLighthouseChromeFlags(parsed: unknown): LighthouseChromeFlagsObservation {
  const settings = getLighthouseCollectSettings(parsed);
  if (!settings) {
    return "missing";
  }
  const current = settings.chromeFlags;
  if (current === CANONICAL_CHROME_FLAGS) {
    return "match";
  }
  if (isLegacyAtlas110ChromeFlags(current)) {
    return "replaceable";
  }
  return "conflict";
}

export function applyCanonicalChromeFlags(parsed: unknown): unknown {
  const clone = JSON.parse(JSON.stringify(parsed)) as unknown;
  const settings = getLighthouseCollectSettings(clone);
  if (!settings) {
    throw new Error("lighthouserc.json is missing ci.collect.settings");
  }
  settings.chromeFlags = CANONICAL_CHROME_FLAGS;
  return clone;
}
