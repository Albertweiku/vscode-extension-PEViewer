/**
 * Dumpbin PE 文件解析器
 * 使用 Windows SDK 的 dumpbin 工具解析 PE 文件
 */

import {exec} from 'child_process';
import {promisify} from 'util';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

/**
 * Dumpbin 解析结果接口
 */
export interface DumpbinData {
  headers?: DumpbinHeaders;
  sections?: DumpbinSection[];
  imports?: DumpbinImport[];
  exports?: DumpbinExport;
  summary?: DumpbinSummary;
  rawOutput?: string;
}

export interface DumpbinHeaders {
  machineType?: string;
  timestamp?: string;
  characteristics?: string[];
  magic?: string;
  linkerVersion?: string;
  sizeOfCode?: number;
  sizeOfInitializedData?: number;
  sizeOfUninitializedData?: number;
  addressOfEntryPoint?: number;
  baseOfCode?: number;
  imageBase?: number;
  sectionAlignment?: number;
  fileAlignment?: number;
  osVersion?: string;
  imageVersion?: string;
  subsystemVersion?: string;
  subsystem?: string;
  dllCharacteristics?: string[];
  sizeOfStackReserve?: number;
  sizeOfStackCommit?: number;
  sizeOfHeapReserve?: number;
  sizeOfHeapCommit?: number;
}

export interface DumpbinSection {
  name: string;
  virtualSize: number;
  virtualAddress: number;
  sizeOfRawData: number;
  pointerToRawData: number;
  characteristics: string[];
}

export interface DumpbinImportFunction {
  name?: string;
  ordinal?: number;
  hint?: number;
}

export interface DumpbinImport {
  dllName: string;
  functions: DumpbinImportFunction[];
}

export interface DumpbinExportFunction {
  ordinal: number;
  hint?: number;
  rva: number;
  name?: string;
}

export interface DumpbinExport {
  name?: string;
  characteristics?: number;
  timeDateStamp?: string;
  version?: string;
  ordinalBase?: number;
  numberOfFunctions?: number;
  numberOfNames?: number;
  functions: DumpbinExportFunction[];
}

export interface DumpbinSummary {
  fileSize?: number;
  peType?: string;
  architecture?: string;
  checksum?: string;
}

/**
 * 检查 dumpbin 是否可用
 */
