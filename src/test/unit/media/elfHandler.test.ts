import { beforeAll, describe, expect, it } from "vitest";

import { loadScripts } from "../../helpers/scriptLoader";

let ctx: Record<string, any>;

beforeAll(() => {
  // elfHandler depends on `t()` from locales, so load both
  ctx = loadScripts(["shared/locales.js", "elf/elfHandler.js"], {
    document: {
      getElementById: () => null,
      querySelector: () => null,
      createElement: (tag: string) => ({
        textContent: "",
        get innerHTML() {
          // Simple HTML escaping for tests
          return (this.textContent as string)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
        },
      }),
      title: "",
    },
  });
});

// ---------------------------------------------------------------------------
// getElfDynamicSoname
// ---------------------------------------------------------------------------
describe("getElfDynamicSoname", () => {
  it("should return empty string for null/undefined elfData", () => {
    expect(ctx.getElfDynamicSoname(null)).toBe("");
    expect(ctx.getElfDynamicSoname(undefined)).toBe("");
    expect(ctx.getElfDynamicSoname({})).toBe("");
  });

  it("should return empty string when dynamic is not an array", () => {
    expect(ctx.getElfDynamicSoname({ dynamic: "not array" })).toBe("");
    expect(ctx.getElfDynamicSoname({ dynamic: 42 })).toBe("");
  });

  it("should extract DT_SONAME by tag string", () => {
    const elfData = {
      dynamic: [
        { tag: "DT_NEEDED", val: "libc.so.6" },
        { tag: "DT_SONAME", val: "libfoo.so.1" },
      ],
    };
    expect(ctx.getElfDynamicSoname(elfData)).toBe("libfoo.so.1");
  });

  it("should extract DT_SONAME by numeric tag (14)", () => {
    const elfData = {
      dynamic: [{ d_tag: 14, d_val: "libbar.so.2" }],
    };
    expect(ctx.getElfDynamicSoname(elfData)).toBe("libbar.so.2");
  });

  it("should return empty string when no DT_SONAME entry", () => {
    const elfData = {
      dynamic: [
        { tag: "DT_NEEDED", val: "libc.so.6" },
        { tag: "DT_STRTAB", val: 1234 },
      ],
    };
    expect(ctx.getElfDynamicSoname(elfData)).toBe("");
  });

  it("should trim whitespace from soname value", () => {
    const elfData = {
      dynamic: [{ tag: "DT_SONAME", val: "  libfoo.so.1  " }],
    };
    expect(ctx.getElfDynamicSoname(elfData)).toBe("libfoo.so.1");
  });

  it("should skip DT_SONAME with non-string or empty value", () => {
    const elfData = {
      dynamic: [
        { tag: "DT_SONAME", val: 42 },
        { tag: "DT_SONAME", val: "" },
        { tag: "DT_SONAME", val: "   " },
      ],
    };
    expect(ctx.getElfDynamicSoname(elfData)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// elfHeaderNum
// ---------------------------------------------------------------------------
describe("elfHeaderNum", () => {
  it("should return undefined for undefined/null", () => {
    expect(ctx.elfHeaderNum(undefined)).toBeUndefined();
    expect(ctx.elfHeaderNum(null)).toBeUndefined();
  });

  it("should pass through finite numbers", () => {
    expect(ctx.elfHeaderNum(42)).toBe(42);
    expect(ctx.elfHeaderNum(0)).toBe(0);
    expect(ctx.elfHeaderNum(-1)).toBe(-1);
  });

  it("should convert numeric strings to number", () => {
    expect(ctx.elfHeaderNum("183")).toBe(183);
    expect(ctx.elfHeaderNum("0")).toBe(0);
  });

  it("should return undefined for non-numeric strings", () => {
    expect(ctx.elfHeaderNum("abc")).toBeUndefined();
  });

  it("should convert empty string to 0 (Number('') === 0)", () => {
    // Number("") returns 0 which is finite, so elfHeaderNum returns 0
    expect(ctx.elfHeaderNum("")).toBe(0);
  });

  it("should return undefined for NaN/Infinity", () => {
    expect(ctx.elfHeaderNum(NaN)).toBeUndefined();
    expect(ctx.elfHeaderNum(Infinity)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getSectionTypeDescription
// ---------------------------------------------------------------------------
describe("getSectionTypeDescription", () => {
  const knownTypes: Array<[number, string]> = [
    [0, "SHT_NULL"],
    [1, "SHT_PROGBITS"],
    [2, "SHT_SYMTAB"],
    [3, "SHT_STRTAB"],
    [4, "SHT_RELA"],
    [5, "SHT_HASH"],
    [6, "SHT_DYNAMIC"],
    [7, "SHT_NOTE"],
    [8, "SHT_NOBITS"],
    [9, "SHT_REL"],
    [11, "SHT_DYNSYM"],
    [14, "SHT_INIT_ARRAY"],
    [15, "SHT_FINI_ARRAY"],
  ];

  for (const [value, expected] of knownTypes) {
    it(`should describe type ${value} as containing "${expected}"`, () => {
      expect(ctx.getSectionTypeDescription(value)).toContain(expected);
    });
  }

  it("should return Unknown for undefined", () => {
    expect(ctx.getSectionTypeDescription(undefined)).toBe("Unknown");
  });

  it("should return Unknown with hex for unrecognized types", () => {
    const result = ctx.getSectionTypeDescription(0xff);
    expect(result).toContain("Unknown");
    expect(result).toContain("ff");
  });
});

// ---------------------------------------------------------------------------
// getSectionFlagsDescription
// ---------------------------------------------------------------------------
describe("getSectionFlagsDescription", () => {
  it("should return None for undefined", () => {
    expect(ctx.getSectionFlagsDescription(undefined)).toBe("None");
  });

  it("should return None for 0", () => {
    expect(ctx.getSectionFlagsDescription(0)).toBe("None");
  });

  it("should describe WRITE flag (0x1)", () => {
    expect(ctx.getSectionFlagsDescription(0x1)).toContain("WRITE");
  });

  it("should describe ALLOC flag (0x2)", () => {
    expect(ctx.getSectionFlagsDescription(0x2)).toContain("ALLOC");
  });

  it("should describe EXECINSTR flag (0x4)", () => {
    expect(ctx.getSectionFlagsDescription(0x4)).toContain("EXECINSTR");
  });

  it("should combine multiple flags with |", () => {
    const result = ctx.getSectionFlagsDescription(0x1 | 0x2 | 0x4);
    expect(result).toContain("WRITE");
    expect(result).toContain("ALLOC");
    expect(result).toContain("EXECINSTR");
    expect(result).toContain("|");
  });

  it("should describe TLS flag (0x400)", () => {
    expect(ctx.getSectionFlagsDescription(0x400)).toContain("TLS");
  });

  it("should describe MERGE and STRINGS flags", () => {
    const result = ctx.getSectionFlagsDescription(0x10 | 0x20);
    expect(result).toContain("MERGE");
    expect(result).toContain("STRINGS");
  });
});
