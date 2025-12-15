/**
 * 增强的 ELF 符号解析器
 * 直接从二进制数据中解析符号表，不依赖外部工具
 */

// ELF 常量
const EI_CLASS = 4; // 文件类别 (32/64位)
const ELFCLASS32 = 1;
const ELFCLASS64 = 2;

const EI_DATA = 5; // 数据编码
const ELFDATA2LSB = 1; // 小端
const ELFDATA2MSB = 2; // 大端

// 节区类型
const SHT_SYMTAB = 2; // 符号表
const SHT_DYNSYM = 11; // 动态符号表
const SHT_STRTAB = 3; // 字符串表

// 符号绑定
const STB_LOCAL = 0;
const STB_GLOBAL = 1;
const STB_WEAK = 2;

// 符号类型
const STT_NOTYPE = 0;
const STT_OBJECT = 1;
const STT_FUNC = 2;
const STT_SECTION = 3;
const STT_FILE = 4;

interface ELFSymbol {
  name: string;
  value: number;
  size: number;
  info: number;
  other: number;
  shndx: number;
  type: number;
  bind: number;
}

export interface ParsedSymbol {
  name: string;
  address: number;
  size: number;
  type: string;
  binding: string;
}

/**
 * 直接从 Buffer 解析 ELF 符号表
 */
export function parseELFSymbolsDirect(fileData: Buffer): ParsedSymbol[] {
  try {
    // 检查 ELF 魔数
    if (
      fileData.length < 64 ||
      fileData[0] !== 0x7f ||
      fileData[1] !== 0x45 || // 'E'
      fileData[2] !== 0x4c || // 'L'
      fileData[3] !== 0x46
    ) {
      // 'F'
      return [];
    }

    const elfClass = fileData[EI_CLASS];
    const elfData = fileData[EI_DATA];
    const is64Bit = elfClass === ELFCLASS64;
    const isLittleEndian = elfData === ELFDATA2LSB;

    console.log(
      `ELF: ${is64Bit ? "64-bit" : "32-bit"}, ${
        isLittleEndian ? "little" : "big"
      } endian`,
    );

    // 读取节区头表偏移和数量
    let e_shoff: number;
    let e_shnum: number;
    let e_shentsize: number;
    let e_shstrndx: number;

    if (is64Bit) {
      e_shoff = readNumber(fileData, 40, 8, isLittleEndian);
      e_shentsize = readNumber(fileData, 58, 2, isLittleEndian);
      e_shnum = readNumber(fileData, 60, 2, isLittleEndian);
      e_shstrndx = readNumber(fileData, 62, 2, isLittleEndian);
    } else {
      e_shoff = readNumber(fileData, 32, 4, isLittleEndian);
      e_shentsize = readNumber(fileData, 46, 2, isLittleEndian);
      e_shnum = readNumber(fileData, 48, 2, isLittleEndian);
      e_shstrndx = readNumber(fileData, 50, 2, isLittleEndian);
    }

    console.log(
      `Section headers: offset=${e_shoff}, count=${e_shnum}, size=${
        e_shentsize
      }`,
    );

    if (e_shoff === 0 || e_shnum === 0) {
      console.log("No section headers found");
      return [];
    }

    // 读取所有节区头
    const sections: any[] = [];
    for (let i = 0; i < e_shnum; i++) {
      const shOffset = e_shoff + i * e_shentsize;
      const section = parseSectionHeader(
        fileData,
        shOffset,
        is64Bit,
        isLittleEndian,
      );
      sections.push(section);
    }

    // 读取节区名称字符串表
    const shstrtab = sections[e_shstrndx];
    if (!shstrtab) {
      console.log("Section name string table not found");
      return [];
    }

    // 查找符号表和字符串表
    let symtabSection: any = null;
    let dynsymSection: any = null;
    let strtabSection: any = null;
    let dynstrSection: any = null;

    for (let i = 0; i < sections.length; i++) {
      const name = readString(
        fileData,
        shstrtab.sh_offset + sections[i].sh_name,
      );
      sections[i].name = name;

      if (sections[i].sh_type === SHT_SYMTAB) {
        symtabSection = sections[i];
        console.log(".symtab found at index", i);
      } else if (sections[i].sh_type === SHT_DYNSYM) {
        dynsymSection = sections[i];
        console.log(".dynsym found at index", i);
      } else if (sections[i].sh_type === SHT_STRTAB) {
        if (name === ".strtab") {
          strtabSection = sections[i];
        } else if (name === ".dynstr") {
          dynstrSection = sections[i];
        }
      }
    }

    const allSymbols: ParsedSymbol[] = [];

    // 优先解析动态符号表
    if (dynsymSection && dynstrSection) {
      console.log("Parsing .dynsym section...");
      const symbols = parseSymbolTable(
        fileData,
        dynsymSection,
        dynstrSection,
        is64Bit,
        isLittleEndian,
      );
      allSymbols.push(...symbols.filter((s) => s.binding !== "STB_LOCAL"));
      console.log(
        "Found",
        symbols.length,
        "dynamic symbols,",
        allSymbols.length,
        "exported",
      );
    }

    // 如果没有找到动态符号，使用静态符号表
    if (allSymbols.length === 0 && symtabSection && strtabSection) {
      console.log("Parsing .symtab section...");
      const symbols = parseSymbolTable(
        fileData,
        symtabSection,
        strtabSection,
        is64Bit,
        isLittleEndian,
      );
      allSymbols.push(
        ...symbols.filter(
          (s) => s.binding === "STB_GLOBAL" || s.binding === "STB_WEAK",
        ),
      );
      console.log(
        "Found",
        symbols.length,
        "static symbols,",
        allSymbols.length,
        "exported",
      );
    }

    return allSymbols;
  } catch (error) {
    console.error("Direct ELF parsing failed:", error);
    return [];
  }
}

