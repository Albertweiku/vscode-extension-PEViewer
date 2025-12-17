/**
 * ELF 文件处理模块
 * 负责 ELF 文件的显示和交互逻辑
 */

/**
 * 构建 ELF 文件树结构
 * @param {any} parsedData - 解析后的数据
 * @param {Function} selectItem - 选择项的回调函数
 */
function buildELFTree(parsedData, selectItem) {
  // 更新页面标题
  const treeHeader = document.getElementById("peTreeHeader");
  if (treeHeader) {
    treeHeader.textContent = t("elfViewerTitle");
  }

  // 更新 HTML title
  document.title = "ELF Viewer - ELF File Viewer";

  // 隐藏 PE 树，显示 ELF 树
  const peTreeStructure = document.getElementById("peTreeStructure");
  const elfTreeStructure = document.getElementById("elfTreeStructure");

  if (peTreeStructure) {
    peTreeStructure.style.display = "none";
  }

  if (elfTreeStructure) {
    elfTreeStructure.style.display = "";
  }

  // 设置 ELF 概览
  const elfHeaderItem = document.querySelector('[data-item="elf_header"]');
  if (elfHeaderItem) {
    elfHeaderItem.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectItem("elf_header");
    };
  }

  // 更新节区显示
  const elfSectionsGroup = document.querySelector(
    '[data-item="elf_sections"]',
  )?.parentElement;
  const elfSectionsItem = document.querySelector('[data-item="elf_sections"]');
  const elfSectionCount = document.getElementById("elfSectionCount");
  const elfSectionsList = document.getElementById("elfSectionsList");

  if (
    elfSectionsItem &&
    parsedData.elfData &&
    parsedData.elfData.sectionHeaders
  ) {
    const sectionsCount = parsedData.elfData.sectionHeaders.length;

    if (elfSectionCount) {
      elfSectionCount.textContent = `(${sectionsCount})`;
    }

    // 确保点击事件已绑定
    elfSectionsItem.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectItem("elf_sections");
    };

    // 动态生成节区列表
    if (elfSectionsList) {
      elfSectionsList.innerHTML = "";

      // 为每个节区创建树节点
      parsedData.elfData.sectionHeaders.forEach((section, index) => {
        const sectionName = section.name || `Section ${index}`;
        const div = document.createElement("div");
        div.className = "pe-tree-item pe-tree-leaf";
        div.setAttribute("data-item", `elf_section_${index}`);
        div.innerHTML = `📄 ${sectionName}`;
        div.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectItem(`elf_section_${index}`);
        });
        elfSectionsList.appendChild(div);
      });

      // 显示节区组
      if (elfSectionsGroup) {
        elfSectionsGroup.style.display = "";
      }

      console.log(`Generated ${sectionsCount} ELF section items`);
    }
  }

  // 更新导出
  const elfExportCount = document.getElementById("elfExportCount");
  const elfExportsItem = document.querySelector('[data-item="elf_exports"]');

  if (elfExportCount && parsedData.elfData && parsedData.elfData.exports) {
    const count = parsedData.elfData.exports.functions
      ? parsedData.elfData.exports.functions.length
      : 0;
    elfExportCount.textContent = `(${count})`;

    if (elfExportsItem) {
      if (count === 0) {
        elfExportsItem.style.display = "none";
      } else {
        elfExportsItem.style.display = "";
        // 确保点击事件已绑定
        elfExportsItem.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectItem("elf_exports");
        };
      }
    }
  }

  // 更新导入
  const elfImportsList = document.getElementById("elfImportsList");
  const elfImportCount = document.getElementById("elfImportCount");
  const elfImportsGroup = document.querySelector(
    '[data-item="elf_imports"]',
  )?.parentElement;

  console.log("ELF imports data:", parsedData.elfData?.imports);

  if (elfImportsList && parsedData.elfData) {
    elfImportsList.innerHTML = "";

    // 检查是否有导入数据
    if (parsedData.elfData.imports && parsedData.elfData.imports.length > 0) {
      let totalFunctions = 0;

      console.log(
        "Building imports tree with",
        parsedData.elfData.imports.length,
        "libraries",
      );

      parsedData.elfData.imports.forEach((lib, index) => {
        const funcCount = lib.functions ? lib.functions.length : 0;
        totalFunctions += funcCount;

        const div = document.createElement("div");
        div.className = "pe-tree-item pe-tree-leaf";
        div.setAttribute("data-item", `elf_imports.${index}`);
        div.innerHTML = `📚 ${lib.name} <span class="pe-tree-count">(${funcCount})</span>`;
        div.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectItem(`elf_imports.${index}`);
        });
        elfImportsList.appendChild(div);
      });

      console.log("Total import functions:", totalFunctions);

      if (elfImportCount) {
        elfImportCount.textContent = `(${totalFunctions})`;
      }

      // 显示导入函数组
      if (elfImportsGroup) {
        elfImportsGroup.style.display = "";
      }
    } else {
      // 没有导入数据，隐藏导入组
      if (elfImportCount) {
        elfImportCount.textContent = "(0)";
      }
      if (elfImportsGroup) {
        elfImportsGroup.style.display = "none";
      }
    }
  }
}