export async function isDumpbinAvailable(): Promise<boolean> {
  try {
    const {stdout} = await execAsync('where dumpbin', {
      timeout: 5000,
    });
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * 使用 dumpbin 解析 PE 文件
 * @param filePath PE 文件路径
 * @returns 解析后的数据
 */
export async function parsePEWithDumpbin(
    filePath: string,
    ): Promise<DumpbinData|null> {
  try {
    // 检查 dumpbin 是否可用
    const available = await isDumpbinAvailable();
    if (!available) {
      console.warn('Dumpbin not available in PATH');
      return null;
    }

    // 执行 dumpbin /ALL 获取完整信息
    const {stdout, stderr} = await execAsync(`dumpbin /ALL "${filePath}"`, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,  // 10MB buffer
    });

    if (stderr) {
      console.warn('Dumpbin stderr:', stderr);
    }

    // 解析输出
    const data = parseDumpbinOutput(stdout);
    data.rawOutput = stdout;

    return data;
  } catch (error: any) {
    console.error('Failed to parse PE with dumpbin:', error);

    // 如果是超时错误，给出友好提示
    if (error.killed || error.code === 'ETIMEDOUT') {
      vscode.window.showWarningMessage(
          'Dumpbin 解析超时，将使用备用解析器',
      );
    } else if (error.code === 1) {
      // Dumpbin 返回错误码 1，可能是无效的 PE 文件
      console.warn('Dumpbin returned error code 1, possibly invalid PE file');
    }

    return null;
  }
}

/**
 * 解析 dumpbin 的输出
 */
function parseDumpbinOutput(output: string): DumpbinData {
  const data: DumpbinData = {};

  try {
    data.headers = parseHeaders(output);
    data.sections = parseSections(output);
    data.imports = parseImports(output);
    data.exports = parseExports(output);
    data.summary = parseSummary(output);
  } catch (error) {
    console.error('Error parsing dumpbin output:', error);
  }

  return data;
}

/**
 * 解析文件头信息
 */
function parseHeaders(output: string): DumpbinHeaders|undefined {
  const headers: DumpbinHeaders = {};

  try {
    // 解析 Machine Type
    const machineMatch = output.match(/machine\s*\(([^)]+)\)/i);
    if (machineMatch) {
      headers.machineType = machineMatch[1].trim();
    }

    // 解析时间戳
    const timestampMatch =
        output.match(/time date stamp\s+([A-F0-9]+)\s+(.+)/i);
    if (timestampMatch) {
      headers.timestamp = timestampMatch[2].trim();
    }

    // 解析 Magic
    const magicMatch = output.match(/magic\s+([A-F0-9]+)/i);
    if (magicMatch) {
      headers.magic = magicMatch[1];
    }

    // 解析 Linker Version
    const linkerMatch = output.match(/linker version\s+([\d.]+)/i);
    if (linkerMatch) {
      headers.linkerVersion = linkerMatch[1];
    }

    // 解析大小信息
    const sizeOfCodeMatch = output.match(/size of code\s+([A-F0-9]+)/i);
    if (sizeOfCodeMatch) {
      headers.sizeOfCode = parseInt(sizeOfCodeMatch[1], 16);
    }

    const sizeOfInitDataMatch =
        output.match(/size of initialized data\s+([A-F0-9]+)/i);
    if (sizeOfInitDataMatch) {
      headers.sizeOfInitializedData = parseInt(sizeOfInitDataMatch[1], 16);
    }

    const sizeOfUninitDataMatch =
        output.match(/size of uninitialized data\s+([A-F0-9]+)/i);
    if (sizeOfUninitDataMatch) {
      headers.sizeOfUninitializedData = parseInt(sizeOfUninitDataMatch[1], 16);
    }

    // 解析 Entry Point
    const entryPointMatch =
        output.match(/address of entry point\s+([A-F0-9]+)/i);
    if (entryPointMatch) {
      headers.addressOfEntryPoint = parseInt(entryPointMatch[1], 16);
    }

    // 解析 Base Of Code
    const baseOfCodeMatch = output.match(/base of code\s+([A-F0-9]+)/i);
    if (baseOfCodeMatch) {
      headers.baseOfCode = parseInt(baseOfCodeMatch[1], 16);
    }

    // 解析 Image Base
    const imageBaseMatch = output.match(/image base\s+([A-F0-9]+)/i);
    if (imageBaseMatch) {
      headers.imageBase = parseInt(imageBaseMatch[1], 16);
    }

    // 解析对齐信息
    const sectionAlignMatch = output.match(/section alignment\s+([A-F0-9]+)/i);
    if (sectionAlignMatch) {
      headers.sectionAlignment = parseInt(sectionAlignMatch[1], 16);
    }

    const fileAlignMatch = output.match(/file alignment\s+([A-F0-9]+)/i);
    if (fileAlignMatch) {
      headers.fileAlignment = parseInt(fileAlignMatch[1], 16);
    }

    // 解析版本信息
    const osVersionMatch = output.match(/operating system version\s+([\d.]+)/i);
    if (osVersionMatch) {
      headers.osVersion = osVersionMatch[1];
    }

    const imageVersionMatch = output.match(/image version\s+([\d.]+)/i);
    if (imageVersionMatch) {
      headers.imageVersion = imageVersionMatch[1];
    }

    const subsystemVersionMatch = output.match(/subsystem version\s+([\d.]+)/i);
    if (subsystemVersionMatch) {
      headers.subsystemVersion = subsystemVersionMatch[1];
    }

    // 解析 Subsystem
    const subsystemMatch = output.match(/subsystem\s+\(([^)]+)\)/i);
    if (subsystemMatch) {
      headers.subsystem = subsystemMatch[1].trim();
    }

    // 解析 Characteristics
    const charSection = output.match(
        /Characteristics[\s\S]*?(?=\n\s*\n|\nFILE HEADER VALUES|\nOPTIONAL HEADER VALUES)/i);
    if (charSection) {
      headers.characteristics = parseCharacteristics(charSection[0]);
    }

    // 解析 DLL Characteristics
    const dllCharSection = output.match(
        /DllCharacteristics[\s\S]*?(?=\n\s*\n|\n\s+[A-F0-9]+ size)/i);
    if (dllCharSection) {
      headers.dllCharacteristics = parseCharacteristics(dllCharSection[0]);
    }

    // 解析堆栈信息
    const stackReserveMatch =
        output.match(/size of stack reserve\s+([A-F0-9]+)/i);
    if (stackReserveMatch) {
      headers.sizeOfStackReserve = parseInt(stackReserveMatch[1], 16);
    }

    const stackCommitMatch =
        output.match(/size of stack commit\s+([A-F0-9]+)/i);
    if (stackCommitMatch) {
      headers.sizeOfStackCommit = parseInt(stackCommitMatch[1], 16);
    }

    const heapReserveMatch =
        output.match(/size of heap reserve\s+([A-F0-9]+)/i);
    if (heapReserveMatch) {
      headers.sizeOfHeapReserve = parseInt(heapReserveMatch[1], 16);
    }

    const heapCommitMatch = output.match(/size of heap commit\s+([A-F0-9]+)/i);
    if (heapCommitMatch) {
      headers.sizeOfHeapCommit = parseInt(heapCommitMatch[1], 16);
    }

    return Object.keys(headers).length > 0 ? headers : undefined;
  } catch (error) {
    console.error('Error parsing headers:', error);
    return undefined;
  }
}

