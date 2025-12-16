/**
 * PE 文件处理模块
 * 负责 PE 文件的显示和交互逻辑
 */

/**
 * 构建 PE 文件树结构
 * @param {any} parsedData - 解析后的数据
 * @param {Function} selectItem - 选择项的回调函数
 * @param {any} templates - 模板对象
 */
function buildPETree(parsedData, selectItem, templates) {
  // 更新页面标题
  const treeHeader = document.getElementById("peTreeHeader");
  if (treeHeader) {
    treeHeader.textContent = t("peViewerTitle");
  }

  // 更新 HTML title
  document.title = "PEViewer - PE File Viewer";

  // 确保 PE 特定的项显示
  const peSpecificItems = [
    "dos_header",
    "coff_header",
    "optional_header",
    "data_directory",
  ];
  peSpecificItems.forEach((itemId) => {
    const element = document.querySelector(`[data-item="${itemId}"]`);
    if (element && element.parentElement) {
      element.parentElement.style.display = "";
    }
  });

  // 更新导出函数计数并控制显示/隐藏
  const exportCount = document.getElementById("exportCount");
  const exportsItem = document.querySelector('[data-item="exports"]');
  if (exportCount) {
    const count =
      parsedData.exports && parsedData.exports.functions
        ? parsedData.exports.functions.length
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

  // 动态生成导入DLL列表
  const importsList = document.getElementById("importsList");
  const importCount = document.getElementById("importCount");
  const importsGroup = importsList?.closest("details.pe-tree-group");
  let totalImportFunctions = 0;

  if (
    importsList &&
    parsedData.imports &&
    parsedData.imports.length > 0 &&
    templates.importDllItem
  ) {
    importsList.innerHTML = "";
    parsedData.imports.forEach((dll, index) => {
      const funcCount = dll.functions ? dll.functions.length : 0;
      totalImportFunctions += funcCount;

      // 使用模板创建元素
      if (!templates.importDllItem) {
        return;
      }
      const clone = templates.importDllItem.content.cloneNode(true);
      const item = clone.querySelector(".pe-tree-item");
      if (item) {
        item.setAttribute("data-item", `imports.${index}`);
        item.setAttribute("data-dll", dll.name);
        const nameSpan = item.querySelector(".dll-name");
        const countSpan = item.querySelector(".pe-tree-count");
        if (nameSpan) {
          nameSpan.textContent = dll.name;
        }
        if (countSpan) {
          countSpan.textContent = `(${funcCount})`;
        }
        // 绑定点击事件
        item.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectItem(`imports.${index}`);
        });
      }
      importsList.appendChild(clone);
    });
  }

  // 更新导入函数总数并控制显示/隐藏
  if (importCount) {
    importCount.textContent = `(${totalImportFunctions})`;
  }
  if (importsGroup) {
    if (totalImportFunctions === 0) {
      importsGroup.style.display = "none";
    } else {
      importsGroup.style.display = "";
    }
  }

  // 动态生成区段列表
  const sectionsList = document
    .querySelector('[data-item="sections"]')
    ?.parentElement?.querySelector(".pe-tree-children");
  if (sectionsList && parsedData.sections && parsedData.sections.length > 0) {
    sectionsList.innerHTML = "";
    parsedData.sections.forEach((section) => {
      const sectionName = section.Name
        ? section.Name.replace(/\0/g, "").trim()
        : "";
      if (sectionName) {
        const sectionItem = document.createElement("div");
        sectionItem.className = "pe-tree-item pe-tree-leaf";
        sectionItem.setAttribute("data-item", `section_${sectionName}`);
        sectionItem.textContent = `📄 ${sectionName}`;
        sectionItem.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectItem(`section_${sectionName}`);
        });
        sectionsList.appendChild(sectionItem);
      }
    });
  }

  // 动态生成资源类型列表
  const resourcesList = document.getElementById("resourcesList");
  const resourceCount = document.getElementById("resourceCount");
  let totalResources = 0;

  if (resourcesList && templates.resourceTypeItem) {
    resourcesList.innerHTML = "";

    // 检查是否有资源数据
    if (parsedData.resources && Object.keys(parsedData.resources).length > 0) {
      // 定义资源类型映射
      const resourceTypeMap = {
        1: { id: "RT_CURSOR", name: t("cursor"), icon: "🖱️" },
        2: { id: "RT_BITMAP", name: t("bitmap"), icon: "🎨" },
        3: { id: "RT_ICON", name: t("icon"), icon: "🖼️" },
        4: { id: "RT_MENU", name: t("menu"), icon: "📋" },
        5: { id: "RT_DIALOG", name: t("dialog"), icon: "💬" },
        6: { id: "RT_STRING", name: t("stringTable"), icon: "📝" },
        9: { id: "RT_ACCELERATOR", name: t("accelerator"), icon: "⌨️" },
        10: { id: "RT_RCDATA", name: t("rcData"), icon: "📦" },
        12: { id: "RT_GROUP_CURSOR", name: t("cursorGroup"), icon: "🖱️" },
        14: { id: "RT_GROUP_ICON", name: t("iconGroup"), icon: "🖼️" },
        16: { id: "RT_VERSION", name: t("version"), icon: "ℹ️" },
        24: { id: "RT_MANIFEST", name: t("manifest"), icon: "📄" },
      };

      Object.keys(parsedData.resources)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((typeNum) => {
          const typeId = Number(typeNum);

          // 跳过单独的图标类型(type=3),它们将作为图标组的子项显示
          if (typeId === 3) {
            return;
          }

          const entries = parsedData.resources[typeId];
          const count = entries ? entries.length : 0;
          totalResources += count;

          const resType = resourceTypeMap[typeId] || {
            id: `RT_${typeId}`,
            name: `${t("resourceTypeId").replace("{id}", typeId)}`,
            icon: "📦",
          };

          if (!templates.resourceTypeItem) {
            return;
          }
          const clone = templates.resourceTypeItem.content.cloneNode(true);
          const item = clone.querySelector(".pe-tree-item");
          if (item) {
            item.setAttribute("data-item", `resources.${typeId}`);
            item.setAttribute("data-resource-type", String(typeId));
            const nameSpan = item.querySelector(".resource-type-name");
            const countSpan = item.querySelector(".pe-tree-count");
            if (nameSpan) {
              nameSpan.textContent = resType.name;
            }
            if (countSpan) {
              countSpan.textContent = `(${count})`;
            }
            // 替换图标
            const iconNode = item.firstChild;
            if (iconNode && iconNode.nodeType === Node.TEXT_NODE) {
              iconNode.textContent = resType.icon + " ";
            }
            // 绑定点击事件
            item.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              selectItem(`resources.${typeId}`);
            });
          }
          resourcesList.appendChild(clone);
        });

      if (resourceCount) {
        resourceCount.textContent = `(${totalResources})`;
      }
    } else {
      if (resourceCount) {
        resourceCount.textContent = "(0)";
      }
    }

    // 控制资源节点的显示/隐藏
    const resourcesGroup = resourcesList?.closest("details.pe-tree-group");
    console.log("[peHandler] totalResources:", totalResources);
    console.log("[peHandler] resourcesGroup:", resourcesGroup);
    if (resourcesGroup) {
      if (totalResources === 0) {
        console.log(
          "[peHandler] Hiding resources group (totalResources === 0)",
        );
        resourcesGroup.style.display = "none";
      } else {
        console.log("[peHandler] Showing resources group");
        resourcesGroup.style.display = "";
      }
    }
  }
}