/**
 * 显示 ELF 文件概览
 * @param {any} parsedData - 解析后的数据
 * @param {HTMLElement} peDetails - 详情显示容器
 * @param {HTMLElement} detailsTitle - 标题元素
 * @param {Function} createTable - 创建表格的函数
 * @param {Function} hideSearchBox - 隐藏搜索框的函数
 */
function showELFOverview(
  parsedData,
  peDetails,
  detailsTitle,
  createTable,
  hideSearchBox,
) {
  console.log("showELFOverview called");
  console.log("parsedData:", parsedData);
  console.log("elfData:", parsedData?.elfData);

  if (!parsedData || !parsedData.elfData || !peDetails || !detailsTitle) {
    console.log("Missing required data:", {
      parsedData: !!parsedData,
      elfData: !!parsedData?.elfData,
      peDetails: !!peDetails,
      detailsTitle: !!detailsTitle,
    });
    return;
  }

  hideSearchBox();
  detailsTitle.textContent = t("elfFileOverview");
  peDetails.innerHTML = "";

  const container = document.createElement("div");
  container.className = "pe-details-section";

  const elfData = parsedData.elfData;
  console.log("elfData header:", elfData.header);

  // ELF 头信息
  if (elfData.header) {
    const header = elfData.header;
    const rows = [];

    // 架构信息
    let archInfo = "Unknown";
    if (header.class === 1) {
      archInfo = "32-bit";
    } else if (header.class === 2) {
      archInfo = "64-bit";
    }

    let endianInfo = "Unknown";
    if (header.data === 1) {
      endianInfo = t("littleEndian");
    } else if (header.data === 2) {
      endianInfo = t("bigEndian");
    }

    rows.push([t("architecture"), archInfo, "", t("processorBits")]);
    rows.push([t("byteOrder"), endianInfo, "", t("dataEncoding")]);
    rows.push([
      t("version"),
      String(header.version || "N/A"),
      "",
      t("elfVersion"),
    ]);

    if (header.type !== undefined) {
      let typeStr = "Unknown";
      if (header.type === 1) {
        typeStr = "REL (" + t("relocatable") + ")";
      } else if (header.type === 2) {
        typeStr = "EXEC (" + t("executable") + ")";
      } else if (header.type === 3) {
        typeStr = "DYN (" + t("sharedObject") + ")";
      } else if (header.type === 4) {
        typeStr = "CORE (" + t("coreFile") + ")";
      }
      rows.push([
        t("fileType"),
        typeStr,
        `0x${header.type.toString(16)}`,
        t("elfFileType"),
      ]);
    }

    if (header.machine !== undefined) {
      let machineStr = "Unknown";
      if (header.machine === 3) {
        machineStr = "Intel 80386";
      } else if (header.machine === 8) {
        machineStr = "MIPS";
      } else if (header.machine === 20) {
        machineStr = "PowerPC";
      } else if (header.machine === 40) {
        machineStr = "ARM";
      } else if (header.machine === 62) {
        machineStr = "AMD x86-64";
      } else if (header.machine === 183) {
        machineStr = "ARM 64-bit (AArch64)";
      } else if (header.machine === 243) {
        machineStr = "RISC-V";
      }
      rows.push([
        t("machineType"),
        machineStr,
        `0x${header.machine.toString(16)}`,
        t("targetArch"),
      ]);
    }

    if (header.entry !== undefined) {
      rows.push([
        t("entryPoint"),
        String(header.entry),
        `0x${header.entry.toString(16)}`,
        t("entryPointAddress"),
      ]);
    }

    container.appendChild(
      createTable(
        t("elfHeaderInfo"),
        [t("field"), t("value"), t("hex"), t("description")],
        rows,
        ["", "pe-details-value", "pe-details-hex", ""],
      ),
    );
  }

  // 节区统计
  if (elfData.sectionHeaders && elfData.sectionHeaders.length > 0) {
    const sectionRows = elfData.sectionHeaders
      .slice(0, 10)
      .map((section, index) => {
        const name = section.name || `Section ${index}`;
        return [
          name,
          String(section.size || 0),
          `0x${(section.addr || 0).toString(16)}`,
          `0x${(section.type || 0).toString(16)}`,
        ];
      });

    if (elfData.sectionHeaders.length > 10) {
      sectionRows.push([
        "...",
        "..",
        "...",
        t("totalSections").replace(
          "{count}",
          String(elfData.sectionHeaders.length),
        ),
      ]);
    }

    container.appendChild(
      createTable(
        t("sectionsFirst10"),
        [t("sectionName"), t("size"), t("address"), t("type")],
        sectionRows,
        [
          "pe-details-value",
          "pe-details-value",
          "pe-details-hex",
          "pe-details-hex",
        ],
      ),
    );
  }

  // 导出函数统计
  if (
    elfData.exports &&
    elfData.exports.functions &&
    elfData.exports.functions.length > 0
  ) {
    const exportCount = elfData.exports.functions.length;
    const exportRows = [
      [
        t("exportSymbolCount"),
        String(exportCount),
        "",
        t("clickLeftTreeForDetails"),
      ],
    ];
    container.appendChild(
      createTable(
        t("exportSymbolStats"),
        [t("type"), t("count"), "", t("description")],
        exportRows,
        ["", "pe-details-value", "", ""],
      ),
    );
  }

  // 导入库统计
  if (elfData.imports && elfData.imports.length > 0) {
    let totalFunctions = 0;
    const importRows = elfData.imports.map((lib) => {
      const funcCount = lib.functions ? lib.functions.length : 0;
      totalFunctions += funcCount;
      return [lib.name, String(funcCount)];
    });
    importRows.push([t("total"), String(totalFunctions)]);

    container.appendChild(
      createTable(
        t("dependencyLibStats"),
        [t("libName"), t("symbolCount")],
        importRows,
        ["", "pe-details-value"],
      ),
    );
  }

  peDetails.appendChild(container);
}

