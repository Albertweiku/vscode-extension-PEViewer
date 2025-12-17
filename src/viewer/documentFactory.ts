/**
 * 文档工厂
 * 根据文件类型创建相应的文档对象
 */

import {Parse} from 'pe-parser';
import * as vscode from 'vscode';

import {BinaryDocument, DocumentDelegate, ParsedData,} from '../common/binaryDocument';
import {detectFileType, FileType, getFileTypeName,} from '../common/fileTypeDetector';
import {ExtendedELFData, parseELF} from '../parsers/elf/elfParser';
import {LibArchiveData, parseLibArchive} from '../parsers/lib/libParser';
import {DumpbinData, isDumpbinAvailable, parsePEWithDumpbin,} from '../parsers/pe/dumpbinParser';

// PE 文件相关类型定义
interface ImportFunction {
  name?: string;
  ordinal?: number;
}

interface ImportDLL {
  name: string;
  functions: ImportFunction[];
}

interface ExportFunction {
  name: string;
  ordinal: number;
  address: number;
}

interface ExportTable {
  name: string;
  base: number;
  numberOfFunctions: number;
  numberOfNames: number;
  addressOfFunctions: number;
  addressOfNames: number;
  addressOfNameOrdinals: number;
  functions: ExportFunction[];
}

interface ResourceEntry {
  type: number;
  id: number | string;
  name?: string;
  data: Buffer;
  size: number;
  codePage?: number;
}

interface ResourceDirectory {
  [key: number]: ResourceEntry[];
}

interface PEData extends ParsedData {
  fileType: "PE";
  dos_header?: any;
  nt_headers?: any;
  sections?: any[];
  imports?: ImportDLL[];
  exports?: ExportTable;
  resources?: ResourceDirectory;
  dumpbinData?: DumpbinData;
  dataSource?: 'dumpbin'|'pe-parser';  // 标记数据来源
}

interface ELFData extends ParsedData {
  fileType: "ELF";
  elfData: ExtendedELFData;
}

interface LIBData extends ParsedData {
  fileType: "LIB";
  libData: LibArchiveData;
}

/**
 * 通用二进制文档实现
 */