/**
 * 显示 PE 文件概览
 * @param {any} parsedData - 解析后的数据
 * @param {HTMLElement} peDetails - 详情显示容器
 * @param {HTMLElement} detailsTitle - 标题元素
 * @param {Function} createTable - 创建表格的函数
 * @param {Function} formatAddress - 格式化地址的函数
 * @param {Function} hideSearchBox - 隐藏搜索框的函数
 */
function showPEOverview(
  parsedData,
  peDetails,
  detailsTitle,
  createTable,
  formatAddress,
  hideSearchBox,
) {
  if (!parsedData || !peDetails || !detailsTitle) {
    return;
  }

  hideSearchBox();

  // 检测位数和机器类型
  let is64Bit = false;
  let bitInfo = t("bit32");
  let machineDesc = "Unknown";

  if (
    parsedData.nt_headers &&
    parsedData.nt_headers.OptionalHeader &&
    parsedData.nt_headers.OptionalHeader.Magic
  ) {
    const magic = parsedData.nt_headers.OptionalHeader.Magic;
    if (magic === 0x20b) {
      is64Bit = true;
      bitInfo = t("bit64");
    }
  }

  // 获取机器类型描述
  if (parsedData.nt_headers && parsedData.nt_headers.FileHeader) {
    const machineType = parsedData.nt_headers.FileHeader.Machine || 0;
    machineDesc = getMachineTypeFullInfo(machineType);
  }

  detailsTitle.textContent = `${t("peOverview")} (${bitInfo})`;
  peDetails.innerHTML = "";

  const container = document.createElement("div");
  container.className = "pe-details-section";

  // 添加位数和架构突出显示
  const archHeader = document.createElement("h4");
  archHeader.innerHTML = `${t("architectureInfo")}: <span style="color: ${
    is64Bit ? "#4CAF50" : "#2196F3"
  }; font-weight: bold;">${machineDesc}</span>`;
  container.appendChild(archHeader);

  // DOS头信息
  if (parsedData.dos_header) {
    const dosRows = [
      [
        t("magic"),
        String(parsedData.dos_header.e_magic || "N/A"),
        `0x${(parsedData.dos_header.e_magic || 0).toString(16).toUpperCase()}`,
        t("mzIdentifier"),
      ],
      [
        t("ntHeaderOffset"),
        String(parsedData.dos_header.e_lfanew || "N/A"),
        `0x${(parsedData.dos_header.e_lfanew || 0).toString(16).toUpperCase()}`,
        t("ntHeaderPosition"),
      ],
    ];
    container.appendChild(
      createTable(
        t("dosHeaderInfo"),
        [t("field"), t("value"), t("hex"), t("description")],
        dosRows,
        ["", "pe-details-value", "pe-details-hex", ""],
      ),
    );
  }

  // NT头信息
  if (parsedData.nt_headers) {
    const ntRows = [];
    ntRows.push([
      t("signature"),
      String(parsedData.nt_headers.Signature || "N/A"),
      `0x${(parsedData.nt_headers.Signature || 0).toString(16).toUpperCase()}`,
      t("peIdentifier"),
    ]);

    if (parsedData.nt_headers.FileHeader) {
      const machineType = parsedData.nt_headers.FileHeader.Machine || 0;
      ntRows.push([
        t("machineType"),
        getMachineTypeFullInfo(machineType),
        `0x${machineType.toString(16).toUpperCase()}`,
        t("targetCPU"),
      ]);
      ntRows.push([
        t("numberOfSections"),
        String(parsedData.nt_headers.FileHeader.NumberOfSections || "N/A"),
        "",
        t("sectionsInTable"),
      ]);
    }

    if (parsedData.nt_headers.OptionalHeader) {
      ntRows.push([
        t("addressOfEntryPoint"),
        String(
          parsedData.nt_headers.OptionalHeader.AddressOfEntryPoint || "N/A",
        ),
        formatAddress(
          parsedData.nt_headers.OptionalHeader.AddressOfEntryPoint || 0,
        ),
        t("entryPointAddress"),
      ]);
      ntRows.push([
        t("imageBase"),
        String(parsedData.nt_headers.OptionalHeader.ImageBase || "N/A"),
        formatAddress(parsedData.nt_headers.OptionalHeader.ImageBase || 0),
        t("imageBaseAddress"),
      ]);
    }
    container.appendChild(
      createTable(
        t("ntHeaderInfo"),
        [t("field"), t("value"), t("hex"), t("description")],
        ntRows,
        ["", "pe-details-value", "pe-details-hex", ""],
      ),
    );
  }

  // 节信息
  if (parsedData.sections && parsedData.sections.length > 0) {
    const sectionRows = parsedData.sections.map((section, index) => {
      const sectionName = section.Name
        ? section.Name.replace(/\0/g, "")
        : `Section ${index + 1}`;
      return [
        sectionName,
        String(section.VirtualSize || "N/A"),
        formatAddress(section.VirtualAddress || 0),
        String(section.SizeOfRawData || "N/A"),
        formatAddress(section.PointerToRawData || 0),
        `0x${(section.Characteristics || 0).toString(16).toUpperCase()}`,
      ];
    });
    container.appendChild(
      createTable(
        t("sectionInfo"),
        [
          t("sectionName"),
          t("virtualSize"),
          t("virtualAddress"),
          t("rawSize"),
          t("rawPointer"),
          t("characteristics"),
        ],
        sectionRows,
        [
          "pe-details-value",
          "pe-details-value",
          "pe-details-hex",
          "pe-details-value",
          "pe-details-hex",
          "pe-details-hex",
        ],
      ),
    );
  }

  // 导出函数统计
  if (
    parsedData.exports &&
    parsedData.exports.functions &&
    parsedData.exports.functions.length > 0
  ) {
    const exportCount = parsedData.exports.functions.length;
    const exportRows = [
      [
        t("exportFunctionCount"),
        String(exportCount),
        "",
        t("clickLeftTreeForDetails"),
      ],
    ];
    container.appendChild(
      createTable(
        t("exportFunctionStats"),
        [t("type"), t("count"), "", t("description")],
        exportRows,
        ["", "pe-details-value", "", ""],
      ),
    );
  }

  // 导入函数统计
  if (parsedData.imports && parsedData.imports.length > 0) {
    let totalFunctions = 0;
    const importRows = parsedData.imports.map((dll) => {
      const funcCount = dll.functions ? dll.functions.length : 0;
      totalFunctions += funcCount;
      return [dll.name, String(funcCount)];
    });
    importRows.push([t("total"), String(totalFunctions)]);

    container.appendChild(
      createTable(
        t("importDLLStats"),
        [t("dllName"), t("functionCount")],
        importRows,
        ["", "pe-details-value"],
      ),
    );
  }

  peDetails.appendChild(container);
}

