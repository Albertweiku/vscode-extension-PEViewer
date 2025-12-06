# 导出函数名解码重构完成总结

## ✅ 已完成工作

### 1. 核心代码重构

**文件**: `media/peEditor.js`

- 重写了 `demangleFunctionName()` 函数
- 参考 [nico/demumble](https://github.com/nico/demumble) 项目的实现思路
- 增加了多编译器符号支持

### 2. 主要改进

#### 🔹 多编译器支持
```javascript
// 原来:只支持 MSVC (?)
if (mangled.startsWith('?')) {
    return demangleMsvc(mangled);
}

// 现在:支持 MSVC、Itanium、Rust
if (mangled.startsWith('?')) {
    return demangleMsvc(mangled);
} else if (isPlausibleItaniumPrefix(mangled)) {
    return demangleItanium(mangled);  // GCC/Clang
} else if (isPlausibleRustPrefix(mangled)) {
    return demangleRust(mangled);     // Rust
}
```

#### 🔹 智能符号识别
- 参考 demumble 的字符集验证
- 增加符号前缀判断
- 支持 macOS 的多下划线前缀

#### 🔹 模块化设计
- `demangleFunctionName()` - 主入口
- `demangleMsvc()` - MSVC 符号解码
- `demangleItanium()` - Itanium ABI 解码  
- `demangleRust()` - Rust 符号解码

### 3. 测试文件

**文件**: `test-demangle.html`

创建了一个完整的测试页面:
- 包含多种符号类型的测试用例
- 实时显示解码结果
- 统计成功率
- 美观的界面展示

### 4. 文档

**文件**: `DEMANGLE_REFACTOR.md`

详细的重构说明文档:
- 改进点说明
- 实现细节
- 使用方法
- 测试用例
- 局限性说明
- 参考资料

## 🎯 demumble 项目参考要点

### 核心思想

1. **符号识别**: 通过前缀和字符集判断符号类型
2. **分类处理**: 不同编译器用不同的解码器
3. **容错设计**: 解码失败返回原始名称
4. **简洁实现**: 核心代码不到 200 行

### 关键代码片段

从 demumble.cc 学习的模式:

```cpp
// demumble 的主解码函数
static void print_demangled(std::string_view s) {
  if (char* itanium = llvm::itaniumDemangle(s)) {
    printf("%s", itanium);
    free(itanium);
  } else if (char* rust = llvm::rustDemangle(s)) {
    printf("%s", rust);
    free(rust);
  } else if (char* ms = llvm::microsoftDemangle(s)) {
    printf("%s", ms);
    free(ms);
  } else {
    printf("%.*s", (int)s.size(), s.data());
  }
}

// 符号识别
static bool is_mangle_char_win(char c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
         (c >= '0' && c <= '9') || strchr("?_@$", c);
}

static bool is_plausible_itanium_prefix(char* s) {
  return strstr(prefix, "_Z");
}
```

### JavaScript 实现对应

```javascript
// 我们的实现
function demangleFunctionName(mangled) {
    if (mangled.startsWith('?')) {
        return demangleMsvc(mangled);
    }
    if (isPlausibleItaniumPrefix(mangled)) {
        return demangleItanium(mangled);
    }
    if (isPlausibleRustPrefix(mangled)) {
        return demangleRust(mangled);
    }
    return mangled;
}

function isMsvcMangleChar(c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || 
           (c >= '0' && c <= '9') || '?_@$'.includes(c);
}
```

## 📊 测试结果

### 支持的符号类型

✅ **MSVC 符号**
- 简单函数: `?test@@YAXXZ` → `test()`
- 成员函数: `?func@MyClass@@QEAAXXZ` → `MyClass::func()`
- 构造函数: `??0MyClass@@QEAA@XZ` → `MyClass::MyClass()`
- 析构函数: `??1MyClass@@QEAA@XZ` → `MyClass::~MyClass()`
- 操作符: `??4MyClass@@QEAAAEAV0@` → `MyClass::operator=`
- 特殊名称: `??_7MyClass@@6B@` → `MyClass::vftable`

✅ **Itanium 符号**
- 简单函数: `_Z4testv` → `test()`
- 命名空间: `_ZN7MyClass4funcEv` → `MyClass::func()`
- macOS: `__ZN7MyClass4funcEv` → `MyClass::func()`

✅ **Rust 符号**
- 基本支持: `_RNvC5mylib4func` → 简化解码

✅ **普通符号**
- 不影响未编码的函数名
- 保持向后兼容

## 🔧 技术细节

### 代码质量

- ✅ 所有函数都有 JSDoc 注释
- ✅ 遵循项目编码规范 (中文注释)
- ✅ 通过 TypeScript 类型检查
- ✅ 健壮的错误处理

### 性能优化

- 使用前缀快速判断符号类型
- 避免不必要的字符串操作
- 解码失败快速返回

### 兼容性

- 向后兼容原有代码
- 不影响非 PE 文件功能
- 解码失败不会崩溃

## 🚀 使用方法

### 在 PE 编辑器中查看

1. 打开任何 PE 文件
2. 查看"导出函数"列表
3. 自动显示解码后的函数名

### 独立测试

1. 打开 `test-demangle.html`
2. 查看各种符号的解码效果
3. 验证实现正确性

## 📝 后续改进建议

### 短期 (可选)
- [ ] 增加更多 MSVC 操作符映射
- [ ] 改进 Itanium 参数类型解析
- [ ] 添加符号解码缓存

### 长期 (需要评估)
- [ ] 考虑 WebAssembly 版 LLVM Demangle
- [ ] 支持 D 语言符号
- [ ] 支持 Swift 符号

## 🎓 学习资源

### demumble 项目
- 仓库: https://github.com/nico/demumble
- 核心文件: `demumble.cc` (仅 ~200 行)
- 测试: `demumble_test.py`

### 符号编码规范
- [Itanium C++ ABI](https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling)
- [Rust Mangling RFC](https://rust-lang.github.io/rfcs/2603-rust-symbol-name-mangling-v0.html)
- [MSVC Name Decoration](https://docs.microsoft.com/en-us/cpp/build/reference/decorated-names)

## ✨ 总结

本次重构成功地:

1. ✅ 参考业界优秀项目 (demumble) 的实现
2. ✅ 提升了符号解码的通用性和可靠性
3. ✅ 保持了代码的简洁和可维护性
4. ✅ 增加了完善的测试和文档

代码质量和功能都得到了显著提升,同时保持了良好的性能和兼容性。

---

**重构日期**: 2025-12-06  
**参考项目**: [nico/demumble](https://github.com/nico/demumble)  
**许可证**: 保持与原项目一致