/**
 * 解析特征标志
 */
function parseCharacteristics(text: string): string[] {
  const characteristics: string[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // 匹配类似 "Executable", "Application can handle large (>2GB) addresses" 等
    if (trimmed && !trimmed.match(/^[A-F0-9]+\s/i) &&
        !trimmed.includes('Characteristics')) {
      characteristics.push(trimmed);
    }
  }

  return characteristics;
}

/**
 * 解析节表信息
 */
function parseSections(output: string): DumpbinSection[]|undefined {
  const sections: DumpbinSection[] = [];

  try {
    // 匹配 SECTION HEADER 部分
    const sectionHeaderRegex =
        /SECTION HEADER #\d+\s+([\s\S]*?)(?=SECTION HEADER #|\n\s*Summary|\Z)/gi;
    const matches = output.matchAll(sectionHeaderRegex);

    for (const match of matches) {
      const sectionText = match[1];
      const section = parseSingleSection(sectionText);
      if (section) {
        sections.push(section);
      }
    }

    return sections.length > 0 ? sections : undefined;
  } catch (error) {
    console.error('Error parsing sections:', error);
    return undefined;
  }
}

/**
 * 解析单个节的信息
 */
function parseSingleSection(text: string): DumpbinSection|null {
  try {
    const nameMatch = text.match(/^\s*([.\w]+)\s+name/i);
    if (!nameMatch) {
      return null;
    }

    const section: DumpbinSection = {
      name: nameMatch[1].trim(),
      virtualSize: 0,
      virtualAddress: 0,
      sizeOfRawData: 0,
      pointerToRawData: 0,
      characteristics: [],
    };

    const virtualSizeMatch = text.match(/([A-F0-9]+)\s+virtual size/i);
    if (virtualSizeMatch) {
      section.virtualSize = parseInt(virtualSizeMatch[1], 16);
    }

    const virtualAddressMatch = text.match(/([A-F0-9]+)\s+virtual address/i);
    if (virtualAddressMatch) {
      section.virtualAddress = parseInt(virtualAddressMatch[1], 16);
    }

    const rawDataSizeMatch = text.match(/([A-F0-9]+)\s+size of raw data/i);
    if (rawDataSizeMatch) {
      section.sizeOfRawData = parseInt(rawDataSizeMatch[1], 16);
    }

    const rawDataPtrMatch = text.match(/([A-F0-9]+)\s+pointer to raw data/i);
    if (rawDataPtrMatch) {
      section.pointerToRawData = parseInt(rawDataPtrMatch[1], 16);
    }

    // 解析特征
    const flagsMatch =
        text.match(/([A-F0-9]+)\s+flags([\s\S]*?)(?=\n\s*[A-F0-9]+\s|\Z)/i);
    if (flagsMatch && flagsMatch[2]) {
      section.characteristics = parseCharacteristics(flagsMatch[2]);
    }

    return section;
  } catch (error) {
    console.error('Error parsing single section:', error);
    return null;
  }
}

/**
 * 解析导入表
 */
function parseImports(output: string): DumpbinImport[]|undefined {
  const imports: DumpbinImport[] = [];

  try {
    // 查找 Import Address Table 或 Bound Import Table 或简单的 Import 部分
    const importSectionMatch = output.match(
        /Section contains the following imports:[\s\S]*?(?=\n\s*Section|\n\s*Summary|\Z)/i);

    if (!importSectionMatch) {
      return undefined;
    }

    const importText = importSectionMatch[0];

    // 匹配 DLL 名称和它的导入函数
    // 格式通常是 DLL 名称后跟函数列表
    const dllRegex = /([^\s]+\.dll)/gi;
    const dllMatches = importText.matchAll(dllRegex);

    const dllPositions: Array<{name: string; pos: number}> = [];
    for (const match of dllMatches) {
      dllPositions.push({name: match[1], pos: match.index || 0});
    }

    // 为每个 DLL 解析其导入函数
    for (let i = 0; i < dllPositions.length; i++) {
      const dll = dllPositions[i];
      const nextPos = i + 1 < dllPositions.length ? dllPositions[i + 1].pos :
                                                    importText.length;
      const dllSection = importText.substring(dll.pos, nextPos);

      const functions = parseImportFunctions(dllSection);

      imports.push({
        dllName: dll.name,
        functions: functions,
      });
    }

    return imports.length > 0 ? imports : undefined;
  } catch (error) {
    console.error('Error parsing imports:', error);
    return undefined;
  }
}