function parseSectionHeader(
  buffer: Buffer,
  offset: number,
  is64Bit: boolean,
  isLittleEndian: boolean,
) {
  if (is64Bit) {
    return {
      sh_name: readNumber(buffer, offset, 4, isLittleEndian),
      sh_type: readNumber(buffer, offset + 4, 4, isLittleEndian),
      sh_flags: readNumber(buffer, offset + 8, 8, isLittleEndian),
      sh_addr: readNumber(buffer, offset + 16, 8, isLittleEndian),
      sh_offset: readNumber(buffer, offset + 24, 8, isLittleEndian),
      sh_size: readNumber(buffer, offset + 32, 8, isLittleEndian),
      sh_link: readNumber(buffer, offset + 40, 4, isLittleEndian),
      sh_info: readNumber(buffer, offset + 44, 4, isLittleEndian),
      sh_addralign: readNumber(buffer, offset + 48, 8, isLittleEndian),
      sh_entsize: readNumber(buffer, offset + 56, 8, isLittleEndian),
    };
  } else {
    return {
      sh_name: readNumber(buffer, offset, 4, isLittleEndian),
      sh_type: readNumber(buffer, offset + 4, 4, isLittleEndian),
      sh_flags: readNumber(buffer, offset + 8, 4, isLittleEndian),
      sh_addr: readNumber(buffer, offset + 12, 4, isLittleEndian),
      sh_offset: readNumber(buffer, offset + 16, 4, isLittleEndian),
      sh_size: readNumber(buffer, offset + 20, 4, isLittleEndian),
      sh_link: readNumber(buffer, offset + 24, 4, isLittleEndian),
      sh_info: readNumber(buffer, offset + 28, 4, isLittleEndian),
      sh_addralign: readNumber(buffer, offset + 32, 4, isLittleEndian),
      sh_entsize: readNumber(buffer, offset + 36, 4, isLittleEndian),
    };
  }
}

