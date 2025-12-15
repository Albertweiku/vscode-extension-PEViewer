import * as fs from "fs";
import { Parse } from "pe-parser";
import * as vscode from "vscode";

import { Disposable, disposeAll } from "./dispose";
import { ExtendedELFData, isELFFile, parseELF } from "./elfParser";
import { getNonce } from "./util";

// PE文件解析相关的类型定义
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

interface ExtendedPEData {
  dos_header?: any;
  nt_headers?: any;
  sections?: any[];
  imports?: ImportDLL[];
  exports?: ExportTable;
  resources?: ResourceDirectory;
  fileType?: "PE" | "ELF";
  elfData?: ExtendedELFData;
}

/**
 * 定义用于 PE 文件的文档（数据模型）。
 */
class PEDocument extends Disposable implements vscode.CustomDocument {
  static async create(
    uri: vscode.Uri,
    backupId: string | undefined,
    delegate: PEDocumentDelegate,
  ): Promise<PEDocument> {
    // 如果有备份，则读取备份。否则从工作区读取资源
    const dataFile =
      typeof backupId === "string" ? vscode.Uri.parse(backupId) : uri;
    const fileData = await PEDocument.readFile(dataFile);
    const buffer = Buffer.from(fileData);

    console.log(`Opening file: ${uri.fsPath}, size: ${buffer.length} bytes`);

    let basicData: any;
    let extendedData: ExtendedPEData;

    // 检查文件类型
    if (isELFFile(buffer)) {
      // ELF 文件
      console.log(`Detected ELF file: ${uri.fsPath}`);
      try {
        const elfData = await parseELF(buffer);
        extendedData = {
          fileType: "ELF",
          elfData: elfData,
        };
        console.log("ELF parsing successful");
      } catch (error) {
        console.error("ELF parsing failed:", error);
        vscode.window.showErrorMessage(`无法解析 ELF 文件: ${error}`);
        throw error;
      }
    } else {
      // PE 文件
      console.log(`Detected PE file: ${uri.fsPath}`);
      try {
        basicData = await Parse(buffer);
        extendedData = await PEDocument.parseExtendedData(buffer, basicData);
        extendedData.fileType = "PE";
        console.log("PE parsing successful");
      } catch (error) {
        console.error("PE parsing failed:", error);
        vscode.window.showErrorMessage(`无法解析 PE 文件: ${error}`);
        throw error;
      }
    }

    return new PEDocument(uri, fileData, extendedData, delegate);
  }

