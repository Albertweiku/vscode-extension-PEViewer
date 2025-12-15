import { exec } from "child_process";
import * as elfy from "elfy";
import { promisify } from "util";

import { parseELFSymbolsDirect } from "./elfParserEnhanced";

const execAsync = promisify(exec);

// ELF文件解析相关的类型定义
interface ELFImportFunction {
  name?: string;
  version?: string;
}

interface ELFImportLibrary {
  name: string;
  functions: ELFImportFunction[];
}

interface ELFExportFunction {
  name: string;
  address: number;
  size: number;
  type?: string;
  binding?: string;
}

interface ELFExportTable {
  functions: ELFExportFunction[];
}

export interface ExtendedELFData {
  header?: any;
  programHeaders?: any[];
  sectionHeaders?: any[];
  symbols?: any[];
  dynamicSymbols?: any[];
  imports?: ELFImportLibrary[];
  exports?: ELFExportTable;
  dynamic?: any[];
  notes?: any[];
}

/**
 * 解析ELF文件
 */
export async function parseELF(fileData: Buffer): Promise<ExtendedELFData> {
  try {
    // 使用elfy库解析基本结构
    const elfData = elfy.parse(fileData);

    console.log("elfy parsed data:", {
      hasBody: !!elfData.body,
      sectionsCount: elfData.body?.sections?.length || 0,
      programHeadersCount: elfData.body?.programHeaders?.length || 0,
    });

    const extendedData: ExtendedELFData = {
      header: elfData.header,
      programHeaders: elfData.body?.programHeaders || [],
      sectionHeaders: elfData.body?.sections || [],
      symbols: [],
      dynamicSymbols: [],
      imports: [],
      exports: { functions: [] },
      dynamic: [],
      notes: [],
    };

    // 解析节区表
    if (elfData.body?.sections) {
      console.log("Parsing sections...");
      // 查找符号表
      const symtabSection = elfData.body.sections.find(
        (s: any) => s.name === ".symtab",
      );
      if (symtabSection) {
        console.log(
          ".symtab found, symbols:",
          symtabSection.symbols?.length || 0,
        );
        extendedData.symbols = symtabSection.symbols || [];
      } else {
        console.log(".symtab not found");
      }

      // 查找动态符号表
      const dynsymSection = elfData.body.sections.find(
        (s: any) => s.name === ".dynsym",
      );
      if (dynsymSection) {
        console.log(
          ".dynsym found, symbols:",
          dynsymSection.symbols?.length || 0,
        );
        extendedData.dynamicSymbols = dynsymSection.symbols || [];
      } else {
        console.log(".dynsym not found");
      }

      // 查找动态节区
      const dynamicSection = elfData.body.sections.find(
        (s: any) => s.name === ".dynamic",
      );
      if (dynamicSection) {
        extendedData.dynamic = dynamicSection.entries || [];
      }

      // 查找note节区
      const noteSection = elfData.body.sections.find(
        (s: any) => s.name === ".note",
      );
      if (noteSection) {
        extendedData.notes = noteSection.notes || [];
      }
    }

    // 解析导入和导出
    extendedData.imports = parseELFImports(extendedData);
    extendedData.exports = parseELFExports(extendedData);

    console.log("Parse results:", {
      symbols: extendedData.symbols?.length || 0,
      dynamicSymbols: extendedData.dynamicSymbols?.length || 0,
      imports: extendedData.imports?.length || 0,
      exports: extendedData.exports?.functions?.length || 0,
    });

    // 如果没有找到导出符号，尝试增强的直接解析
    if (extendedData.exports.functions.length === 0) {
      console.log("No exports found, trying enhanced direct parsing...");
      try {
        const directSymbols = parseELFSymbolsDirect(fileData);
        if (directSymbols.length > 0) {
          extendedData.exports.functions = directSymbols.map((s) => ({
            name: s.name,
            address: s.address,
            size: s.size,
            type: s.type,
            binding: s.binding,
          }));
          console.log("Direct parsing found exports:", directSymbols.length);
        }
      } catch (err) {
        console.log("Direct parsing failed:", err);

        // 最后尝试外部工具
        console.log("Trying external tools as last resort...");
        try {
          const externalSymbols = await parseWithExternalTools(fileData);
          if (externalSymbols.length > 0) {
            extendedData.exports.functions = externalSymbols;
            console.log(
              "External tools found exports:",
              externalSymbols.length,
            );
          }
        } catch (err2) {
          console.log("External tools parsing failed:", err2);
        }
      }
    }

    return extendedData;
  } catch (error) {
    console.error("Failed to parse ELF file:", error);
    throw error;
  }
}

/**
 * 解析ELF导入表
 */
