# 搜索功能修复说明

## 问题描述

在之前的版本中，PE 和 ELF 文件的搜索功能存在一个严重问题：**搜索只能查找当前页面显示的内容，无法搜索到其他分页的数据**。

例如：

- 如果导出函数有 500 个，分为 5 页（每页 100 个）
- 用户在第 1 页搜索某个函数名
- 如果该函数在第 3 页，搜索会显示"未找到匹配项"

这是因为原始的 `performSearch()` 函数只搜索 DOM 中已渲染的表格行，而分页机制意味着只有当前页的数据被渲染到 DOM 中。

## 修复内容

### 最新版本修复（2024年12月）

#### 1. **全局数据搜索**

- 修改搜索逻辑，不再仅搜索 DOM 中显示的行
- 直接搜索全局数据数组（`allExportRows`、`allImportRows`）
- 支持搜索所有分页的完整数据
- 新增 `performSearchInExports()` 和 `performSearchInImports()` 函数专门处理分页数据搜索

#### 2. **自动页面跳转**

- 当找到匹配项时，自动跳转到包含该匹配项的页面
- 示例：搜索的函数在第 3 页，自动从第 1 页跳转到第 3 页
- 计算公式：`targetPage = Math.floor(matchIndex / pageSize) + 1`

#### 3. **跨页面导航**

- 支持使用 Enter/Shift+Enter 在不同页面的搜索结果间导航
- 新增 `navigateSearchResultsAcrossPages()` 函数处理跨页导航
- 自动切换页面并高亮目标匹配项
- 平滑滚动到匹配项位置
- 智能处理导出和导入函数的不同分页大小

#### 4. **搜索结果持久化**

- 新增 `allMatchedIndices` 数组保存所有匹配项的全局索引
- 新增 `currentSearchText` 变量保存当前搜索文本
- 切换页面时保持搜索状态
- 页面渲染后自动恢复高亮显示（使用 `highlightMatchesInCurrentPage()`）
- 实时更新搜索计数显示全局匹配数（如 "3/15" 表示第 3 个匹配项，共 15 个）

#### 5. **兼容性保持**

- 对于不分页的表格（如节区详情、数据目录等），仍使用原有的页内搜索逻辑
- `searchCurrentPageTable()` 函数处理这些场景
- 确保所有搜索场景都能正常工作

## 技术实现

### 修改的文件

- `media/shared/peViewer.js`

### 核心改动

#### 1. 新增搜索状态变量

```javascript
// 原有变量
let currentSearchMatches = []; // 当前页面匹配的 DOM 元素
let currentSearchIndex = -1; // 当前高亮的匹配项索引

// 新增变量
let allMatchedIndices = []; // 所有匹配项在原始数据中的全局索引
let currentSearchText = ""; // 当前搜索文本（用于页面切换后恢复高亮）
```

#### 2. performSearch() 函数重构

```javascript
function performSearch() {
  // 清空所有搜索状态
  currentSearchMatches = [];
  currentSearchIndex = -1;
  allMatchedIndices = [];
  currentSearchText = "";

  // 检查搜索类型：
  if (allExportRows.length > 0) {
    performSearchInExports(searchText); // 导出函数搜索
  } else if (allImportRows.length > 0) {
    performSearchInImports(searchText); // 导入函数搜索
  } else {
    searchCurrentPageTable(searchText); // 普通表格搜索
  }
}
```

#### 3. performSearchInExports() 新函数

```javascript
function performSearchInExports(searchText) {
  // 1. 在所有数据中搜索，保存匹配的全局索引
  allExportRows.forEach((row, index) => {
    if (row某列包含searchText) {
      allMatchedIndices.push(index);
    }
  });

  // 2. 计算第一个匹配项所在的页面
  const firstMatchIndex = allMatchedIndices[0];
  const targetPage = Math.floor(firstMatchIndex / pageSize) + 1;

  // 3. 如果不在当前页，切换页面
  if (targetPage !== currentPage) {
    currentPage = targetPage;
    renderExportPage();
  }

  // 4. 渲染后高亮当前页的匹配项
  setTimeout(() => {
    highlightMatchesInCurrentPage(searchText);
    currentSearchIndex = 0;
    updateSearchCount();
  }, 50);
}
```

#### 4. navigateSearchResults() 函数增强

```javascript
function navigateSearchResults(direction) {
  // 如果有全局匹配索引（分页搜索）
  if (allMatchedIndices.length > 0) {
    navigateSearchResultsAcrossPages(direction);
    return;
  }

  // 否则使用页内导航（非分页表格）
  // ... 原有逻辑
}
```

#### 5. navigateSearchResultsAcrossPages() 新函数

