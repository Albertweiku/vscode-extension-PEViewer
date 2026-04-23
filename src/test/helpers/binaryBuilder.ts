/**
 * 二进制测试数据构造工具
 *
 * 提供参数化 Builder 为每种文件格式生成最小合法 Buffer，
 * 方便 AI 在修改解析逻辑后快速调整测试数据。
 */

// ---------------------------------------------------------------------------
// PE
// ---------------------------------------------------------------------------

/**
 * 构造最小可识别的 PE 文件：
 *   DOS Header (64 bytes, MZ magic) + PE Signature (PE\0\0)
 */
export function buildMinimalPE(): Buffer {
  const buf = Buffer.alloc(128, 0);
  // DOS magic "MZ"
  buf[0] = 0x4d;
  buf[1] = 0x5a;
  // e_lfanew at offset 60 → PE sig starts at 64
  buf.writeUInt32LE(64, 60);
  // PE\0\0
  buf[64] = 0x50;
  buf[65] = 0x45;
  buf[66] = 0x00;
  buf[67] = 0x00;
  return buf;
}

// ---------------------------------------------------------------------------
// ELF
// ---------------------------------------------------------------------------

export interface ElfSectionDef {
  name: string;
  type: number; // SHT_*
  data: Buffer;
  link?: number;
  entsize?: number;
}

export interface BuildElfOptions {
  bits?: 32 | 64;
  endian?: "LE" | "BE";
  type?: number; // e_type (ET_DYN=3, ET_EXEC=2, ...)
  machine?: number; // e_machine (EM_X86_64=62, EM_AARCH64=183, ...)
  sections?: ElfSectionDef[];
}

const SHT_STRTAB = 3;

/**
 * 构造最小合法 ELF 文件。
 *
 * 布局：ELF Header → Section Data → Section Headers → Shstrtab
 * 自动追加 shstrtab 作为最后一个 section。
 */