function parseELFImports(elfData: ExtendedELFData): ELFImportLibrary[] {
  const imports: ELFImportLibrary[] = [];
  const libraryMap = new Map<string, ELFImportFunction[]>();

  // 从动态符号表中提取导入的符号
  if (elfData.dynamicSymbols && elfData.dynamicSymbols.length > 0) {
    for (const symbol of elfData.dynamicSymbols) {
      // UND (undefined) 类型的符号表示导入
      if (symbol.shndx === 0 && symbol.name && symbol.name !== "") {
        // 尝试从版本信息中获取库名
        let libName = "UNKNOWN";
        if (symbol.version) {
          libName = symbol.version;
        }

        if (!libraryMap.has(libName)) {
          libraryMap.set(libName, []);
        }

        libraryMap.get(libName)!.push({
          name: symbol.name,
          version: symbol.version,
        });
      }
    }
  }

  // 从dynamic节区中提取需要的库
  if (elfData.dynamic && elfData.dynamic.length > 0) {
    const neededLibs = elfData.dynamic
      .filter((entry: any) => entry.tag === "DT_NEEDED" || entry.d_tag === 1)
      .map((entry: any) => entry.val || entry.d_val);

    for (const lib of neededLibs) {
      if (!libraryMap.has(lib)) {
        libraryMap.set(lib, []);
      }
    }
  }

  // 转换为数组格式
  for (const [libName, functions] of libraryMap.entries()) {
    imports.push({
      name: libName,
      functions: functions,
    });
  }

  return imports;
}

/**
 * 解析ELF导出表
 */
function parseELFExports(elfData: ExtendedELFData): ELFExportTable {
  const exports: ELFExportTable = { functions: [] };

  console.log("parseELFExports: Starting export parsing");
  console.log("dynamicSymbols count:", elfData.dynamicSymbols?.length || 0);
  console.log("symbols count:", elfData.symbols?.length || 0);

  // 从动态符号表中提取导出的符号
  // 动态符号表通常保留在 stripped 的库中，用于动态链接
  if (elfData.dynamicSymbols && elfData.dynamicSymbols.length > 0) {
    console.log("Parsing dynamic symbols...");
    let skippedCount = 0;

    for (const symbol of elfData.dynamicSymbols) {
      // 记录一些符号信息用于调试
      if (exports.functions.length < 5) {
        console.log("Symbol sample:", {
          name: symbol.name,
          shndx: symbol.shndx,
          bind: symbol.bind,
          type: symbol.type,
          value: symbol.value,
        });
      }

      // 对于 stripped 库，我们需要更宽松的条件
      // 只要符号有名称且不是 UND (未定义) 类型，就认为是导出的
      if (symbol.name && symbol.name !== "") {
        // shndx !== 0 表示符号已定义（不是外部引用）
        // 但对于某些情况，即使 shndx 为特殊值也可能是导出的
        if (symbol.shndx !== 0 || symbol.value > 0) {
          // 只排除明确是导入的符号 (STB_LOCAL 可能不是导出，但我们先保留)
          if (
            symbol.bind !== "STB_LOCAL" ||
            symbol.type === "STT_FUNC" ||
            symbol.type === "STT_OBJECT"
          ) {
            exports.functions.push({
              name: symbol.name,
              address: symbol.value || 0,
              size: symbol.size || 0,
              type: symbol.type || "UNKNOWN",
              binding: symbol.bind || "UNKNOWN",
            });
          } else {
            skippedCount++;
          }
        }
      }
    }
    console.log("Dynamic symbols exports found:", exports.functions.length);
    console.log("Skipped local symbols:", skippedCount);
  }

  // 如果动态符号表为空或没有找到导出，尝试从普通符号表提取
  if (
    exports.functions.length === 0 &&
    elfData.symbols &&
    elfData.symbols.length > 0
  ) {
    console.log("Parsing static symbols...");
    for (const symbol of elfData.symbols) {
      if (
        symbol.shndx !== 0 &&
        symbol.name &&
        symbol.name !== "" &&
        (symbol.bind === "STB_GLOBAL" || symbol.bind === "STB_WEAK")
      ) {
        exports.functions.push({
          name: symbol.name,
          address: symbol.value || 0,
          size: symbol.size || 0,
          type: symbol.type || "UNKNOWN",
          binding: symbol.bind || "UNKNOWN",
        });
      }
    }
    console.log("Static symbols exports found:", exports.functions.length);
  }

  console.log("Total exports:", exports.functions.length);
  return exports;
}

/**
 * 检查是否为ELF文件
 */
export function isELFFile(fileData: Buffer): boolean {
  if (fileData.length < 4) {
    console.log("File too small for ELF format");
    return false;
  }

  // 检查ELF魔数: 0x7F 'E' 'L' 'F'
  const isELF =
    fileData[0] === 0x7f &&
    fileData[1] === 0x45 &&
    fileData[2] === 0x4c &&
    fileData[3] === 0x46;

  if (!isELF) {
    console.log(
      `Not ELF file. Magic bytes: ${fileData[0].toString(16)} ${fileData[1].toString(
        16,
      )} ${fileData[2].toString(16)} ${fileData[3].toString(16)}`,
    );
  } else {
    console.log("ELF file detected");
  }

  return isELF;
}

/**
 * 获取ELF类型描述
 */
export function getELFTypeDescription(type: number): string {
  const types: { [key: number]: string } = {
    0: "ET_NONE (No file type)",
    1: "ET_REL (Relocatable file)",
    2: "ET_EXEC (Executable file)",
    3: "ET_DYN (Shared object file)",
    4: "ET_CORE (Core file)",
  };
  return types[type] || `Unknown (${type})`;
}

