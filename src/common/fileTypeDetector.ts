/**
 * 文件类型检测器
 * 负责识别不同的二进制文件格式
 */

export type FileType = "PE" | "ELF" | "LIB" | "UNKNOWN";

/**
 * 检测文件类型
 * @param buffer 文件数据缓冲区
 * @returns 文件类型
 */
export function detectFileType(buffer: Buffer): FileType {
  if (isELFFile(buffer)) {
    return "ELF";
  }
  if (isLibFile(buffer)) {
    return "LIB";
  }
  if (isPEFile(buffer)) {
    return "PE";
  }
  return "UNKNOWN";
}

/**
 * 检查是否为 ELF 文件
 */
export function isELFFile(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }
  // ELF 魔术字节: 0x7F 'E' 'L' 'F'
  return (
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  );
}

/**
 * 检查是否为 PE 文件
 */
export function isPEFile(buffer: Buffer): boolean {
  if (buffer.length < 64) {
    return false;
  }
  // DOS 头魔术字节: 'MZ'
  if (buffer[0] !== 0x4d || buffer[1] !== 0x5a) {
    return false;
  }
  // 读取 PE 头偏移
  const peOffset = buffer.readUInt32LE(60);
  if (peOffset + 4 > buffer.length) {
    return false;
  }
  // PE 签名: 'PE\0\0'
  return (
    buffer[peOffset] === 0x50 &&
    buffer[peOffset + 1] === 0x45 &&
    buffer[peOffset + 2] === 0x00 &&
    buffer[peOffset + 3] === 0x00
  );
}

/**
 * 检查是否为 COFF Archive (LIB) 文件
 */
export function isLibFile(buffer: Buffer): boolean {
  if (buffer.length < 8) {
    return false;
  }
  // COFF Archive 魔术字节: "!<arch>\n"
  const magic = buffer.toString("ascii", 0, 8);
  return magic === "!<arch>\n";
}

/**
 * 获取文件类型的显示名称
 */
export function getFileTypeName(fileType: FileType): string {
  switch (fileType) {
    case "PE":
      return "PE (Portable Executable)";
    case "ELF":
      return "ELF (Executable and Linkable Format)";
    case "LIB":
      return "LIB (COFF Archive)";
    case "UNKNOWN":
      return "Unknown Format";
  }
}
