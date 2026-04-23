import { describe, expect, it } from "vitest";

import {
  getELFMachineDescription,
  getELFTypeDescription,
  isELFFile,
} from "../../../../parsers/elf/elfParser";
import { buildMinimalELF, buildMinimalPE } from "../../../helpers/binaryBuilder";

// ---------------------------------------------------------------------------
// isELFFile
// ---------------------------------------------------------------------------
describe("isELFFile (elfParser)", () => {
  it("should return true for valid ELF buffer", () => {
    expect(isELFFile(buildMinimalELF())).toBe(true);
  });

  it("should return true for 32-bit ELF buffer", () => {
    expect(isELFFile(buildMinimalELF({ bits: 32 }))).toBe(true);
  });

  it("should return false for empty buffer", () => {
    expect(isELFFile(Buffer.alloc(0))).toBe(false);
  });

  it("should return false for too short buffer", () => {
    expect(isELFFile(Buffer.from([0x7f]))).toBe(false);
  });

  it("should return false for PE buffer", () => {
    expect(isELFFile(buildMinimalPE())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getELFTypeDescription
// ---------------------------------------------------------------------------
describe("getELFTypeDescription", () => {
  it("should describe ET_NONE", () => {
    expect(getELFTypeDescription(0)).toContain("ET_NONE");
  });

  it("should describe ET_REL", () => {
    expect(getELFTypeDescription(1)).toContain("ET_REL");
  });

  it("should describe ET_EXEC", () => {
    expect(getELFTypeDescription(2)).toContain("ET_EXEC");
  });

  it("should describe ET_DYN", () => {
    expect(getELFTypeDescription(3)).toContain("ET_DYN");
  });

  it("should describe ET_CORE", () => {
    expect(getELFTypeDescription(4)).toContain("ET_CORE");
  });

  it("should return Unknown for unrecognized types", () => {
    expect(getELFTypeDescription(99)).toContain("Unknown");
    expect(getELFTypeDescription(99)).toContain("99");
  });
});

// ---------------------------------------------------------------------------
// getELFMachineDescription
// ---------------------------------------------------------------------------
describe("getELFMachineDescription", () => {
  const knownMachines: Array<[number, string]> = [
    [0, "No machine"],
    [3, "Intel 80386"],
    [8, "MIPS"],
    [20, "PowerPC"],
    [21, "PowerPC 64-bit"],
    [40, "ARM"],
    [62, "AMD x86-64"],
    [183, "ARM 64-bit"],
    [243, "RISC-V"],
  ];

  for (const [value, expected] of knownMachines) {
    it(`should describe machine ${value} as "${expected}"`, () => {
      expect(getELFMachineDescription(value)).toContain(expected);
    });
  }

  it("should return Unknown for unrecognized machine types", () => {
    expect(getELFMachineDescription(9999)).toContain("Unknown");
    expect(getELFMachineDescription(9999)).toContain("9999");
  });
});
