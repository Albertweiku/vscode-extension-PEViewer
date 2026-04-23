/**
 * 为 PE 导入表中的 DLL 解析磁盘路径与文件版本（VS_FIXEDFILEINFO）
 */

import * as fs from "fs";
import * as path from "path";

import { Parse } from "pe-parser";

import { getPeFileVersionFromBuffer } from "./peVersionResource";

export interface ImportDllWithModuleMeta {
  name: string;
  functions: unknown[];
  modulePath?: string;
  moduleVersion?: string;
  /** PE 可选头未声明资源目录，无法读取 RT_VERSION */
  moduleVersionNoPeResource?: boolean;
}

function tryResolveDllPath(
  mainExeFsPath: string,
  dllName: string,
): string | undefined {
  const dir = path.dirname(mainExeFsPath);
  const sysRoot = process.env.SystemRoot || "C:\\Windows";
  const candidates = [
    path.join(dir, dllName),
    path.join(sysRoot, "System32", dllName),
    path.join(sysRoot, "SysWOW64", dllName),
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return path.normalize(c);
      }
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

/**
 * 填充每个导入项的 modulePath / moduleVersion（就地修改）
 */
export async function enrichPeImportsModuleMetadata(
  imports: ImportDllWithModuleMeta[],
  mainExeFsPath: string,
): Promise<void> {
  if (!imports?.length || !mainExeFsPath) {
    return;
  }

  for (const dll of imports) {
    const resolved = tryResolveDllPath(mainExeFsPath, dll.name);
    if (!resolved) {
      dll.modulePath = undefined;
      dll.moduleVersion = undefined;
      dll.moduleVersionNoPeResource = undefined;
      continue;
    }
    dll.modulePath = resolved;
    dll.moduleVersionNoPeResource = undefined;
    try {
      const buf = fs.readFileSync(resolved);
      const basic = await Parse(buf);
      dll.moduleVersion = getPeFileVersionFromBuffer(buf, basic);
      const resEntry =
        basic?.nt_headers?.OptionalHeader?.DataDirectory?.[2];
      dll.moduleVersionNoPeResource =
        !dll.moduleVersion && !resEntry?.VirtualAddress;
    } catch {
      dll.moduleVersion = undefined;
      dll.moduleVersionNoPeResource = undefined;
    }
  }
}
