/**
 * 从 PE 文件缓冲区中读取 RT_VERSION（16）资源里的 VS_FIXEDFILEINFO 文件版本
 */

function rvaToOffset(rva: number, sections: any[]): number {
  for (const section of sections) {
    if (
      rva >= section.VirtualAddress &&
      rva < section.VirtualAddress + section.VirtualSize
    ) {
      return rva - section.VirtualAddress + section.PointerToRawData;
    }
  }
  return rva;
}

/**
 * 在版本资源原始数据中定位 VS_FIXEDFILEINFO（dwSignature == 0xFEEF04BD）
 */
export function parseFixedFileVersionQuad(versionBlob: Buffer): string | undefined {
  if (!versionBlob || versionBlob.length < 64) {
    return undefined;
  }

  // 规范路径：从 VS_VERSIONINFO 根解析 wValueLength 后紧跟 VS_FIXEDFILEINFO
  try {
    const wLength = versionBlob.readUInt16LE(0);
    const wValueLength = versionBlob.readUInt16LE(2);
    if (wLength > versionBlob.length || wValueLength < 52) {
      return scanFixedSignature(versionBlob);
    }
    let off = 6;
    // UTF-16 LE "VS_VERSION_INFO\0"
    const maxKey = Math.min(versionBlob.length - 2, off + 80);
    while (off + 1 < maxKey) {
      const c = versionBlob.readUInt16LE(off);
      off += 2;
      if (c === 0) {
        break;
      }
    }
    while (off % 4 !== 0) {
      off++;
    }
    if (off + 52 > versionBlob.length) {
      return scanFixedSignature(versionBlob);
    }
    const ffi = versionBlob.readUInt32LE(off);
    if (ffi !== 0xfeef04bd) {
      return scanFixedSignature(versionBlob);
    }
    const ms = versionBlob.readUInt32LE(off + 8);
    const ls = versionBlob.readUInt32LE(off + 12);
    return quadFromMsLs(ms, ls);
  } catch {
    return scanFixedSignature(versionBlob);
  }
}

function quadFromMsLs(ms: number, ls: number): string {
  const a = (ms >> 16) & 0xffff;
  const b = ms & 0xffff;
  const c = (ls >> 16) & 0xffff;
  const d = ls & 0xffff;
  return `${a}.${b}.${c}.${d}`;
}

/** 在整块 blob 中扫描合法签名（资源内嵌套时根解析可能失败） */
function scanFixedSignature(buf: Buffer): string | undefined {
  const sig = 0xfeef04bd;
  let lastQuad: string | undefined;
  for (let i = 0; i <= buf.length - 52; i += 4) {
    if (buf.readUInt32LE(i) !== sig) {
      continue;
    }
    const ms = buf.readUInt32LE(i + 8);
    const ls = buf.readUInt32LE(i + 12);
    const q = quadFromMsLs(ms, ls);
    if (q === "0.0.0.0") {
      lastQuad = q;
      continue;
    }
    return q;
  }
  return lastQuad;
}

/**
 * 从 VS_VERSIONINFO 资源 blob 的 StringFileInfo 中读取指定键的 UTF-16 值（与 RC 中 VALUE 一致）
 */
export function parseStringFileInfoValue(
  blob: Buffer,
  asciiKey: string,
): string | undefined {
  if (!blob?.length || !asciiKey) {
    return undefined;
  }
  const needle = Buffer.from(`${asciiKey}\0`, "utf16le");
  if (needle.length < 4) {
    return undefined;
  }

  let searchFrom = 0;
  while (searchFrom < blob.length) {
    const idx = blob.indexOf(needle, searchFrom);
    if (idx < 0) {
      break;
    }
    if (idx < 6) {
      searchFrom = idx + 2;
      continue;
    }
    const structStart = idx - 6;
    const wLength = blob.readUInt16LE(structStart);
    const wValueLength = blob.readUInt16LE(structStart + 2);
    if (wLength < 6 || structStart + wLength > blob.length) {
      searchFrom = idx + 2;
      continue;
    }

    let off = structStart + 6;
    while (off + 1 < blob.length) {
      if (blob.readUInt16LE(off) === 0) {
        break;
      }
      off += 2;
    }
    off += 2;
    while (off % 4 !== 0) {
      off++;
    }

    if (wValueLength <= 0 || off + wValueLength * 2 > blob.length) {
      searchFrom = idx + 2;
      continue;
    }
    const raw = blob.toString("utf16le", off, off + wValueLength * 2);
    const trimmed = raw.replace(/\0+$/, "").trim();
    if (trimmed) {
      return trimmed;
    }
    searchFrom = idx + 2;
  }
  return undefined;
}

