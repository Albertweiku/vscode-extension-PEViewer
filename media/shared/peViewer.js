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
   * @property {"PE" | "ELF" | "LIB"} [fileType]
   * @property {ExtendedELFData} [elfData]
   * @property {LibArchiveData} [libData]
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

    // 检查是否为 LIB 文件
    if (parsedData.fileType === "LIB") {
      buildLibTree(parsedData);
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
      if (itemId === "elf_header") {
        showELFOverview(
          parsedData,
          peDetails,
          detailsTitle,
          createTable,
          hideSearchBox,
        );
        return;
      }

      if (itemId === "elf_sections") {
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

      if (itemId === "elf_exports") {
        showELFExports(
          parsedData,
          peDetails,
          detailsTitle,
          createTable,
          hideSearchBox,
          showSearchBox,
          showEmptyMessage,
          createPageButton,
          allELFExportRows,
          currentELFExportPage,
          elfExportPageSize,
        );
        return;
      }

      if (itemId === "elf_imports") {
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

      if (itemId.startsWith("elf_imports.")) {
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
              createPageButton,
              allELFImportRows,
              currentELFImportPage,
              elfImportPageSize,
            );
            return;
          }
        }
      }

      // 处理单个节区
      if (itemId.startsWith("elf_section_")) {
        const sectionIndex = parseInt(itemId.replace("elf_section_", ""));
        if (!isNaN(sectionIndex)) {
          showELFSection(
            sectionIndex,
            parsedData,
            peDetails,
            detailsTitle,
            createTable,
            hideSearchBox,
            showEmptyMessage,
          );
          return;
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
      showResourcesOverview(
        parsedData,
        peDetails,
        detailsTitle,
        createTable,
        formatAddress,
        hideSearchBox,
        showEmptyMessage,
        t,
      );
      return;
    }

    // 处理特定资源类型
    if (itemId.startsWith("resources.")) {
      const parts = itemId.split(".");
      if (parts.length === 2) {
        const resourceType = parts[1];
        showResourceType(
          resourceType,
          parsedData,
          peDetails,
          detailsTitle,
          createTable,
          hideSearchBox,
          showEmptyMessage,
          t,
        );
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

  // ELF 导出函数分页相关变量
  /** @type {Array<string[]>} */
  let allELFExportRows = [];
  let currentELFExportPage = { value: 1 };
  const elfExportPageSize = 100; // 每页显示100条

  // ELF 导入函数分页相关变量
  /** @type {Array<string[]>} */
  let allELFImportRows = [];
  let currentELFImportPage = { value: 1 };
  const elfImportPageSize = 100; // 每页显示100条

  // 搜索相关变量
  /** @type {HTMLTableRowElement[]} */
  let currentSearchMatches = [];
  let currentSearchIndex = -1;
  /** @type {number[]} - 在原始数据中匹配的索引列表（用于跨页搜索） */
  let allMatchedIndices = [];
  /** @type {string} - 当前搜索文本 */
  let currentSearchText = "";

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
    allMatchedIndices = [];
    currentSearchText = "";

    if (!searchText) {
      updateSearchCount();
      return;
    }

    currentSearchText = searchText;

    // 检查是否在导出函数页面（有分页数据）
    if (allExportRows.length > 0) {
      performSearchInExports(searchText);
      return;
    }

    // 检查是否在导入函数页面（有分页数据）
    if (allImportRows.length > 0) {
      performSearchInImports(searchText);
      return;
    }

    // 检查是否在 ELF 导出函数页面（有分页数据）
    if (allELFExportRows.length > 0) {
      performSearchInELFExports(searchText);
      return;
    }

    // 检查是否在 ELF 导入函数页面（有分页数据）
    if (allELFImportRows.length > 0) {
      performSearchInELFImports(searchText);
      return;
    }

    // 否则，搜索当前页面的表格行（用于其他不分页的表格）
    searchCurrentPageTable(searchText);
  }

  /**
   * 在导出函数数据中搜索
   * @param {string} searchText - 搜索文本
   */
  function performSearchInExports(searchText) {
    allMatchedIndices = [];

    // 在所有导出函数数据中搜索
    allExportRows.forEach((row, index) => {
      // row = [ordinal, address, decodedName, originalName]
      const matched = row.some((cell) =>
        String(cell).toLowerCase().includes(searchText),
      );
      if (matched) {
        allMatchedIndices.push(index);
      }
    });

    if (allMatchedIndices.length === 0) {
      updateSearchCount();
      return;
    }

    // 跳转到第一个匹配项所在的页面
    const firstMatchIndex = allMatchedIndices[0];
    const targetPage = Math.floor(firstMatchIndex / pageSize) + 1;

    if (targetPage !== currentPage) {
      currentPage = targetPage;
      renderExportPage();
    }

    // 等待DOM更新后，在当前页面中高亮匹配项
    setTimeout(() => {
      highlightMatchesInCurrentPage(searchText, true);
      // 设置当前索引为0（第一个匹配项）
      currentSearchIndex = 0;
      updateSearchCount();
    }, 50);
  }

  /**
   * 在导入函数数据中搜索
   * @param {string} searchText - 搜索文本
   */
  function performSearchInImports(searchText) {
    allMatchedIndices = [];

    // 在所有导入函数数据中搜索
    allImportRows.forEach((row, index) => {
      // row = [dllName, functionName, type]
      const matched = row.some((cell) =>
        String(cell).toLowerCase().includes(searchText),
      );
      if (matched) {
        allMatchedIndices.push(index);
      }
    });

    if (allMatchedIndices.length === 0) {
      updateSearchCount();
      return;
    }

    // 跳转到第一个匹配项所在的页面
    const firstMatchIndex = allMatchedIndices[0];
    const targetPage = Math.floor(firstMatchIndex / importPageSize) + 1;

    if (targetPage !== currentImportPage) {
      currentImportPage = targetPage;
      renderImportPage();
    }

    // 等待DOM更新后，在当前页面中高亮匹配项
    setTimeout(() => {
      highlightMatchesInCurrentPage(searchText, true);
      // 设置当前索引为0（第一个匹配项）
      currentSearchIndex = 0;
      updateSearchCount();
    }, 50);
  }

  /**
   * 在 ELF 导出函数数据中搜索
   * @param {string} searchText - 搜索文本
   */
  function performSearchInELFExports(searchText) {
    allMatchedIndices = [];

    // 在所有 ELF 导出函数数据中搜索
    allELFExportRows.forEach((row, index) => {
      // row = [index, name, address, size, type, binding]
      const matched = row.some((cell) =>
        String(cell).toLowerCase().includes(searchText),
      );
      if (matched) {
        allMatchedIndices.push(index);
      }
    });

    if (allMatchedIndices.length === 0) {
      updateSearchCount();
      return;
    }

    // 跳转到第一个匹配项所在的页面
    const firstMatchIndex = allMatchedIndices[0];
    const targetPage = Math.floor(firstMatchIndex / elfExportPageSize) + 1;

    if (targetPage !== currentELFExportPage.value) {
      currentELFExportPage.value = targetPage;
      // 需要获取必要的参数来渲染页面
      // 这些参数应该在调用时可用
      const peDetails = document.getElementById("peDetails");
      const detailsTitle = document.getElementById("detailsTitle");
      if (peDetails && detailsTitle) {
        renderELFExportPage(
          peDetails,
          detailsTitle,
          createTable,
          createPageButton,
          allELFExportRows,
          currentELFExportPage,
          elfExportPageSize,
        );
      }
    }

    // 等待DOM更新后，在当前页面中高亮匹配项
    setTimeout(() => {
      highlightMatchesInCurrentPage(searchText, true);
      // 设置当前索引为0（第一个匹配项）
      currentSearchIndex = 0;
      updateSearchCount();
    }, 50);
  }

  /**
   * 在 ELF 导入函数数据中搜索
   * @param {string} searchText - 搜索文本
   */
  function performSearchInELFImports(searchText) {
    allMatchedIndices = [];

    // 在所有 ELF 导入函数数据中搜索
    allELFImportRows.forEach((row, index) => {
      // row = [index, name, version]
      const matched = row.some((cell) =>
        String(cell).toLowerCase().includes(searchText),
      );
      if (matched) {
        allMatchedIndices.push(index);
      }
    });

    if (allMatchedIndices.length === 0) {
      updateSearchCount();
      return;
    }

    // 跳转到第一个匹配项所在的页面
    const firstMatchIndex = allMatchedIndices[0];
    const targetPage = Math.floor(firstMatchIndex / elfImportPageSize) + 1;

    if (targetPage !== currentELFImportPage.value) {
      currentELFImportPage.value = targetPage;
      // 需要获取必要的参数来渲染页面
      const peDetails = document.getElementById("peDetails");
      const detailsTitle = document.getElementById("detailsTitle");
      if (peDetails && detailsTitle) {
        renderELFImportPage(
          peDetails,
          detailsTitle,
          createTable,
          createPageButton,
          allELFImportRows,
          currentELFImportPage,
          elfImportPageSize,
        );
      }
    }

    // 等待DOM更新后，在当前页面中高亮匹配项
    setTimeout(() => {
      highlightMatchesInCurrentPage(searchText, true);
      // 设置当前索引为0（第一个匹配项）
      currentSearchIndex = 0;
      updateSearchCount();
    }, 50);
  }

  /**
   * 在当前页面的表格中搜索（用于非分页表格）
   * @param {string} searchText - 搜索文本
   */
  function searchCurrentPageTable(searchText) {
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
    });

    // 如果有匹配结果，高亮第一个
    if (currentSearchMatches.length > 0) {
      currentSearchIndex = 0;
      highlightCurrentMatch();
    }

    updateSearchCount();
  }

  /**
   * 在当前页面中高亮所有匹配项
   * @param {string} searchText - 搜索文本
   * @param {boolean} [resetIndex=false] - 是否重置索引到第一个匹配项
   */
  function highlightMatchesInCurrentPage(searchText, resetIndex = false) {
    clearSearchHighlights();
    currentSearchMatches = [];
    // 不再重置 currentSearchIndex，保持全局导航状态

    const table = peDetails?.querySelector(".pe-details-table");
    if (!table) {
      updateSearchCount();
      return;
    }

    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      let matched = false;

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
    });

    // 只在首次搜索或明确要求时重置索引
    if (resetIndex && currentSearchMatches.length > 0) {
      currentSearchIndex = 0;
      highlightCurrentMatch();
    }
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
    // 如果有全局匹配索引（分页搜索），使用跨页导航
    if (allMatchedIndices.length > 0) {
      navigateSearchResultsAcrossPages(direction);
      return;
    }

    // 否则使用当前页内导航
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
   * 跨页导航搜索结果
   * @param {number} direction - 1表示下一个，-1表示上一个
   */
  function navigateSearchResultsAcrossPages(direction) {
    if (allMatchedIndices.length === 0) {
      return;
    }

    currentSearchIndex += direction;

    // 循环导航
    if (currentSearchIndex >= allMatchedIndices.length) {
      currentSearchIndex = 0;
    } else if (currentSearchIndex < 0) {
      currentSearchIndex = allMatchedIndices.length - 1;
    }

    const globalIndex = allMatchedIndices[currentSearchIndex];

    // 判断是 PE 导出、PE 导入、ELF 导出还是 ELF 导入，并计算目标页面
    let targetPage;
    let needPageChange = false;
    let pageSize_;
    let currentPage_;

    if (allExportRows.length > 0) {
      // PE 导出
      pageSize_ = pageSize;
      currentPage_ = currentPage;
      targetPage = Math.floor(globalIndex / pageSize_) + 1;
      if (targetPage !== currentPage_) {
        currentPage = targetPage;
        currentPage_ = targetPage; // 更新 currentPage_ 为新页码
        renderExportPage();
        needPageChange = true;
      }
    } else if (allImportRows.length > 0) {
      // PE 导入
      pageSize_ = importPageSize;
      currentPage_ = currentImportPage;
      targetPage = Math.floor(globalIndex / pageSize_) + 1;
      if (targetPage !== currentPage_) {
        currentImportPage = targetPage;
        currentPage_ = targetPage; // 更新 currentPage_ 为新页码
        renderImportPage();
        needPageChange = true;
      }
    } else if (allELFExportRows.length > 0) {
      // ELF 导出
      pageSize_ = elfExportPageSize;
      currentPage_ = currentELFExportPage.value;
      targetPage = Math.floor(globalIndex / pageSize_) + 1;
      if (targetPage !== currentPage_) {
        currentELFExportPage.value = targetPage;
        currentPage_ = targetPage; // 更新 currentPage_ 为新页码
        const peDetails = document.getElementById("peDetails");
        const detailsTitle = document.getElementById("detailsTitle");
        if (peDetails && detailsTitle) {
          renderELFExportPage(
            peDetails,
            detailsTitle,
            createTable,
            createPageButton,
            allELFExportRows,
            currentELFExportPage,
            elfExportPageSize,
          );
        }
        needPageChange = true;
      }
    } else if (allELFImportRows.length > 0) {
      // ELF 导入
      pageSize_ = elfImportPageSize;
      currentPage_ = currentELFImportPage.value;
      targetPage = Math.floor(globalIndex / pageSize_) + 1;
      if (targetPage !== currentPage_) {
        currentELFImportPage.value = targetPage;
        currentPage_ = targetPage; // 更新 currentPage_ 为新页码
        const peDetails = document.getElementById("peDetails");
        const detailsTitle = document.getElementById("detailsTitle");
        if (peDetails && detailsTitle) {
          renderELFImportPage(
            peDetails,
            detailsTitle,
            createTable,
            createPageButton,
            allELFImportRows,
            currentELFImportPage,
            elfImportPageSize,
          );
        }
        needPageChange = true;
      }
    }

    if (needPageChange) {
      // 页面切换后，等待DOM更新再高亮
      setTimeout(() => {
        // 保持当前的 currentSearchIndex，不重置
        highlightMatchesInCurrentPage(currentSearchText, false);
        // 找到当前全局索引在当前页内的位置
        const startIndex = (currentPage_ - 1) * pageSize_;
        const matchesInPage = allMatchedIndices.filter(
          (idx) => idx >= startIndex && idx < startIndex + pageSize_,
        );
        const localIndex = matchesInPage.indexOf(globalIndex);
        if (localIndex >= 0 && localIndex < currentSearchMatches.length) {
          // 更新DOM中的当前匹配索引
          currentSearchMatches.forEach((row) => {
            row.classList.remove("highlight-current");
          });
          if (currentSearchMatches[localIndex]) {
            currentSearchMatches[localIndex].classList.add("highlight-current");
            currentSearchMatches[localIndex].scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }
        updateSearchCount();
      }, 50);
    } else {
      // 同一页内，直接高亮
      const startIndex = (currentPage_ - 1) * pageSize_;
      const matchesInPage = allMatchedIndices.filter(
        (idx) => idx >= startIndex && idx < startIndex + pageSize_,
      );
      const localIndex = matchesInPage.indexOf(globalIndex);
      if (localIndex >= 0 && localIndex < currentSearchMatches.length) {
        currentSearchMatches.forEach((row) => {
          row.classList.remove("highlight-current");
        });
        currentSearchMatches[localIndex].classList.add("highlight-current");
        currentSearchMatches[localIndex].scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      updateSearchCount();
    }
  }

  /**
   * 更新搜索计数显示
   */
  function updateSearchCount() {
    const searchCount = document.getElementById("searchCount");
    if (!searchCount) {
      return;
    }

    // 如果有全局匹配索引，显示全局计数
    if (allMatchedIndices.length > 0) {
      if (
        currentSearchIndex >= 0 &&
        currentSearchIndex < allMatchedIndices.length
      ) {
        searchCount.textContent = `${currentSearchIndex + 1} / ${allMatchedIndices.length}`;
      } else {
        searchCount.textContent = `0 / ${allMatchedIndices.length}`;
      }
    } else if (currentSearchMatches.length === 0) {
      searchCount.textContent = "";
    } else {
      searchCount.textContent = `${currentSearchIndex + 1} / ${currentSearchMatches.length}`;
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
            name: func.name || `${t("ordinalPrefix")}${func.ordinal}`,
            type: func.name ? t("byName") : t("byOrdinal"),
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
          // 特殊处理Machine字段，显示架构描述和代码
          if (key === "Machine") {
            rows.push([
              key,
              getMachineTypeFullInfo(numVal),
              `0x${numVal.toString(16).toUpperCase()}`,
            ]);
          } else {
            rows.push([
              key,
              String(numVal),
              `0x${numVal.toString(16).toUpperCase()}`,
            ]);
          }
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

  // 发出 webview 已准备好的信号
  vscode.postMessage({ type: "ready" });
})();