/**
 * 显示 ELF 节区列表
 */
function showELFSections(
  parsedData,
  peDetails,
  detailsTitle,
  createTable,
  hideSearchBox,
  showEmptyMessage,
) {
  if (!parsedData || !parsedData.elfData || !peDetails || !detailsTitle) {
    return;
  }

  hideSearchBox();
  detailsTitle.textContent = t("sectionList");
  peDetails.innerHTML = "";

  const elfData = parsedData.elfData;
  if (!elfData.sectionHeaders || elfData.sectionHeaders.length === 0) {
    showEmptyMessage(t("noSectionInfo"));
    return;
  }

  const container = document.createElement("div");
  container.className = "pe-details-section";

  const rows = elfData.sectionHeaders.map((section, index) => {
    const name = section.name || `Section ${index}`;
    return [
      String(index),
      name,
      String(section.size || 0),
      `0x${(section.addr || 0).toString(16)}`,
      `0x${(section.offset || 0).toString(16)}`,
      `0x${(section.type || 0).toString(16)}`,
    ];
  });

  container.appendChild(
    createTable(
      t("allSections"),
      [
        t("sectionIndex"),
        t("name"),
        t("size"),
        t("address"),
        t("offset"),
        t("type"),
      ],
      rows,
      [
        "",
        "pe-details-value",
        "pe-details-value",
        "pe-details-hex",
        "pe-details-hex",
        "pe-details-hex",
      ],
    ),
  );

  peDetails.appendChild(container);
}

