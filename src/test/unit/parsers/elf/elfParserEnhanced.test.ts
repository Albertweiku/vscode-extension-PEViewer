import { describe, expect, it } from "vitest";

import {
  parseELFDynamicSection,
  parseELFSymbolsDirect,
} from "../../../../parsers/elf/elfParserEnhanced";
import {
  buildDynamicSection,
  buildDynstr,
  buildMinimalELF,
  buildSymbolEntry,
  type ElfSectionDef,
} from "../../../helpers/binaryBuilder";

const SHT_DYNAMIC = 6;
const SHT_STRTAB = 3;
const SHT_DYNSYM = 11;

const DT_NEEDED = 1;

// ---------------------------------------------------------------------------
// parseELFDynamicSection
// ---------------------------------------------------------------------------
describe("parseELFDynamicSection", () => {
  it("should return empty needed for non-ELF buffer", () => {
    const result = parseELFDynamicSection(Buffer.from("not an elf"));
    expect(result.needed).toEqual([]);
  });

  it("should return empty needed for buffer too small", () => {
    const result = parseELFDynamicSection(Buffer.alloc(10));
    expect(result.needed).toEqual([]);
  });

  it("should parse DT_NEEDED entries from a 64-bit LE ELF", () => {
    const libs = ["libc.so.6", "libm.so.6"];
    const { data: dynstrData, offsets } = buildDynstr(libs);
    const dynEntries = libs.map((lib) => ({
      tag: DT_NEEDED,
      val: offsets.get(lib)!,
    }));
    const dynData = buildDynamicSection(true, true, dynEntries);

    // dynstr section needs link=0, dynamic needs link pointing to dynstr
    const sections: ElfSectionDef[] = [
      { name: ".dynstr", type: SHT_STRTAB, data: dynstrData },
      {
        name: ".dynamic",
        type: SHT_DYNAMIC,
        data: dynData,
        link: 1,
        entsize: 16,
      },
    ];

    const elf = buildMinimalELF({ bits: 64, endian: "LE", sections });
    const result = parseELFDynamicSection(elf);
    expect(result.needed).toContain("libc.so.6");
    expect(result.needed).toContain("libm.so.6");
    expect(result.needed).toHaveLength(2);
  });

  it("should parse DT_NEEDED entries from a 32-bit LE ELF", () => {
    const libs = ["libpthread.so.0"];
    const { data: dynstrData, offsets } = buildDynstr(libs);
    const dynEntries = libs.map((lib) => ({
      tag: DT_NEEDED,
      val: offsets.get(lib)!,
    }));
    const dynData = buildDynamicSection(false, true, dynEntries);

    const sections: ElfSectionDef[] = [
      { name: ".dynstr", type: SHT_STRTAB, data: dynstrData },
      {
        name: ".dynamic",
        type: SHT_DYNAMIC,
        data: dynData,
        link: 1,
        entsize: 8,
      },
    ];

    const elf = buildMinimalELF({ bits: 32, endian: "LE", sections });
    const result = parseELFDynamicSection(elf);
    expect(result.needed).toContain("libpthread.so.0");
  });

  it("should return empty needed when no .dynamic section exists", () => {
    const elf = buildMinimalELF({ bits: 64 });
    const result = parseELFDynamicSection(elf);
    expect(result.needed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseELFSymbolsDirect
// ---------------------------------------------------------------------------
describe("parseELFSymbolsDirect", () => {
  it("should return empty for non-ELF buffer", () => {
    const result = parseELFSymbolsDirect(Buffer.from("not elf"));
    expect(result).toEqual([]);
  });

  it("should return empty for buffer too small", () => {
    const result = parseELFSymbolsDirect(Buffer.alloc(10));
    expect(result).toEqual([]);
  });

  it("should parse symbols from a 64-bit ELF with .dynsym", () => {
    const symbolNames = ["my_func", "my_data", "imported_func"];
    const { data: strData, offsets: strOffsets } = buildDynstr(symbolNames);

    // Build symbol entries
    // STB_GLOBAL=1, STT_FUNC=2, STT_OBJECT=1
    const nullSym = buildSymbolEntry(true, true, 0, 0, 0, 0, 0);
    const funcSym = buildSymbolEntry(
      true, true,
      strOffsets.get("my_func")!, 0x1000, 64,
      (1 << 4) | 2, // STB_GLOBAL | STT_FUNC
      1, // defined (shndx != 0)
    );
    const dataSym = buildSymbolEntry(
      true, true,
      strOffsets.get("my_data")!, 0x2000, 8,
      (1 << 4) | 1, // STB_GLOBAL | STT_OBJECT
      2,
    );
    const importSym = buildSymbolEntry(
      true, true,
      strOffsets.get("imported_func")!, 0, 0,
      (1 << 4) | 2, // STB_GLOBAL | STT_FUNC
      0, // UND (import)
    );

    const symData = Buffer.concat([nullSym, funcSym, dataSym, importSym]);

    // dynstr section index will be 1, dynsym will be 2 (in the 1-based section header table)
    const sections: ElfSectionDef[] = [
      { name: ".dynstr", type: SHT_STRTAB, data: strData },
      {
        name: ".dynsym",
        type: SHT_DYNSYM,
        data: symData,
        link: 1, // points to .dynstr (section index 1 in 1-based table)
        entsize: 24,
      },
    ];

    const elf = buildMinimalELF({ bits: 64, endian: "LE", sections });
    const result = parseELFSymbolsDirect(elf);

    // Should find non-LOCAL symbols (all three have STB_GLOBAL)
    expect(result.length).toBeGreaterThanOrEqual(2);
    const names = result.map((s) => s.name);
    expect(names).toContain("my_func");
    expect(names).toContain("my_data");

    // Check symbol properties
    const func = result.find((s) => s.name === "my_func")!;
    expect(func.type).toBe("FUNC");
    expect(func.binding).toBe("STB_GLOBAL");
    expect(func.address).toBe(0x1000);
    expect(func.size).toBe(64);
    expect(func.shndx).not.toBe(0);

    // Imported symbol
    const imported = result.find((s) => s.name === "imported_func");
    if (imported) {
      expect(imported.shndx).toBe(0);
    }
  });

  it("should return empty when ELF has no symbol sections", () => {
    const elf = buildMinimalELF({ bits: 64, endian: "LE" });
    const result = parseELFSymbolsDirect(elf);
    expect(result).toEqual([]);
  });

  it("should parse 32-bit ELF symbols", () => {
    const symbolNames = ["func32"];
    const { data: strData, offsets: strOffsets } = buildDynstr(symbolNames);

    const nullSym = buildSymbolEntry(false, true, 0, 0, 0, 0, 0);
    const funcSym = buildSymbolEntry(
      false, true,
      strOffsets.get("func32")!, 0x8000, 32,
      (1 << 4) | 2,
      1,
    );
    const symData = Buffer.concat([nullSym, funcSym]);

    const sections: ElfSectionDef[] = [
      { name: ".dynstr", type: SHT_STRTAB, data: strData },
      {
        name: ".dynsym",
        type: SHT_DYNSYM,
        data: symData,
        link: 1,
        entsize: 16,
      },
    ];

    const elf = buildMinimalELF({ bits: 32, endian: "LE", sections });
    const result = parseELFSymbolsDirect(elf);
    const names = result.map((s) => s.name);
    expect(names).toContain("func32");
  });
});