function parseSymbolTable(
  buffer: Buffer,
  symSection: any,
  strSection: any,
  is64Bit: boolean,
  isLittleEndian: boolean,
): ParsedSymbol[] {
  const symbols: ParsedSymbol[] = [];
  const symEntSize = is64Bit ? 24 : 16;
  const numSymbols = Math.floor(symSection.sh_size / symEntSize);

  console.log(
    `Parsing ${numSymbols} symbols from table at offset ${
      symSection.sh_offset
    }`,
  );

  for (let i = 0; i < numSymbols && i < 100000; i++) {
    const symOffset = symSection.sh_offset + i * symEntSize;

    let st_name: number,
      st_value: number,
      st_size: number,
      st_info: number,
      st_other: number,
      st_shndx: number;

    if (is64Bit) {
      st_name = readNumber(buffer, symOffset, 4, isLittleEndian);
      st_info = buffer[symOffset + 4];
      st_other = buffer[symOffset + 5];
      st_shndx = readNumber(buffer, symOffset + 6, 2, isLittleEndian);
      st_value = readNumber(buffer, symOffset + 8, 8, isLittleEndian);
      st_size = readNumber(buffer, symOffset + 16, 8, isLittleEndian);
    } else {
      st_name = readNumber(buffer, symOffset, 4, isLittleEndian);
      st_value = readNumber(buffer, symOffset + 4, 4, isLittleEndian);
      st_size = readNumber(buffer, symOffset + 8, 4, isLittleEndian);
      st_info = buffer[symOffset + 12];
      st_other = buffer[symOffset + 13];
      st_shndx = readNumber(buffer, symOffset + 14, 2, isLittleEndian);
    }

    const bind = st_info >> 4;
    const type = st_info & 0xf;

    // 读取符号名称
    if (st_name !== 0) {
      const name = readString(buffer, strSection.sh_offset + st_name);

      // 只保留有效的符号
      if (name && st_shndx !== 0) {
        // 非 UND
        symbols.push({
          name: name,
          address: st_value,
          size: st_size,
          type: getSymbolType(type),
          binding: getSymbolBinding(bind),
        });
      }
    }
  }

  return symbols;
}

function readNumber(
  buffer: Buffer,
  offset: number,
  size: number,
  isLittleEndian: boolean,
): number {
  if (offset + size > buffer.length) {
    return 0;
  }

  if (size === 1) {
    return buffer[offset];
  } else if (size === 2) {
    return isLittleEndian
      ? buffer.readUInt16LE(offset)
      : buffer.readUInt16BE(offset);
  } else if (size === 4) {
    return isLittleEndian
      ? buffer.readUInt32LE(offset)
      : buffer.readUInt32BE(offset);
  } else if (size === 8) {
    // 对于 64 位数字，我们只取低32位以避免精度问题
    const low = isLittleEndian
      ? buffer.readUInt32LE(offset)
      : buffer.readUInt32BE(offset + 4);
    const high = isLittleEndian
      ? buffer.readUInt32LE(offset + 4)
      : buffer.readUInt32BE(offset);
    // 如果高位不为0，可能会有精度问题，但对于地址和大小通常够用
    return high * 0x100000000 + low;
  }
  return 0;
}

function readString(buffer: Buffer, offset: number): string {
  if (offset >= buffer.length) {
    return "";
  }

  let end = offset;
  while (end < buffer.length && buffer[end] !== 0) {
    end++;
  }

  return buffer.toString("utf8", offset, end);
}

function getSymbolType(type: number): string {
  switch (type) {
    case STT_NOTYPE:
      return "NOTYPE";
    case STT_OBJECT:
      return "OBJECT";
    case STT_FUNC:
      return "FUNC";
    case STT_SECTION:
      return "SECTION";
    case STT_FILE:
      return "FILE";
    default:
      return `UNKNOWN(${type})`;
  }
}

function getSymbolBinding(bind: number): string {
  switch (bind) {
    case STB_LOCAL:
      return "STB_LOCAL";
    case STB_GLOBAL:
      return "STB_GLOBAL";
    case STB_WEAK:
      return "STB_WEAK";
    default:
      return `UNKNOWN(${bind})`;
  }
}
