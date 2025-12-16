/**
 * COFF Archive (.lib) 文件解析器
 */

export interface LibArchiveMember {
  name: string;
  timestamp: number;
  size: number;
  offset: number;
  data?: Buffer;
  uid?: number;
  gid?: number;
  mode?: number;
}

export interface LibArchiveData {
  members: LibArchiveMember[];
  symbols?: Map<string, string>; // 符号名 -> 成员名
}

const ARCHIVE_MAGIC = "!<arch>\n";
const MEMBER_HEADER_SIZE = 60;

/**
 * 检查是否为 COFF Archive 文件
 */
export function isLibFile(buffer: Buffer): boolean {
  if (buffer.length < 8) {
    return false;
  }
  const magic = buffer.toString("ascii", 0, 8);
  return magic === ARCHIVE_MAGIC;
}

/**
 * 解析 Archive 成员头部
 */
function parseMemberHeader(
  buffer: Buffer,
  offset: number,
): LibArchiveMember | null {
  if (offset + MEMBER_HEADER_SIZE > buffer.length) {
    return null;
  }

  // 读取头部字段（全部为 ASCII 文本，空格填充）
  const name = buffer.toString("ascii", offset, offset + 16).trim();
  const timestamp = parseInt(
    buffer.toString("ascii", offset + 16, offset + 28).trim(),
    10,
  );
  const uid = parseInt(
    buffer.toString("ascii", offset + 28, offset + 34).trim(),
    10,
  );
  const gid = parseInt(
    buffer.toString("ascii", offset + 34, offset + 40).trim(),
    10,
  );
  const mode = parseInt(
    buffer.toString("ascii", offset + 40, offset + 48).trim(),
    8,
  ); // 八进制
  const size = parseInt(
    buffer.toString("ascii", offset + 48, offset + 58).trim(),
    10,
  );
  const endChar = buffer.toString("ascii", offset + 58, offset + 60);

  // 验证结束标记
  if (endChar !== "`\n") {
    console.warn(`Invalid member header end marker at offset ${offset}`);
    return null;
  }

  return {
    name,
    timestamp: isNaN(timestamp) ? 0 : timestamp,
    uid: isNaN(uid) ? 0 : uid,
    gid: isNaN(gid) ? 0 : gid,
    mode: isNaN(mode) ? 0 : mode,
    size: isNaN(size) ? 0 : size,
    offset: offset + MEMBER_HEADER_SIZE,
  };
}

/**
 * 解析长文件名（扩展文件名表）
 */
function parseLongNames(data: Buffer): Map<number, string> {
  const longNames = new Map<number, string>();
  let currentOffset = 0;
  const text = data.toString("ascii");

  // 长文件名以换行符分隔
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.endsWith("/")) {
      longNames.set(currentOffset, line.slice(0, -1));
    }
    currentOffset += line.length + 1; // +1 for newline
  }

  return longNames;
}

/**
 * 解析第一链接器成员（符号索引）
 */
function parseFirstLinkerMember(data: Buffer): Map<string, number> {
  const symbols = new Map<string, number>();

  if (data.length < 4) {
    return symbols;
  }

  // 大端序读取符号数量
  const symbolCount = data.readUInt32BE(0);
  let offset = 4;

  // 读取偏移量数组（大端序）
  const offsets: number[] = [];
  for (let i = 0; i < symbolCount && offset + 4 <= data.length; i++) {
    offsets.push(data.readUInt32BE(offset));
    offset += 4;
  }

  // 读取符号名称（null 结尾字符串）
  for (let i = 0; i < symbolCount && offset < data.length; i++) {
    const nullIndex = data.indexOf(0, offset);
    if (nullIndex === -1) {
      break;
    }
    const symbolName = data.toString("ascii", offset, nullIndex);
    symbols.set(symbolName, offsets[i]);
    offset = nullIndex + 1;
  }

  return symbols;
}

/**
 * 解析第二链接器成员（扩展符号索引）
 */