/**
 * 获取ELF机器类型描述
 */
export function getELFMachineDescription(machine: number): string {
  const machines: { [key: number]: string } = {
    0: "No machine",
    3: "Intel 80386",
    8: "MIPS",
    20: "PowerPC",
    21: "PowerPC 64-bit",
    40: "ARM",
    62: "AMD x86-64",
    183: "ARM 64-bit (AArch64)",
    243: "RISC-V",
  };
  return machines[machine] || `Unknown (${machine})`;
}

/**
 * 使用外部工具（LLVM/binutils）解析符号
 */
async function parseWithExternalTools(
  fileData: Buffer,
): Promise<ELFExportFunction[]> {
  const exports: ELFExportFunction[] = [];

  // 将 buffer 写入临时文件
  const fs = require("fs");
  const os = require("os");
  const path = require("path");

  const tempFile = path.join(os.tmpdir(), `elf_temp_${Date.now()}.so`);

  try {
    fs.writeFileSync(tempFile, fileData);

    // 尝试多种工具，按优先级排序
    const tools = [
      // 鸿蒙 LLVM 工具链
      {
        cmd: "llvm-nm",
        args: ["-D", "--defined-only", "--format=posix", tempFile],
      },
      // 标准 LLVM
      { cmd: "llvm-nm", args: ["-D", "--defined-only", tempFile] },
      // GNU binutils
      { cmd: "nm", args: ["-D", "--defined-only", tempFile] },
      // llvm-readelf
      { cmd: "llvm-readelf", args: ["--dyn-symbols", "--wide", tempFile] },
      // readelf
      { cmd: "readelf", args: ["--dyn-symbols", "--wide", tempFile] },
    ];

    for (const tool of tools) {
      try {
        const result = await parseWithTool(tool.cmd, tool.args);
        if (result.length > 0) {
          console.log(`Successfully parsed with ${tool.cmd}:`, result.length);
          return result;
        }
      } catch (err) {
        console.log(`${tool.cmd} failed:`, err);
        continue;
      }
    }

    return exports;
  } finally {
    // 清理临时文件
    try {
      fs.unlinkSync(tempFile);
    } catch (err) {
      // 忽略清理错误
    }
  }
}

/**
 * 使用特定工具解析符号
 */
async function parseWithTool(
  cmd: string,
  args: string[],
): Promise<ELFExportFunction[]> {
  const exports: ELFExportFunction[] = [];

  try {
    const { stdout, stderr } = await execAsync(`${cmd} ${args.join(" ")}`, {
      maxBuffer: 10 * 1024 * 1024,
    });

    if (cmd.includes("nm")) {
      // 解析 nm 输出
      // 格式: address type name [size]
      // 或 POSIX 格式: name type address [size]
      const lines = stdout.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;

        let name = "";
        let address = 0;
        let type = "";
        let size = 0;

        // POSIX 格式: name type value
        if (parts[0] && !parts[0].match(/^[0-9a-fA-F]+$/)) {
          name = parts[0];
          type = parts[1];
          if (parts[2]) {
            address = parseInt(parts[2], 16) || 0;
          }
          if (parts[3]) {
            size = parseInt(parts[3], 16) || 0;
          }
        }
        // 标准格式: address type name
        else if (parts.length >= 3) {
          address = parseInt(parts[0], 16) || 0;
          type = parts[1];
          name = parts.slice(2).join(" ");
        } else {
          continue;
        }

        // 只保留导出的符号 (T/D/R/B/W 等)
        const exportTypes = ["T", "t", "D", "d", "R", "r", "B", "b", "W", "w"];
        if (name && exportTypes.includes(type)) {
          exports.push({
            name: name,
            address: address,
            size: size,
            type: type === "T" || type === "t" ? "STT_FUNC" : "STT_OBJECT",
            binding: type === type.toUpperCase() ? "STB_GLOBAL" : "STB_LOCAL",
          });
        }
      }
    } else if (cmd.includes("readelf")) {
      // 解析 readelf 输出
      const lines = stdout.split("\n");
      let inSymbolTable = false;

      for (const line of lines) {
        if (line.includes("Symbol table")) {
          inSymbolTable = true;
          continue;
        }

        if (!inSymbolTable || !line.trim()) continue;
        if (line.includes("Num:") || line.includes("---")) continue;

        // 格式: Num Value Size Type Bind Vis Ndx Name
        const match = line.match(
          /^\s*\d+:\s+([0-9a-fA-F]+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/,
        );
        if (match) {
          const [_, addr, size, type, bind, vis, ndx, name] = match;

          // 只保留已定义的符号 (Ndx != UND)
          if (ndx !== "UND" && name && name.trim()) {
            exports.push({
              name: name.trim(),
              address: parseInt(addr, 16) || 0,
              size: parseInt(size) || 0,
              type: type,
              binding: bind,
            });
          }
        }
      }
    }

    return exports;
  } catch (error: any) {
    throw new Error(`${cmd} execution failed: ${error.message}`);
  }
}
