# PEViewer - PE/ELF文件查看器

一个专门用于查看和分析Windows PE（Portable Executable）文件和Linux ELF（Executable and Linkable Format）文件结构的VS Code扩展。

> **说明**：此扩展由GitHub Copilot开发。

![PEViewer界面截图](https://raw.githubusercontent.com/easyatm/vscode-extension-PEViewer/main/media/ScreenShot_2025-12-07_010545_842.png)

## 功能特性

- 📁 **结构化视图**：以树形结构展示PE/ELF文件的各个组成部分
- 🔍 **详细信息**：查看文件头、节表、符号表等详细数据
- 📊 **多格式显示**：同时显示十进制、十六进制和二进制格式
- 📦 **导入/导出表**：查看DLL/SO导入函数和导出函数列表
- 🎨 **资源查看**：查看PE文件中的资源节信息和常见资源类型
- 🔧 **函数名解码**：自动解码MSVC/Itanium/Rust符号名称
- 🐧 **Linux支持**：新增对Linux .so共享对象文件的完整解析能力
- 💻 **VS Code集成**：完美融入VS Code主题和界面风格
- 📏 **支持多种格式**：.exe、.dll、.ocx、.sys、.scr、.drv、.cpl、.so等

## 使用方法

1. 安装此扩展
2. 在VS Code中打开PE或ELF文件（如.exe、.dll或.so）
3. 右键点击文件，选择 **"Open With"** > **"code"**
4. 在左侧树形视图中点击各个节点查看详细信息

## 支持的文件类型

### Windows PE 文件

- `.exe` - 可执行文件
- `.dll` - 动态链接库
- `.ocx` - ActiveX控件
- `.sys` - 系统驱动
- `.scr` - 屏幕保护程序
- `.drv` - 驱动程序
- `.cpl` - 控制面板程序

### Linux ELF 文件

- `.so` - 共享对象库 (Shared Object)
- `.so.*` - 版本化共享库
- `lib*.so` - 带 lib 前缀的共享库
- `.o` - 目标文件
- `.a` - 静态库
- `.ko` - 内核模块
- `.elf` - ELF 可执行文件
- `.axf` - ARM 可执行文件
- `.bin` - 二进制文件
- `.out` - 可执行输出文件

> **注意**：支持包括鸿蒙 (HarmonyOS) 在内的各种 Linux/Unix 系统编译的 SO 库

## 显示信息

### Windows PE 文件

#### DOS头部

- 魔数 (e_magic): MZ签名
- NT头偏移 (e_lfanew): NT头在文件中的位置

#### NT头部

- PE签名
- 机器类型：x86、x64等
- 节数量
- 时间戳
- 特性标志

### Linux ELF 文件

#### ELF头部

- 架构信息：32位/64位
- 字节序：大端/小端
- 文件类型：可执行文件、共享对象、可重定位文件等
- 机器类型：x86、x86-64、ARM、AArch64、RISC-V等
- 入口点地址

#### 节区信息

- 节区名称
- 大小和地址
- 节区类型和属性

#### 符号表

- 导出符号列表（含地址、大小、类型、绑定属性）
- 导入符号列表（含版本信息）
- 依赖库统计

### 可选头部

- 魔数：PE32或PE32+
- 入口点地址
- 映像基址
- 节对齐/文件对齐
- 映像大小
- 子系统类型

### 节表

- 节名称（.text, .data, .rdata等）
- 虚拟地址和虚拟大小
- 原始数据指针和大小
- 特性标志

### 导入/导出表

- 导入的DLL列表
- 导入的函数名称或序号
- 导出的函数列表（如果有）
- 自动解码C++函数名

### 资源

- 资源节 (.rsrc) 基本信息
- 常见资源类型说明
  - 图标 (RT_ICON / RT_GROUP_ICON)
  - 位图 (RT_BITMAP)
  - 光标 (RT_CURSOR)
  - 对话框 (RT_DIALOG)
  - 字符串表 (RT_STRING)
  - 菜单 (RT_MENU)
  - 版本信息 (RT_VERSION)
  - 清单文件 (RT_MANIFEST)

## 技术栈

- **TypeScript** - 扩展核心代码
- **pe-parser** - PE文件解析库
- **Webpack** - 打包工具

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监视模式
npm run watch

# 运行扩展
按 F5 启动扩展开发主机

# 代码格式化
npm run format
```

## 版本历史

### 0.0.1

- ✨ 初始版本
- 📁 树形结构显示PE文件各部分
- 🔍 详细信息面板
- 📊 支持导入/导出表解析
- 🎨 VS Code主题集成

## 安装

在VS Code扩展市场中搜索 **PEViewer** 并安装。

## 多语言支持

支持中文和英文界面，自动适配VS Code语言设置。

## 许可证

MIT