function parseSecondLinkerMember(data: Buffer): Map<string, number> {
  const symbols = new Map<string, number>();

  if (data.length < 4) {
    return symbols;
  }

  // 小端序读取成员数量
  const memberCount = data.readUInt32LE(0);
  let offset = 4;

  // 跳过成员偏移量数组
  offset += memberCount * 4;

  if (offset + 4 > data.length) {
    return symbols;
  }

  // 读取符号数量
  const symbolCount = data.readUInt32LE(offset);
  offset += 4;

  // 读取符号索引数组（指向成员）
  const indices: number[] = [];
  for (let i = 0; i < symbolCount && offset + 2 <= data.length; i++) {
    indices.push(data.readUInt16LE(offset));
    offset += 2;
  }

  // 读取符号名称（null 结尾字符串）
  for (let i = 0; i < symbolCount && offset < data.length; i++) {
    const nullIndex = data.indexOf(0, offset);
    if (nullIndex === -1) {
      break;
    }
    const symbolName = data.toString("ascii", offset, nullIndex);
    symbols.set(symbolName, indices[i]);
    offset = nullIndex + 1;
  }

  return symbols;
}

/**
 * 解析 COFF Archive 文件
 */
export async function parseLibArchive(buffer: Buffer): Promise<LibArchiveData> {
  if (!isLibFile(buffer)) {
    throw new Error("Not a valid COFF Archive file");
  }

  const members: LibArchiveMember[] = [];
  let offset = 8; // 跳过魔术字节
  let longNames: Map<number, string> | null = null;
  let symbolMap: Map<string, string> | null = null;
  let firstLinkerSymbols: Map<string, number> | null = null;
  let secondLinkerSymbols: Map<string, number> | null = null;

  while (offset < buffer.length) {
    const member = parseMemberHeader(buffer, offset);
    if (!member) {
      break;
    }

    // 读取成员数据
    const dataEnd = member.offset + member.size;
    if (dataEnd > buffer.length) {
      console.warn(`Member data exceeds buffer length at offset ${offset}`);
      break;
    }
    member.data = buffer.subarray(member.offset, dataEnd);

    // 处理特殊成员
    if (member.name === "/") {
      // 第一链接器成员（符号索引）
      firstLinkerSymbols = parseFirstLinkerMember(member.data);
    } else if (member.name === "//") {
      // 长文件名表
      longNames = parseLongNames(member.data);
    } else if (member.name === "//" || member.name.startsWith("/")) {
      // 可能是第二链接器成员或长文件名引用
      if (member.name === "/" && firstLinkerSymbols !== null) {
        // 第二个 "/" 是第二链接器成员
        secondLinkerSymbols = parseSecondLinkerMember(member.data);
      } else if (member.name.match(/^\/\d+$/)) {
        // 长文件名引用 /数字
        const index = parseInt(member.name.substring(1), 10);
        if (longNames && longNames.has(index)) {
          member.name = longNames.get(index)!;
        }
      }
    }

    // 去掉文件名末尾的 '/'
    if (member.name.endsWith("/") && member.name.length > 1) {
      member.name = member.name.slice(0, -1);
    }

    members.push(member);

    // 移动到下一个成员（2字节对齐）
    offset = dataEnd;
    if (offset % 2 !== 0) {
      offset++;
    }
  }

  // 构建符号到成员的映射
  if (firstLinkerSymbols || secondLinkerSymbols) {
    symbolMap = new Map<string, string>();

    // 使用第二链接器成员（更详细）
    if (secondLinkerSymbols) {
      for (const [symbol, memberIndex] of secondLinkerSymbols) {
        if (memberIndex < members.length) {
          symbolMap.set(symbol, members[memberIndex].name);
        }
      }
    }

    // 如果没有第二链接器成员，使用第一链接器成员
    if (symbolMap.size === 0 && firstLinkerSymbols) {
      // 第一链接器成员使用偏移量而非索引，需要查找对应成员
      for (const [symbol, memberOffset] of firstLinkerSymbols) {
        const member = members.find((m) => m.offset === memberOffset);
        if (member) {
          symbolMap.set(symbol, member.name);
        }
      }
    }
  }

  return {
    members,
    symbols: symbolMap || undefined,
  };
}
