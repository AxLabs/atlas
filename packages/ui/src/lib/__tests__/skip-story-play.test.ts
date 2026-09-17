import { skipStoryPlay } from "../skip-story-play";

describe("skipStoryPlay", () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  function setSearch(search: string) {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, search },
    });
  }

  it("returns true when atlasPlay=0 is in the query string", () => {
    setSearch("?id=ui-select--keyboard-interaction&atlasPlay=0");
    expect(skipStoryPlay()).toBe(true);
  });

  it("returns false when atlasPlay is absent", () => {
    setSearch("?id=ui-select--keyboard-interaction");
    expect(skipStoryPlay()).toBe(false);
  });

  it("returns false when atlasPlay is not 0", () => {
    setSearch("?atlasPlay=1");
    expect(skipStoryPlay()).toBe(false);
  });

  it("returns false without a browser window", () => {
    const globalWithWindow = globalThis as typeof globalThis & {
      window?: Window & typeof globalThis;
    };
    const savedWindow = globalWithWindow.window;
    Reflect.deleteProperty(globalWithWindow, "window");
    expect(skipStoryPlay()).toBe(false);
    globalWithWindow.window = savedWindow;
  });
});
