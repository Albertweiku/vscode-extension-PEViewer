import { describe, expect, it } from "vitest";

import {
  parseFixedFileVersionQuad,
  parseStringFileInfoValue,
} from "../../../../parsers/pe/peVersionResource";
import {
  buildStringFileInfoEntry,
  buildVersionBlob,
} from "../../../helpers/binaryBuilder";

// ---------------------------------------------------------------------------
// parseFixedFileVersionQuad
// ---------------------------------------------------------------------------
describe("parseFixedFileVersionQuad", () => {
  it("should parse version 1.0.0.0", () => {
    const blob = buildVersionBlob("1.0.0.0");
    expect(parseFixedFileVersionQuad(blob)).toBe("1.0.0.0");
  });

  it("should parse version 10.0.22621.1", () => {
    const blob = buildVersionBlob("10.0.22621.1");
    expect(parseFixedFileVersionQuad(blob)).toBe("10.0.22621.1");
  });

  it("should parse version 3.14.159.2653", () => {
    const blob = buildVersionBlob("3.14.159.2653");
    expect(parseFixedFileVersionQuad(blob)).toBe("3.14.159.2653");
  });

  it("should return undefined for null buffer", () => {
    expect(parseFixedFileVersionQuad(null as any)).toBeUndefined();
  });

  it("should return undefined for buffer shorter than 64 bytes", () => {
    expect(parseFixedFileVersionQuad(Buffer.alloc(32))).toBeUndefined();
  });

  it("should fall back to signature scan when root parse fails", () => {
    // Place VS_FIXEDFILEINFO signature at an arbitrary offset
    const buf = Buffer.alloc(128, 0);
    buf.writeUInt16LE(128, 0); // wLength
    buf.writeUInt16LE(10, 2); // wValueLength (too small → triggers scan)
    // Embed signature at offset 60
    buf.writeUInt32LE(0xfeef04bd, 60);
    buf.writeUInt32LE(0x00010000, 64); // dwStrucVersion
    const ms = (5 << 16) | 3;
    const ls = (2 << 16) | 1;
    buf.writeUInt32LE(ms, 68);
    buf.writeUInt32LE(ls, 72);
    expect(parseFixedFileVersionQuad(buf)).toBe("5.3.2.1");
  });

  it("should skip 0.0.0.0 signatures and try next", () => {
    const buf = Buffer.alloc(128, 0);
    buf.writeUInt16LE(128, 0);
    buf.writeUInt16LE(10, 2);
    // First signature at offset 20 → version 0.0.0.0
    buf.writeUInt32LE(0xfeef04bd, 20);
    buf.writeUInt32LE(0, 28);
    buf.writeUInt32LE(0, 32);
    // Second signature at offset 60 → real version
    buf.writeUInt32LE(0xfeef04bd, 60);
    buf.writeUInt32LE((2 << 16) | 1, 68);
    buf.writeUInt32LE((3 << 16) | 4, 72);
    expect(parseFixedFileVersionQuad(buf)).toBe("2.1.3.4");
  });
});

// ---------------------------------------------------------------------------
// parseStringFileInfoValue
// ---------------------------------------------------------------------------
describe("parseStringFileInfoValue", () => {
  it("should parse a StringFileInfo entry with key 'FileVersion'", () => {
    const entry = buildStringFileInfoEntry("FileVersion", "1.2.3.4");
    expect(parseStringFileInfoValue(entry, "FileVersion")).toBe("1.2.3.4");
  });

  it("should parse a StringFileInfo entry with key 'ProductVersion'", () => {
    const entry = buildStringFileInfoEntry("ProductVersion", "10.0-beta");
    expect(parseStringFileInfoValue(entry, "ProductVersion")).toBe("10.0-beta");
  });

  it("should return undefined for empty blob", () => {
    expect(parseStringFileInfoValue(Buffer.alloc(0), "FileVersion")).toBeUndefined();
  });

  it("should return undefined for null blob", () => {
    expect(parseStringFileInfoValue(null as any, "FileVersion")).toBeUndefined();
  });

  it("should return undefined for empty key", () => {
    const entry = buildStringFileInfoEntry("FileVersion", "1.0");
    expect(parseStringFileInfoValue(entry, "")).toBeUndefined();
  });

  it("should return undefined when key is not found in blob", () => {
    const entry = buildStringFileInfoEntry("FileVersion", "1.0");
    expect(parseStringFileInfoValue(entry, "CompanyName")).toBeUndefined();
  });

  it("should handle multiple entries in a single blob", () => {
    const e1 = buildStringFileInfoEntry("CompanyName", "TestCorp");
    // Align second entry to 4-byte boundary
    const pad = (4 - (e1.length % 4)) % 4;
    const e2 = buildStringFileInfoEntry("FileVersion", "2.5.0.0");
    const combined = Buffer.concat([e1, Buffer.alloc(pad, 0), e2]);
    const fv = parseStringFileInfoValue(combined, "FileVersion");
    expect(fv?.trim()).toBe("2.5.0.0");
    const cn = parseStringFileInfoValue(combined, "CompanyName");
    expect(cn?.trim()).toBe("TestCorp");
  });
});
