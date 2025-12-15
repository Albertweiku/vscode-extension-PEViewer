// @ts-check

// 此脚本在 webview 本身中运行
(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  /** @type {HTMLElement | null} */
  const peTree = document.getElementById("peTree");
  /** @type {HTMLElement | null} */
  const peDetails = document.getElementById("peDetails");
  /** @type {HTMLElement | null} */
  const detailsTitle = document.getElementById("detailsTitle");

  // 模板缓存
  const templates = {
    importDllItem: /** @type {HTMLTemplateElement | null} */ (
      document.getElementById("tmpl-import-dll-item")
    ),
    resourceTypeItem: /** @type {HTMLTemplateElement | null} */ (
      document.getElementById("tmpl-resource-type-item")
    ),
    tableBasic: /** @type {HTMLTemplateElement | null} */ (
      document.getElementById("tmpl-table-basic")
    ),
    tableRow: /** @type {HTMLTemplateElement | null} */ (
      document.getElementById("tmpl-table-row")
    ),
    emptyMessage: /** @type {HTMLTemplateElement | null} */ (
      document.getElementById("tmpl-empty-message")
    ),
  };

  /**
   * 创建表格行
   * @param {string[]} cells - 单元格内容
   * @param {string[]} [classes] - 每个单元格的CSS类名
   * @returns {HTMLTableRowElement}
   */
  function createTableRow(cells, classes) {
    const row = document.createElement("tr");
    cells.forEach((content, index) => {
      const cell = document.createElement("td");
      cell.innerHTML = content;
      if (classes && classes[index]) {
        cell.className = classes[index];
      }
      // 为函数名列添加特殊样式（第3和第4列）
      if (index >= 2) {
        cell.style.maxWidth = "400px";
        cell.style.wordBreak = "break-all";
        cell.style.whiteSpace = "normal";
        cell.style.overflowWrap = "anywhere";
      }
      row.appendChild(cell);
    });
    return row;
  }

  /**
   * 创建表格
   * @param {string} title - 表格标题
   * @param {string[]} headers - 表头
   * @param {Array<string[]>} rows - 表格行数据
   * @param {string[]} [cellClasses] - 单元格CSS类名
   * @returns {DocumentFragment}
   */
  function createTable(title, headers, rows, cellClasses) {
    if (!templates.tableBasic) {
      return document.createDocumentFragment();
    }

    const fragment = templates.tableBasic.content.cloneNode(true);
    const section = /** @type {DocumentFragment} */ (fragment);

    // 设置标题
    const titleElement = section.querySelector(".section-title");
    if (titleElement) {
      titleElement.textContent = title;
    }

    // 创建表头
    const thead = section.querySelector(".table-head");
    if (thead) {
      const headerRow = document.createElement("tr");
      headers.forEach((header) => {
        const th = document.createElement("th");
        th.textContent = header;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
    }

    // 创建表体
    const tbody = section.querySelector(".table-body");
    if (tbody) {
      rows.forEach((rowData) => {
        tbody.appendChild(createTableRow(rowData, cellClasses));
      });
    }

    return /** @type {DocumentFragment} */ (fragment);
  }

  /**
   * 显示空消息
   * @param {string} message
   */
  function showEmptyMessage(message) {
    if (!peDetails || !templates.emptyMessage) {
      return;
    }

    const fragment = templates.emptyMessage.content.cloneNode(true);
    const msgElement = /** @type {DocumentFragment} */ (fragment).querySelector(
      ".empty-message",
    );
    if (msgElement) {
      msgElement.textContent = message;
    }

    peDetails.innerHTML = "";
    peDetails.appendChild(fragment);
  }

  /**
   * 格式化地址为十六进制字符串(自动补零)
   * @param {number | bigint} address - 地址值
   * @param {number} [minWidth=8] - 最小宽度(默认8位用于32位地址)
   * @returns {string} - 格式化后的地址字符串
   */
  function formatAddress(address, minWidth = 8) {
    // 将bigint转换为number
    const addrNum = typeof address === "bigint" ? Number(address) : address;
    return "0x" + addrNum.toString(16).toUpperCase().padStart(minWidth, "0");
  }

  /**
   * @typedef {Object} DosHeader
   * @property {number} [e_magic]
   * @property {number} [e_lfanew]
   */

  /**
   * @typedef {Object} FileHeader
   * @property {number} [Machine]
   * @property {number} [NumberOfSections]
   */

  /**
   * @typedef {Object} OptionalHeader
   * @property {number} [Magic]
   * @property {number} [AddressOfEntryPoint]
   * @property {number|BigInt} [ImageBase]
   */

  /**
   * @typedef {Object} NtHeaders
   * @property {number} [Signature]
   * @property {FileHeader} [FileHeader]
   * @property {OptionalHeader} [OptionalHeader]
   */

  /**
   * @typedef {Object} Section
   * @property {string} [Name]
   * @property {number} [VirtualSize]
   * @property {number} [VirtualAddress]
   * @property {number} [SizeOfRawData]
   * @property {number} [PointerToRawData]
   * @property {number} [Characteristics]
   */

  /**
   * @typedef {Object} ImportFunction
   * @property {string} [name]
   * @property {number} [ordinal]
   */

  /**
   * @typedef {Object} ImportDLL
   * @property {string} name
   * @property {ImportFunction[]} functions
   */

  /**
   * @typedef {Object} ExportFunction
   * @property {string} name
   * @property {number} ordinal
   * @property {number} address
   */

  /**
   * @typedef {Object} ExportTable
   * @property {string} name
   * @property {number} base
   * @property {number} numberOfFunctions
   * @property {number} numberOfNames
   * @property {number} addressOfFunctions
   * @property {number} addressOfNames
   * @property {number} addressOfNameOrdinals
   * @property {ExportFunction[]} functions
   */

  /**
   * @typedef {Object} ResourceEntry
   * @property {number} type
   * @property {number | string} id
   * @property {string} [name]
   * @property {Uint8Array} data
   * @property {number} size
   * @property {number} [codePage]
   */

  /**
   * @typedef {Object.<number, ResourceEntry[]>} ResourceDirectory
   */

  /**
   * @typedef {Object} ELFImportFunction
   * @property {string} [name]
   * @property {string} [version]
   */

  /**
   * @typedef {Object} ELFImportLibrary
   * @property {string} name
   * @property {ELFImportFunction[]} functions
   */

  /**
   * @typedef {Object} ELFExportFunction
   * @property {string} name
   * @property {number} address
   * @property {number} size
   * @property {string} [type]
   * @property {string} [binding]
   */

  /**
   * @typedef {Object} ELFExportTable
   * @property {ELFExportFunction[]} functions
   */

  /**
   * @typedef {Object} ELFSectionHeader
   * @property {string} [name]
   * @property {number} [type]
   * @property {number} [addr]
   * @property {number} [offset]
   * @property {number} [size]
   */

  /**
   * @typedef {Object} ELFHeader
   * @property {number} [class]
   * @property {number} [data]
   * @property {number} [version]
   * @property {number} [type]
   * @property {number} [machine]
   * @property {number} [entry]
   */

  /**
   * @typedef {Object} ExtendedELFData
   * @property {ELFHeader} [header]
   * @property {any[]} [programHeaders]
   * @property {ELFSectionHeader[]} [sectionHeaders]
   * @property {any[]} [symbols]
   * @property {any[]} [dynamicSymbols]
   * @property {ELFImportLibrary[]} [imports]
   * @property {ELFExportTable} [exports]
   * @property {any[]} [dynamic]
   * @property {any[]} [notes]
   */

  /**
   * @typedef {Object} ParsedData
   * @property {DosHeader} [dos_header]
   * @property {NtHeaders} [nt_headers]
   * @property {Section[]} [sections]
   * @property {ImportDLL[]} [imports]
   * @property {ExportTable} [exports]
   * @property {ResourceDirectory} [resources]
   * @property {"PE" | "ELF"} [fileType]
   * @property {ExtendedELFData} [elfData]
   */

  /** @type {ParsedData | null} */
  let parsedData = null;

  /** @type {string | null} */
  let selectedItem = null;

  // 处理来自扩展的消息
  window.addEventListener("message", async (e) => {
    const { type, body, requestId } = e.data;
    switch (type) {
      case "init": {
        parsedData = body.value;
        let lang = body.language || "en";
        if (lang.startsWith("zh")) {
          currentLanguage = "zh-cn";
        } else {
          currentLanguage = "en";
        }
        updateUILanguage();
        buildTree();
        return;
      }
      case "update": {
        parsedData = body.parsedData;
        buildTree();
        if (selectedItem) {
          selectItem(selectedItem);
        } else {
          selectItem("pe_header");
        }
        return;
      }
      case "getFileData": {
        // 目前不支持编辑，因此返回原始数据
        vscode.postMessage({
          type: "response",
          requestId,
          body: Array.from(parsedData ? new Uint8Array(0) : new Uint8Array(0)),
        });
        return;
      }
    }
  });

  function buildTree() {
    if (!parsedData) {
      return;
    }

    // 检查是否为 ELF 文件
    if (parsedData.fileType === "ELF") {
      buildELFTree(parsedData, selectItem);
      return;
    }

    // PE 文件处理
    buildPETree(parsedData, selectItem, templates);

    // 为所有树节点添加点击事件
    document.querySelectorAll(".pe-tree-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        // 阻止事件冒泡，避免触发details的展开/收缩
        e.stopPropagation();
        const itemId = /** @type {string | null} */ (
          item.getAttribute("data-item")
        );
        console.log("Tree item clicked, itemId:", itemId);
        if (itemId) {
          selectItem(itemId);
        }
      });
    });

    // 默认选中PE头部总览
    selectItem("pe_header");
  }

  /**
   * @param {string} itemId
   */
  function selectItem(itemId) {
    selectedItem = itemId;

    // 更新选中状态
    document.querySelectorAll(".pe-tree-item").forEach((item) => {
      item.classList.remove("selected");
    });
    const selectedElement = document.querySelector(`[data-item="${itemId}"]`);
    if (selectedElement) {
      selectedElement.classList.add("selected");
    }

    // 显示详细信息
    showDetails(itemId);
  }

  /**
   * @param {string} itemId
   */
  function showDetails(itemId) {
    if (!parsedData || !peDetails || !detailsTitle) {
      if (peDetails) {
        showEmptyMessage(t("errorLoadingData"));
      }
      return;
    }

    // 检查是否为 ELF 文件
    if (parsedData.fileType === "ELF") {
      // ELF 文件特殊处理
      if (itemId === "pe_header") {
        showELFOverview(
          parsedData,
          peDetails,
          detailsTitle,
          createTable,
          hideSearchBox,
        );
        return;
      }

      if (itemId === "sections") {
        showELFSections(
          parsedData,
          peDetails,
          detailsTitle,
          createTable,
          hideSearchBox,
          showEmptyMessage,
        );
        return;
      }

      if (itemId === "exports") {
        showELFExports(
          parsedData,
          peDetails,
          detailsTitle,
          createTable,
          hideSearchBox,
          showSearchBox,
          showEmptyMessage,
        );
        return;
      }

      if (itemId === "imports") {
        showELFImportsOverview(
          parsedData,
          peDetails,
          detailsTitle,
          createTable,
          hideSearchBox,
          showEmptyMessage,
        );
        return;
      }

      if (itemId.startsWith("imports.")) {
        const parts = itemId.split(".");
        if (parts.length === 2) {
          const libIndex = parseInt(parts[1]);
          if (
            !isNaN(libIndex) &&
            parsedData.elfData &&
            parsedData.elfData.imports &&
            parsedData.elfData.imports[libIndex]
          ) {
            showELFLibraryImports(
              parsedData.elfData.imports[libIndex],
              peDetails,
              detailsTitle,
              createTable,
              hideSearchBox,
              showSearchBox,
              showEmptyMessage,
            );
            return;
          }
        }
      }

      // 默认显示
      hideSearchBox();
      detailsTitle.textContent = t("detailsTitle");
      showEmptyMessage(t("selectItemMessage"));
      return;
    }

    // PE 文件处理
    // 特殊处理
    if (itemId === "pe_header") {
      showPEOverview(
        parsedData,
        peDetails,
        detailsTitle,
        createTable,
        formatAddress,
        hideSearchBox,
      );
      return;
    }

    // 处理DOS头部
    if (itemId === "dos_header") {
      showPEDosHeader(
        parsedData,
        peDetails,
        detailsTitle,
        hideSearchBox,
        generateValueDetails,
      );
      return;
    }

    // 处理COFF头部
    if (itemId === "coff_header") {
      showPECoffHeader(
        parsedData,
        peDetails,
        detailsTitle,
        hideSearchBox,
        generateValueDetails,
      );
      return;
    }

    // 处理可选头部
    if (itemId === "optional_header") {
      showPEOptionalHeader(
        parsedData,
        peDetails,
        detailsTitle,
        hideSearchBox,
        generateValueDetails,
      );
      return;
    }

    // 处理数据目录
    if (itemId === "data_directory") {
      showPEDataDirectory(
        parsedData,
        peDetails,
        detailsTitle,
        createTable,
        hideSearchBox,
        showEmptyMessage,
      );
      return;
    }

    // 处理区段列表
    if (itemId === "sections") {
      showPEAllSections(
        parsedData,
        peDetails,
        detailsTitle,
        createTable,
        hideSearchBox,
        showEmptyMessage,
      );
      return;
    }

    // 处理单个区段
    if (itemId.startsWith("section_")) {
      const sectionName = itemId.replace("section_", "");
      showPESection(
        sectionName,
        parsedData,
        peDetails,
        detailsTitle,
        hideSearchBox,
        showEmptyMessage,
        generateValueDetails,
      );
      return;
    }

    // 处理导出函数
    if (itemId === "exports") {
      showExports();
      return;
    }

    // 处理导入函数总览
    if (itemId === "imports") {
      showImportsOverview();
      return;
    }

    // 处理单个DLL的导入
    if (itemId.startsWith("imports.")) {
      const parts = itemId.split(".");
      if (parts.length === 2) {
        const dllIndex = parseInt(parts[1]);
        if (
          !isNaN(dllIndex) &&
          parsedData.imports &&
          parsedData.imports[dllIndex]
        ) {
          showDllImports(parsedData.imports[dllIndex]);
          return;
        }
      }
    } // 处理资源总览
    if (itemId === "resources") {
      showResourcesOverview();
      return;
    }

    // 处理特定资源类型
    if (itemId.startsWith("resources.")) {
      const parts = itemId.split(".");
      if (parts.length === 2) {
        const resourceType = parts[1];
        showResourceType(resourceType);
        return;
      }
    }

    // 默认显示
    hideSearchBox();
    detailsTitle.textContent = t("detailsTitle");
    showEmptyMessage(t("selectItemMessage"));
  }

  function showExports() {
    if (!parsedData || !peDetails || !detailsTitle) {
      return;
    }

    if (
      !parsedData.exports ||
      !parsedData.exports.functions ||
      parsedData.exports.functions.length === 0
    ) {
      detailsTitle.textContent = t("exportsTitle");
      showEmptyMessage(t("noExportsFound"));
      hideSearchBox();
      return;
    }

    const totalCount = parsedData.exports.functions.length;
    detailsTitle.textContent = `${t("exportFunctions")} (${t(
      "totalFunctions",
    ).replace("{count}", totalCount)})`;
    peDetails.innerHTML = "";

    // 缓存所有导出行数据
    allExportRows = parsedData.exports.functions.map(
      (/** @type {ExportFunction} */ func) => {
        const decodedName = demangleFunctionName(func.name);
        return [
          String(func.ordinal),
          formatAddress(func.address),
          decodedName, // 解码后的名称
          func.name, // 始终显示原始函数名
        ];
      },
    );

    // 重置到第一页
    currentPage = 1;
    renderExportPage();

    // 显示搜索框
    showSearchBox();
  }

  /**
   * 渲染导出函数的当前页
   */
  function renderExportPage() {
    if (!peDetails) {
      return;
    }

    const totalCount = allExportRows.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalCount);
    const currentPageRows = allExportRows.slice(startIndex, endIndex);

    // 清空详情区域
    peDetails.innerHTML = "";

    // 创建表格容器（带滚动）
    const tableContainer = document.createElement("div");
    tableContainer.className = "export-table-container";
    tableContainer.style.overflowX = "auto";
    tableContainer.style.overflowY = "auto";
    tableContainer.style.maxHeight = "calc(100vh - 200px)";
    tableContainer.style.marginBottom = "0";

    // 创建表格
    const tableFragment = createTable(
      t("exportFunctionsList"),
      [
        t("ordinal"),
        t("addressRVA"),
        t("decodedFunctionName"),
        t("originalFunctionName"),
      ],
      currentPageRows,
      [
        "pe-details-value",
        "pe-details-hex",
        "pe-details-value",
        "pe-details-value",
      ],
    );
    tableContainer.appendChild(tableFragment);
    peDetails.appendChild(tableContainer);

    // 创建分页控件
    const paginationContainer = createPaginationControls(
      currentPage,
      totalPages,
      totalCount,
      startIndex + 1,
      endIndex,
    );
    peDetails.appendChild(paginationContainer);
  }

  /**
   * 创建分页控件
   * @param {number} page - 当前页
   * @param {number} totalPages - 总页数
   * @param {number} totalCount - 总条目数
   * @param {number} startIndex - 起始索引(从1开始)
   * @param {number} endIndex - 结束索引
   * @returns {HTMLElement}
   */
  function createPaginationControls(
    page,
    totalPages,
    totalCount,
    startIndex,
    endIndex,
  ) {
    const container = document.createElement("div");
    container.className = "pagination-container";
    container.style.display = "flex";
    container.style.justifyContent = "space-between";
    container.style.alignItems = "center";
    container.style.marginTop = "16px";
    container.style.padding = "12px";
    container.style.borderTop = "1px solid var(--vscode-panel-border)";

    // 左侧：显示范围信息
    const infoDiv = document.createElement("div");
    infoDiv.style.fontSize = "12px";
    infoDiv.style.color = "var(--vscode-descriptionForeground)";
    infoDiv.textContent = `${t("showing")} ${startIndex}-${endIndex} ${t("of")} ${totalCount}`;
    container.appendChild(infoDiv);

    // 右侧：分页按钮
    const buttonsDiv = document.createElement("div");
    buttonsDiv.style.display = "flex";
    buttonsDiv.style.gap = "8px";
    buttonsDiv.style.alignItems = "center";

    // 首页按钮
    const firstBtn = createPageButton("⟪", page > 1, () => {
      currentPage = 1;
      renderExportPage();
    });
    buttonsDiv.appendChild(firstBtn);

    // 上一页按钮
    const prevBtn = createPageButton("‹", page > 1, () => {
      currentPage--;
      renderExportPage();
    });
    buttonsDiv.appendChild(prevBtn);

    // 页码显示
    const pageInfo = document.createElement("span");
    pageInfo.style.fontSize = "12px";
    pageInfo.style.padding = "0 8px";
    pageInfo.textContent = `${page} / ${totalPages}`;
    buttonsDiv.appendChild(pageInfo);

    // 下一页按钮
    const nextBtn = createPageButton("›", page < totalPages, () => {
      currentPage++;
      renderExportPage();
    });
    buttonsDiv.appendChild(nextBtn);

    // 末页按钮
    const lastBtn = createPageButton("⟫", page < totalPages, () => {
      currentPage = totalPages;
      renderExportPage();
    });
    buttonsDiv.appendChild(lastBtn);

    container.appendChild(buttonsDiv);
    return container;
  }

  /**
   * 创建分页按钮
   * @param {string} text - 按钮文本
   * @param {boolean} enabled - 是否启用
   * @param {() => void} onClick - 点击回调
   * @returns {HTMLButtonElement}
   */
  function createPageButton(text, enabled, onClick) {
    const button = document.createElement("button");
    button.textContent = text;
    button.className = "pagination-button";
    button.style.padding = "4px 12px";
    button.style.border = "1px solid var(--vscode-button-border)";
    button.style.borderRadius = "2px";
    button.style.fontSize = "14px";
    button.style.cursor = enabled ? "pointer" : "not-allowed";
    button.style.backgroundColor = enabled
      ? "var(--vscode-button-secondaryBackground)"
      : "var(--vscode-button-secondaryBackground)";
    button.style.color = enabled
      ? "var(--vscode-button-secondaryForeground)"
      : "var(--vscode-disabledForeground)";
    button.style.opacity = enabled ? "1" : "0.5";
    button.disabled = !enabled;

    if (enabled) {
      button.addEventListener("click", onClick);
      button.addEventListener("mouseenter", () => {
        button.style.backgroundColor =
          "var(--vscode-button-secondaryHoverBackground)";
      });
      button.addEventListener("mouseleave", () => {
        button.style.backgroundColor =
          "var(--vscode-button-secondaryBackground)";
      });
    }

    return button;
  }

  // 分页相关变量
  /** @type {Array<string[]>} */
  let allExportRows = [];
  let currentPage = 1;
  const pageSize = 100; // 每页显示100条

  // 导入函数分页相关变量
  /** @type {Array<string[]>} */
  let allImportRows = [];
  let currentImportPage = 1;
  const importPageSize = 100; // 每页显示100条

  // 搜索相关变量
  /** @type {HTMLTableRowElement[]} */
  let currentSearchMatches = [];
  let currentSearchIndex = -1;

  /**
   * 显示搜索框
   */
  function showSearchBox() {
    const searchContainer = document.getElementById("searchContainer");
    const searchInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById("searchInput")
    );

    if (searchContainer) {
      searchContainer.style.display = "flex";
    }

    if (searchInput) {
      // 设置本地化的placeholder
      searchInput.placeholder = t("searchPlaceholder");

      // 清空之前的搜索
      searchInput.value = "";
      currentSearchMatches = [];
      currentSearchIndex = -1;
      updateSearchCount();

      // 绑定搜索事件（使用节流避免频繁搜索）
      searchInput.removeEventListener("input", handleSearchInput);
      searchInput.addEventListener("input", handleSearchInput);

      // 支持Enter键跳转到下一个匹配
      searchInput.removeEventListener("keydown", handleSearchKeydown);
      searchInput.addEventListener("keydown", handleSearchKeydown);
    }
  }

  /**
   * 隐藏搜索框
   */
  function hideSearchBox() {
    const searchContainer = document.getElementById("searchContainer");
    if (searchContainer) {
      searchContainer.style.display = "none";
    }
    clearSearchHighlights();
  }

  /**
   * 处理搜索输入
   */
  /** @type {any} */
  let searchTimeout = null;
  function handleSearchInput() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
      performSearch();
    }, 300); // 300ms防抖
  }

  /**
   * 处理搜索快捷键
   * @param {KeyboardEvent} e
   */
  function handleSearchKeydown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Enter: 上一个匹配
        navigateSearchResults(-1);
      } else {
        // Enter: 下一个匹配
        navigateSearchResults(1);
      }
    } else if (e.key === "Escape") {
      // Esc: 清空搜索
      const searchInput = /** @type {HTMLInputElement | null} */ (
        document.getElementById("searchInput")
      );
      if (searchInput) {
        searchInput.value = "";
        performSearch();
      }
    }
  }

  /**
   * 执行搜索
   */
  function performSearch() {
    const searchInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById("searchInput")
    );
    if (!searchInput) {
      return;
    }

    const searchText = searchInput.value.trim().toLowerCase();

    // 清除之前的高亮
    clearSearchHighlights();
    currentSearchMatches = [];
    currentSearchIndex = -1;

    if (!searchText) {
      updateSearchCount();
      return;
    }

    // 搜索表格行
    const table = peDetails?.querySelector(".pe-details-table");
    if (!table) {
      updateSearchCount();
      return;
    }

    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row, index) => {
      const cells = row.querySelectorAll("td");
      let matched = false;

      // 搜索所有单元格内容
      cells.forEach((cell) => {
        const text = cell.textContent?.toLowerCase() || "";
        if (text.includes(searchText)) {
          matched = true;
        }
      });

      if (matched) {
        row.classList.add("highlight");
        const tableRow = /** @type {HTMLTableRowElement} */ (row);
        currentSearchMatches.push(tableRow);
      }
    }); // 如果有匹配结果，高亮第一个
    if (currentSearchMatches.length > 0) {
      currentSearchIndex = 0;
      highlightCurrentMatch();
    }

    updateSearchCount();
  }

  /**
   * 清除搜索高亮
   */
  function clearSearchHighlights() {
    const table = peDetails?.querySelector(".pe-details-table");
    if (!table) {
      return;
    }

    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      row.classList.remove("highlight", "highlight-current");
    });
  }

  /**
   * 高亮当前匹配项
   */
  function highlightCurrentMatch() {
    if (
      currentSearchIndex < 0 ||
      currentSearchIndex >= currentSearchMatches.length
    ) {
      return;
    }

    // 移除之前的当前高亮
    currentSearchMatches.forEach((row) => {
      row.classList.remove("highlight-current");
    });

    // 添加当前高亮
    const currentRow = currentSearchMatches[currentSearchIndex];
    currentRow.classList.add("highlight-current");

    // 滚动到可见区域
    currentRow.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /**
   * 导航搜索结果
   * @param {number} direction - 1表示下一个，-1表示上一个
   */
  function navigateSearchResults(direction) {
    if (currentSearchMatches.length === 0) {
      return;
    }

    currentSearchIndex += direction;

    // 循环导航
    if (currentSearchIndex >= currentSearchMatches.length) {
      currentSearchIndex = 0;
    } else if (currentSearchIndex < 0) {
      currentSearchIndex = currentSearchMatches.length - 1;
    }

    highlightCurrentMatch();
    updateSearchCount();
  }

  /**
   * 更新搜索计数显示
   */
  function updateSearchCount() {
    const searchCount = document.getElementById("searchCount");
    if (!searchCount) {
      return;
    }

    if (currentSearchMatches.length === 0) {
      searchCount.textContent = "";
    } else {
      searchCount.textContent = `${currentSearchIndex + 1} / ${currentSearchMatches.length}`;
    }
  }

  /**
   * 函数名解码（demangle）- 参考demumble实现
   * 支持Microsoft (MSVC)、Itanium (GCC/Clang)、Rust等多种编译器符号
   * @param {string} mangled - 被编码的符号名称
   * @returns {string} - 解码后的函数名,如果无法解码则返回原始名称
   */
  function demangleFunctionName(mangled) {
    // 检查是否为合法的编码字符
    function isMsvcMangleChar(/** @type {string} */ c) {
      return (
        (c >= "a" && c <= "z") ||
        (c >= "A" && c <= "Z") ||
        (c >= "0" && c <= "9") ||
        "?_@$".includes(c)
      );
    }

    function isItaniumMangleChar(/** @type {string} */ c) {
      return (
        (c >= "a" && c <= "z") ||
        (c >= "A" && c <= "Z") ||
        (c >= "0" && c <= "9") ||
        c === "_" ||
        c === "$"
      );
    }

    function isRustMangleChar(/** @type {string} */ c) {
      return (
        (c >= "a" && c <= "z") ||
        (c >= "A" && c <= "Z") ||
        (c >= "0" && c <= "9") ||
        c === "_"
      );
    }

    // 检查是否为可能的符号前缀
    function isPlausibleItaniumPrefix(/** @type {string} */ s) {
      // Itanium符号以1-4个下划线+Z开头
      const prefix = s.substring(0, 5);
      return prefix.includes("_Z");
    }

    function isPlausibleRustPrefix(/** @type {string} */ s) {
      // Rust符号以_R开头
      return s.startsWith("_R");
    }

    // 尝试解码MSVC符号
    if (mangled.startsWith("?")) {
      return demangleMsvc(mangled);
    }

    // 尝试解码Itanium符号 (_Z开头)
    if (isPlausibleItaniumPrefix(mangled)) {
      return demangleItanium(mangled);
    }

    // 尝试解码Rust符号 (_R开头)
    if (isPlausibleRustPrefix(mangled)) {
      return demangleRust(mangled);
    }

    // 无法识别的符号,返回原始名称
    return mangled;
  }

  /**
   * 解码MSVC符号
   * @param {string} mangled
   * @returns {string}
   */
  function demangleMsvc(mangled) {
    try {
      let pos = 1; // 跳过开头的?
      const str = mangled;

      function peek() {
        return pos < str.length ? str[pos] : "";
      }

      function read() {
        return pos < str.length ? str[pos++] : "";
      }

      function readSourceName() {
        let name = "";
        // 处理模板名称: ?$name@template_args@
        if (peek() === "?" && pos + 1 < str.length && str[pos + 1] === "$") {
          pos += 2; // 跳过 ?$
          // 读取模板名称
          while (pos < str.length && str[pos] !== "@") {
            name += str[pos++];
          }

          // 读取并简化模板参数
          if (peek() === "@") {
            pos++; // 跳过 @
            let templateArgs = "";
            let depth = 1;
            const argStart = pos;

            while (pos < str.length && depth > 0) {
              const ch = str[pos];
              if (ch === "@") {
                // 检查下一个字符来判断是否结束
                if (
                  pos + 1 < str.length &&
                  str[pos + 1] !== "$" &&
                  str[pos + 1] !== "?"
                ) {
                  // 这是模板参数的结束
                  depth--;
                  if (depth === 0) {
                    templateArgs = str.substring(argStart, pos);
                    pos++; // 跳过结束的 @
                    break;
                  }
                }
              } else if (
                ch === "?" &&
                pos + 1 < str.length &&
                str[pos + 1] === "$"
              ) {
                // 嵌套模板
                depth++;
              }
              pos++;
            }

            // 简化模板参数显示
            if (templateArgs) {
              // MSVC 模板参数编码规则：
              // $0A@ = 0, $00@ = 1, $01@ = 2, etc.
              // $H = int, $D = char, $N = bool, etc.
              let simplifiedArgs = templateArgs;

              // 数字模板参数
              if (templateArgs.startsWith("$0")) {
                const numPart = templateArgs.substring(1);
                if (numPart === "0A") {
                  simplifiedArgs = "0";
                } else if (numPart.match(/^0[0-9A-F]$/)) {
                  // $00=1, $01=2, ... $09=10, $0A=0(循环), $0B=11, etc.
                  const hexDigit = numPart[1];
                  if (hexDigit >= "0" && hexDigit <= "9") {
                    simplifiedArgs = String(parseInt(hexDigit, 10) + 1);
                  } else {
                    simplifiedArgs = String(parseInt(hexDigit, 16));
                  }
                }
              }
              // 类型模板参数（简化显示）
              else if (templateArgs === "$H") {
                simplifiedArgs = "int";
              } else if (templateArgs === "$D") {
                simplifiedArgs = "char";
              } else if (templateArgs === "$_N") {
                simplifiedArgs = "bool";
              }

              name += `<${simplifiedArgs}>`;
            }
          }
          return name;
        }

        // 普通名称
        while (pos < str.length && str[pos] !== "@") {
          name += str[pos++];
        }
        return name;
      }

      function readQualifiedName() {
        const parts = [];
        while (pos < str.length) {
          if (peek() === "@") {
            pos++;
            if (peek() === "@") {
              pos++;
              break;
            }
            continue;
          }
          const part = readSourceName();
          if (part) {
            parts.push(part);
          }
        }
        return parts.reverse().join("::");
      }

      // 特殊操作符映射
      const specialNames = {
        0: "constructor",
        1: "destructor",
        2: "operator new",
        3: "operator delete",
        4: "operator=",
        5: "operator>>",
        6: "operator<<",
        7: "operator!",
        8: "operator==",
        9: "operator!=",
        A: "operator[]",
        C: "operator->",
        D: "operator*",
        E: "operator++",
        F: "operator--",
        G: "operator-",
        H: "operator+",
        I: "operator&",
        J: "operator->*",
        K: "operator/",
        L: "operator%",
        M: "operator<",
        N: "operator<=",
        O: "operator>",
        P: "operator>=",
        Q: "operator,",
        R: "operator()",
        S: "operator~",
        T: "operator^",
        U: "operator|",
        V: "operator&&",
        W: "operator||",
        X: "operator*=",
        Y: "operator+=",
        Z: "operator-=",
      };

      const extendedNames = {
        _0: "operator/=",
        _1: "operator%=",
        _2: "operator>>=",
        _3: "operator<<=",
        _4: "operator&=",
        _5: "operator|=",
        _6: "operator^=",
        _7: "`vftable'",
        _8: "`vbtable'",
        _9: "`vcall'",
        _A: "`typeof'",
        _B: "`local static guard'",
        _C: "`string'",
        _D: "`vbase destructor'",
        _E: "`vector deleting destructor'",
        _F: "`default constructor closure'",
        _G: "`scalar deleting destructor'",
        _H: "`vector constructor iterator'",
        _I: "`vector destructor iterator'",
        _J: "`vector vbase constructor iterator'",
        _K: "`virtual displacement map'",
        _L: "`eh vector constructor iterator'",
        _M: "`eh vector destructor iterator'",
        _N: "`eh vector vbase constructor iterator'",
        _O: "`copy constructor closure'",
        _P: "`udt returning'",
        _R: "RTTI Type Descriptor",
        _S: "`local vftable'",
        _T: "`local vftable constructor closure'",
        _U: "operator new[]",
        _V: "operator delete[]",
        _X: "`placement delete closure'",
        _Y: "`placement delete[] closure'",
      };

      // 解析函数参数类型
      function parseArgumentTypes() {
        // 跳过访问修饰符和调用约定 (如 QEAA, AEAA等)
        while (pos < str.length && /[A-Z]/.test(str[pos])) {
          const ch = str[pos];
          if (ch === "X" || ch === "Z") {
            break; // X=void, Z=结束
          }
          pos++;
        }

        if (pos >= str.length) {
          return "";
        } // 解析参数
        const args = [];
        while (pos < str.length && str[pos] !== "Z" && str[pos] !== "@") {
          const type = parseType();
          if (type) {
            args.push(type);
          } else {
            break;
          }
        }

        return args.length > 0 ? args.join(", ") : "void";
      }

      // 解析单个类型
      /**
       * @returns {string}
       */
      function parseType() {
        if (pos >= str.length) {
          return "";
        }

        const ch = str[pos++];

        // 基本类型
        const typeMap = {
          X: "void",
          D: "char",
          E: "unsigned char",
          F: "short",
          G: "unsigned short",
          H: "int",
          I: "unsigned int",
          J: "long",
          K: "unsigned long",
          M: "float",
          N: "double",
          _N: "bool",
          O: "long double",
          _J: "__int64",
          _K: "unsigned __int64",
        };

        // 修饰符
        if (ch === "P") {
          // 指针
          if (peek() === "E" && pos + 1 < str.length && str[pos + 1] === "A") {
            // PEA = 引用 &
            pos += 2;
            return parseType() + " &";
          } else if (peek() === "6") {
            // P6 = 函数指针
            pos++; // 跳过 6
            let returnType = parseType();
            if (peek() === "A") {
              pos++; // 跳过调用约定
            }
            let params = [];
            while (pos < str.length && str[pos] !== "Z" && str[pos] !== "@") {
              const paramType = parseType();
              if (paramType) {
                params.push(paramType);
              } else {
                break;
              }
            }
            if (peek() === "Z") {
              pos++; // 跳过结束符
            }
            const paramList = params.length > 0 ? params.join(", ") : "void";
            return `${returnType} (*)(${paramList})`;
          }
          return parseType() + " *";
        } else if (ch === "A") {
          // A开头可能是引用或其他
          if (peek() === "E") {
            pos++;
            return parseType() + " &";
          }
          return parseType();
        } else if (ch === "Q") {
          // Q = const
          return "const " + parseType();
        } else if (ch === "R") {
          // R = volatile
          return "volatile " + parseType();
        } else if (ch === "_") {
          // 扩展类型
          const next = peek();
          if (next === "N") {
            pos++;
            return "bool";
          } else if (next === "J") {
            pos++;
            return "__int64";
          } else if (next === "K") {
            pos++;
            return "unsigned __int64";
          }
        }

        // 检查基本类型映射
        // @ts-ignore
        if (typeMap[ch]) {
          // @ts-ignore
          return typeMap[ch];
        }

        // 未识别的类型，返回空
        return "";
      }

      // 检查特殊名称
      if (peek() === "?") {
        pos++;
        const opCode = read();
        let opName = "";

        if (opCode === "_") {
          const extCode = read();
          const key = "_" + extCode;
          // @ts-ignore
          opName = extendedNames[key] || `operator_${extCode}`;
        } else {
          // @ts-ignore
          opName = specialNames[opCode] || `operator${opCode}`;
        }

        const className = readQualifiedName();

        // 解析函数参数
        const params = parseArgumentTypes();

        if (opName === "constructor") {
          const simpleName = className.split("::").pop() || className;
          return `${className}::${simpleName}(${params})`;
        } else if (opName === "destructor") {
          const simpleName = className.split("::").pop() || className;
          return `${className}::~${simpleName}()`;
        }
        return `${className}::${opName}`;
      }

      // 普通函数或成员函数
      const funcName = readSourceName();
      const scope = readQualifiedName();

      // 解析函数参数
      const params = parseArgumentTypes();

      if (scope) {
        return `${scope}::${funcName}(${params})`;
      }
      return funcName ? `${funcName}(${params})` : mangled;
    } catch (e) {
      return mangled;
    }
  }

  /**
   * 解码Itanium C++ ABI符号 (GCC/Clang使用)
   * @param {string} mangled
   * @returns {string}
   */
  function demangleItanium(mangled) {
    // 简化的Itanium解码实现
    // 完整实现需要LLVM的Demangle库,这里只做基本解析
    try {
      // 去除前导下划线
      let symbol = mangled;
      while (symbol.startsWith("_") && symbol.length > 2) {
        symbol = symbol.substring(1);
      }

      if (!symbol.startsWith("Z")) {
        return mangled;
      }

      // 基本模式: _Z + 长度 + 名称
      let pos = 1; // 跳过Z
      const nameParts = [];

      while (pos < symbol.length) {
        // 读取长度
        let len = 0;
        while (
          pos < symbol.length &&
          symbol[pos] >= "0" &&
          symbol[pos] <= "9"
        ) {
          len = len * 10 + (symbol.charCodeAt(pos) - 48);
          pos++;
        }

        if (len === 0) {
          break;
        }

        // 读取名称部分
        const part = symbol.substring(pos, pos + len);
        nameParts.push(part);
        pos += len;

        // 检查是否还有更多部分
        if (pos >= symbol.length || symbol[pos] < "0" || symbol[pos] > "9") {
          break;
        }
      }

      if (nameParts.length > 0) {
        return nameParts.join("::") + "()";
      }

      return mangled;
    } catch (e) {
      return mangled;
    }
  }

  /**
   * 解码Rust符号
   * @param {string} mangled
   * @returns {string}
   */
  function demangleRust(mangled) {
    // 简化的Rust解码实现
    // Rust v0规范:
    // https://rust-lang.github.io/rfcs/2603-rust-symbol-name-mangling-v0.html
    try {
      if (!mangled.startsWith("_R")) {
        return mangled;
      }

      // 基本解析,移除哈希和特殊字符
      let result = mangled.substring(2);

      // 移除结尾的哈希值 (通常是17个十六进制字符)
      result = result.replace(/[0-9a-f]{17}$/, "");

      // 将路径分隔符转换为::
      result = result.replace(/(\d+)/g, (match, num) => {
        return "::";
      });

      // 清理多余的分隔符
      result = result.replace(/^::+|::+$/g, "").replace(/::+/g, "::");

      return result || mangled;
    } catch (e) {
      return mangled;
    }
  }

  function showImportsOverview() {
    if (!parsedData || !peDetails || !detailsTitle) {
      return;
    }

    if (!parsedData.imports || parsedData.imports.length === 0) {
      detailsTitle.textContent = t("importsTitle");
      showEmptyMessage(t("noImportsFound"));
      hideSearchBox();
      return;
    }

    // 收集所有导入函数
    /** @type {Array<{dll: string, name: string, type: string}>} */
    const allFunctions = [];
    let totalFunctions = 0;

    parsedData.imports.forEach((/** @type {ImportDLL} */ dll) => {
      if (dll.functions) {
        dll.functions.forEach((/** @type {ImportFunction} */ func) => {
          allFunctions.push({
            dll: dll.name,
            name: func.name || `序号 ${func.ordinal}`,
            type: func.name ? "按名称" : "按序号",
          });
          totalFunctions++;
        });
      }
    });

    detailsTitle.textContent = `${t("importFunctionsOverview")} (${t(
      "importFunctionsCount",
    )
      .replace("{totalFunctions}", totalFunctions)
      .replace("{dllCount}", parsedData.imports.length)})`;
    peDetails.innerHTML = "";

    // 缓存所有导入行数据
    allImportRows = allFunctions.map((func) => [
      func.dll,
      func.name,
      func.type,
    ]);

    // 重置到第一页
    currentImportPage = 1;
    renderImportPage();

    // 显示搜索框
    showSearchBox();
  }

  /**
   * @param {ImportDLL} dll
   */
  function showDllImports(dll) {
    if (!dll || !peDetails || !detailsTitle) {
      return;
    }

    const funcCount = dll.functions ? dll.functions.length : 0;
    detailsTitle.textContent = `${dll.name} - ${t(
      "importedFunctionsTitle",
    ).replace("{dllName}", dll.name)} (${t("importedFunctionsCount").replace(
      "{count}",
      funcCount,
    )})`;
    peDetails.innerHTML = "";

    if (!dll.functions || dll.functions.length === 0) {
      showEmptyMessage(`${dll.name} ${t("noImportsFound").toLowerCase()}`);
      hideSearchBox();
      return;
    }

    // 缓存当前DLL的函数行数据
    allImportRows = dll.functions.map((/** @type {ImportFunction} */ func) => {
      return [
        dll.name,
        func.name || `${t("ordinalPrefix")}${func.ordinal}`,
        func.name ? t("byName") : t("byOrdinal"),
      ];
    });

    // 重置到第一页
    currentImportPage = 1;
    renderImportPage();

    // 显示搜索框
    showSearchBox();
  }

  /**
   * 渲染导入函数的当前页
   */
  function renderImportPage() {
    if (!peDetails) {
      return;
    }

    const totalCount = allImportRows.length;
    const totalPages = Math.ceil(totalCount / importPageSize);
    const startIndex = (currentImportPage - 1) * importPageSize;
    const endIndex = Math.min(startIndex + importPageSize, totalCount);
    const currentPageRows = allImportRows.slice(startIndex, endIndex);

    // 清空详情区域
    peDetails.innerHTML = "";

    // 创建表格容器（带滚动）
    const tableContainer = document.createElement("div");
    tableContainer.className = "import-table-container";
    tableContainer.style.overflowX = "auto";
    tableContainer.style.overflowY = "auto";
    tableContainer.style.maxHeight = "calc(100vh - 200px)";
    tableContainer.style.marginBottom = "0";

    // 创建表格
    const tableFragment = createTable(
      t("allImportFunctions"),
      [t("dllColumn"), t("functionNameColumn"), t("typeColumn")],
      currentPageRows,
      ["pe-details-value", "pe-details-value", "pe-details-value"],
    );
    tableContainer.appendChild(tableFragment);
    peDetails.appendChild(tableContainer);

    // 创建分页控件
    const paginationContainer = createImportPaginationControls(
      currentImportPage,
      totalPages,
      totalCount,
      startIndex + 1,
      endIndex,
    );
    peDetails.appendChild(paginationContainer);
  }

  /**
   * 创建导入函数分页控件
   * @param {number} page - 当前页
   * @param {number} totalPages - 总页数
   * @param {number} totalCount - 总条目数
   * @param {number} startIndex - 起始索引(从1开始)
   * @param {number} endIndex - 结束索引
   * @returns {HTMLElement}
   */
  function createImportPaginationControls(
    page,
    totalPages,
    totalCount,
    startIndex,
    endIndex,
  ) {
    const container = document.createElement("div");
    container.className = "pagination-container";
    container.style.display = "flex";
    container.style.justifyContent = "space-between";
    container.style.alignItems = "center";
    container.style.marginTop = "16px";
    container.style.padding = "12px";
    container.style.borderTop = "1px solid var(--vscode-panel-border)";

    // 左侧：显示范围信息
    const infoDiv = document.createElement("div");
    infoDiv.style.fontSize = "12px";
    infoDiv.style.color = "var(--vscode-descriptionForeground)";
    infoDiv.textContent = `${t("showing")} ${startIndex}-${endIndex} ${t("of")} ${totalCount}`;
    container.appendChild(infoDiv);

    // 右侧：分页按钮
    const buttonsDiv = document.createElement("div");
    buttonsDiv.style.display = "flex";
    buttonsDiv.style.gap = "8px";
    buttonsDiv.style.alignItems = "center";

    // 首页按钮
    const firstBtn = createPageButton("⟪", page > 1, () => {
      currentImportPage = 1;
      renderImportPage();
    });
    buttonsDiv.appendChild(firstBtn);

    // 上一页按钮
    const prevBtn = createPageButton("‹", page > 1, () => {
      currentImportPage--;
      renderImportPage();
    });
    buttonsDiv.appendChild(prevBtn);

    // 页码显示
    const pageInfo = document.createElement("span");
    pageInfo.style.fontSize = "12px";
    pageInfo.style.padding = "0 8px";
    pageInfo.textContent = `${page} / ${totalPages}`;
    buttonsDiv.appendChild(pageInfo);

    // 下一页按钮
    const nextBtn = createPageButton("›", page < totalPages, () => {
      currentImportPage++;
      renderImportPage();
    });
    buttonsDiv.appendChild(nextBtn);

    // 末页按钮
    const lastBtn = createPageButton("⟫", page < totalPages, () => {
      currentImportPage = totalPages;
      renderImportPage();
    });
    buttonsDiv.appendChild(lastBtn);

    container.appendChild(buttonsDiv);
    return container;
  }

  /**
   * @param {any} value
   * @param {string} path
   * @returns {DocumentFragment}
   */
  function generateValueDetails(value, path) {
    const fragment = document.createDocumentFragment();
    const container = document.createElement("div");
    container.className = "pe-details-section";

    if (typeof value === "number" || typeof value === "bigint") {
      const numValue = Number(value);
      const rows = [
        [t("decimal"), String(numValue)],
        [t("hexadecimal"), `0x${numValue.toString(16).toUpperCase()}`],
        [t("binary"), numValue.toString(2)],
      ];
      container.appendChild(
        createTable(t("numericDetails"), [t("property"), t("value")], rows, [
          "",
          "pe-details-value",
        ]),
      );
    } else if (typeof value === "string") {
      const rows = [
        [t("stringType"), value],
        [t("length"), String(value.length)],
        [
          t("hexadecimal"),
          Array.from(value)
            .map((c) =>
              c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"),
            )
            .join(" "),
        ],
      ];
      container.appendChild(
        createTable(t("stringDetails"), [t("property"), t("value")], rows, [
          "",
          "pe-details-value",
        ]),
      );
    } else if (typeof value === "object" && value !== null) {
      const rows = [];
      for (const [key, val] of Object.entries(value)) {
        if (typeof val === "number" || typeof val === "bigint") {
          const numVal = Number(val);
          rows.push([
            key,
            String(numVal),
            `0x${numVal.toString(16).toUpperCase()}`,
          ]);
        } else if (typeof val === "string") {
          rows.push([key, val, "-"]);
        } else if (Array.isArray(val)) {
          rows.push([
            key,
            t("arrayWithLength").replace("{length}", val.length),
            "-",
          ]);
        } else if (typeof val === "object" && val !== null) {
          rows.push([key, t("objectType"), "-"]);
        } else {
          rows.push([key, String(val), "-"]);
        }
      }
      container.appendChild(
        createTable(
          t("structureDetails"),
          [t("field"), t("value"), t("hexadecimal")],
          rows,
          ["", "pe-details-value", "pe-details-hex"],
        ),
      );
    } else {
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(value, null, 2);
      container.appendChild(pre);
    }

    fragment.appendChild(container);
    return fragment;
  }

  /**
   * 显示资源总览
   */
  function showResourcesOverview() {
    if (!parsedData || !peDetails || !detailsTitle) {
      return;
    }

    hideSearchBox();

    detailsTitle.textContent = t("resourceOverview");
    peDetails.innerHTML = "";

    // 检查是否有资源数据
    if (
      !parsedData.resources ||
      Object.keys(parsedData.resources).length === 0
    ) {
      showEmptyMessage(t("noResourcesFound"));
      return;
    }

    // 查找.rsrc资源节
    const rsrcSection = parsedData.sections
      ? parsedData.sections.find(
          (s) => s.Name && s.Name.replace(/\0/g, "").toLowerCase() === ".rsrc",
        )
      : null;

    if (rsrcSection) {
      // 显示资源节基本信息
      const rows = [
        [t("sectionName"), ".rsrc", t("resourceSection")],
        [
          t("virtualAddress"),
          formatAddress(rsrcSection.VirtualAddress || 0),
          t("memoryAddress"),
        ],
        [
          t("virtualSize"),
          String(rsrcSection.VirtualSize || 0),
          `${rsrcSection.VirtualSize} ${t("bytes")}`,
        ],
        [
          t("rawDataPointer"),
          formatAddress(rsrcSection.PointerToRawData || 0),
          t("fileOffset"),
        ],
        [
          t("rawDataSize"),
          String(rsrcSection.SizeOfRawData || 0),
          `${rsrcSection.SizeOfRawData} ${t("bytes")}`,
        ],
        [
          t("characteristics"),
          `0x${(rsrcSection.Characteristics || 0).toString(16).toUpperCase()}`,
          t("sectionFlags"),
        ],
      ];

      peDetails.appendChild(
        createTable(
          t("resourceSectionInfo"),
          [t("field"), t("value"), t("description")],
          rows,
          ["", "pe-details-value", ""],
        ),
      );
    }

    // 统计资源类型
    const resourceTypeMap = {
      1: t("cursor"),
      2: t("bitmap"),
      3: t("icon"),
      4: t("menu"),
      5: t("stringTable"),
      6: t("accelerator"),
      9: t("rcData"),
      10: t("cursorGroup"),
      12: t("iconGroup"),
      14: t("version"),
      16: t("manifest"),
      24: t("unknownType"),
    };

    /** @type {Record<number, string>} */
    const resourceTypeMapTyped = resourceTypeMap;

    const typeRows = [];
    let totalResources = 0;

    Object.keys(parsedData.resources)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((typeNum) => {
        const typeId = Number(typeNum);
        if (!parsedData || !parsedData.resources) {
          return;
        }
        const entries = parsedData.resources[typeId];
        const count = entries ? entries.length : 0;
        totalResources += count;

        const typeName = resourceTypeMapTyped[typeId] || t("unknownType");
        typeRows.push([
          String(typeId),
          typeName,
          String(count),
          `${entries.reduce((sum, e) => sum + e.size, 0)} ${t("bytes")}`,
        ]);
      });

    typeRows.push(["", t("total"), String(totalResources), ""]);

    peDetails.appendChild(
      createTable(
        t("parsedResourceTypes"),
        [t("typeId"), t("name"), t("count"), t("totalSize")],
        typeRows,
        ["pe-details-value", "", "pe-details-value", "pe-details-value"],
      ),
    );

    // 提示信息
    const hint = document.createElement("p");
    hint.style.marginTop = "20px";
    hint.style.color = "var(--vscode-descriptionForeground)";
    hint.textContent = t("resourceHint");
    peDetails.appendChild(hint);
  }

  /**
   * 辅助函数：在容器中显示单个图标
   * @param {any} entry - 图标资源条目
   * @param {number|string} iconId - 图标ID
   * @param {HTMLElement} container - 容器元素
   * @param {string} logPrefix - 日志前缀
   */
  function showIconInContainer(entry, iconId, container, logPrefix) {
    showIconInContainerWithSize(
      entry,
      iconId,
      container,
      logPrefix,
      null,
      null,
      null,
    );
  }

  /**
   * 辅助函数：在容器中显示单个图标(带尺寸信息)
   * @param {any} entry - 图标资源条目
   * @param {number|string} iconId - 图标ID
   * @param {HTMLElement} container - 容器元素
   * @param {string} logPrefix - 日志前缀
   * @param {number|null} width - 宽度
   * @param {number|null} height - 高度
   * @param {number|null} bitCount - 位深度
   */
  function showIconInContainerWithSize(
    entry,
    iconId,
    container,
    logPrefix,
    width,
    height,
    bitCount,
  ) {
    try {
      console.log(`[Icon ${logPrefix}] Starting to process icon ID ${iconId}`);

      // 获取图标数据
      /** @type {any} */
      const entryData = entry.data;
      const dataArray = entryData.data || entryData;
      const iconData = new Uint8Array(dataArray);

      console.log(
        `[Icon ${logPrefix}] Icon data size: ${iconData.length} bytes`,
      );

      let url;
      let blob;
      let fileExtension = "ico"; // 默认扩展名

      // 检查是否是PNG格式
      if (
        iconData.length > 4 &&
        iconData[0] === 0x89 &&
        iconData[1] === 0x50 &&
        iconData[2] === 0x4e &&
        iconData[3] === 0x47
      ) {
        console.log(`[Icon ${logPrefix}] Detected PNG format`);
        blob = new Blob([iconData], { type: "image/png" });
        fileExtension = "png"; // PNG格式
      } else {
        // BMP格式 - 构建ICO文件
        console.log(
          `[Icon ${logPrefix}] Detected BMP format - building ICO file`,
        );

        const headerSize =
          iconData[0] |
          (iconData[1] << 8) |
          (iconData[2] << 16) |
          (iconData[3] << 24);

        if (headerSize === 40) {
          const width =
            iconData[4] |
            (iconData[5] << 8) |
            (iconData[6] << 16) |
            (iconData[7] << 24);
          const fullHeight =
            iconData[8] |
            (iconData[9] << 8) |
            (iconData[10] << 16) |
            (iconData[11] << 24);
          const actualHeight = Math.floor(fullHeight / 2);
          const bpp = iconData[14] | (iconData[15] << 8);

          // 构建ICO文件：ICONDIR(6) + ICONDIRENTRY(16) + 图标数据
          const icoSize = 6 + 16 + iconData.length;
          const icoData = new Uint8Array(icoSize);

          // ICONDIR (6字节)
          icoData[0] = 0;
          icoData[1] = 0; // Reserved
          icoData[2] = 1;
          icoData[3] = 0; // Type: 1 = ICO
          icoData[4] = 1;
          icoData[5] = 0; // Count: 1 image

          // ICONDIRENTRY (16字节)
          icoData[6] = width > 255 ? 0 : width; // Width (0 means 256)
          icoData[7] = actualHeight > 255 ? 0 : actualHeight; // Height
          icoData[8] = 0; // Color count
          icoData[9] = 0; // Reserved
          icoData[10] = 1;
          icoData[11] = 0; // Color planes
          icoData[12] = bpp & 0xff;
          icoData[13] = (bpp >> 8) & 0xff; // Bits per pixel
          icoData[14] = iconData.length & 0xff;
          icoData[15] = (iconData.length >> 8) & 0xff;
          icoData[16] = (iconData.length >> 16) & 0xff;
          icoData[17] = (iconData.length >> 24) & 0xff;
          icoData[18] = 22;
          icoData[19] = 0;
          icoData[20] = 0;
          icoData[21] = 0;

          // 复制BMP数据
          icoData.set(iconData, 22);

          blob = new Blob([icoData], { type: "image/x-icon" });
        } else {
          console.warn(
            `[Icon ${logPrefix}] Unsupported header size: ${headerSize}`,
          );
          blob = new Blob([iconData], { type: "application/octet-stream" });
        }
      }

      url = URL.createObjectURL(blob);

      const iconWrapper = document.createElement("div");
      iconWrapper.style.textAlign = "center";
      iconWrapper.style.padding = "12px";
      iconWrapper.style.border = "1px solid var(--vscode-panel-border)";
      iconWrapper.style.borderRadius = "4px";
      iconWrapper.style.minWidth = "120px";

      // 信息标签(在图标上方)
      const infoLabel = document.createElement("div");
      infoLabel.style.fontSize = "11px";
      infoLabel.style.marginBottom = "8px";
      infoLabel.style.lineHeight = "1.4";
      infoLabel.style.color = "var(--vscode-descriptionForeground)";

      if (width !== null && height !== null) {
        const idStr = typeof iconId === "string" ? iconId : `#${iconId}`;
        infoLabel.innerHTML =
          `<div style="font-weight: bold; color: var(--vscode-foreground);">${
            idStr
          }</div>` +
          `<div>${width}×${height}</div>` +
          (bitCount ? `<div>${bitCount}${t("bitSuffix")}</div>` : "");
      } else {
        const idStr = typeof iconId === "string" ? iconId : `#${iconId}`;
        infoLabel.innerHTML = `<div style="font-weight: bold; color: var(--vscode-foreground);">${
          idStr
        }</div>`;
      }

      iconWrapper.appendChild(infoLabel);

      const img = document.createElement("img");
      img.src = url;
      img.style.maxWidth = "64px";
      img.style.maxHeight = "64px";
      img.style.display = "block";
      img.style.margin = "0 auto";
      img.style.border = "1px solid var(--vscode-widget-border)";
      img.style.borderRadius = "2px";
      img.style.cursor = "pointer";
      img.title = t("clickToSaveIcon");

      // 点击图标保存文件
      img.addEventListener("click", () => {
        const idStr = typeof iconId === "string" ? iconId : iconId;
        const sizeStr = width && height ? `_${width}x${height}` : "";
        const filename = `icon_${idStr}${sizeStr}.${fileExtension}`;

        // 创建下载链接
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();

        console.log(`[Icon ${logPrefix}] Downloading as ${filename}`);
      });

      img.onload = () => {
        console.log(
          `[Icon ${logPrefix}] ✓ Loaded: ${img.naturalWidth}x${
            img.naturalHeight
          }`,
        );
      };

      img.onerror = (e) => {
        console.error(`[Icon ${logPrefix}] ✗ Load failed:`, e);
        img.style.display = "none";
        const errorText = document.createElement("div");
        errorText.textContent = t("cannotDisplay");
        errorText.style.fontSize = "12px";
        errorText.style.marginTop = "8px";
        errorText.style.color = "var(--vscode-errorForeground)";
        iconWrapper.appendChild(errorText);
      };

      iconWrapper.appendChild(img);

      container.appendChild(iconWrapper);
    } catch (error) {
      console.error(`[Icon ${logPrefix}] Exception:`, error);
    }
  }

  /**
   * 显示特定资源类型
   * @param {string} resourceType - 资源类型ID
   */
  function showResourceType(resourceType) {
    if (!parsedData || !peDetails || !detailsTitle) {
      return;
    }

    hideSearchBox();

    const typeId = Number(resourceType);

    // 资源类型映射
    const resourceTypeMap = {
      1: { name: t("cursor"), type: 1, desc: t("cursorDesc") },
      2: { name: t("bitmap"), type: 2, desc: t("bitmapDesc") },
      3: { name: t("icon"), type: 3, desc: t("iconDesc") },
      4: { name: t("menu"), type: 4, desc: t("menuDesc") },
      5: { name: t("stringTable"), type: 6, desc: t("stringTableDesc") },
      6: { name: t("accelerator"), type: 9, desc: t("acceleratorDesc") },
      9: { name: t("rcData"), type: 10, desc: t("rcDataDesc") },
      10: { name: t("cursorGroup"), type: 12, desc: t("cursorGroupDesc") },
      12: { name: t("iconGroup"), type: 14, desc: t("iconGroupDesc") },
      14: { name: t("version"), type: 16, desc: t("versionDesc") },
      16: { name: t("manifest"), type: 24, desc: t("manifestDesc") },
    };

    /** @type {Record<number, {name: string, type: number, desc: string}>} */
    const resourceTypeMapTyped = resourceTypeMap;

    const resInfo = resourceTypeMapTyped[typeId] || {
      name: t("resourceTypeId").replace("{id}", typeId),
      type: typeId,
      desc: t("unknownResourceType"),
    };

    detailsTitle.textContent = resInfo.name;
    peDetails.innerHTML = "";

    // 检查是否有此类型的资源
    if (!parsedData.resources || !parsedData.resources[typeId]) {
      showEmptyMessage(
        `${t("noResourcesFound").toLowerCase()} ${resInfo.name}.`,
      );
      return;
    }

    const entries = parsedData.resources[typeId];

    // 显示资源列表
    const resourceRows = entries.map((entry, index) => {
      const idStr = typeof entry.id === "string" ? entry.id : `#${entry.id}`;
      const sizeStr = `${entry.size} ${t("bytes")}`;
      return [
        String(index + 1),
        idStr,
        sizeStr,
        entry.codePage ? String(entry.codePage) : t("na"),
      ];
    });

    peDetails.appendChild(
      createTable(
        t("resourceList"),
        [t("serialNumber"), t("idOrName"), t("size"), t("codePage")],
        resourceRows,
        [
          "pe-details-value",
          "pe-details-value",
          "pe-details-value",
          "pe-details-value",
        ],
      ),
    );

    // 特殊处理：图标显示
    if (typeId === 3 && entries.length > 0) {
      const iconTitle = document.createElement("h4");
      iconTitle.textContent = t("iconPreview");
      iconTitle.style.marginTop = "20px";
      peDetails.appendChild(iconTitle);

      const iconContainer = document.createElement("div");
      iconContainer.style.display = "flex";
      iconContainer.style.flexWrap = "wrap";
      iconContainer.style.gap = "10px";
      iconContainer.style.marginTop = "10px";

      entries.forEach((entry, index) => {
        showIconInContainer(entry, entry.id, iconContainer, String(index));
      });

      peDetails.appendChild(iconContainer);
    }

    // 特殊处理：位图显示
    if (typeId === 2 && entries.length > 0) {
      const bitmapTitle = document.createElement("h4");
      bitmapTitle.textContent = t("bitmapPreview");
      bitmapTitle.style.marginTop = "20px";
      peDetails.appendChild(bitmapTitle);

      const bitmapContainer = document.createElement("div");
      bitmapContainer.style.display = "flex";
      bitmapContainer.style.flexWrap = "wrap";
      bitmapContainer.style.gap = "15px";
      bitmapContainer.style.marginTop = "10px";

      entries.forEach((entry, index) => {
        try {
          /** @type {any} */
          const entryData = entry.data;
          const dataArray = entryData.data || entryData;
          const dibData = new Uint8Array(dataArray);

          // PE资源中的位图缺少BITMAPFILEHEADER (14字节)
          // 需要手动构建完整的BMP文件

          // 读取BITMAPINFOHEADER的信息
          const headerSize =
            dibData[0] |
            (dibData[1] << 8) |
            (dibData[2] << 16) |
            (dibData[3] << 24);
          const width =
            dibData[4] |
            (dibData[5] << 8) |
            (dibData[6] << 16) |
            (dibData[7] << 24);
          const height =
            dibData[8] |
            (dibData[9] << 8) |
            (dibData[10] << 16) |
            (dibData[11] << 24);
          const bitCount = dibData[14] | (dibData[15] << 8);

          // 计算调色板大小（如果有）
          let paletteSize = 0;
          if (bitCount <= 8) {
            const colorsUsed =
              dibData[32] |
              (dibData[33] << 8) |
              (dibData[34] << 16) |
              (dibData[35] << 24);
            paletteSize = (colorsUsed || 1 << bitCount) * 4;
          }

          // 像素数据偏移 = 14字节文件头 + 信息头 + 调色板
          const pixelDataOffset = 14 + headerSize + paletteSize;

          // 构建BITMAPFILEHEADER (14字节)
          const fileHeader = new Uint8Array(14);
          fileHeader[0] = 0x42; // 'B'
          fileHeader[1] = 0x4d; // 'M'

          // 文件大小 = 文件头(14) + DIB数据
          const fileSize = 14 + dibData.length;
          fileHeader[2] = fileSize & 0xff;
          fileHeader[3] = (fileSize >> 8) & 0xff;
          fileHeader[4] = (fileSize >> 16) & 0xff;
          fileHeader[5] = (fileSize >> 24) & 0xff;

          // 保留字段
          fileHeader[6] = 0;
          fileHeader[7] = 0;
          fileHeader[8] = 0;
          fileHeader[9] = 0;

          // 像素数据偏移
          fileHeader[10] = pixelDataOffset & 0xff;
          fileHeader[11] = (pixelDataOffset >> 8) & 0xff;
          fileHeader[12] = (pixelDataOffset >> 16) & 0xff;
          fileHeader[13] = (pixelDataOffset >> 24) & 0xff;

          // 合并文件头和DIB数据
          const bmpData = new Uint8Array(fileHeader.length + dibData.length);
          bmpData.set(fileHeader, 0);
          bmpData.set(dibData, fileHeader.length);

          // 创建位图容器
          const bitmapWrapper = document.createElement("div");
          bitmapWrapper.style.border = "1px solid var(--vscode-panel-border)";
          bitmapWrapper.style.padding = "10px";
          bitmapWrapper.style.borderRadius = "4px";
          bitmapWrapper.style.backgroundColor =
            "var(--vscode-editor-background)";

          // 位图信息
          const bitmapId =
            typeof entry.id === "string" ? entry.id : `#${entry.id}`;
          const infoDiv = document.createElement("div");
          infoDiv.style.marginBottom = "8px";
          infoDiv.style.fontSize = "11px";
          infoDiv.style.color = "var(--vscode-descriptionForeground)";
          infoDiv.textContent = `位图 ${bitmapId} (${width}x${Math.abs(height)}, ${bitCount}bit)`;
          bitmapWrapper.appendChild(infoDiv);

          // 创建Blob和URL
          const blob = new Blob([bmpData], { type: "image/bmp" });
          const url = URL.createObjectURL(blob);

          // 创建图片元素
          const img = document.createElement("img");
          img.src = url;
          img.style.maxWidth = "300px";
          img.style.maxHeight = "300px";
          img.style.display = "block";
          img.style.border = "1px solid var(--vscode-input-border)";
          img.style.backgroundColor = "#ffffff";
          img.style.cursor = "pointer";
          img.title = "点击保存位图";

          // 点击图片保存
          img.addEventListener("click", () => {
            const a = document.createElement("a");
            a.href = url;
            a.download = `bitmap_${bitmapId.replace(/[^a-zA-Z0-9]/g, "_")}.bmp`;
            a.click();
          });

          img.onload = () => {
            // 添加实际尺寸信息
            const sizeInfo = document.createElement("div");
            sizeInfo.style.marginTop = "5px";
            sizeInfo.style.fontSize = "10px";
            sizeInfo.style.color = "var(--vscode-descriptionForeground)";
            sizeInfo.textContent = `${img.naturalWidth}x${img.naturalHeight}`;
            bitmapWrapper.appendChild(sizeInfo);
          };

          img.onerror = () => {
            img.style.display = "none";
            const errorText = document.createElement("div");
            errorText.textContent = t("bitmapLoadFailed");
            errorText.style.color = "var(--vscode-errorForeground)";
            errorText.style.fontSize = "11px";
            bitmapWrapper.appendChild(errorText);
          };

          bitmapWrapper.appendChild(img);
          bitmapContainer.appendChild(bitmapWrapper);
        } catch (error) {
          console.error(`Failed to display bitmap ${index}:`, error);
        }
      });

      peDetails.appendChild(bitmapContainer);
    }

    // 特殊处理：图标组显示(type=14)
    if (typeId === 14 && entries.length > 0) {
      // 获取所有图标资源
      const allIcons = parsedData.resources[3] || [];

      // 遍历每个图标组
      entries.forEach((groupEntry, groupIndex) => {
        const groupTitle = document.createElement("h4");
        const groupId =
          typeof groupEntry.id === "string"
            ? groupEntry.id
            : `#${groupEntry.id}`;
        groupTitle.textContent = `${t("iconGroup")} ${groupId}`;
        groupTitle.style.marginTop = groupIndex === 0 ? "20px" : "30px";
        peDetails.appendChild(groupTitle);

        try {
          /** @type {any} */
          const groupData = groupEntry.data;
          const groupArray = groupData.data || groupData;
          const groupBytes = new Uint8Array(groupArray);

          // 解析图标组结构
          // GRPICONDIR: Reserved(2) + Type(2) + Count(2) + GRPICONDIRENTRY[Count]
          if (groupBytes.length < 6) {
            console.warn(`[Icon Group ${groupIndex}] Data too small`);
            return;
          }

          const reserved = groupBytes[0] | (groupBytes[1] << 8);
          const type = groupBytes[2] | (groupBytes[3] << 8);
          const iconCount = groupBytes[4] | (groupBytes[5] << 8);

          console.log(
            `[Icon Group ${groupIndex}] ID: ${groupId}, Count: ${iconCount}`,
          );

          // 收集所有图标信息
          const iconInfos = [];

          // 解析每个GRPICONDIRENTRY (14字节)
          for (
            let i = 0;
            i < iconCount && 6 + i * 14 + 14 <= groupBytes.length;
            i++
          ) {
            const entryOffset = 6 + i * 14;
            const width = groupBytes[entryOffset] || 256; // 0表示256
            const height = groupBytes[entryOffset + 1] || 256;
            const colorCount = groupBytes[entryOffset + 2];
            const reserved2 = groupBytes[entryOffset + 3];
            const planes =
              groupBytes[entryOffset + 4] | (groupBytes[entryOffset + 5] << 8);
            const bitCount =
              groupBytes[entryOffset + 6] | (groupBytes[entryOffset + 7] << 8);
            const bytesInRes =
              groupBytes[entryOffset + 8] |
              (groupBytes[entryOffset + 9] << 8) |
              (groupBytes[entryOffset + 10] << 16) |
              (groupBytes[entryOffset + 11] << 24);
            const iconId =
              groupBytes[entryOffset + 12] |
              (groupBytes[entryOffset + 13] << 8);

            console.log(
              `[Icon Group ${groupIndex}] Entry ${i}: iconId=${
                iconId
              }, size=${width}x${height}, bits=${bitCount}`,
            );

            // 查找对应的图标资源
            const iconEntry = allIcons.find((icon) => icon.id === iconId);

            if (iconEntry) {
              iconInfos.push({
                entry: iconEntry,
                iconId: iconId,
                width: width,
                height: height,
                bitCount: bitCount,
                size: width * height, // 用于排序
              });
            } else {
              console.warn(
                `[Icon Group ${groupIndex}] Icon ${iconId} not found`,
              );
            }
          }

          // 按尺寸从大到小排序
          iconInfos.sort((a, b) => b.size - a.size);

          // 创建图标容器
          const iconContainer = document.createElement("div");
          iconContainer.style.display = "flex";
          iconContainer.style.flexWrap = "wrap";
          iconContainer.style.gap = "10px";
          iconContainer.style.marginTop = "10px";

          // 显示排序后的图标
          iconInfos.forEach((info, index) => {
            showIconInContainerWithSize(
              info.entry,
              info.iconId,
              iconContainer,
              `${groupIndex}-${index}`,
              info.width,
              info.height,
              info.bitCount,
            );
          });

          peDetails.appendChild(iconContainer);
        } catch (error) {
          console.error(`[Icon Group ${groupIndex}] Parse error:`, error);
        }
      });
    }

    // 特殊处理：字符串表显示
    if (typeId === 6 && entries.length > 0) {
      const stringTableTitle = document.createElement("h4");
      stringTableTitle.textContent = t("stringContent");
      stringTableTitle.style.marginTop = "20px";
      peDetails.appendChild(stringTableTitle);

      try {
        // 解析所有字符串表条目
        /** @type {Array<{id: number, value: string, length: number}>} */
        const allStrings = [];

        entries.forEach((entry, entryIndex) => {
          const blockId =
            typeof entry.id === "number"
              ? entry.id
              : parseInt(String(entry.id).replace(/^#/, ""), 10);

          try {
            /** @type {any} */
            const entryData = entry.data;
            const dataArray = entryData.data || entryData;
            const stringData = parseStringTableBlock(dataArray, blockId);

            if (stringData && stringData.length > 0) {
              allStrings.push(...stringData);
            }
          } catch (error) {
            console.warn(
              `Failed to parse string table entry ${entryIndex}:`,
              error,
            );
          }
        });

        if (allStrings.length > 0) {
          // 按字符串ID排序
          allStrings.sort((a, b) => a.id - b.id);

          // 创建自定义字符串表格（使用文本框显示内容）
          const tableContainer = document.createElement("div");
          tableContainer.style.marginTop = "10px";

          const table = document.createElement("table");
          table.className = "pe-string-table";
          table.style.width = "100%";
          table.style.borderCollapse = "collapse";
          table.style.marginBottom = "15px";

          // 表头
          const thead = document.createElement("thead");
          const headerRow = document.createElement("tr");
          ["ID", "长度", "内容"].forEach((header, index) => {
            const th = document.createElement("th");
            th.textContent = header;
            th.style.cssText =
              "padding: 4px 8px; text-align: left !important; font-weight: bold;";
            th.style.borderBottom = "1px solid var(--vscode-panel-border)";
            th.style.backgroundColor = "var(--vscode-editorWidget-background)";

            if (index === 0) {
              th.style.width = "60px"; // ID列固定宽度
            } else if (index === 1) {
              th.style.width = "80px"; // 长度列固定宽度
            }
            // 内容列不设置宽度，自动占满剩余空间
            headerRow.appendChild(th);
          });
          thead.appendChild(headerRow);
          table.appendChild(thead);

          // 表体
          const tbody = document.createElement("tbody");
          allStrings.forEach((str) => {
            const row = document.createElement("tr");

            // ID列
            const idCell = document.createElement("td");
            idCell.textContent = String(str.id);
            idCell.className = "pe-details-value";
            idCell.style.width = "60px";
            idCell.style.padding = "4px 8px";
            idCell.style.borderBottom = "1px solid var(--vscode-panel-border)";
            idCell.style.fontFamily = "'Courier New', monospace";
            idCell.style.fontSize = "11px";
            row.appendChild(idCell);

            // 长度列
            const lengthCell = document.createElement("td");
            lengthCell.textContent = String(str.length);
            lengthCell.className = "pe-details-value";
            lengthCell.style.width = "80px";
            lengthCell.style.padding = "4px 8px";
            lengthCell.style.borderBottom =
              "1px solid var(--vscode-panel-border)";
            lengthCell.style.fontFamily = "'Courier New', monospace";
            lengthCell.style.fontSize = "11px";
            row.appendChild(lengthCell);

            // 内容列（使用只读文本框）
            const contentCell = document.createElement("td");
            contentCell.style.padding = "4px 8px";
            contentCell.style.borderBottom =
              "1px solid var(--vscode-panel-border)";
            // 不设置width，让它自动占满剩余空间
            const textInput = document.createElement("input");
            textInput.type = "text";
            textInput.value = str.value || "(空字符串)";
            textInput.readOnly = true;
            textInput.style.width = "100%";
            textInput.style.border = "1px solid var(--vscode-input-border)";
            textInput.style.background = "var(--vscode-input-background)";
            textInput.style.color = "var(--vscode-input-foreground)";
            textInput.style.padding = "4px 8px";
            textInput.style.fontSize = "inherit";
            textInput.style.fontFamily = "inherit";
            textInput.style.boxSizing = "border-box";
            contentCell.appendChild(textInput);
            row.appendChild(contentCell);

            tbody.appendChild(row);
          });
          table.appendChild(tbody);

          // 添加标题
          const title = document.createElement("h5");
          title.textContent = `共 ${allStrings.length} 个字符串`;
          title.style.marginBottom = "10px";
          tableContainer.appendChild(title);
          tableContainer.appendChild(table);

          peDetails.appendChild(tableContainer);
        } else {
          const emptyText = document.createElement("p");
          emptyText.textContent = t("noParsableStrings");
          emptyText.style.color = "var(--vscode-descriptionForeground)";
          peDetails.appendChild(emptyText);
        }
      } catch (error) {
        const errorText = document.createElement("p");
        errorText.textContent = t("stringTableParseFailed");
        errorText.style.color = "var(--vscode-errorForeground)";
        peDetails.appendChild(errorText);
        console.error("String table parse error:", error);
      }
    }

    // 特殊处理：版本信息显示
    if (typeId === 16 && entries.length > 0) {
      const versionTitle = document.createElement("h4");
      versionTitle.textContent = t("versionInfoDetails");
      versionTitle.style.marginTop = "20px";
      peDetails.appendChild(versionTitle);

      try {
        /** @type {any} */
        const entryData = entries[0].data;
        const dataArray = entryData.data || entryData;
        const versionData = parseVersionInfo(dataArray);
        if (versionData) {
          const versionRows = Object.entries(versionData).map(
            ([key, value]) => [key, String(value)],
          );
          peDetails.appendChild(
            createTable(
              t("versionInfoFields"),
              [t("field"), t("value")],
              versionRows,
              ["", "pe-details-value"],
            ),
          );
        }
      } catch (error) {
        const errorText = document.createElement("p");
        errorText.textContent = t("versionInfoParseFailed");
        errorText.style.color = "var(--vscode-errorForeground)";
        peDetails.appendChild(errorText);
      }
    }

    // 特殊处理：清单文件显示
    if (typeId === 24 && entries.length > 0) {
      const manifestTitle = document.createElement("h4");
      manifestTitle.textContent = t("manifestContent");
      manifestTitle.style.marginTop = "20px";
      peDetails.appendChild(manifestTitle);

      const entry = entries[0];

      // 使用TextDecoder解码清单文件内容
      /** @type {any} */
      const entryData = entry.data;
      const dataArray = entryData.data || entryData;
      const decoder = new TextDecoder("utf-8");
      const manifestText = decoder.decode(new Uint8Array(dataArray));

      if (manifestText && manifestText.trim()) {
        const pre = document.createElement("pre");
        pre.style.backgroundColor = "var(--vscode-textCodeBlock-background)";
        pre.style.padding = "10px";
        pre.style.borderRadius = "4px";
        pre.style.overflow = "auto";
        pre.style.height = "auto";
        pre.style.minHeight = "200px";
        pre.style.fontSize = "12px";
        pre.style.whiteSpace = "pre-wrap";
        pre.style.wordBreak = "break-all";
        pre.textContent = manifestText;
        peDetails.appendChild(pre);
      } else {
        const errorText = document.createElement("p");
        errorText.textContent = t("manifestEmptyOrUnparsable");
        errorText.style.color = "var(--vscode-errorForeground)";
        peDetails.appendChild(errorText);
      }
    }
  }

  /**
   * 解析字符串表块
   * 字符串表资源的结构：每个块包含16个字符串（即使某些字符串为空）
   * 每个字符串以 WORD(2字节) 开头表示长度（字符数，不包括长度字段本身）
   * 然后是 UTF-16LE 编码的字符串数据
   * @param {Array<number>|Uint8Array} data - 字符串表块数据
   * @param {number} blockId - 块ID（用于计算字符串ID）
   * @returns {Array<{id: number, value: string, length: number}>} -
   *     解析后的字符串数组
   */
  function parseStringTableBlock(data, blockId) {
    try {
      const dataArray = Array.isArray(data) ? new Uint8Array(data) : data;
      /** @type {Array<{id: number, value: string, length: number}>} */
      const strings = [];

      // 每个字符串表块包含16个字符串
      // blockId * 16 是该块中第一个字符串的ID
      const baseStringId = (blockId - 1) * 16;

      let offset = 0;
      for (let i = 0; i < 16 && offset < dataArray.length; i++) {
        // 读取字符串长度（WORD，2字节，字符数）
        if (offset + 2 > dataArray.length) {
          break;
        }

        const strLen = dataArray[offset] | (dataArray[offset + 1] << 8);
        offset += 2;

        // 如果长度为0，说明这个位置没有字符串
        if (strLen === 0) {
          continue;
        }

        // 读取字符串数据（UTF-16LE编码）
        const strByteLen = strLen * 2; // 每个字符2字节
        if (offset + strByteLen > dataArray.length) {
          console.warn(
            `String ${baseStringId + i}: not enough data (need ${
              strByteLen
            }, have ${dataArray.length - offset})`,
          );
          break;
        }

        const strBytes = dataArray.slice(offset, offset + strByteLen);
        offset += strByteLen;

        // 解码字符串
        const decoder = new TextDecoder("utf-16le");
        const strValue = decoder.decode(strBytes);

        strings.push({
          id: baseStringId + i,
          value: strValue,
          length: strLen,
        });
      }

      return strings;
    } catch (error) {
      console.warn("Failed to parse string table block:", error);
      return [];
    }
  }

  /**
   * 解析版本信息资源
   * @param {Array<number>|Uint8Array} data - 版本信息数据
   * @returns {Object | null} - 解析后的版本信息
   */
  function parseVersionInfo(data) {
    try {
      // 简单的版本信息解析（仅解析字符串表）
      // 如果是数组，转换为Uint8Array
      const dataArray = Array.isArray(data) ? new Uint8Array(data) : data;
      const decoder = new TextDecoder("utf-16le");
      const text = decoder.decode(dataArray);

      /** @type {Record<string, string>} */
      const versionInfo = {};
      const fields = [
        "CompanyName",
        "FileDescription",
        "FileVersion",
        "InternalName",
        "LegalCopyright",
        "OriginalFilename",
        "ProductName",
        "ProductVersion",
      ];

      fields.forEach((field) => {
        const index = text.indexOf(field);
        if (index !== -1) {
          // 跳过字段名,然后找到第一个非空字符作为值的开始
          let valueStart = index + field.length;
          // 跳过字段名后的空字符(可能有多个\0和空格)
          while (
            valueStart < text.length &&
            (text[valueStart] === "\0" ||
              text[valueStart] === " " ||
              text[valueStart] === "\t")
          ) {
            valueStart++;
          }

          // 找到值的结束位置(下一个\0)
          let valueEnd = text.indexOf("\0", valueStart);
          if (valueEnd === -1) {
            valueEnd = text.length;
          }

          const value = text
            .substring(valueStart, valueEnd)
            .replace(/\0/g, "")
            .trim();
          if (value) {
            versionInfo[field] = value;
          }
        }
      });
      return Object.keys(versionInfo).length > 0 ? versionInfo : null;
    } catch (error) {
      console.warn("Failed to parse version info:", error);
      return null;
    }
  }

  // 发出 webview 已准备好的信号
  vscode.postMessage({ type: "ready" });
})();