/**
 * 显示 DOS 头部详情
 */
function showPEDosHeader(
  parsedData,
  peDetails,
  detailsTitle,
  hideSearchBox,
  generateValueDetails,
) {
  if (!parsedData || !parsedData.dos_header || !peDetails || !detailsTitle) {
    return;
  }

  hideSearchBox();

  detailsTitle.textContent = t("dosHeaderDetails");
  peDetails.innerHTML = "";

  const container = document.createElement("div");
  container.className = "pe-details-section";

  const header = document.createElement("h4");
  header.textContent = t("dosHeaderStructure");
  container.appendChild(header);
  container.appendChild(
    generateValueDetails(parsedData.dos_header, "dos_header"),
  );

  peDetails.appendChild(container);
}

/**
 * 显示 COFF 头部详情
 */
function showPECoffHeader(
  parsedData,
  peDetails,
  detailsTitle,
  hideSearchBox,
  generateValueDetails,
) {
  if (
    !parsedData ||
    !parsedData.nt_headers ||
    !parsedData.nt_headers.FileHeader ||
    !peDetails ||
    !detailsTitle
  ) {
    return;
  }

  hideSearchBox();

  detailsTitle.textContent = t("coffHeaderDetails");
  peDetails.innerHTML = "";

  const container = document.createElement("div");
  container.className = "pe-details-section";

  const header = document.createElement("h4");
  header.textContent = t("coffFileHeader");
  container.appendChild(header);
  container.appendChild(
    generateValueDetails(parsedData.nt_headers.FileHeader, "coff_header"),
  );

  peDetails.appendChild(container);
}

