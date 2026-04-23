import { describe, expect, it } from "vitest";

import {
  isLibFile,
  parseLibArchive,
} from "../../../../parsers/lib/libParser";
import {
  buildFirstLinkerMemberData,
  buildMinimalLib,
} from "../../../helpers/binaryBuilder";

// ---------------------------------------------------------------------------
// isLibFile
// ---------------------------------------------------------------------------
describe("isLibFile", () => {
  it("should return true for valid COFF Archive magic", () => {
    const buf = Buffer.from("!<arch>\n", "ascii");
    expect(isLibFile(buf)).toBe(true);
  });

  it("should return false for empty buffer", () => {
    expect(isLibFile(Buffer.alloc(0))).toBe(false);
  });

  it("should return false for buffer shorter than 8 bytes", () => {
    expect(isLibFile(Buffer.from("!<arch>"))).toBe(false);
  });

  it("should return false for wrong magic string", () => {
    expect(isLibFile(Buffer.from("NOTMAGIC"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseLibArchive
// ---------------------------------------------------------------------------
describe("parseLibArchive", () => {
  it("should throw for non-archive buffer", async () => {
    await expect(parseLibArchive(Buffer.from("invalid"))).rejects.toThrow(
      "Not a valid COFF Archive file",
    );
  });

  it("should parse an archive with a single data member", async () => {
    const memberData = Buffer.from("test content", "ascii");
    const lib = buildMinimalLib([
      { name: "test.obj", data: memberData, timestamp: 1000 },
    ]);
    const result = await parseLibArchive(lib);

    expect(result.members).toHaveLength(1);
    expect(result.members[0].name).toBe("test.obj");
    expect(result.members[0].timestamp).toBe(1000);
    expect(result.members[0].size).toBe(memberData.length);
    expect(result.members[0].data).toBeDefined();
    expect(Buffer.from(result.members[0].data!).toString("ascii")).toBe(
      "test content",
    );
  });

  it("should parse multiple members", async () => {
    const lib = buildMinimalLib([
      { name: "a.obj", data: Buffer.from("aaa") },
      { name: "b.obj", data: Buffer.from("bbbb") },
      { name: "c.obj", data: Buffer.from("ccccc") },
    ]);
    const result = await parseLibArchive(lib);
    expect(result.members).toHaveLength(3);
    expect(result.members[0].name).toBe("a.obj");
    expect(result.members[1].name).toBe("b.obj");
    expect(result.members[2].name).toBe("c.obj");
  });

  it("should strip trailing slash from member names", async () => {
    // buildMinimalLib appends "/" to short names (COFF convention)
    // The parser should strip that trailing "/"
    const lib = buildMinimalLib([
      { name: "foo.obj", data: Buffer.from("x") },
    ]);
    const result = await parseLibArchive(lib);
    expect(result.members[0].name).toBe("foo.obj");
    expect(result.members[0].name.endsWith("/")).toBe(false);
  });

  it("should parse first linker member (/ member) as symbols", async () => {
    // Build linker member data with big-endian symbol offsets
    const linkerData = buildFirstLinkerMemberData([
      { name: "symbol_a", offset: 100 },
      { name: "symbol_b", offset: 200 },
    ]);
    const objData = Buffer.from("object data");

    const lib = buildMinimalLib([
      { name: "/", data: linkerData },
      { name: "test.obj", data: objData },
    ]);

    const result = await parseLibArchive(lib);
    expect(result.members.length).toBeGreaterThanOrEqual(2);
    // First member should be the linker member
    expect(result.members[0].name).toBe("/");
  });

  it("should handle empty archive (magic only)", async () => {
    const lib = Buffer.from("!<arch>\n", "ascii");
    const result = await parseLibArchive(lib);
    expect(result.members).toHaveLength(0);
  });

  it("should handle 2-byte alignment between members", async () => {
    // Odd-sized data requires a padding byte
    const lib = buildMinimalLib([
      { name: "odd.obj", data: Buffer.from("abc") }, // 3 bytes → needs pad
      { name: "even.obj", data: Buffer.from("abcd") }, // 4 bytes → no pad
    ]);
    const result = await parseLibArchive(lib);
    expect(result.members).toHaveLength(2);
    expect(result.members[0].name).toBe("odd.obj");
    expect(result.members[1].name).toBe("even.obj");
  });
});