/**
 * 显示 ELF 单个节区详情
 */
function showELFSection(
  sectionIndex,
  parsedData,
  peDetails,
  detailsTitle,
  createTable,
  hideSearchBox,
  showEmptyMessage,
) {
  if (!parsedData || !parsedData.elfData || !peDetails || !detailsTitle) {
    return;
  }

  const elfData = parsedData.elfData;
  if (
    !elfData.sectionHeaders ||
    sectionIndex >= elfData.sectionHeaders.length
  ) {
    hideSearchBox();
    showEmptyMessage(t("sectionNotFound"));
    return;
  }

  hideSearchBox();
  const section = elfData.sectionHeaders[sectionIndex];
  const sectionName = section.name || `Section ${sectionIndex}`;
  detailsTitle.textContent = `${t("section")}: ${sectionName}`;
  peDetails.innerHTML = "";

  const container = document.createElement("div");
  container.className = "pe-details-section";

  // 节区基本信息
  const basicRows = [
    [t("sectionName"), sectionName, "", t("sectionNameDesc")],
    [t("sectionIndex"), String(sectionIndex), "", t("sectionIndexDesc")],
    [
      t("type"),
      `0x${(section.type || 0).toString(16)}`,
      getSectionTypeDescription(section.type),
      t("sectionTypeDesc"),
    ],
    [
      t("flags"),
      `0x${(section.flags || 0).toString(16)}`,
      getSectionFlagsDescription(section.flags),
      t("sectionFlagsDesc"),
    ],
    [
      t("address"),
      `0x${(section.addr || 0).toString(16)}`,
      String(section.addr || 0),
      t("virtualAddress"),
    ],
    [
      t("offset"),
      `0x${(section.offset || 0).toString(16)}`,
      String(section.offset || 0),
      t("fileOffset"),
    ],
    [
      t("size"),
      String(section.size || 0),
      `0x${(section.size || 0).toString(16)}`,
      t("sectionSize"),
    ],
    [
      t("alignment"),
      String(section.addralign || 0),
      `0x${(section.addralign || 0).toString(16)}`,
      t("sectionAlignment"),
    ],
  ];

  if (section.link !== undefined) {
    basicRows.push([
      t("link"),
      String(section.link),
      "",
      t("linkedSectionIndex"),
    ]);
  }

  if (section.info !== undefined) {
    basicRows.push([t("info"), String(section.info), "", t("sectionInfo")]);
  }

  if (section.entsize !== undefined && section.entsize > 0) {
    basicRows.push([
      t("entrySize"),
      String(section.entsize),
      `0x${section.entsize.toString(16)}`,
      t("entrySizeDesc"),
    ]);
  }

  container.appendChild(
    createTable(
      t("sectionDetails"),
      [t("field"), t("value"), t("hex"), t("description")],
      basicRows,
      ["", "pe-details-value", "pe-details-hex", ""],
    ),
  );

  peDetails.appendChild(container);
}

/**
 * 获取节区类型描述
 */
function getSectionTypeDescription(type) {
  if (type === undefined) return "Unknown";

  const types = {
    0: "SHT_NULL (Inactive)",
    1: "SHT_PROGBITS (Program data)",
    2: "SHT_SYMTAB (Symbol table)",
    3: "SHT_STRTAB (String table)",
    4: "SHT_RELA (Relocation entries with addends)",
    5: "SHT_HASH (Symbol hash table)",
    6: "SHT_DYNAMIC (Dynamic linking information)",
    7: "SHT_NOTE (Notes)",
    8: "SHT_NOBITS (BSS)",
    9: "SHT_REL (Relocation entries)",
    10: "SHT_SHLIB (Reserved)",
    11: "SHT_DYNSYM (Dynamic linker symbol table)",
    14: "SHT_INIT_ARRAY (Array of constructors)",
    15: "SHT_FINI_ARRAY (Array of destructors)",
    16: "SHT_PREINIT_ARRAY (Array of pre-constructors)",
    17: "SHT_GROUP (Section group)",
    18: "SHT_SYMTAB_SHNDX (Extended section indices)",
  };

  return types[type] || `Unknown (0x${type.toString(16)})`;
}