export function buildMinimalELF(opts: BuildElfOptions = {}): Buffer {
  const bits = opts.bits ?? 64;
  const le = (opts.endian ?? "LE") === "LE";
  const is64 = bits === 64;
  const eType = opts.type ?? 3;
  const eMachine = opts.machine ?? (is64 ? 62 : 3);

  const ehSize = is64 ? 64 : 52;
  const shEntSize = is64 ? 64 : 40;

  const userSections = opts.sections ?? [];

  // 构建 shstrtab 内容: \0 + 各 section name + \0 + ".shstrtab\0"
  const nameOffsets: number[] = [];
  let shstrtab = "\0";
  for (const sec of userSections) {
    nameOffsets.push(shstrtab.length);
    shstrtab += sec.name + "\0";
  }
  const shstrtabNameOff = shstrtab.length;
  shstrtab += ".shstrtab\0";
  const shstrtabData = Buffer.from(shstrtab, "ascii");

  // 所有 section（用户 + shstrtab），加上 index 0（null section header）
  const allSections = [
    ...userSections.map((s, i) => ({
      nameOff: nameOffsets[i],
      type: s.type,
      data: s.data,
      link: s.link ?? 0,
      entsize: s.entsize ?? 0,
    })),
    {
      nameOff: shstrtabNameOff,
      type: SHT_STRTAB,
      data: shstrtabData,
      link: 0,
      entsize: 0,
    },
  ];

  // 计算总布局
  let dataOffset = ehSize;
  const sectionFileOffsets: number[] = [];
  for (const sec of allSections) {
    sectionFileOffsets.push(dataOffset);
    dataOffset += sec.data.length;
    if (dataOffset % 8 !== 0) {
      dataOffset += 8 - (dataOffset % 8);
    }
  }

  const shOff = dataOffset;
  // section header count = 1 (null) + allSections.length
  const shNum = 1 + allSections.length;
  const shstrndx = allSections.length; // last one

  const totalSize = shOff + shNum * shEntSize;
  const buf = Buffer.alloc(totalSize, 0);

  // --- ELF Header ---
  const w16 = (off: number, val: number) =>
    le ? buf.writeUInt16LE(val, off) : buf.writeUInt16BE(val, off);
  const w32 = (off: number, val: number) =>
    le ? buf.writeUInt32LE(val, off) : buf.writeUInt32BE(val, off);
  const w64 = (off: number, val: number) => {
    if (le) {
      buf.writeUInt32LE(val & 0xffffffff, off);
      buf.writeUInt32LE(Math.floor(val / 0x100000000), off + 4);
    } else {
      buf.writeUInt32BE(Math.floor(val / 0x100000000), off);
      buf.writeUInt32BE(val & 0xffffffff, off + 4);
    }
  };
  const wAddr = is64 ? w64 : w32;

  // Magic
  buf[0] = 0x7f;
  buf[1] = 0x45; // E
  buf[2] = 0x4c; // L
  buf[3] = 0x46; // F
  buf[4] = is64 ? 2 : 1; // EI_CLASS
  buf[5] = le ? 1 : 2; // EI_DATA
  buf[6] = 1; // EI_VERSION

  if (is64) {
    w16(16, eType);
    w16(18, eMachine);
    w32(20, 1); // e_version
    w64(24, 0); // e_entry
    w64(32, 0); // e_phoff
    w64(40, shOff); // e_shoff
    w32(48, 0); // e_flags
    w16(52, ehSize); // e_ehsize
    w16(54, 0); // e_phentsize
    w16(56, 0); // e_phnum
    w16(58, shEntSize); // e_shentsize
    w16(60, shNum); // e_shnum
    w16(62, shstrndx); // e_shstrndx
  } else {
    w16(16, eType);
    w16(18, eMachine);
    w32(20, 1); // e_version
    w32(24, 0); // e_entry
    w32(28, 0); // e_phoff
    w32(32, shOff); // e_shoff
    w32(36, 0); // e_flags
    w16(40, ehSize); // e_ehsize
    w16(42, 0); // e_phentsize
    w16(44, 0); // e_phnum
    w16(46, shEntSize); // e_shentsize
    w16(48, shNum); // e_shnum
    w16(50, shstrndx); // e_shstrndx
  }

  // --- Section Data ---
  for (let i = 0; i < allSections.length; i++) {
    allSections[i].data.copy(buf, sectionFileOffsets[i]);
  }

  // --- Section Headers ---
  // [0] = null header (all zeros)
  let off = shOff + shEntSize; // skip null header
  for (let i = 0; i < allSections.length; i++) {
    const sec = allSections[i];
    if (is64) {
      w32(off + 0, sec.nameOff); // sh_name
      w32(off + 4, sec.type); // sh_type
      w64(off + 8, 0); // sh_flags
      w64(off + 16, 0); // sh_addr
      w64(off + 24, sectionFileOffsets[i]); // sh_offset
      w64(off + 32, sec.data.length); // sh_size
      w32(off + 40, sec.link); // sh_link
      w32(off + 44, 0); // sh_info
      w64(off + 48, 1); // sh_addralign
      w64(off + 56, sec.entsize); // sh_entsize
    } else {
      w32(off + 0, sec.nameOff); // sh_name
      w32(off + 4, sec.type); // sh_type
      w32(off + 8, 0); // sh_flags
      w32(off + 12, 0); // sh_addr
      w32(off + 16, sectionFileOffsets[i]); // sh_offset
      w32(off + 20, sec.data.length); // sh_size
      w32(off + 24, sec.link); // sh_link
      w32(off + 28, 0); // sh_info
      w32(off + 32, 1); // sh_addralign
      w32(off + 36, sec.entsize); // sh_entsize
    }
    off += shEntSize;
  }

  return buf;
}

// ---------------------------------------------------------------------------
// LIB (COFF Archive)
// ---------------------------------------------------------------------------

export interface LibMemberDef {
  name: string;
  data: Buffer;
  timestamp?: number;
}

/**
 * 构造最小 COFF Archive (.lib) 文件。
 *
 * 布局：`!<arch>\n` + member headers + 2-byte alignment padding
 */