```javascript
function navigateSearchResultsAcrossPages(direction) {
  // 1. 更新全局索引
  currentSearchIndex += direction;

  // 2. 循环处理
  if (currentSearchIndex >= allMatchedIndices.length) {
    currentSearchIndex = 0;
  }

  // 3. 获取目标匹配项的全局索引
  const globalIndex = allMatchedIndices[currentSearchIndex];

  // 4. 计算目标页面
  const targetPage = Math.floor(globalIndex / pageSize) + 1;

  // 5. 如果需要切换页面
  if (targetPage !== currentPage) {
    currentPage = targetPage;
    renderExportPage();

    // 6. 等待页面渲染后高亮
    setTimeout(() => {
      highlightMatchesInCurrentPage(currentSearchText);
      // 找到并高亮当前项
      updateSearchCount();
    }, 50);
  } else {
    // 7. 同一页内直接高亮
    // 直接更新高亮状态
    updateSearchCount();
  }
}
```

#### 6. highlightMatchesInCurrentPage() 新函数

```javascript
function highlightMatchesInCurrentPage(searchText) {
  // 1. 清空之前的高亮
  clearSearchHighlights();
  currentSearchMatches = [];

  // 2. 在当前页面的 DOM 中搜索并高亮
  const rows = table.querySelectorAll("tbody tr");
  rows.forEach((row) => {
    if (row包含searchText) {
      row.classList.add("highlight");
      currentSearchMatches.push(row);
    }
  });

  // 3. 高亮当前选中的匹配项
  if (currentSearchMatches.length > 0) {
    currentSearchIndex = 0;
    highlightCurrentMatch();
  }
}
```

#### 7. updateSearchCount() 函数增强

```javascript
function updateSearchCount() {
  // 如果有全局匹配索引，显示全局计数
  if (allMatchedIndices.length > 0) {
    searchCount.textContent = `${currentSearchIndex + 1} / ${allMatchedIndices.length}`;
  }
  // 否则显示当前页计数
  else if (currentSearchMatches.length > 0) {
    searchCount.textContent = `${currentSearchIndex + 1} / ${currentSearchMatches.length}`;
  }
  // 无匹配项
  else {
    searchCount.textContent = "";
  }
}
```

### 关键技术点

1. **双层搜索机制**：
   - 第一层：在原始数据数组中搜索（`allExportRows`/`allImportRows`）
   - 第二层：在当前页 DOM 中高亮显示

2. **页面切换时机**：
   - 使用 `setTimeout` 确保页面渲染完成后再执行高亮
   - 延迟 50ms 足够 DOM 更新

3. **索引映射**：
   - 全局索引 → 页码：`Math.floor(index / pageSize) + 1`
   - 全局索引 → 页内索引：需要计算当前页的起始索引

4. **搜索状态持久化**：
   - 保存 `currentSearchText` 以便页面切换后恢复
   - 保存 `allMatchedIndices` 以支持跨页导航

## 使用示例

### 场景 1：跨页搜索导出函数

1. 打开一个有 500 个导出函数的 DLL 文件
2. 当前在第 1 页（显示 1-100）
3. 在搜索框输入 "CreateWindow"
4. 如果该函数在第 3 页：
   - ✅ 自动跳转到第 3 页
   - ✅ 高亮显示匹配的行
   - ✅ 显示 "1/1" 搜索计数

### 场景 2：多个匹配项导航

1. 搜索 "Get" （常见前缀）
2. 找到 15 个匹配项分布在不同页面
3. 按 Enter 键：
   - 第 1 个匹配（第 1 页）
   - 第 2 个匹配（第 1 页）
   - 第 3 个匹配（第 2 页）← 自动跳转
   - ...依次循环

### 场景 3：搜索导入函数

1. 查看导入的 DLL 的所有函数（例如 kernel32.dll 的 200+ 函数）
2. 搜索特定函数名
3. 自动在所有页面中查找并跳转

## 兼容性

### 向后兼容

- 保留了旧的 DOM 搜索逻辑作为回退
- 对于没有分页的表格（如 ELF 文件的某些视图），仍使用 DOM 搜索
- 现有的搜索快捷键（Enter、Shift+Enter、Esc）继续工作

### 支持的文件类型

- ✅ PE 文件导出函数（分页）
- ✅ PE 文件导入函数（分页）
- ✅ PE 文件单个 DLL 的导入函数（分页）
- ✅ ELF 文件导出符号（非分页，使用 DOM 搜索）
- ✅ ELF 文件导入符号（非分页，使用 DOM 搜索）

## 性能优化

1. **搜索防抖**：300ms 延迟避免频繁搜索
2. **异步高亮**：使用 `setTimeout` 避免阻塞 UI
3. **按需渲染**：只在切换页面时重新渲染
4. **内存效率**：存储索引而非复制整行数据

## 已知限制

1. 搜索不支持正则表达式（使用简单的字符串包含匹配）
2. 搜索不区分大小写
3. 每次搜索都会重新计算所有匹配项（对于超大文件可能略慢）

## 未来改进方向

1. 添加正则表达式支持
2. 添加大小写敏感选项
3. 搜索结果缓存（避免重复计算）
4. 搜索历史记录
5. 高级过滤选项（按类型、地址范围等）
6. 导出搜索结果到文件

---

**版本**: 2.0.1  
**修复日期**: 2025-12-17  
**影响范围**: PE/ELF 文件的所有分页表格搜索功能