/**
 * 获取节区标志描述
 */
function getSectionFlagsDescription(flags) {
  if (flags === undefined || flags === 0) return "None";

  const flagDescs = [];

  if (flags & 0x1) flagDescs.push("WRITE");
  if (flags & 0x2) flagDescs.push("ALLOC");
  if (flags & 0x4) flagDescs.push("EXECINSTR");
  if (flags & 0x10) flagDescs.push("MERGE");
  if (flags & 0x20) flagDescs.push("STRINGS");
  if (flags & 0x40) flagDescs.push("INFO_LINK");
  if (flags & 0x80) flagDescs.push("LINK_ORDER");
  if (flags & 0x100) flagDescs.push("OS_NONCONFORMING");
  if (flags & 0x200) flagDescs.push("GROUP");
  if (flags & 0x400) flagDescs.push("TLS");

  return flagDescs.length > 0 ? flagDescs.join(" | ") : "None";
}

/**
 * 显示 ELF 导出符号
 */
function showELFExports(
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
) {
  if (!parsedData || !parsedData.elfData || !peDetails || !detailsTitle) {
    return;
  }

  const elfData = parsedData.elfData;
  if (
    !elfData.exports ||
    !elfData.exports.functions ||
    elfData.exports.functions.length === 0
  ) {
    hideSearchBox();
    detailsTitle.textContent = t("exports");
    showEmptyMessage(t("noExportSymbols"));
    return;
  }

  showSearchBox();
  detailsTitle.textContent = `${t("exports")} (${elfData.exports.functions.length})`;

  // 准备所有行数据
  const rows = elfData.exports.functions.map((func, index) => {
    return [
      String(index + 1),
      func.name || "N/A",
      `0x${(func.address || 0).toString(16)}`,
      String(func.size || 0),
      func.type || "N/A",
      func.binding || "N/A",
    ];
  });

  // 更新共享的导出行数据
  allELFExportRows.length = 0;
  allELFExportRows.push(...rows);

  // 重置到第一页并渲染
  currentELFExportPage.value = 1;
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

/**
 * 渲染 ELF 导出函数的当前页
 */
function renderELFExportPage(
  peDetails,
  detailsTitle,
  createTable,
  createPageButton,
  allELFExportRows,
  currentELFExportPage,
  elfExportPageSize,
) {
  if (!peDetails) {
    return;
  }

  const totalCount = allELFExportRows.length;
  const totalPages = Math.ceil(totalCount / elfExportPageSize);
  const startIndex = (currentELFExportPage.value - 1) * elfExportPageSize;
  const endIndex = Math.min(startIndex + elfExportPageSize, totalCount);
  const currentPageRows = allELFExportRows.slice(startIndex, endIndex);

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
    t("exportSymbolList"),
    [
      t("symbolIndex"),
      t("symbolName"),
      t("address"),
      t("size"),
      t("symbolType"),
      t("symbolBinding"),
    ],
    currentPageRows,
    ["", "pe-details-value", "pe-details-hex", "pe-details-value", "", ""],
  );
  tableContainer.appendChild(tableFragment);
  peDetails.appendChild(tableContainer);

  // 创建分页控件
  const paginationContainer = createELFExportPaginationControls(
    currentELFExportPage.value,
    totalPages,
    totalCount,
    startIndex + 1,
    endIndex,
    peDetails,
    detailsTitle,
    createTable,
    createPageButton,
    allELFExportRows,
    currentELFExportPage,
    elfExportPageSize,
  );
  peDetails.appendChild(paginationContainer);
}

/**
 * 创建 ELF 导出函数分页控件
 * @param {number} page - 当前页
 * @param {number} totalPages - 总页数
 * @param {number} totalCount - 总条目数
 * @param {number} startIndex - 起始索引(从1开始)
 * @param {number} endIndex - 结束索引
 * @param {HTMLElement} peDetails - 详情显示容器
 * @param {HTMLElement} detailsTitle - 标题元素
 * @param {Function} createTable - 创建表格的函数
 * @param {Function} createPageButton - 创建分页按钮的函数
 * @param {Array<string[]>} allELFExportRows - 所有导出行数据
 * @param {{value: number}} currentELFExportPage - 当前页对象
 * @param {number} elfExportPageSize - 每页大小
 * @returns {HTMLElement}
 */
