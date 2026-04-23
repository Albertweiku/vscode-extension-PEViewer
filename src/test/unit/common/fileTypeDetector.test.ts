import { describe, expect, it } from "vitest";

import {
  detectFileType,
  getFileTypeName,
  isELFFile,
  isLibFile,
  isPEFile,
} from "../../../common/fileTypeDetector";
import {
  buildMinimalELF,
  buildMinimalLib,
  buildMinimalPE,
} from "../../helpers/binaryBuilder";

// ---------------------------------------------------------------------------
// isELFFile
// ---------------------------------------------------------------------------
describe("isELFFile", () => {
  it("should return true for valid ELF magic bytes", () => {
    const buf = buildMinimalELF();
    expect(isELFFile(buf)).toBe(true);
  });

  it("should return true for 32-bit ELF", () => {
    const buf = buildMinimalELF({ bits: 32 });
    expect(isELFFile(buf)).toBe(true);
  });

  it("should return false for empty buffer", () => {
    expect(isELFFile(Buffer.alloc(0))).toBe(false);
  });

  it("should return false for buffer shorter than 4 bytes", () => {
    expect(isELFFile(Buffer.from([0x7f, 0x45, 0x4c]))).toBe(false);
  });

  it("should return false for PE file", () => {
    expect(isELFFile(buildMinimalPE())).toBe(false);
  });

  it("should return false for random data", () => {
    expect(isELFFile(Buffer.from([0xde, 0xad, 0xbe, 0xef]))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isPEFile
// ---------------------------------------------------------------------------
describe("isPEFile", () => {
  it("should return true for valid PE file", () => {
    expect(isPEFile(buildMinimalPE())).toBe(true);
  });

  it("should return false for empty buffer", () => {
    expect(isPEFile(Buffer.alloc(0))).toBe(false);
  });

  it("should return false for buffer shorter than 64 bytes", () => {
    const buf = Buffer.alloc(63, 0);
    buf[0] = 0x4d;
    buf[1] = 0x5a;
    expect(isPEFile(buf)).toBe(false);
  });

  it("should return false when MZ magic is missing", () => {
    const buf = Buffer.alloc(128, 0);
    buf[0] = 0x00;
    buf[1] = 0x00;
    expect(isPEFile(buf)).toBe(false);
  });

  it("should return false when PE signature is missing", () => {
    const buf = Buffer.alloc(128, 0);
    buf[0] = 0x4d;
    buf[1] = 0x5a;
    buf.writeUInt32LE(64, 60);
    // no PE\0\0 at offset 64
    expect(isPEFile(buf)).toBe(false);
  });

  it("should return false when e_lfanew points beyond buffer", () => {
    const buf = Buffer.alloc(128, 0);
    buf[0] = 0x4d;
    buf[1] = 0x5a;
    buf.writeUInt32LE(200, 60); // beyond buffer
    expect(isPEFile(buf)).toBe(false);
  });

  it("should return false for ELF file", () => {
    expect(isPEFile(buildMinimalELF())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isLibFile
// ---------------------------------------------------------------------------
describe("isLibFile", () => {
  it("should return true for valid LIB magic", () => {
    const buf = buildMinimalLib([
      { name: "test", data: Buffer.from("hello") },
    ]);
    expect(isLibFile(buf)).toBe(true);
  });

  it("should return true for bare magic only", () => {
    expect(isLibFile(Buffer.from("!<arch>\n", "ascii"))).toBe(true);
  });

  it("should return false for empty buffer", () => {
    expect(isLibFile(Buffer.alloc(0))).toBe(false);
  });

  it("should return false for buffer shorter than 8 bytes", () => {
    expect(isLibFile(Buffer.from("!<arch>", "ascii"))).toBe(false);
  });

  it("should return false for wrong magic", () => {
    expect(isLibFile(Buffer.from("!<ARCH>\n", "ascii"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectFileType
// ---------------------------------------------------------------------------
describe("detectFileType", () => {
  it("should detect ELF files", () => {
    expect(detectFileType(buildMinimalELF())).toBe("ELF");
  });

  it("should detect PE files", () => {
    expect(detectFileType(buildMinimalPE())).toBe("PE");
  });

  it("should detect LIB files", () => {
    const buf = buildMinimalLib([
      { name: "/", data: Buffer.alloc(4) },
    ]);
    expect(detectFileType(buf)).toBe("LIB");
  });

  it("should return UNKNOWN for empty buffer", () => {
    expect(detectFileType(Buffer.alloc(0))).toBe("UNKNOWN");
  });

  it("should return UNKNOWN for random data", () => {
    expect(detectFileType(Buffer.from("hello world"))).toBe("UNKNOWN");
  });

  it("should prioritize ELF over PE when both match (edge case)", () => {
    // ELF detection runs first
    const buf = buildMinimalELF();
    expect(detectFileType(buf)).toBe("ELF");
  });
});

// ---------------------------------------------------------------------------
// getFileTypeName
// ---------------------------------------------------------------------------
describe("getFileTypeName", () => {
  it("should return correct name for PE", () => {
    expect(getFileTypeName("PE")).toBe("PE (Portable Executable)");
  });

  it("should return correct name for ELF", () => {
    expect(getFileTypeName("ELF")).toBe("ELF (Executable and Linkable Format)");
  });

  it("should return correct name for LIB", () => {
    expect(getFileTypeName("LIB")).toBe("LIB (COFF Archive)");
  });

  it("should return correct name for UNKNOWN", () => {
    expect(getFileTypeName("UNKNOWN")).toBe("Unknown Format");
  });
});
