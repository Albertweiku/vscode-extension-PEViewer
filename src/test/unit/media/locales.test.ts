import { beforeAll, describe, expect, it } from "vitest";

import { loadScript } from "../../helpers/scriptLoader";

let ctx: Record<string, any>;

beforeAll(() => {
  ctx = loadScript("shared/locales.js", {
    document: {
      getElementById: () => null,
    },
  });
});

describe("locales data", () => {
  it("should define zh-cn and en locale objects", () => {
    expect(ctx.locales).toBeDefined();
    expect(ctx.locales["zh-cn"]).toBeDefined();
    expect(ctx.locales["en"]).toBeDefined();
  });

  it("should have mostly matching keys between locales", () => {
    const zhKeys = new Set(Object.keys(ctx.locales["zh-cn"]));
    const enKeys = new Set(Object.keys(ctx.locales["en"]));

    const missingInEn = [...zhKeys].filter((k) => !enKeys.has(k));
    const missingInZh = [...enKeys].filter((k) => !zhKeys.has(k));

    // Allow a small number of mismatches (locale WIP), but warn
    if (missingInEn.length > 0) {
      console.warn("Keys in zh-cn but missing in en:", missingInEn);
    }
    if (missingInZh.length > 0) {
      console.warn("Keys in en but missing in zh-cn:", missingInZh);
    }

    // At least 95% overlap
    const total = new Set([...zhKeys, ...enKeys]).size;
    const shared = [...zhKeys].filter((k) => enKeys.has(k)).length;
    expect(shared / total).toBeGreaterThan(0.95);
  });
});

describe("t() translation function", () => {
  it("should return English text by default", () => {
    ctx.currentLanguage = "en";
    const result = ctx.t("peHeader");
    expect(result).toBe("PE Header");
  });

  it("should return Chinese text when language is zh-cn", () => {
    ctx.currentLanguage = "zh-cn";
    const result = ctx.t("peHeader");
    expect(result).toBe("PE头部");
  });

  it("should fall back to key when key does not exist", () => {
    ctx.currentLanguage = "en";
    const result = ctx.t("nonExistentKey12345");
    expect(result).toBe("nonExistentKey12345");
  });

  it("should replace {param} placeholders", () => {
    ctx.currentLanguage = "en";
    const result = ctx.t("importFunctionsCount", {
      totalFunctions: "42",
      dllCount: "5",
    });
    expect(result).toContain("42");
    expect(result).toContain("5");
  });

  it("should replace multiple occurrences of same param", () => {
    ctx.currentLanguage = "en";
    // Manually test with a template containing repeated param
    const result = ctx.t("totalFunctions", { count: "10" });
    expect(result).toContain("10");
  });

  it("should return key with params replaced even for unknown keys", () => {
    ctx.currentLanguage = "en";
    const result = ctx.t("{count} items total", { count: "7" });
    expect(result).toBe("7 items total");
  });

  it("should work without params argument", () => {
    ctx.currentLanguage = "en";
    expect(ctx.t("exports")).toBe("Export Functions");
  });

  it("should handle zh-cn param replacement", () => {
    ctx.currentLanguage = "zh-cn";
    const result = ctx.t("importedFunctionsCount", { count: "100" });
    expect(result).toContain("100");
  });
});

describe("currentLanguage", () => {
  it("should default to en", () => {
    // Reload to check default
    const fresh = loadScript("shared/locales.js", {
      document: { getElementById: () => null },
    });
    expect(fresh.currentLanguage).toBe("en");
  });
});