function createELFExportPaginationControls(
  page,
  totalPages,
  totalCount,
  startIndex,
  endIndex,
  peDetails,
  detailsTitle,
  createTable,
  createPageButton,
  allELFExportRows,
  currentELFExportPage,
  elfExportPageSize,
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
    currentELFExportPage.value = 1;
    renderELFExportPage(
      peDetails,
      detailsTitle,
      createTable,
      createPageButton,
      allELFExportRows,
      currentELFExportPage,
      elfExportPageSize,
    );
  });
  buttonsDiv.appendChild(firstBtn);

  // 上一页按钮
  const prevBtn = createPageButton("‹", page > 1, () => {
    currentELFExportPage.value--;
    renderELFExportPage(
      peDetails,
      detailsTitle,
      createTable,
      createPageButton,
      allELFExportRows,
      currentELFExportPage,
      elfExportPageSize,
    );
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
    currentELFExportPage.value++;
    renderELFExportPage(
      peDetails,
      detailsTitle,
      createTable,
      createPageButton,
      allELFExportRows,
      currentELFExportPage,
      elfExportPageSize,
    );
  });
  buttonsDiv.appendChild(nextBtn);

  // 末页按钮
  const lastBtn = createPageButton("⟫", page < totalPages, () => {
    currentELFExportPage.value = totalPages;
    renderELFExportPage(
      peDetails,
      detailsTitle,
      createTable,
      createPageButton,
      allELFExportRows,
      currentELFExportPage,
      elfExportPageSize,
    );
  });
  buttonsDiv.appendChild(lastBtn);

  container.appendChild(buttonsDiv);
  return container;
}

/**
 * 显示 ELF 导入函数总览
 */
function showELFImportsOverview(
  parsedData,
  peDetails,
  detailsTitle,
  createTable,
  hideSearchBox,
  showEmptyMessage,
) {
  if (!parsedData || !parsedData.elfData || !peDetails || !detailsTitle) {
    return;
  }

  const elfData = parsedData.elfData;
  if (!elfData.imports || elfData.imports.length === 0) {
    hideSearchBox();
    detailsTitle.textContent = t("dependencyLib");
    showEmptyMessage(t("noDependencyLibs"));
    return;
  }

  hideSearchBox();
  detailsTitle.textContent = `${t("dependencyLib")} (${elfData.imports.length})`;
  peDetails.innerHTML = "";

  const container = document.createElement("div");
  container.className = "pe-details-section";

  // 统计信息
  let totalFunctions = 0;
  elfData.imports.forEach((lib) => {
    totalFunctions += lib.functions ? lib.functions.length : 0;
  });

  const summaryRows = [
    [t("dependencyLibCount"), String(elfData.imports.length)],
    [t("importSymbolTotal"), String(totalFunctions)],
  ];

  container.appendChild(
    createTable(
      t("dependencyLibStats"),
      [t("statsItem"), t("statsValue")],
      summaryRows,
      ["", "pe-details-value"],
    ),
  );

  // 依赖库列表
  const libRows = elfData.imports.map((lib, index) => {
    const funcCount = lib.functions ? lib.functions.length : 0;
    return [
      String(index + 1),
      lib.name,
      String(funcCount),
      funcCount > 0 ? t("clickLeftTreeForDetails") : t("noSymbols"),
    ];
  });

  container.appendChild(
    createTable(
      t("dependencyLibList"),
      [
        t("serialNumber"),
        t("libName"),
        t("importSymbolCount"),
        t("description"),
      ],
      libRows,
      ["", "pe-details-value", "pe-details-value", ""],
    ),
  );

  peDetails.appendChild(container);
}

/**
 * 显示特定库的导入符号
 */
