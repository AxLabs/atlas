/**
 * Playwright keyboard probes load `iframe.html` directly. Storybook still runs CSF
 * `play` functions there, and those sequences use the same widget (open/close, keys)
 * as the probe. Skip play when the iframe is opened with `atlasPlay=0`.
 *
 * The test-runner does not set this param, so interaction/axe stories still play.
 */
export function skipStoryPlay() {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("atlasPlay") === "0";
}