/**
 * 解析导入函数列表
 */
function parseImportFunctions(text: string): DumpbinImportFunction[] {
  const functions: DumpbinImportFunction[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // 匹配函数导入行，格式如：
    // 140001000    0 GetModuleHandleW
    // 140001008   1A CreateFileW
    // 或 Ordinal    1
    const funcMatch = trimmed.match(/^[A-F0-9]+\s+([A-F0-9]+)\s+(.+)$/i);
    if (funcMatch) {
      const ordinalOrHint = funcMatch[1];
      const name = funcMatch[2].trim();

      functions.push({
        name: name,
        hint: parseInt(ordinalOrHint, 16),
      });
      continue;
    }

    // 匹配仅有序号的导入
    const ordinalMatch = trimmed.match(/^Ordinal\s+(\d+)$/i);
    if (ordinalMatch) {
      functions.push({
        ordinal: parseInt(ordinalMatch[1], 10),
      });
    }
  }

  return functions;
}

/**
 * 解析导出表
 */
function parseExports(output: string): DumpbinExport|undefined {
  try {
    const exportSectionMatch = output.match(
        /Section contains the following exports:[\s\S]*?(?=\n\s*Section|\n\s*Summary|\Z)/i);

    if (!exportSectionMatch) {
      return undefined;
    }

    const exportText = exportSectionMatch[0];
    const exportData: DumpbinExport = {
      functions: [],
    };

    // 解析导出表头信息
    const nameMatch = exportText.match(/name\s*:\s*(.+)/i);
    if (nameMatch) {
      exportData.name = nameMatch[1].trim();
    }

    const ordinalBaseMatch = exportText.match(/ordinal base\s*:\s*(\d+)/i);
    if (ordinalBaseMatch) {
      exportData.ordinalBase = parseInt(ordinalBaseMatch[1], 10);
    }

    const numFuncMatch = exportText.match(/number of functions\s*:\s*(\d+)/i);
    if (numFuncMatch) {
      exportData.numberOfFunctions = parseInt(numFuncMatch[1], 10);
    }

    const numNamesMatch = exportText.match(/number of names\s*:\s*(\d+)/i);
    if (numNamesMatch) {
      exportData.numberOfNames = parseInt(numNamesMatch[1], 10);
    }

    // 解析导出函数列表
    // 格式通常是：ordinal hint RVA      name
    const funcLines = exportText.split('\n');
    for (const line of funcLines) {
      const trimmed = line.trim();

      // 匹配格式: 1    0 00001000 ExportedFunction1
      const funcMatch =
          trimmed.match(/^(\d+)\s+([A-F0-9]+)\s+([A-F0-9]+)\s+(.+)$/i);
      if (funcMatch) {
        exportData.functions.push({
          ordinal: parseInt(funcMatch[1], 10),
          hint: parseInt(funcMatch[2], 16),
          rva: parseInt(funcMatch[3], 16),
          name: funcMatch[4].trim(),
        });
      }
    }

    return exportData.functions.length > 0 || exportData.name ? exportData :
                                                                undefined;
  } catch (error) {
    console.error('Error parsing exports:', error);
    return undefined;
  }
}

/**
 * 解析摘要信息
 */
function parseSummary(output: string): DumpbinSummary|undefined {
  const summary: DumpbinSummary = {};

  try {
    // 查找 Summary 部分
    const summaryMatch =
        output.match(/Summary[\s\S]*?(?=\n\s*[A-Z][A-Z\s]+:|$)/i);
    if (!summaryMatch) {
      return undefined;
    }

    const summaryText = summaryMatch[0];

    // 解析文件大小
    const fileSizeMatch = summaryText.match(/([A-F0-9]+)\s+\.text/i) ||
        output.match(/PE signature found/i);

    // 尝试从文件头获取 PE 类型
    const peTypeMatch = output.match(/magic\s+([A-F0-9]+)/i);
    if (peTypeMatch) {
      const magic = peTypeMatch[1];
      if (magic === '10B') {
        summary.peType = 'PE32';
      } else if (magic === '20B') {
        summary.peType = 'PE32+';
      }
    }

    // 获取架构信息
    const archMatch = output.match(/machine\s*\(([^)]+)\)/i);
    if (archMatch) {
      summary.architecture = archMatch[1].trim();
    }

    return Object.keys(summary).length > 0 ? summary : undefined;
  } catch (error) {
    console.error('Error parsing summary:', error);
    return undefined;
  }
}
