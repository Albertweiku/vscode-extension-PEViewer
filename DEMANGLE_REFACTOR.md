# 函数名解码重构说明

## 概述

本次重构参考了 [demumble](https://github.com/nico/demumble) 项目的实现方式,重写了 PE 编辑器中的导出函数名解码逻辑。

## 参考项目

**demumble** - 一个跨平台的 C++ 符号解码工具
- 项目地址: https://github.com/nico/demumble
- 作者: Nico Weber
- 许可证: Apache License 2.0

## 主要改进

### 1. 多编译器支持

原实现仅支持 MSVC 符号,新实现支持:

- **MSVC (Microsoft Visual C++)** - Windows 平台主流编译器
  - 符号前缀: `?`
  - 示例: `?func@@YAXXZ` → `func()`

- **Itanium C++ ABI** - GCC/Clang 使用的标准
  - 符号前缀: `_Z` (可能带有多个前导下划线)
  - 示例: `_Z4funcv` → `func()`

- **Rust** - Rust 编程语言符号
  - 符号前缀: `_R`
  - 示例: `_RNvC5mylib4func` → `mylib::func`

### 2. 智能符号识别

参考 demumble 的实现,增加了符号前缀和字符集验证:

```javascript
// 检查是否为 MSVC 符号字符
function isMsvcMangleChar(c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || 
           (c >= '0' && c <= '9') || '?_@$'.includes(c);
}

// 检查是否为可能的 Itanium 前缀
function isPlausibleItaniumPrefix(s) {
    const prefix = s.substring(0, 5);
    return prefix.includes('_Z');
}
```

### 3. 模块化设计

将解码逻辑拆分为独立的函数:

- `demangleFunctionName()` - 主入口,分发到不同的解码器
- `demangleMsvc()` - MSVC 符号解码
- `demangleItanium()` - Itanium ABI 符号解码
- `demangleRust()` - Rust 符号解码

### 4. 健壮的错误处理

- 所有解码函数都有 try-catch 保护
- 解码失败时返回原始符号名
- 不会因为解码错误导致程序崩溃

## 实现细节

### MSVC 符号解码

支持的特性:
- ✅ 构造函数/析构函数识别
- ✅ 操作符重载 (operator+, operator[], 等)
- ✅ 命名空间和类名解析
- ✅ 特殊名称 (vftable, RTTI, 等)
- ⚠️ 参数类型解码 (简化版)
- ⚠️ 模板参数解码 (简化版)

### Itanium 符号解码

当前实现:
- ✅ 基本函数名解析
- ✅ 命名空间解析
- ✅ 前导下划线处理 (macOS 兼容)
- ⚠️ 参数类型解码 (需要完整的类型表)
- ⚠️ 模板实例化 (需要递归解析)

### Rust 符号解码

当前实现:
- ✅ 基本路径解析
- ✅ 模块层次结构
- ⚠️ 泛型参数 (简化版)
- ⚠️ trait 实现 (未实现)

## 使用方法

### 在 PE 编辑器中

函数名解码会自动应用于导出函数列表:

```javascript
const exportRows = parsedData.exports.functions.map((func) => {
    const decodedName = demangleFunctionName(func.name);
    return [
        String(func.ordinal),
        `0x${func.address.toString(16).toUpperCase()}`,
        decodedName,  // 解码后的名称
        func.name     // 原始函数名
    ];
});
```

### 独立测试

打开 `test-demangle.html` 文件可以查看各种符号的解码效果。

## 测试用例

### MSVC 符号测试
| 原始符号 | 解码结果 | 说明 |
|---------|---------|------|
| `?test@@YAXXZ` | `test()` | 简单函数 |
| `??0MyClass@@QEAA@XZ` | `MyClass::MyClass()` | 构造函数 |
| `??1MyClass@@QEAA@XZ` | `MyClass::~MyClass()` | 析构函数 |
| `??2@YAPEAX_K@Z` | `operator new` | 全局 operator new |

### Itanium 符号测试
| 原始符号 | 解码结果 | 说明 |
|---------|---------|------|
| `_Z4testv` | `test()` | 简单函数 |
| `_ZN7MyClass4funcEv` | `MyClass::func()` | 成员函数 |
| `__ZN7MyClass4funcEv` | `MyClass::func()` | macOS 符号 |

### Rust 符号测试
| 原始符号 | 解码结果 | 说明 |
|---------|---------|------|
| `_RNvC5mylib4func` | 简化解码 | Rust 函数 |

## 局限性

### 当前限制

1. **参数类型**: 完整的参数类型解码需要 LLVM Demangle 库
2. **模板**: 模板参数解析需要递归类型解析器
3. **复杂类型**: 函数指针、引用等复杂类型未完全支持

### 为什么不直接使用 LLVM?

JavaScript 环境中无法直接调用 C++ 的 LLVM Demangle 库。完整的符号解码需要:
- C++ 编译的 LLVM 库
- WebAssembly 包装器 (增加约 1-2MB 大小)
- 或服务端 API 调用

当前的实现在性能、大小和功能之间取得了平衡,适用于大多数 PE 文件分析场景。

## 改进建议

### 短期优化
- [ ] 增加更多 MSVC 操作符支持
- [ ] 改进 Itanium 命名空间解析
- [ ] 添加符号缓存机制

### 长期规划
- [ ] 考虑 WebAssembly 版本的 LLVM Demangle
- [ ] 支持 D 语言符号
- [ ] 支持 Swift 符号

## 参考资料

1. [demumble 项目](https://github.com/nico/demumble)
2. [LLVM Demangle 库](https://github.com/llvm/llvm-project/tree/main/llvm/lib/Demangle)
3. [Itanium C++ ABI](https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling)
4. [Rust Name Mangling RFC](https://rust-lang.github.io/rfcs/2603-rust-symbol-name-mangling-v0.html)
5. [MSVC Name Decoration](https://docs.microsoft.com/en-us/cpp/build/reference/decorated-names)

## 版本历史

### v2.0.0 (2025-12-06)
- 重构为基于 demumble 的实现
- 增加 Itanium 和 Rust 符号支持
- 改进代码结构和错误处理

### v1.0.0 (原始版本)
- 仅支持 MSVC 符号
- 基本的操作符和类名解析

## 贡献者

- 原实现: PE Editor 团队
- 重构参考: [nico/demumble](https://github.com/nico/demumble) by Nico Weber