function showELFLibraryImports(
  lib,
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
) {
  if (!peDetails || !detailsTitle) {
    return;
  }

  const funcCount = lib.functions ? lib.functions.length : 0;

  if (funcCount === 0) {
    hideSearchBox();
    detailsTitle.textContent = lib.name;
    showEmptyMessage(t("noImportSymbolsInLib"));
    return;
  }

  showSearchBox();
  detailsTitle.textContent = `${lib.name} (${funcCount})`;

  // 准备所有行数据
  const rows = lib.functions.map((func, index) => {
    return [String(index + 1), func.name || "N/A", func.version || "N/A"];
  });

  // 更新共享的导入行数据
  allELFImportRows.length = 0;
  allELFImportRows.push(...rows);

  // 重置到第一页并渲染
  currentELFImportPage.value = 1;
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

/**
 * 渲染 ELF 导入函数的当前页
 */
function renderELFImportPage(
  peDetails,
  detailsTitle,
  createTable,
  createPageButton,
  allELFImportRows,
  currentELFImportPage,
  elfImportPageSize,
) {
  if (!peDetails) {
    return;
  }

  const totalCount = allELFImportRows.length;
  const totalPages = Math.ceil(totalCount / elfImportPageSize);
  const startIndex = (currentELFImportPage.value - 1) * elfImportPageSize;
  const endIndex = Math.min(startIndex + elfImportPageSize, totalCount);
  const currentPageRows = allELFImportRows.slice(startIndex, endIndex);

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
    t("importSymbolList"),
    [t("symbolIndex"), t("symbolName"), t("symbolVersion")],
    currentPageRows,
    ["", "pe-details-value", ""],
  );
  tableContainer.appendChild(tableFragment);
  peDetails.appendChild(tableContainer);

  // 创建分页控件
  const paginationContainer = createELFImportPaginationControls(
    currentELFImportPage.value,
    totalPages,
    totalCount,
    startIndex + 1,
    endIndex,
    peDetails,
    detailsTitle,
    createTable,
    createPageButton,
    allELFImportRows,
    currentELFImportPage,
    elfImportPageSize,
  );
  peDetails.appendChild(paginationContainer);
}

/**
 * 创建 ELF 导入函数分页控件
 * @param {number} page - 当前页
 * @param {number} totalPages - 总页数
 * @param {number} totalCount - 总条目数
 * @param {number} startIndex - 起始索引(从1开始)
 * @param {number} endIndex - 结束索引
 * @param {HTMLElement} peDetails - 详情显示容器
 * @param {HTMLElement} detailsTitle - 标题元素
 * @param {Function} createTable - 创建表格的函数
 * @param {Function} createPageButton - 创建分页按钮的函数
 * @param {Array<string[]>} allELFImportRows - 所有导入行数据
 * @param {{value: number}} currentELFImportPage - 当前页对象
 * @param {number} elfImportPageSize - 每页大小
 * @returns {HTMLElement}
 */
function createELFImportPaginationControls(
  page,
  totalPages,
  totalCount,
  startIndex,
  endIndex,
  peDetails,
  detailsTitle,
  createTable,
  createPageButton,
  allELFImportRows,
  currentELFImportPage,
  elfImportPageSize,
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
    currentELFImportPage.value = 1;
    renderELFImportPage(
      peDetails,
      detailsTitle,
      createTable,
      createPageButton,
      allELFImportRows,
      currentELFImportPage,
      elfImportPageSize,
    );
  });
  buttonsDiv.appendChild(firstBtn);

  // 上一页按钮
  const prevBtn = createPageButton("‹", page > 1, () => {
    currentELFImportPage.value--;
    renderELFImportPage(
      peDetails,
      detailsTitle,
      createTable,
      createPageButton,
      allELFImportRows,
      currentELFImportPage,
      elfImportPageSize,
    );
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
    currentELFImportPage.value++;
    renderELFImportPage(
      peDetails,
      detailsTitle,
      createTable,
      createPageButton,
      allELFImportRows,
      currentELFImportPage,
      elfImportPageSize,
    );
  });
  buttonsDiv.appendChild(nextBtn);

  // 末页按钮
  const lastBtn = createPageButton("⟫", page < totalPages, () => {
    currentELFImportPage.value = totalPages;
    renderELFImportPage(
      peDetails,
      detailsTitle,
      createTable,
      createPageButton,
      allELFImportRows,
      currentELFImportPage,
      elfImportPageSize,
    );
  });
  buttonsDiv.appendChild(lastBtn);

  container.appendChild(buttonsDiv);
  return container;
}