export function buildMinimalLib(members: LibMemberDef[]): Buffer {
  const magic = Buffer.from("!<arch>\n", "ascii");
  const parts: Buffer[] = [magic];

  for (const m of members) {
    const header = Buffer.alloc(60, 0x20); // space-filled
    const nameField = m.name.length <= 15 ? m.name + "/" : m.name;
    header.write(nameField, 0, Math.min(16, nameField.length), "ascii");
    const ts = (m.timestamp ?? 0).toString();
    header.write(ts, 16, ts.length, "ascii");
    const sizeStr = m.data.length.toString();
    header.write(sizeStr, 48, sizeStr.length, "ascii");
    // end marker `\n
    header[58] = 0x60; // `
    header[59] = 0x0a; // \n
    parts.push(header);
    parts.push(m.data);
    if (m.data.length % 2 !== 0) {
      parts.push(Buffer.from([0x0a])); // padding
    }
  }

  return Buffer.concat(parts);
}

/**
 * 构造第一链接器成员（/ member）的 data 段：
 * BE symbol_count + BE offsets[count] + NUL-terminated names
 */
export function buildFirstLinkerMemberData(
  symbols: Array<{ name: string; offset: number }>,
): Buffer {
  const count = symbols.length;
  const headerSize = 4 + count * 4;
  const namesParts = symbols.map((s) => Buffer.from(s.name + "\0", "ascii"));
  const namesSize = namesParts.reduce((sum, b) => sum + b.length, 0);

  const buf = Buffer.alloc(headerSize + namesSize);
  buf.writeUInt32BE(count, 0);
  for (let i = 0; i < count; i++) {
    buf.writeUInt32BE(symbols[i].offset, 4 + i * 4);
  }
  let off = headerSize;
  for (const nb of namesParts) {
    nb.copy(buf, off);
    off += nb.length;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// PE Version Resource
// ---------------------------------------------------------------------------

/**
 * 构造包含 VS_FIXEDFILEINFO 的版本资源 blob。
 *
 * @param version "major.minor.build.revision"
 */
export function buildVersionBlob(version: string): Buffer {
  const parts = version.split(".").map(Number);
  const [major = 0, minor = 0, build = 0, rev = 0] = parts;

  // VS_VERSIONINFO 结构：wLength(2) + wValueLength(2) + wType(2) + szKey(UTF16LE) + padding + VS_FIXEDFILEINFO
  const key = "VS_VERSION_INFO";
  const keyBuf = Buffer.from(key + "\0", "utf16le");

  // VS_FIXEDFILEINFO is 52 bytes
  const ffiSize = 52;
  let headerLen = 6 + keyBuf.length;
  // padding to 4-byte boundary
  while (headerLen % 4 !== 0) headerLen++;
  const totalLen = headerLen + ffiSize;

  const blob = Buffer.alloc(totalLen + 32, 0); // extra space
  blob.writeUInt16LE(totalLen, 0); // wLength
  blob.writeUInt16LE(ffiSize, 2); // wValueLength
  blob.writeUInt16LE(0, 4); // wType (binary)
  keyBuf.copy(blob, 6);

  // VS_FIXEDFILEINFO
  const ffiOff = headerLen;
  blob.writeUInt32LE(0xfeef04bd, ffiOff); // dwSignature
  blob.writeUInt32LE(0x00010000, ffiOff + 4); // dwStrucVersion

  // dwFileVersionMS / dwFileVersionLS
  const ms = ((major & 0xffff) << 16) | (minor & 0xffff);
  const ls = ((build & 0xffff) << 16) | (rev & 0xffff);
  blob.writeUInt32LE(ms, ffiOff + 8);
  blob.writeUInt32LE(ls, ffiOff + 12);

  // dwProductVersionMS / LS (same)
  blob.writeUInt32LE(ms, ffiOff + 16);
  blob.writeUInt32LE(ls, ffiOff + 20);

  return blob.subarray(0, totalLen);
}

/**
 * 在 blob 中追加 StringFileInfo 键值对。
 *
 * @param key ASCII key (e.g. "FileVersion")
 * @param value 值字符串
 */
export function buildStringFileInfoEntry(key: string, value: string): Buffer {
  const keyBuf = Buffer.from(key + "\0", "utf16le");
  const valueBuf = Buffer.from(value + "\0", "utf16le");
  const valueChars = value.length + 1; // wValueLength is in chars

  let headerLen = 6 + keyBuf.length;
  while (headerLen % 4 !== 0) headerLen++;
  const totalLen = headerLen + valueBuf.length;

  const buf = Buffer.alloc(totalLen, 0);
  buf.writeUInt16LE(totalLen, 0); // wLength
  buf.writeUInt16LE(valueChars, 2); // wValueLength (in WCHAR)
  buf.writeUInt16LE(1, 4); // wType (text)
  keyBuf.copy(buf, 6);
  valueBuf.copy(buf, headerLen);
  return buf;
}

// ---------------------------------------------------------------------------
// ELF Dynamic Section 和 Symbol Table 构建工具
// ---------------------------------------------------------------------------

const DT_NULL = 0;
const DT_NEEDED = 1;

/**
 * 构建 .dynstr 节区内容。
 * 返回 { data: Buffer, offsets: Map<string, number> }
 */
export function buildDynstr(strings: string[]): {
  data: Buffer;
  offsets: Map<string, number>;
} {
  const offsets = new Map<string, number>();
  let content = "\0"; // 第一个字节是 NUL
  for (const s of strings) {
    offsets.set(s, content.length);
    content += s + "\0";
  }
  return { data: Buffer.from(content, "ascii"), offsets };
}

/**
 * 构建 .dynamic 节区内容（DT_NEEDED entries + DT_NULL terminator）。
 *
 * @param is64 是否 64 位
 * @param le 是否小端
 * @param entries 每条 { tag, val }
 */
export function buildDynamicSection(
  is64: boolean,
  le: boolean,
  entries: Array<{ tag: number; val: number }>,
): Buffer {
  const entSize = is64 ? 16 : 8;
  // +1 for DT_NULL terminator
  const buf = Buffer.alloc((entries.length + 1) * entSize, 0);

  const w32 = (off: number, val: number) =>
    le ? buf.writeUInt32LE(val, off) : buf.writeUInt32BE(val, off);
  const w64 = (off: number, val: number) => {
    if (le) {
      buf.writeUInt32LE(val & 0xffffffff, off);
      buf.writeUInt32LE(Math.floor(val / 0x100000000), off + 4);
    } else {
      buf.writeUInt32BE(Math.floor(val / 0x100000000), off);
      buf.writeUInt32BE(val & 0xffffffff, off + 4);
    }
  };
  const wN = is64 ? w64 : w32;

  for (let i = 0; i < entries.length; i++) {
    const off = i * entSize;
    wN(off, entries[i].tag);
    wN(off + (is64 ? 8 : 4), entries[i].val);
  }
  // DT_NULL terminator (already zero-filled)

  return buf;
}

/**
 * 构建 ELF 符号表条目（.dynsym 或 .symtab）。
 */
export function buildSymbolEntry(
  is64: boolean,
  le: boolean,
  nameIdx: number,
  value: number,
  size: number,
  info: number, // (bind << 4) | type
  shndx: number,
): Buffer {
  const entSize = is64 ? 24 : 16;
  const buf = Buffer.alloc(entSize, 0);
  const w16 = (off: number, val: number) =>
    le ? buf.writeUInt16LE(val, off) : buf.writeUInt16BE(val, off);
  const w32 = (off: number, val: number) =>
    le ? buf.writeUInt32LE(val, off) : buf.writeUInt32BE(val, off);
  const w64 = (off: number, val: number) => {
    if (le) {
      buf.writeUInt32LE(val & 0xffffffff, off);
      buf.writeUInt32LE(Math.floor(val / 0x100000000), off + 4);
    } else {
      buf.writeUInt32BE(Math.floor(val / 0x100000000), off);
      buf.writeUInt32BE(val & 0xffffffff, off + 4);
    }
  };

  if (is64) {
    w32(0, nameIdx); // st_name
    buf[4] = info; // st_info
    buf[5] = 0; // st_other
    w16(6, shndx); // st_shndx
    w64(8, value); // st_value
    w64(16, size); // st_size
  } else {
    w32(0, nameIdx); // st_name
    w32(4, value); // st_value
    w32(8, size); // st_size
    buf[12] = info; // st_info
    buf[13] = 0; // st_other
    w16(14, shndx); // st_shndx
  }
  return buf;
}
