# PEViewer 测试计划

## 1. 概述

本文档定义 PEViewer VSCode 扩展的测试策略，覆盖所有可测试模块。  
测试框架选型以 **AI 可维护性** 为核心目标：快速反馈、明确的测试边界、可编程的二进制 fixture。

## 2. 测试框架

| 层级 | 框架 | 用途 |
|------|------|------|
| 单元测试 | **Vitest** | 纯函数 / Buffer 解析器，无 VSCode 依赖 |
| 集成测试 | `@vscode/test-cli` + `@vscode/test-electron` | 需要 VSCode API 的组件（后续扩展） |

**选择 Vitest 的理由：**
- 零配置 TypeScript 支持
- 亚秒级执行速度，适合 CI 和 AI 迭代循环
- 内置 `describe` / `it` / `expect`，无需额外断言库
- 内置覆盖率报告

## 3. 目录结构

```
src/test/
├── helpers/
│   └── binaryBuilder.ts      # 构造 PE/ELF/LIB 测试缓冲区的工具函数
├── unit/
│   ├── common/
│   │   ├── fileTypeDetector.test.ts
│   │   └── util.test.ts
│   ├── parsers/
│   │   ├── elf/
│   │   │   ├── elfParser.test.ts
│   │   │   └── elfParserEnhanced.test.ts
│   │   ├── lib/
│   │   │   └── libParser.test.ts
│   │   └── pe/
│   │       └── peVersionResource.test.ts
│   └── (future: viewer/, extension/)
└── integration/               # 预留：VSCode 集成测试
    └── (future)
```

## 4. 模块测试矩阵

### 4.1 纯函数模块（Vitest 单元测试）

| 模块 | 关键函数 | 测试策略 |
|------|---------|---------|
| `common/fileTypeDetector` | `detectFileType`, `isELFFile`, `isPEFile`, `isLibFile`, `getFileTypeName` | 使用 `binaryBuilder` 构造各格式的最小合法 Buffer；测试边界（空、过短、损坏魔数） |
| `common/util` | `getNonce` | 验证长度 32、字符集合法、多次调用不重复 |
| `parsers/pe/peVersionResource` | `parseFixedFileVersionQuad`, `parseStringFileInfoValue`, `getPeFileVersionFromBuffer` | 构造含 `VS_FIXEDFILEINFO` 签名的 Buffer；测试四元组提取、UTF-16 字符串键值对解析 |
| `parsers/lib/libParser` | `isLibFile`, `parseLibArchive` | 构造最小 COFF Archive（magic + member header + linker member）；测试成员解析、符号索引、长文件名 |
| `parsers/elf/elfParserEnhanced` | `parseELFDynamicSection`, `parseELFSymbolsDirect` | 构造最小 ELF64/ELF32 Buffer（header + section headers + .dynamic + .dynsym + .dynstr）；测试大小端、符号类型/绑定映射 |
| `parsers/elf/elfParser` | `isELFFile`, `getELFTypeDescription`, `getELFMachineDescription` | 纯映射函数直接测试；`parseELF` 依赖 `elfy` 库，通过 mock 测试编排逻辑 |

### 4.2 需要 Mock 的模块

| 模块 | Mock 对象 | 说明 |
|------|----------|------|
| `parsers/pe/peImportModuleMetadata` | `fs`, `pe-parser`, `peVersionResource` | 验证 DLL 路径解析逻辑与版本填充 |
| `parsers/elf/elfParser` (parseELF) | `elfy` 包 | 控制 `elfy.parse` 返回值以测试后处理逻辑 |
| `viewer/documentFactory` | `vscode`, `pe-parser`, 所有 parsers | 集成测试范畴 |

### 4.3 集成测试模块（预留）

| 模块 | 测试要点 |
|------|---------|
| `extension.ts` | `activate` 注册 provider 和命令 |
| `viewer/peViewer.ts` | webview 消息协议、文件加载流程 |
| `viewer/documentFactory.ts` | 端到端解析链路 |

## 5. 测试辅助工具设计

### `binaryBuilder.ts`

提供程序化构造二进制格式测试数据的 Builder 函数，避免依赖外部二进制文件：

```typescript
// PE 最小结构：DOS Header (MZ) + PE Signature
buildMinimalPE(): Buffer

// ELF 最小结构：可配置 32/64 位、大小端、section headers
buildMinimalELF(options: { bits: 32|64, endian: 'LE'|'BE', sections?: [...] }): Buffer

// LIB 最小结构：Archive magic + member headers
buildMinimalLib(options: { members?: [...], symbols?: Map }): Buffer

// VS_VERSIONINFO 资源 blob
buildVersionBlob(version: string): Buffer
```

**设计原则：**
- 每个 Builder 产出的 Buffer 满足目标解析器的最低结构要求
- 参数化设计，方便 AI 在修改解析逻辑后快速调整测试数据
- 所有数值按目标格式的字节序写入

## 6. 覆盖率目标

| 指标 | 目标 |
|------|------|
| 行覆盖率 | ≥ 80%（纯函数模块） |
| 分支覆盖率 | ≥ 70%（含错误处理路径） |
| 函数覆盖率 | 100%（所有导出函数） |

## 7. CI 集成建议

```bash
# 快速单元测试（开发时 / AI 修改后立即运行）
npm run test:unit

# 带覆盖率的完整测试
npm run test:unit -- --coverage

# VSCode 集成测试（CI 环境）
npm run test
```

## 8. AI 维护指南

### 添加新解析器时
1. 在 `binaryBuilder.ts` 中添加对应格式的 Builder 函数
2. 在 `src/test/unit/parsers/` 下创建测试文件
3. 遵循现有测试的 `describe`/`it` 命名风格
4. 运行 `npm run test:unit` 验证

### 修改现有解析逻辑时
1. 先运行现有测试确认基线通过
2. 如果修改了边界条件，更新对应的边界测试用例
3. 如果修改了数据结构，更新 Builder 和断言

### 测试命名约定
- `describe` 块用模块/函数名
- `it` 块用 `should + 行为描述`
- 边界测试用 `should handle + 边界条件`