class GenericBinaryDocument extends BinaryDocument {
  static async create(
    uri: vscode.Uri,
    backupId: string | undefined,
    delegate: DocumentDelegate,
  ): Promise<GenericBinaryDocument> {
    // 读取文件数据
    const dataFile =
      typeof backupId === "string" ? vscode.Uri.parse(backupId) : uri;
    const fileData = await BinaryDocument.readFile(dataFile);
    const buffer = Buffer.from(fileData);

    console.log(`Opening file: ${uri.fsPath}, size: ${buffer.length} bytes`);

    // 检测文件类型
    const fileType = detectFileType(buffer);
    console.log(`Detected file type: ${getFileTypeName(fileType)}`);

    // 根据文件类型解析
    let parsedData: ParsedData;

    switch (fileType) {
      case "ELF":
        parsedData = await GenericBinaryDocument.parseELF(buffer, uri);
        break;
      case "LIB":
        parsedData = await GenericBinaryDocument.parseLIB(buffer, uri);
        break;
      case "PE":
        parsedData = await GenericBinaryDocument.parsePE(buffer, uri);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    return new GenericBinaryDocument(uri, fileData, parsedData, delegate);
  }

  /**
   * 解析 ELF 文件
   */
  private static async parseELF(
    buffer: Buffer,
    uri: vscode.Uri,
  ): Promise<ELFData> {
    try {
      const elfData = await parseELF(buffer);
      console.log("ELF parsing successful");
      return {
        fileType: "ELF",
        elfData: elfData,
      };
    } catch (error) {
      console.error("ELF parsing failed:", error);
      vscode.window.showErrorMessage(`无法解析 ELF 文件: ${error}`);
      throw error;
    }
  }

  /**
   * 解析 LIB 文件
   */
  private static async parseLIB(
    buffer: Buffer,
    uri: vscode.Uri,
  ): Promise<LIBData> {
    try {
      const libData = await parseLibArchive(buffer);
      console.log(`LIB parsing successful: ${libData.members.length} members`);
      console.log("LIB symbols:", libData.symbols);
      if (libData.symbols) {
        console.log("Symbol count:", Object.keys(libData.symbols).length);
        console.log(
          "First 5 symbols:",
          Object.keys(libData.symbols).slice(0, 5),
        );
      } else {
        console.log("No symbols found in parsed data");
      }
      return {
        fileType: "LIB",
        libData: libData,
      };
    } catch (error) {
      console.error("LIB parsing failed:", error);
      vscode.window.showErrorMessage(`无法解析 LIB 文件: ${error}`);
      throw error;
    }
  }

  /**
   * 解析 PE 文件
   */
  private static async parsePE(
    buffer: Buffer,
    uri: vscode.Uri,
  ): Promise<PEData> {
    try {
      // 优先尝试使用 dumpbin 解析
      let dumpbinData: DumpbinData|null = null;

      // 检查是否是Windows系统且文件有有效路径
      if (process.platform === 'win32' && uri.scheme === 'file') {
        try {
          console.log('Attempting to parse PE file with dumpbin...');
          dumpbinData = await parsePEWithDumpbin(uri.fsPath);

          if (dumpbinData) {
            console.log('Dumpbin parsing successful, using dumpbin data');
            // 使用 dumpbin 数据构建 PEData
            const peData = await GenericBinaryDocument.buildPEDataFromDumpbin(
                buffer,
                dumpbinData,
            );
            return peData;
          } else {
            console.log(
                'Dumpbin parsing returned null, falling back to pe-parser');
          }
        } catch (dumpbinError) {
          console.warn(
              'Dumpbin parsing failed, falling back to pe-parser:',
              dumpbinError);
        }
      } else {
        console.log(
            'Dumpbin not available (non-Windows or invalid URI), using pe-parser');
      }

      // 回退到 pe-parser
      const basicData = await Parse(buffer);
      const extendedData = await GenericBinaryDocument.parseExtendedPEData(
        buffer,
        basicData,
      );
      extendedData.dataSource = 'pe-parser';
      console.log('PE parsing successful (using pe-parser)');
      return extendedData;
    } catch (error) {
      console.error("PE parsing failed:", error);
      vscode.window.showErrorMessage(`无法解析 PE 文件: ${error}`);
      throw error;
    }
  }

  /**
   * 从 dumpbin 数据构建 PEData
   */
  private static async buildPEDataFromDumpbin(
      buffer: Buffer,
      dumpbinData: DumpbinData,
      ): Promise<PEData> {
    // 仍然需要使用 pe-parser 获取基础结构信息（DOS header, NT headers等）
    let basicData: any;
    try {
      basicData = await Parse(buffer);
    } catch (error) {
      console.warn(
          'Failed to parse basic PE structure, using dumpbin data only:',
          error);
      basicData = {};
    }

    const peData: PEData = {
      ...basicData,
      fileType: 'PE',
      dataSource: 'dumpbin',
      dumpbinData: dumpbinData,
    };

    // 优先使用 dumpbin 解析的导入表数据
    if (dumpbinData.imports && dumpbinData.imports.length > 0) {
      peData.imports = dumpbinData.imports.map(
          (dllImport) => ({
            name: dllImport.dllName,
            functions: dllImport.functions.map((func) => ({
                                                 name: func.name,
                                                 ordinal: func.ordinal,
                                               })),
          }));
      console.log(`Loaded ${peData.imports.length} imports from dumpbin`);
    } else {
      // 回退到 pe-parser 的导入表解析
      try {
        peData.imports =
            GenericBinaryDocument.parseImportTable(buffer, basicData);
      } catch (error) {
        console.warn('Failed to parse import table with pe-parser:', error);
        peData.imports = [];
      }
    }

    // 优先使用 dumpbin 解析的导出表数据
    if (dumpbinData.exports && dumpbinData.exports.functions &&
        dumpbinData.exports.functions.length > 0) {
      peData.exports = {
        name: dumpbinData.exports.name || '',
        base: dumpbinData.exports.ordinalBase || 0,
        numberOfFunctions: dumpbinData.exports.numberOfFunctions ||
            dumpbinData.exports.functions.length,
        numberOfNames: dumpbinData.exports.numberOfNames ||
            dumpbinData.exports.functions.length,
        addressOfFunctions: 0,
        addressOfNames: 0,
        addressOfNameOrdinals: 0,
        functions: dumpbinData.exports.functions.map((func) => ({
                                                       name: func.name || '',
                                                       ordinal: func.ordinal,
                                                       address: func.rva,
                                                     })),
      };
      console.log(
          `Loaded ${peData.exports.functions.length} exports from dumpbin`);
    } else {
      // 回退到 pe-parser 的导出表解析
      try {
        peData.exports =
            GenericBinaryDocument.parseExportTable(buffer, basicData);
      } catch (error) {
        console.warn('Failed to parse export table with pe-parser:', error);
        peData.exports = undefined;
      }
    }

    // 资源表仍然使用 pe-parser 解析（dumpbin 的资源信息较难解析）
    try {
      peData.resources =
          GenericBinaryDocument.parseResourceDirectory(buffer, basicData);
    } catch (error) {
      console.warn('Failed to parse resources:', error);
      peData.resources = undefined;
    }

    return peData;
  }

  /**
   * 解析 PE 扩展数据（导入表、导出表、资源）
   */
  private static async parseExtendedPEData(
    fileData: Buffer,
    basicData: any,
  ): Promise<PEData> {
    const extendedData:
        PEData = {...basicData, fileType: 'PE', dataSource: 'pe-parser'};

    try {
      extendedData.imports = GenericBinaryDocument.parseImportTable(
        fileData,
        basicData,
      );
    } catch (error) {
      console.warn("Failed to parse import table:", error);
      extendedData.imports = [];
    }

    try {
      extendedData.exports = GenericBinaryDocument.parseExportTable(
        fileData,
        basicData,
      );
    } catch (error) {
      console.warn("Failed to parse export table:", error);
      extendedData.exports = undefined;
    }

    try {
      extendedData.resources = GenericBinaryDocument.parseResourceDirectory(
        fileData,
        basicData,
      );
    } catch (error) {
      console.warn("Failed to parse resources:", error);
      extendedData.resources = undefined;
    }

    return extendedData;
  }

  // PE 解析方法（从 PEDocument 移动过来）
  private static parseImportTable(
    fileData: Buffer,
    basicData: any,
  ): ImportDLL[] {
    // ... 保持原有实现不变
    const imports: ImportDLL[] = [];

    if (!basicData.nt_headers?.OptionalHeader?.DataDirectory) {
      return imports;
    }

    const dataDirectory = basicData.nt_headers.OptionalHeader.DataDirectory;
    if (dataDirectory.length < 2) {
      return imports;
    }

    const importTableEntry = dataDirectory[1];
    if (!importTableEntry || importTableEntry.VirtualAddress === 0) {
      return imports;
    }

    const importTableOffset = GenericBinaryDocument.rvaToOffset(
      importTableEntry.VirtualAddress,
      basicData.sections,
    );

    let offset = importTableOffset;
    while (offset < fileData.length) {
      const importLookupTableRVA = fileData.readUInt32LE(offset);
      const timeDateStamp = fileData.readUInt32LE(offset + 4);
      const forwarderChain = fileData.readUInt32LE(offset + 8);
      const nameRVA = fileData.readUInt32LE(offset + 12);
      const importAddressTableRVA = fileData.readUInt32LE(offset + 16);

      if (
        importLookupTableRVA === 0 &&
        timeDateStamp === 0 &&
        forwarderChain === 0 &&
        nameRVA === 0 &&
        importAddressTableRVA === 0
      ) {
        break;
      }

      const nameOffset = GenericBinaryDocument.rvaToOffset(
        nameRVA,
        basicData.sections,
      );
      let dllName = "";
      let namePos = nameOffset;
      while (namePos < fileData.length) {
        const char = fileData.readUInt8(namePos);
        if (char === 0) {
          break;
        }
        dllName += String.fromCharCode(char);
        namePos++;
      }

      const functions: ImportFunction[] = [];
      const lookupTableRVA =
        importLookupTableRVA !== 0
          ? importLookupTableRVA
          : importAddressTableRVA;
      let lookupOffset = GenericBinaryDocument.rvaToOffset(
        lookupTableRVA,
        basicData.sections,
      );

      const is64Bit = basicData.nt_headers.OptionalHeader.Magic === 0x20b;
      const entrySize = is64Bit ? 8 : 4;

      let entryIndex = 0;
      while (lookupOffset + entryIndex * entrySize < fileData.length) {
        if (is64Bit) {
          const entry64 = fileData.readBigUInt64LE(
            lookupOffset + entryIndex * entrySize,
          );
          const ordinalMask64 = 0x8000000000000000n;
          const ordinalValueMask64 = 0xffffn;
          const rvaMaxValue = 0x7fffffffn;

          if (entry64 === 0n) {
            break;
          }

          const isOrdinal = (entry64 & ordinalMask64) !== 0n;

          if (isOrdinal) {
            const ordinalValue = Number(entry64 & ordinalValueMask64);
            functions.push({ ordinal: ordinalValue });
          } else {
            if (entry64 > rvaMaxValue) {
              console.warn(
                `Invalid RVA value in 64-bit import table: ${entry64.toString(
                  16,
                )}`,
              );
              break;
            }
            const rvaValue = Number(entry64);
            const hintNameOffset = GenericBinaryDocument.rvaToOffset(
              rvaValue,
              basicData.sections,
            );
            if (hintNameOffset < 0 || hintNameOffset >= fileData.length - 2) {
              console.warn(
                `Invalid hint/name offset: ${hintNameOffset} (RVA: 0x${rvaValue.toString(
                  16,
                )})`,
              );
              break;
            }
            let funcName = "";
            let namePos2 = hintNameOffset + 2;
            while (namePos2 < fileData.length) {
              const char = fileData.readUInt8(namePos2);
              if (char === 0) {
                break;
              }
              funcName += String.fromCharCode(char);
              namePos2++;
            }
            functions.push({ name: funcName });
          }
        } else {
          const entry32 = fileData.readUInt32LE(
            lookupOffset + entryIndex * entrySize,
          );

          if (entry32 === 0) {
            break;
          }

          const ordinalMask32 = 0x80000000;
          const ordinalValueMask32 = 0xffff;
          const isOrdinal = (entry32 & ordinalMask32) !== 0;

          if (isOrdinal) {
            const ordinalValue = entry32 & ordinalValueMask32;
            functions.push({ ordinal: ordinalValue });
          } else {
            const hintNameOffset = GenericBinaryDocument.rvaToOffset(
              entry32,
              basicData.sections,
            );
            if (hintNameOffset < 0 || hintNameOffset >= fileData.length - 2) {
              break;
            }
            let funcName = "";
            let namePos2 = hintNameOffset + 2;
            while (namePos2 < fileData.length) {
              const char = fileData.readUInt8(namePos2);
              if (char === 0) {
                break;
              }
              funcName += String.fromCharCode(char);
              namePos2++;
            }
            functions.push({ name: funcName });
          }
        }

        entryIndex++;
        if (entryIndex > 1000) {
          break;
        }
      }

      imports.push({
        name: dllName,
        functions: functions,
      });
      offset += 20;
    }

    return imports;
  }

  private static parseExportTable(
    fileData: Buffer,
    basicData: any,
  ): ExportTable | undefined {
    // ... 保持原有实现
    if (!basicData.nt_headers?.OptionalHeader?.DataDirectory) {
      return undefined;
    }

    const dataDirectory = basicData.nt_headers.OptionalHeader.DataDirectory;
    if (dataDirectory.length < 1) {
      return undefined;
    }

    const exportTableEntry = dataDirectory[0];
    if (!exportTableEntry || exportTableEntry.VirtualAddress === 0) {
      return undefined;
    }

    const exportTableOffset = GenericBinaryDocument.rvaToOffset(
      exportTableEntry.VirtualAddress,
      basicData.sections,
    );

    const nameRVA = fileData.readUInt32LE(exportTableOffset + 12);
    const base = fileData.readUInt32LE(exportTableOffset + 16);
    const numberOfFunctions = fileData.readUInt32LE(exportTableOffset + 20);
    const numberOfNames = fileData.readUInt32LE(exportTableOffset + 24);
    const addressOfFunctions = fileData.readUInt32LE(exportTableOffset + 28);
    const addressOfNames = fileData.readUInt32LE(exportTableOffset + 32);
    const addressOfNameOrdinals = fileData.readUInt32LE(exportTableOffset + 36);

    const nameOffset = GenericBinaryDocument.rvaToOffset(
      nameRVA,
      basicData.sections,
    );
    let dllName = "";
    let namePos = nameOffset;
    while (namePos < fileData.length) {
      const char = fileData.readUInt8(namePos);
      if (char === 0) {
        break;
      }
      dllName += String.fromCharCode(char);
      namePos++;
    }

    const functionsOffset = GenericBinaryDocument.rvaToOffset(
      addressOfFunctions,
      basicData.sections,
    );
    const functionAddresses: number[] = [];
    for (let i = 0; i < numberOfFunctions; i++) {
      functionAddresses.push(fileData.readUInt32LE(functionsOffset + i * 4));
    }

    const namesOffset = GenericBinaryDocument.rvaToOffset(
      addressOfNames,
      basicData.sections,
    );
    const ordinalsOffset = GenericBinaryDocument.rvaToOffset(
      addressOfNameOrdinals,
      basicData.sections,
    );

    const functions: ExportFunction[] = [];

    for (let i = 0; i < numberOfNames; i++) {
      const funcNameRVA = fileData.readUInt32LE(namesOffset + i * 4);
      const ordinal = fileData.readUInt16LE(ordinalsOffset + i * 2);

      const funcNameOffset = GenericBinaryDocument.rvaToOffset(
        funcNameRVA,
        basicData.sections,
      );
      let funcName = "";
      let namePos2 = funcNameOffset;
      while (namePos2 < fileData.length) {
        const char = fileData.readUInt8(namePos2);
        if (char === 0) {
          break;
        }
        funcName += String.fromCharCode(char);
        namePos2++;
      }

      functions.push({
        name: funcName,
        ordinal: base + ordinal,
        address: functionAddresses[ordinal],
      });
    }

    return {
      name: dllName,
      base: base,
      numberOfFunctions: numberOfFunctions,
      numberOfNames: numberOfNames,
      addressOfFunctions: addressOfFunctions,
      addressOfNames: addressOfNames,
      addressOfNameOrdinals: addressOfNameOrdinals,
      functions: functions,
    };
  }

  private static parseResourceDirectory(
    fileData: Buffer,
    basicData: any,
  ): ResourceDirectory | undefined {
    // ... 保持原有实现简化版
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
    const resourceOffset = GenericBinaryDocument.rvaToOffset(
      resourceRVA,
      basicData.sections,
    );

    if (resourceOffset < 0 || resourceOffset >= fileData.length) {
      return undefined;
    }

    const resources: ResourceDirectory = {};

    try {
      GenericBinaryDocument.parseResourceLevel(
        fileData,
        resourceOffset,
        resourceRVA,
        resourceOffset,
        0,
        resources,
        null,
        null,
        basicData.sections,
      );
    } catch (error) {
      console.warn("Failed to parse resource directory:", error);
      return undefined;
    }

    return resources;
  }

  private static parseResourceLevel(
    fileData: Buffer,
    offset: number,
    resourceBaseRVA: number,
    resourceBaseOffset: number,
    level: number,
    resources: ResourceDirectory,
    typeId: number | null,
    nameId: number | string | null,
    sections: any[],
  ): void {
    // 简化的资源解析实现
    if (offset < 0 || offset + 16 > fileData.length) {
      return;
    }

    const numberOfNamedEntries = fileData.readUInt16LE(offset + 12);
    const numberOfIdEntries = fileData.readUInt16LE(offset + 14);
    const totalEntries = numberOfNamedEntries + numberOfIdEntries;

    if (totalEntries > 1000) {
      return;
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
        const nameOffset = resourceBaseOffset + entryId;
        if (nameOffset + 2 <= fileData.length) {
          const nameLength = fileData.readUInt16LE(nameOffset);
          let name = "";
          for (
            let j = 0;
            j < nameLength && nameOffset + 2 + j * 2 + 1 < fileData.length;
            j++
          ) {
            const charCode = fileData.readUInt16LE(nameOffset + 2 + j * 2);
            name += String.fromCharCode(charCode);
          }
          entryId = name;
        }
      } else {
        entryId = nameOrId;
      }

      if (isDirectory) {
        const subdirOffset = resourceBaseOffset + (offsetToData & 0x7fffffff);

        if (level === 0) {
          GenericBinaryDocument.parseResourceLevel(
            fileData,
            subdirOffset,
            resourceBaseRVA,
            resourceBaseOffset,
            level + 1,
            resources,
            typeof entryId === "number" ? entryId : 0,
            null,
            sections,
          );
        } else if (level === 1) {
          GenericBinaryDocument.parseResourceLevel(
            fileData,
            subdirOffset,
            resourceBaseRVA,
            resourceBaseOffset,
            level + 1,
            resources,
            typeId,
            entryId,
            sections,
          );
        } else {
          GenericBinaryDocument.parseResourceLevel(
            fileData,
            subdirOffset,
            resourceBaseRVA,
            resourceBaseOffset,
            level + 1,
            resources,
            typeId,
            nameId,
            sections,
          );
        }
      } else {
        const dataEntryOffset = resourceBaseOffset + offsetToData;
        if (dataEntryOffset + 16 <= fileData.length && typeId !== null) {
          const dataRVA = fileData.readUInt32LE(dataEntryOffset);
          const size = fileData.readUInt32LE(dataEntryOffset + 4);
          const codePage = fileData.readUInt32LE(dataEntryOffset + 8);

          const dataOffset = GenericBinaryDocument.rvaToOffset(
            dataRVA,
            sections,
          );

          if (dataOffset >= 0 && dataOffset + size <= fileData.length) {
            const data = fileData.subarray(dataOffset, dataOffset + size);

            const entry: ResourceEntry = {
              type: typeId,
              id: nameId !== null ? nameId : entryId,
              data: data,
              size: size,
              codePage: codePage,
            };

            if (!resources[typeId]) {
              resources[typeId] = [];
            }
            resources[typeId].push(entry);
          }
        }
      }

      entryOffset += 8;
    }
  }

  private static rvaToOffset(rva: number, sections: any[]): number {
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
   * 更新文档数据
   */
  public async updateData(data: Uint8Array): Promise<void> {
    this._documentData = data;
    const buffer = Buffer.from(data);

    const fileType = detectFileType(buffer);

    switch (fileType) {
      case "ELF":
        this._parsedData = await GenericBinaryDocument.parseELF(
          buffer,
          this.uri,
        );
        break;
      case "LIB":
        this._parsedData = await GenericBinaryDocument.parseLIB(
          buffer,
          this.uri,
        );
        break;
      case "PE":
        this._parsedData = await GenericBinaryDocument.parsePE(
          buffer,
          this.uri,
        );
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }
}

export { GenericBinaryDocument as BinaryFileDocument };
