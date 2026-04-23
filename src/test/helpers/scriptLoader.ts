/**
 * 加载 webview 全局作用域脚本并提取其中的函数/变量。
 *
 * media/ 下的 JS 文件均为传统 <script> 标签加载的全局脚本，
 * 本工具使用 Node `vm` 模块在隔离沙箱中执行它们，
 * 使得 vitest 可以直接调用其中的纯函数，无需修改源码。
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createContext, Script } from "vm";

const MEDIA_ROOT = join(__dirname, "..", "..", "..", "media");

/**
 * 在沙箱中执行指定脚本并返回上下文对象（包含所有全局声明）。
 *
 * @param relativePath 相对于 media/ 的脚本路径，如 "shared/machineTypes.js"
 * @param preGlobals   预注入的全局变量（如 `document`、`t` 等 DOM/i18n 桩）
 */
export function loadScript(
  relativePath: string,
  preGlobals: Record<string, unknown> = {},
): Record<string, any> {
  const filePath = join(MEDIA_ROOT, relativePath);
  let code = readFileSync(filePath, "utf-8");

  // const/let 在 vm context 中不会成为上下文属性，将顶层声明提升为 var
  // 使测试能直接通过 ctx.xxx 访问脚本变量
  code = hoistTopLevelDeclarations(code);

  const sandbox: Record<string, any> = {
    console,
    Number,
    String,
    Math,
    Array,
    Object,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    NaN,
    Infinity,
    Buffer,
    ...preGlobals,
  };

  const context = createContext(sandbox);
  const script = new Script(code, { filename: filePath });
  script.runInContext(context);
  return context;
}

/**
 * 一次性加载多个脚本到同一沙箱（模拟浏览器依次加载 <script>）。
 */
export function loadScripts(
  relativePaths: string[],
  preGlobals: Record<string, unknown> = {},
): Record<string, any> {
  const sandbox: Record<string, any> = {
    console,
    Number,
    String,
    Math,
    Array,
    Object,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    NaN,
    Infinity,
    Buffer,
    ...preGlobals,
  };

  const context = createContext(sandbox);

  for (const rel of relativePaths) {
    const filePath = join(MEDIA_ROOT, rel);
    let code = readFileSync(filePath, "utf-8");
    code = hoistTopLevelDeclarations(code);
    const script = new Script(code, { filename: filePath });
    script.runInContext(context);
  }

  return context;
}

/**
 * 将脚本顶层的 `const` / `let` 声明替换为 `var`，
 * 使其在 vm context 中成为可访问的上下文属性。
 *
 * 仅替换行首的声明（不会影响函数体内的 const/let）。
 */
function hoistTopLevelDeclarations(code: string): string {
  return code.replace(/^(const|let) /gm, "var ");
}