function collectFirstVersionBlob(
  fileData: Buffer,
  offset: number,
  resourceBaseRVA: number,
  resourceBaseOffset: number,
  level: number,
  typeId: number | null,
  nameId: number | string | null,
  sections: any[],
): Buffer | undefined {
  if (offset < 0 || offset + 16 > fileData.length) {
    return undefined;
  }

  const numberOfNamedEntries = fileData.readUInt16LE(offset + 12);
  const numberOfIdEntries = fileData.readUInt16LE(offset + 14);
  const totalEntries = numberOfNamedEntries + numberOfIdEntries;
  if (totalEntries > 1000) {
    return undefined;
  }

  let entryOffset = offset + 16;

  for (let i = 0; i < totalEntries; i++) {
    if (entryOffset + 8 > fileData.length) {
      break;
    }

    const nameOrId = fileData.readUInt32LE(entryOffset);
    const offsetToData = fileData.readUInt32LE(entryOffset + 4);
    const isNamedEntry = (nameOrId & 0x80000000) !== 0;
    const isDirectory = (offsetToData & 0x80000000) !== 0;
    let entryId: number | string = nameOrId & 0x7fffffff;

    if (isNamedEntry) {
      const nameOff = resourceBaseOffset + entryId;
      if (nameOff + 2 <= fileData.length) {
        const nameLength = fileData.readUInt16LE(nameOff);
        let name = "";
        for (
          let j = 0;
          j < nameLength && nameOff + 2 + j * 2 + 1 < fileData.length;
          j++
        ) {
          const charCode = fileData.readUInt16LE(nameOff + 2 + j * 2);
          name += String.fromCharCode(charCode);
        }
        entryId = name;
      }
    } else {
      entryId = nameOrId;
    }

    if (isDirectory) {
      const subdirOffset = resourceBaseOffset + (offsetToData & 0x7fffffff);
      let nextType = typeId;
      let nextName: number | string | null = nameId;
      if (level === 0) {
        nextType = typeof entryId === "number" ? entryId : 0;
        nextName = null;
      } else if (level === 1) {
        nextName = entryId;
      }
      const found = collectFirstVersionBlob(
        fileData,
        subdirOffset,
        resourceBaseRVA,
        resourceBaseOffset,
        level + 1,
        nextType,
        nextName,
        sections,
      );
      if (found) {
        return found;
      }
    } else if (typeId === 16) {
      const dataEntryOffset = resourceBaseOffset + offsetToData;
      if (dataEntryOffset + 16 <= fileData.length) {
        const dataRVA = fileData.readUInt32LE(dataEntryOffset);
        const size = fileData.readUInt32LE(dataEntryOffset + 4);
        const dataOffset = rvaToOffset(dataRVA, sections);
        if (dataOffset >= 0 && dataOffset + size <= fileData.length) {
          return fileData.subarray(dataOffset, dataOffset + size);
        }
      }
    }

    entryOffset += 8;
  }

  return undefined;
}

/**
 * 从已解析的 PE（含 sections）缓冲区中取第一个 RT_VERSION 资源并解析文件版本四元组
 */
export function getPeFileVersionFromBuffer(
  fileData: Buffer,
  basicData: any,
): string | undefined {
  if (!basicData.nt_headers?.OptionalHeader?.DataDirectory) {
    return undefined;
  }
  const dataDirectory = basicData.nt_headers.OptionalHeader.DataDirectory;
  if (dataDirectory.length < 3) {
    return undefined;
  }
  const resourceTableEntry = dataDirectory[2];
  if (!resourceTableEntry || resourceTableEntry.VirtualAddress === 0) {
    return undefined;
  }
  const resourceRVA = resourceTableEntry.VirtualAddress;
  const resourceOffset = rvaToOffset(resourceRVA, basicData.sections);
  if (resourceOffset < 0 || resourceOffset >= fileData.length) {
    return undefined;
  }

  const blob = collectFirstVersionBlob(
    fileData,
    resourceOffset,
    resourceRVA,
    resourceOffset,
    0,
    null,
    null,
    basicData.sections,
  );
  if (!blob || blob.length === 0) {
    return undefined;
  }
  // RC 里 VALUE "FileVersion" / "ProductVersion" 常比 FILEVERSION 更完整（如 ANGLE 带 git 信息）
  const fromStrings =
    parseStringFileInfoValue(blob, "FileVersion") ||
    parseStringFileInfoValue(blob, "ProductVersion");
  const fixed = parseFixedFileVersionQuad(blob);
  if (fromStrings) {
    return fromStrings;
  }
  if (fixed && fixed !== "0.0.0.0") {
    return fixed;
  }
  return fixed;
}