/**
 * 显示可选头部详情
 */
function showPEOptionalHeader(
  parsedData,
  peDetails,
  detailsTitle,
  hideSearchBox,
  generateValueDetails,
) {
  if (
    !parsedData ||
    !parsedData.nt_headers ||
    !parsedData.nt_headers.OptionalHeader ||
    !peDetails ||
    !detailsTitle
  ) {
    return;
  }

  hideSearchBox();

  detailsTitle.textContent = t("optionalHeaderDetails");
  peDetails.innerHTML = "";

  const container = document.createElement("div");
  container.className = "pe-details-section";

  const header = document.createElement("h4");
  header.textContent = t("optionalHeaderStructure");
  container.appendChild(header);
  container.appendChild(
    generateValueDetails(
      parsedData.nt_headers.OptionalHeader,
      "optional_header",
    ),
  );

  peDetails.appendChild(container);
}

/**
 * 显示数据目录详情
 */
function showPEDataDirectory(
  parsedData,
  peDetails,
  detailsTitle,
  createTable,
  hideSearchBox,
  showEmptyMessage,
) {
  if (
    !parsedData ||
    !parsedData.nt_headers ||
    !parsedData.nt_headers.OptionalHeader ||
    !peDetails ||
    !detailsTitle
  ) {
    return;
  }

  hideSearchBox();

  const dataDir = parsedData.nt_headers.OptionalHeader.DataDirectory;
  if (!dataDir) {
    showEmptyMessage(t("noDataDirectory"));
    return;
  }

  detailsTitle.textContent = t("dataDirectoryDetails");
  peDetails.innerHTML = "";

  const directoryNames = [
    t("exportTable"),
    t("importTable"),
    t("resourceTable"),
    t("exceptionTable"),
    t("certificateTable"),
    t("relocationTable"),
    t("debugInfo"),
    t("architectureData"),
    t("globalPointer"),
    t("tlsTable"),
    t("loadConfigTable"),
    t("boundImportTable"),
    t("iat"),
    t("delayImportTable"),
    t("clrRuntimeHeader"),
    t("reserved"),
  ];

  const dirRows = [];
  dataDir.forEach((dir, index) => {
    const name =
      index < directoryNames.length
        ? directoryNames[index]
        : `${t("entry")} ${index}`;
    dirRows.push([
      String(index),
      name,
      `0x${(dir.VirtualAddress || 0).toString(16).toUpperCase()}`,
      String(dir.Size || 0),
    ]);
  });

  peDetails.appendChild(
    createTable(
      t("dataDirectoryTable"),
      [t("index"), t("type"), t("virtualAddress"), t("size")],
      dirRows,
      [
        "pe-details-value",
        "pe-details-value",
        "pe-details-hex",
        "pe-details-value",
      ],
    ),
  );
}

