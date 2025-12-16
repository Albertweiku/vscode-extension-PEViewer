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

  // ELF 文件树结构
  const elfOverviewItem = document.querySelector('[data-item="pe_header"]');
  if (elfOverviewItem) {
    elfOverviewItem.textContent = "📁 " + t("elfOverview");
    // 确保点击事件已绑定
    elfOverviewItem.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectItem("pe_header");
    };
  }

  // 隐藏 PE 特定的项
  const peSpecificItems = [
    "dos_header",
    "coff_header",
    "optional_header",
    "data_directory",
    "resources",
  ];
  peSpecificItems.forEach((itemId) => {
    const element = document.querySelector(`[data-item="${itemId}"]`);
    if (element) {
      const parent = element.parentElement;
      if (parent) {
        parent.style.display = "none";
      }
    }
  });

  // 更新节区显示
  const sectionsItem = document.querySelector('[data-item="sections"]');
  if (sectionsItem && parsedData.elfData && parsedData.elfData.sectionHeaders) {
    sectionsItem.textContent =
      t("sections") + ` (${parsedData.elfData.sectionHeaders.length})`;
    // 确保点击事件已绑定
    sectionsItem.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectItem("sections");
    };
  }

  // 更新导出
  const exportCount = document.getElementById("exportCount");
  const exportsItem = document.querySelector('[data-item="exports"]');
  if (exportCount && parsedData.elfData && parsedData.elfData.exports) {
    const count = parsedData.elfData.exports.functions
      ? parsedData.elfData.exports.functions.length
      : 0;
    exportCount.textContent = `(${count})`;
    if (exportsItem) {
      if (count === 0) {
        exportsItem.style.display = "none";
      } else {
        exportsItem.style.display = "";
        // 确保点击事件已绑定
        exportsItem.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectItem("exports");
        };
      }
    }
  }

  // 更新导入
  const importsList = document.getElementById("importsList");
  const importCount = document.getElementById("importCount");
  const importsGroup = document.querySelector(
    '[data-item="imports"]',
  )?.parentElement;

  console.log("ELF imports data:", parsedData.elfData?.imports);
  console.log("importsList element:", importsList);
  console.log("importsGroup element:", importsGroup);

  if (importsList && parsedData.elfData) {
    importsList.innerHTML = "";

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

        console.log(
          `Import library ${index}:`,
          lib.name,
          "functions:",
          funcCount,
        );

        const div = document.createElement("div");
        div.className = "pe-tree-item pe-tree-leaf";
        div.setAttribute("data-item", `imports.${index}`);
        div.innerHTML = `📚 ${lib.name} <span class="pe-tree-count">(${funcCount})</span>`;
        div.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectItem(`imports.${index}`);
        });
        importsList.appendChild(div);
      });

      console.log("Total import functions:", totalFunctions);

      if (importCount) {
        importCount.textContent = `(${totalFunctions})`;
      }

      // 显示导入函数组
      if (importsGroup) {
        importsGroup.style.display = "";
        console.log("Imports group shown");
      }
    } else {
      // 没有导入数据，隐藏导入组
      console.log("No imports found, hiding imports group");
      if (importCount) {
        importCount.textContent = "(0)";
      }
      if (importsGroup) {
        importsGroup.style.display = "none";
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
  peDetails.innerHTML = "";

  const container = document.createElement("div");
  container.className = "pe-details-section";

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

  container.appendChild(
    createTable(
      t("exportSymbolList"),
      [
        t("symbolIndex"),
        t("symbolName"),
        t("address"),
        t("size"),
        t("symbolType"),
        t("symbolBinding"),
      ],
      rows,
      ["", "pe-details-value", "pe-details-hex", "pe-details-value", "", ""],
    ),
  );

  peDetails.appendChild(container);
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
  peDetails.innerHTML = "";

  const container = document.createElement("div");
  container.className = "pe-details-section";

  const rows = lib.functions.map((func, index) => {
    return [String(index + 1), func.name || "N/A", func.version || "N/A"];
  });

  container.appendChild(
    createTable(
      t("importSymbolList"),
      [t("symbolIndex"), t("symbolName"), t("symbolVersion")],
      rows,
      ["", "pe-details-value", ""],
    ),
  );

  peDetails.appendChild(container);
}
