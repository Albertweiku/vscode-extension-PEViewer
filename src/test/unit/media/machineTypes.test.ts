import { beforeAll, describe, expect, it } from "vitest";

import { loadScript } from "../../helpers/scriptLoader";

let getMachineTypeDescription: (type: number) => string;
let getMachineTypeFullInfo: (type: number) => string;

beforeAll(() => {
  const ctx = loadScript("shared/machineTypes.js");
  getMachineTypeDescription = ctx.getMachineTypeDescription;
  getMachineTypeFullInfo = ctx.getMachineTypeFullInfo;
});

describe("getMachineTypeDescription", () => {
  const knownTypes: Array<[number, string]> = [
    [0x0, "Unknown"],
    [0x14c, "Intel 386 (x86)"],
    [0x8664, "AMD64 (x64)"],
    [0xaa64, "ARM64 (AArch64)"],
    [0xa64e, "ARM64EC"],
    [0x1c0, "ARM little endian"],
    [0x1c4, "ARMv7 Thumb"],
    [0x200, "Intel IA64"],
    [0xebc, "EFI Byte Code"],
    [0xc0ee, "clr pure MSIL"],
    [0x1f0, "PowerPC little endian"],
  ];

  for (const [code, expected] of knownTypes) {
    it(`should describe 0x${code.toString(16)} as containing "${expected}"`, () => {
      expect(getMachineTypeDescription(code)).toContain(expected);
    });
  }

  it("should return Unknown with hex for unrecognized types", () => {
    const result = getMachineTypeDescription(0xdead);
    expect(result).toContain("Unknown");
    expect(result).toContain("DEAD");
  });
});

describe("getMachineTypeFullInfo", () => {
  it("should include description, hex and decimal for x64", () => {
    const result = getMachineTypeFullInfo(0x8664);
    expect(result).toContain("AMD64 (x64)");
    expect(result).toContain("0x8664");
    expect(result).toContain(String(0x8664));
  });

  it("should include description, hex and decimal for ARM64", () => {
    const result = getMachineTypeFullInfo(0xaa64);
    expect(result).toContain("ARM64");
    expect(result).toContain("0xAA64");
  });

  it("should format unknown types with hex", () => {
    const result = getMachineTypeFullInfo(0x1234);
    expect(result).toContain("Unknown");
    expect(result).toContain("0x1234");
  });
});