/**
 * 显示所有节区列表
 */
function showPEAllSections(
  parsedData,
  peDetails,
  detailsTitle,
  createTable,
  hideSearchBox,
  showEmptyMessage,
) {
  if (!parsedData || !parsedData.sections || !peDetails || !detailsTitle) {
    return;
  }

  hideSearchBox();

  if (parsedData.sections.length === 0) {
    showEmptyMessage(t("noSections"));
    return;
  }

  detailsTitle.textContent = `${t("sectionsList")} (${t(
    "totalSections",
  ).replace("{count}", parsedData.sections.length)})`;
  peDetails.innerHTML = "";

  const sectionRows = parsedData.sections.map((section, index) => {
    const sectionName = section.Name
      ? section.Name.replace(/\0/g, "")
      : `Section ${index + 1}`;
    return [
      sectionName,
      `0x${(section.VirtualAddress || 0).toString(16).toUpperCase()}`,
      String(section.VirtualSize || 0),
      `0x${(section.PointerToRawData || 0).toString(16).toUpperCase()}`,
      String(section.SizeOfRawData || 0),
      `0x${(section.Characteristics || 0).toString(16).toUpperCase()}`,
    ];
  });

  peDetails.appendChild(
    createTable(
      t("allSectionsOverview"),
      [
        t("sectionName"),
        t("virtualAddress"),
        t("virtualSize"),
        t("rawPointer"),
        t("rawSize"),
        t("characteristics"),
      ],
      sectionRows,
      [
        "pe-details-value",
        "pe-details-hex",
        "pe-details-value",
        "pe-details-hex",
        "pe-details-value",
        "pe-details-hex",
      ],
    ),
  );
}

/**
 * 显示单个节区详情
 */
function showPESection(
  sectionName,
  parsedData,
  peDetails,
  detailsTitle,
  hideSearchBox,
  showEmptyMessage,
  generateValueDetails,
) {
  if (!parsedData || !parsedData.sections || !peDetails || !detailsTitle) {
    return;
  }

  hideSearchBox();

  const section = parsedData.sections.find((s) => {
    const name = s.Name ? s.Name.replace(/\0/g, "").trim() : "";
    return name === sectionName;
  });

  if (!section) {
    showEmptyMessage(t("sectionNotFound"));
    return;
  }

  detailsTitle.textContent = `${t("section")}: ${sectionName}`;
  peDetails.innerHTML = "";

  const container = document.createElement("div");
  container.className = "pe-details-section";

  const header = document.createElement("h4");
  header.textContent = t("sectionDetails").replace(
    "{sectionName}",
    sectionName,
  );
  container.appendChild(header);
  container.appendChild(
    generateValueDetails(section, `section_${sectionName}`),
  );

  peDetails.appendChild(container);
}