  private static async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    if (uri.scheme === "untitled") {
      return new Uint8Array();
    }
    return new Uint8Array(await vscode.workspace.fs.readFile(uri));
  }

  private static async parseExtendedData(
    fileData: Buffer,
    basicData: any,
  ): Promise<ExtendedPEData> {
    const extendedData: ExtendedPEData = { ...basicData };

    try {
      // 解析导入表
      extendedData.imports = PEDocument.parseImportTable(fileData, basicData);
    } catch (error) {
      console.warn("Failed to parse import table:", error);
      extendedData.imports = [];
    }

    try {
      // 解析导出表
      extendedData.exports = PEDocument.parseExportTable(fileData, basicData);
    } catch (error) {
      console.warn("Failed to parse export table:", error);
      extendedData.exports = undefined;
    }

    try {
      // 解析资源
      extendedData.resources = PEDocument.parseResourceDirectory(
        fileData,
        basicData,
      );
    } catch (error) {
      console.warn("Failed to parse resources:", error);
      extendedData.resources = undefined;
    }

    return extendedData;
  }

  private static parseImportTable(
    fileData: Buffer,
    basicData: any,
  ): ImportDLL[] {
    const imports: ImportDLL[] = [];

    if (!basicData.nt_headers?.OptionalHeader?.DataDirectory) {
      return imports;
    }

    const dataDirectory = basicData.nt_headers.OptionalHeader.DataDirectory;
    if (dataDirectory.length < 2) {
      return imports;
    }

    // 导入表在数据目录的第2项（索引1）
    const importTableEntry = dataDirectory[1];
    if (!importTableEntry || importTableEntry.VirtualAddress === 0) {
      return imports;
    }

    // 将RVA转换为文件偏移
    const importTableOffset = PEDocument.rvaToOffset(
      importTableEntry.VirtualAddress,
      basicData.sections,
    );

    let offset = importTableOffset;
    while (offset < fileData.length) {
      // 读取导入目录表项
      const importLookupTableRVA = fileData.readUInt32LE(offset);
      const timeDateStamp = fileData.readUInt32LE(offset + 4);
      const forwarderChain = fileData.readUInt32LE(offset + 8);
      const nameRVA = fileData.readUInt32LE(offset + 12);
      const importAddressTableRVA = fileData.readUInt32LE(offset + 16);

      // 如果所有字段都是0，表示导入表结束
      if (
        importLookupTableRVA === 0 &&
        timeDateStamp === 0 &&
        forwarderChain === 0 &&
        nameRVA === 0 &&
        importAddressTableRVA === 0
      ) {
        break;
      }

      // 读取DLL名称
      const nameOffset = PEDocument.rvaToOffset(nameRVA, basicData.sections);
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

      // 解析导入函数
      const functions: ImportFunction[] = [];
      // 如果importLookupTableRVA为0，使用importAddressTableRVA
      const lookupTableRVA =
        importLookupTableRVA !== 0
          ? importLookupTableRVA
          : importAddressTableRVA;
      let lookupOffset = PEDocument.rvaToOffset(
        lookupTableRVA,
        basicData.sections,
      );

      //console.log(`DLL: ${dllName}, lookupTableRVA: 0x${lookupTableRVA.toString(16)}, lookupOffset: ${lookupOffset}`);

      // 检查是32位还是64位
      const is64Bit = basicData.nt_headers.OptionalHeader.Magic === 0x20b;
      const entrySize = is64Bit ? 8 : 4;

      let entryIndex = 0;
      while (lookupOffset + entryIndex * entrySize < fileData.length) {
        let entry: number | bigint;
        let isOrdinal: boolean;
        let ordinalValue: number;
        let rvaValue: number;

        if (is64Bit) {
          // 64位：使用BigInt处理
          const entry64 = fileData.readBigUInt64LE(
            lookupOffset + entryIndex * entrySize,
          );
          const ordinalMask64 = 0x8000000000000000n;
          const ordinalValueMask64 = 0xffffn;
          const rvaMaxValue = 0x7fffffffn; // RVA最大值 (2GB)

          if (entry64 === 0n) {
            break;
          }

          isOrdinal = (entry64 & ordinalMask64) !== 0n;

          if (isOrdinal) {
            // 按序号导入
            ordinalValue = Number(entry64 & ordinalValueMask64);
            functions.push({ ordinal: ordinalValue });
          } else {
            // 按名称导入 - entry64是RVA
            // 在64位PE中，即使是64位字段，RVA仍然是32位值
            if (entry64 > rvaMaxValue) {
              console.warn(
                `Invalid RVA value in 64-bit import table: ${entry64.toString(16)}`,
              );
              break;
            }
            rvaValue = Number(entry64);
            const hintNameOffset = PEDocument.rvaToOffset(
              rvaValue,
              basicData.sections,
            );
            if (hintNameOffset < 0 || hintNameOffset >= fileData.length - 2) {
              console.warn(
                `Invalid hint/name offset: ${hintNameOffset} (RVA: 0x${rvaValue.toString(16)})`,
              );
              break;
            }
            const hint = fileData.readUInt16LE(hintNameOffset);
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
          // 32位：使用Number处理
          const entry32 = fileData.readUInt32LE(
            lookupOffset + entryIndex * entrySize,
          );

          if (entry32 === 0) {
            break;
          }

          const ordinalMask32 = 0x80000000;
          const ordinalValueMask32 = 0xffff;

          isOrdinal = (entry32 & ordinalMask32) !== 0;

          if (isOrdinal) {
            // 按序号导入
            ordinalValue = entry32 & ordinalValueMask32;
            functions.push({ ordinal: ordinalValue });
          } else {
            // 按名称导入
            const hintNameOffset = PEDocument.rvaToOffset(
              entry32,
              basicData.sections,
            );
            if (hintNameOffset < 0 || hintNameOffset >= fileData.length - 2) {
              break;
            }
            const hint = fileData.readUInt16LE(hintNameOffset);
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
          break; // 防止无限循环
        }
      }

      //console.log(`DLL: ${dllName}, parsed ${functions.length} functions`);

      imports.push({
        name: dllName,
        functions: functions,
      });
      offset += 20; // 每个导入目录表项20字节
    }

    return imports;
  }

  private static parseExportTable(
    fileData: Buffer,
    basicData: any,
  ): ExportTable | undefined {
    if (!basicData.nt_headers?.OptionalHeader?.DataDirectory) {
      return undefined;
    }

    const dataDirectory = basicData.nt_headers.OptionalHeader.DataDirectory;
    if (dataDirectory.length < 1) {
      return undefined;
    }

    // 导出表在数据目录的第1项（索引0）
    const exportTableEntry = dataDirectory[0];
    if (!exportTableEntry || exportTableEntry.VirtualAddress === 0) {
      return undefined;
    }

    const exportTableOffset = PEDocument.rvaToOffset(
      exportTableEntry.VirtualAddress,
      basicData.sections,
    );

    // 读取导出目录表
    const characteristics = fileData.readUInt32LE(exportTableOffset);
    const timeDateStamp = fileData.readUInt32LE(exportTableOffset + 4);
    const majorVersion = fileData.readUInt16LE(exportTableOffset + 8);
    const minorVersion = fileData.readUInt16LE(exportTableOffset + 10);
    const nameRVA = fileData.readUInt32LE(exportTableOffset + 12);
    const base = fileData.readUInt32LE(exportTableOffset + 16);
    const numberOfFunctions = fileData.readUInt32LE(exportTableOffset + 20);
    const numberOfNames = fileData.readUInt32LE(exportTableOffset + 24);
    const addressOfFunctions = fileData.readUInt32LE(exportTableOffset + 28);
    const addressOfNames = fileData.readUInt32LE(exportTableOffset + 32);
    const addressOfNameOrdinals = fileData.readUInt32LE(exportTableOffset + 36);

    // 读取DLL名称
    const nameOffset = PEDocument.rvaToOffset(nameRVA, basicData.sections);
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

    // 读取函数地址表
    const functionsOffset = PEDocument.rvaToOffset(
      addressOfFunctions,
      basicData.sections,
    );
    const functionAddresses: number[] = [];
    for (let i = 0; i < numberOfFunctions; i++) {
      functionAddresses.push(fileData.readUInt32LE(functionsOffset + i * 4));
    }

    // 读取名称表和序号表
    const namesOffset = PEDocument.rvaToOffset(
      addressOfNames,
      basicData.sections,
    );
    const ordinalsOffset = PEDocument.rvaToOffset(
      addressOfNameOrdinals,
      basicData.sections,
    );

    const functions: ExportFunction[] = [];

    for (let i = 0; i < numberOfNames; i++) {
      const nameRVA = fileData.readUInt32LE(namesOffset + i * 4);
      const ordinal = fileData.readUInt16LE(ordinalsOffset + i * 2);

      // 读取函数名称
      const funcNameOffset = PEDocument.rvaToOffset(
        nameRVA,
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
    if (!basicData.nt_headers?.OptionalHeader?.DataDirectory) {
      return undefined;
    }

    const dataDirectory = basicData.nt_headers.OptionalHeader.DataDirectory;
    if (dataDirectory.length < 3) {
      return undefined;
    }

    // 资源表在数据目录的第3项（索引2）
    const resourceTableEntry = dataDirectory[2];
    if (!resourceTableEntry || resourceTableEntry.VirtualAddress === 0) {
      return undefined;
    }

    const resourceRVA = resourceTableEntry.VirtualAddress;
    const resourceOffset = PEDocument.rvaToOffset(
      resourceRVA,
      basicData.sections,
    );

    if (resourceOffset < 0 || resourceOffset >= fileData.length) {
      return undefined;
    }

    const resources: ResourceDirectory = {};

    try {
      // 解析资源目录表（第一层：类型）
      PEDocument.parseResourceLevel(
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
    if (offset < 0 || offset + 16 > fileData.length) {
      return;
    }

    // 读取资源目录表头
    const characteristics = fileData.readUInt32LE(offset);
    const timeDateStamp = fileData.readUInt32LE(offset + 4);
    const majorVersion = fileData.readUInt16LE(offset + 8);
    const minorVersion = fileData.readUInt16LE(offset + 10);
    const numberOfNamedEntries = fileData.readUInt16LE(offset + 12);
    const numberOfIdEntries = fileData.readUInt16LE(offset + 14);

    const totalEntries = numberOfNamedEntries + numberOfIdEntries;
    if (totalEntries > 1000) {
      return; // 防止异常数据
    }

    let entryOffset = offset + 16;

    // 遍历所有条目
    for (let i = 0; i < totalEntries; i++) {
      if (entryOffset + 8 > fileData.length) {
        break;
      }

      const nameOrId = fileData.readUInt32LE(entryOffset);
      const offsetToData = fileData.readUInt32LE(entryOffset + 4);

      const isNamedEntry = (nameOrId & 0x80000000) !== 0;
      const isDirectory = (offsetToData & 0x80000000) !== 0;

      let entryId: number | string;
      if (isNamedEntry) {
        // 读取名称字符串
        const nameOffset = resourceBaseOffset + (nameOrId & 0x7fffffff);
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
        } else {
          entryId = nameOrId & 0x7fffffff;
        }
      } else {
        entryId = nameOrId;
      }

      if (isDirectory) {
        // 递归解析子目录
        const subdirOffset = resourceBaseOffset + (offsetToData & 0x7fffffff);

        if (level === 0) {
          // 第一层：类型
          PEDocument.parseResourceLevel(
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
          // 第二层：ID/名称
          PEDocument.parseResourceLevel(
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
          // 第三层：语言（直接指向数据）
          PEDocument.parseResourceLevel(
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
        // 数据条目
        const dataEntryOffset = resourceBaseOffset + offsetToData;
        if (dataEntryOffset + 16 <= fileData.length && typeId !== null) {
          const dataRVA = fileData.readUInt32LE(dataEntryOffset);
          const size = fileData.readUInt32LE(dataEntryOffset + 4);
          const codePage = fileData.readUInt32LE(dataEntryOffset + 8);

          // 将RVA转换为文件偏移
          const dataOffset = PEDocument.rvaToOffset(dataRVA, sections);

          if (dataOffset >= 0 && dataOffset + size <= fileData.length) {
            const data = fileData.slice(dataOffset, dataOffset + size);

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
    return rva; // 如果找不到对应节，返回RVA作为偏移（可能在头部）
  }

  private readonly _uri: vscode.Uri;
  private _documentData: Uint8Array;
  private _parsedData: ExtendedPEData;

  private readonly _delegate: PEDocumentDelegate;

  private _onDidDispose: vscode.EventEmitter<void>;
  public onDidDispose: vscode.EventEmitter<void>["event"];

  private constructor(
    uri: vscode.Uri,
    initialContent: Uint8Array,
    parsedData: any,
    delegate: PEDocumentDelegate,
  ) {
    super();
    this._uri = uri;
    this._documentData = initialContent;
    this._parsedData = parsedData;
    this._delegate = delegate;
    this._onDidDispose = this._register(new vscode.EventEmitter<void>());
    this.onDidDispose = this._onDidDispose.event;
  }

  public get uri() {
    return this._uri;
  }

  public get documentData(): Uint8Array {
    return this._documentData;
  }

  public get parsedData(): any {
    return this._parsedData;
  }

  public get delegate() {
    return this._delegate;
  }

  public static async loadData(uri: vscode.Uri): Promise<Uint8Array> {
    return PEDocument.readFile(uri);
  }

  // CustomDocument 实现
  dispose(): void {
    this._onDidDispose.fire();
    super.dispose();
  }

  public async updateData(data: Uint8Array): Promise<void> {
    this._documentData = data;
    const buffer = Buffer.from(data);

    if (isELFFile(buffer)) {
      // ELF 文件
      const elfData = await parseELF(buffer);
      this._parsedData = {
        fileType: "ELF",
        elfData: elfData,
      };
    } else {
      // PE 文件
      this._parsedData = await Parse(buffer);
      this._parsedData.fileType = "PE";
    }
  }
}

interface PEDocumentDelegate {
  getFileData(): Promise<Uint8Array>;
}

/**
 * PE 编辑器的提供者。
 */
export class PEEditorProvider implements vscode.CustomEditorProvider<PEDocument> {
  private static newPEFileId = 1;

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      PEEditorProvider.viewType,
      new PEEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      },
    );
  }

  private static readonly viewType = "peviewer.peViewer";

  /**
   * 跟踪所有已知的 webview
   */
  private readonly webviews = new WebviewCollection();

  constructor(private readonly _context: vscode.ExtensionContext) {}

  //#region CustomEditorProvider

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: { backupId?: string },
    _token: vscode.CancellationToken,
  ): Promise<PEDocument> {
    const document: PEDocument = await PEDocument.create(
      uri,
      openContext.backupId,
      {
        getFileData: async () => {
          const webviewsForDocument = Array.from(
            this.webviews.get(document.uri),
          );
          if (!webviewsForDocument.length) {
            throw new Error("Could not find webview to save for");
          }
          const panel = webviewsForDocument[0];
          const response = await this.postMessageWithResponse<number[]>(
            panel,
            "getFileData",
            {},
          );
          return new Uint8Array(response);
        },
      },
    );

    const listeners: vscode.Disposable[] = [];

    document.onDidDispose(() => disposeAll(listeners));

    return document;
  }

  async resolveCustomEditor(
    document: PEDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    // Add the webview to our internal set of active webviews
    this.webviews.add(document.uri, webviewPanel);

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    webviewPanel.webview.onDidReceiveMessage((e) =>
      this.onMessage(document, e),
    );

    // Wait for the webview to be properly ready before we init
    webviewPanel.webview.onDidReceiveMessage((e) => {
      if (e.type === "ready") {
        if (document.uri.scheme === "untitled") {
          this.postMessage(webviewPanel, "init", {
            untitled: true,
            editable: true,
            language: vscode.env.language,
          });
        } else {
          const editable = vscode.workspace.fs.isWritableFileSystem(
            document.uri.scheme,
          );

          this.postMessage(webviewPanel, "init", {
            value: JSON.parse(
              JSON.stringify(document.parsedData, (key, value) =>
                typeof value === "bigint" ? value.toString() : value,
              ),
            ),
            editable,
            language: vscode.env.language,
          });
        }
      }
    });
  }

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<PEDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  public saveCustomDocument(
    document: PEDocument,
    cancellation: vscode.CancellationToken,
  ): Thenable<void> {
    return this.doSave(document, document.uri, cancellation);
  }

  public saveCustomDocumentAs(
    document: PEDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken,
  ): Thenable<void> {
    return this.doSave(document, destination, cancellation);
  }

  public revertCustomDocument(
    document: PEDocument,
    cancellation: vscode.CancellationToken,
  ): Thenable<void> {
    return PEDocument.loadData(document.uri).then(async (data) => {
      await document.updateData(data);
      this.postMessageToAll(document.uri, "update", {
        parsedData: JSON.parse(
          JSON.stringify(document.parsedData, (key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          ),
        ),
      });
    });
  }

  public backupCustomDocument(
    document: PEDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken,
  ): Thenable<vscode.CustomDocumentBackup> {
    return this.doSave(document, context.destination, cancellation).then(() => {
      return {
        id: context.destination.toString(),
        delete: async () => {
          try {
            await vscode.workspace.fs.delete(context.destination);
          } catch {
            // noop
          }
        },
      };
    });
  }

  //#endregion

  private async doSave(
    document: PEDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken,
  ): Promise<void> {
    const fileData = await document.delegate.getFileData();
    if (cancellation.isCancellationRequested) {
      return;
    }
    await vscode.workspace.fs.writeFile(destination, fileData);
  }

  private postMessageToAll(uri: vscode.Uri, type: string, body: any): void {
    for (const webview of this.webviews.get(uri)) {
      this.postMessage(webview, type, body);
    }
  }

  private postMessageWithResponse<R = unknown>(
    panel: vscode.WebviewPanel,
    type: string,
    body: any,
  ): Promise<R> {
    const requestId = this._requestId++;
    const p = new Promise<R>((resolve) =>
      this._callbacks.set(requestId, resolve),
    );
    panel.webview.postMessage({ type, requestId, body });
    return p;
  }

  private postMessage(
    panel: vscode.WebviewPanel,
    type: string,
    body: any,
  ): void {
    panel.webview.postMessage({ type, body });
  }

  private onMessage(document: PEDocument, message: any) {
    switch (message.type) {
      case "response": {
        const callback = this._callbacks.get(message.requestId);
        callback?.(message.body);
        return;
      }
    }
  }

  private _requestId = 1;
  private readonly _callbacks = new Map<number, (response: any) => void>();

  /**
   * Get the static HTML used for in our editor's webviews.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Local path to script and css for the webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "peViewer.js"),
    );
    const localesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "locales.js"),
    );
    const peHandlerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "peHandler.js"),
    );
    const elfHandlerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "elfHandler.js"),
    );

    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "reset.css"),
    );

    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "vscode.css"),
    );

    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "peViewer.css"),
    );

    const htmlUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "peViewer.html"),
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    // Read HTML template
    const htmlContent = fs.readFileSync(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "peViewer.html")
        .fsPath,
      "utf8",
    );

    // Replace placeholders
    return htmlContent
      .replace(/\$\{webview\.cspSource\}/g, webview.cspSource)
      .replace(/\$\{nonce\}/g, nonce)
      .replace(/\$\{styleResetUri\}/g, styleResetUri.toString())
      .replace(/\$\{styleVSCodeUri\}/g, styleVSCodeUri.toString())
      .replace(/\$\{styleMainUri\}/g, styleMainUri.toString())
      .replace(/\$\{localesUri\}/g, localesUri.toString())
      .replace(/\$\{peHandlerUri\}/g, peHandlerUri.toString())
      .replace(/\$\{elfHandlerUri\}/g, elfHandlerUri.toString())
      .replace(/\$\{scriptUri\}/g, scriptUri.toString());
  }
}

/**
 * Tracks all webviews.
 */
class WebviewCollection {
  private readonly _webviews = new Set<{
    readonly resource: string;
    readonly webviewPanel: vscode.WebviewPanel;
  }>();

  /**
   * Get all known webviews for a given uri.
   */
  public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
    const key = uri.toString();
    for (const entry of this._webviews) {
      if (entry.resource === key) {
        yield entry.webviewPanel;
      }
    }
  }

  /**
   * Add a new webview to the collection.
   */
  public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
    const entry = { resource: uri.toString(), webviewPanel };
    this._webviews.add(entry);

    webviewPanel.onDidDispose(() => {
      this._webviews.delete(entry);
    });
  }
}
