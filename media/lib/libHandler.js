/**
 * LIB 文件 (COFF Archive) 处理器
 */

/**
 * 创建LIB详情表格
 * @param {string} title - 表格标题
 * @param {Array<[string, string, string?]>} rows - 表格行 [标签, 值,
 *     描述(可选)]
 * @returns {string}
 */
function createLibTable(title, rows) {
  let html = `<h3>${title}</h3>`;
  html += "<table>";

  rows.forEach(([label, value, description]) => {
    html += `<tr><th>${label}</th><td>${value}`;
    if (description) {
      html += ` <span class="lib-description">${description}</span>`;
    }
    html += "</td></tr>";
  });

  html += "</table>";
  return html;
}

/**
 * 创建LIB列表表格
 * @param {string} title - 表格标题
 * @param {string[]} headers - 表头
 * @param {Array<string[]>} rows - 数据行
 * @param {Object} options - 可选配置
 * @returns {string}
 */
function createLibListTable(title, headers, rows, options = {}) {
  const { searchable = false, searchId = "", maxDisplay = 1000 } = options;

  let html = `<h3>${title}</h3>`;

  // 如果需要搜索框
  if (searchable) {
    html += `<div class="lib-search-container">`;
    html += `<input type="text" id="${searchId}" placeholder="${t(
      "libSearchPlaceholder",
    )}" class="lib-search-input" />`;
    html += `<div id="${searchId}Info" class="lib-search-info"></div>`;
    html += `</div>`;
  }

  html += "<table>";

  // 表头
  html += "<tr>";
  headers.forEach((header) => {
    html += `<th>${header}</th>`;
  });
  html += "</tr>";

  // 数据行
  let displayCount = 0;
  rows.forEach((row) => {
    if (displayCount >= maxDisplay) {
      return;
    }

    const rowClass = searchable ? "lib-searchable-row" : "";
    const dataAttr =
      searchable && row.length > 0
        ? `data-search="${escapeHtml(row[0].toLowerCase())}"`
        : "";

    html += `<tr class="${rowClass}" ${dataAttr}>`;
    row.forEach((cell) => {
      html += `<td>${cell}</td>`;
    });
    html += "</tr>";
    displayCount++;
  });

  // 如果有更多数据未显示
  if (rows.length > maxDisplay) {
    html += `<tr><td colspan="${headers.length}"><em>... ${t("andMoreItems", {
      count: rows.length - maxDisplay,
    })}</em></td></tr>`;
  }

  html += "</table>";
  return html;
}

/**
 * 设置LIB详情内容
 * @param {string} title - 标题
 * @param {string} content - HTML内容
 */
function setLibDetails(title, content) {
  const detailsContent = document.getElementById("peDetails");
  const detailsTitle = document.getElementById("detailsTitle");

  if (!detailsContent) {
    console.error("peDetails element not found");
    return;
  }

  if (detailsTitle) {
    detailsTitle.textContent = title;
  }

  detailsContent.innerHTML = content;
}

/**
 * 构建 LIB 文件的树形结构
 */
function buildLibTree(parsedData) {
  console.log("Building LIB tree structure", parsedData);

  // 更新页面标题
  const treeHeader = document.getElementById("peTreeHeader");
  if (treeHeader) {
    treeHeader.textContent = t("libViewerTitle");
  }

  // 更新 HTML title
  document.title = "LIB Viewer - COFF Archive Viewer";

  // 隐藏 PE 树和 ELF 树，显示 LIB 树
  const peTreeStructure = document.getElementById("peTreeStructure");
  const elfTreeStructure = document.getElementById("elfTreeStructure");
  const libTreeStructure = document.getElementById("libTreeStructure");

  console.log("Elements found:", {
    peTreeStructure: !!peTreeStructure,
    elfTreeStructure: !!elfTreeStructure,
    libTreeStructure: !!libTreeStructure,
  });

  if (peTreeStructure) {
    peTreeStructure.style.display = "none";
  }

  if (elfTreeStructure) {
    elfTreeStructure.style.display = "none";
  }

  if (libTreeStructure) {
    libTreeStructure.style.display = "";
  }

  // 清空现有内容
  if (libTreeStructure) {
    libTreeStructure.innerHTML = "";
  }

  // 确保存在 libData
  if (!parsedData || !parsedData.libData) {
    console.error("No LIB data found", parsedData);
    return;
  }

  const libData = parsedData.libData;
  console.log("LIB data:", libData);

  // 创建 LIB 文件头部节点
  const libHeader = document.createElement("div");
  libHeader.className = "pe-tree-item pe-tree-top-level";
  libHeader.setAttribute("data-item", "lib_header");
  libHeader.innerHTML = `📁 <span id="lib_header">${t("libHeader")}</span>`;

  // 创建成员列表节点
  const libMembers = document.createElement("details");
  libMembers.className = "pe-tree-group";
  libMembers.open = true;
  const memberCount = libData.members ? libData.members.length : 0;
  const summary = document.createElement("summary");
  summary.className = "pe-tree-item";
  summary.setAttribute("data-item", "lib_members");
  summary.innerHTML = `📂 <span>${t("libMembers")}</span> <span class="pe-tree-count">(${
    memberCount
  })</span>`;
  libMembers.appendChild(summary);

  const membersList = document.createElement("div");
  membersList.id = "libMembersList";
  membersList.className = "pe-tree-children";

  // 添加所有成员，并保存到数组中以便后续访问
  const normalMembers = [];
  if (libData.members) {
    libData.members.forEach((member, index) => {
      // 跳过特殊成员（链接器成员和长文件名表）
      if (member.name === "/" || member.name === "//") {
        return;
      }

      const memberIndex = normalMembers.length;
      normalMembers.push(member);

      const memberItem = document.createElement("div");
      memberItem.className = "pe-tree-item pe-tree-leaf";
      memberItem.setAttribute("data-item", `lib_member_${memberIndex}`);
      memberItem.innerHTML = `📄 <span>${member.name}</span>`;
      membersList.appendChild(memberItem);
    });
  }

  libMembers.appendChild(membersList);

  // 添加到 DOM
  libTreeStructure.appendChild(libHeader);
  libTreeStructure.appendChild(libMembers);

  // 创建导出符号列表节点（如果有）
  console.log(
    "Checking symbols:",
    libData.symbols,
    "Type:",
    typeof libData.symbols,
  );
  if (libData.symbols) {
    console.log("Symbols keys:", Object.keys(libData.symbols));
    console.log("Symbols length:", Object.keys(libData.symbols).length);
  }

  if (libData.symbols && Object.keys(libData.symbols).length > 0) {
    const libExports = document.createElement("div");
    libExports.className = "pe-tree-item pe-tree-top-level";
    libExports.setAttribute("data-item", "lib_exports");
    const exportCount = Object.keys(libData.symbols).length;
    libExports.innerHTML = `📤 <span>${t(
      "libExports",
    )}</span> <span class="pe-tree-count">(${exportCount})</span>`;
    libExports.style.display = "";

    libTreeStructure.appendChild(libExports);
    console.log("Export node added with count:", exportCount);
  } else {
    console.log("No symbols found or symbols is empty");
  }

  // 添加点击事件（使用事件委托）
  libTreeStructure.addEventListener("click", function (e) {
    const target = e.target.closest(".pe-tree-item");
    if (!target) return;

    const itemId = target.getAttribute("data-item");
    if (itemId === "lib_header") {
      showLibOverview(libData);
    } else if (itemId === "lib_exports") {
      showLibExports(libData.symbols);
    } else if (itemId && itemId.startsWith("lib_member_")) {
      const index = parseInt(itemId.replace("lib_member_", ""));
      if (index < normalMembers.length) {
        showLibMember(normalMembers[index], index);
      }
    }
  });

  // 默认显示 LIB 文件总览
  showLibOverview(libData);
}

/**
 * 显示 LIB 文件总览
 */
function showLibOverview(libData) {
  const totalMembers = libData.members ? libData.members.length : 0;
  const normalMembers = libData.members
    ? libData.members.filter((m) => m.name !== "/" && m.name !== "//").length
    : 0;
  const exportCount = libData.symbols ? Object.keys(libData.symbols).length : 0;

  let totalSize = 0;
  if (libData.members) {
    libData.members.forEach((member) => {
      totalSize += member.size || 0;
    });
  }

  let html = "";

  // 基本信息
  const basicInfoRows = [
    [t("libMemberCount"), totalMembers.toString()],
    [t("libNormalMemberCount"), normalMembers.toString()],
    [t("libExportCount"), exportCount.toString()],
    [t("libTotalSize"), `${totalSize} ${t("bytes")}`, formatSize(totalSize)],
  ];
  html += createLibTable(t("libBasicInfo"), basicInfoRows);

  // 成员文件列表（前10个）
  if (normalMembers > 0) {
    const memberRows = [];
    let count = 0;

    for (const member of libData.members) {
      if (member.name === "/" || member.name === "//") continue;
      if (count >= 10) break;

      memberRows.push([
        escapeHtml(member.name),
        `${member.size} ${t("bytes")}`,
      ]);
      count++;
    }

    html += createLibListTable(
      t("libTopMembers"),
      [t("libMemberName"), t("libMemberSize")],
      memberRows,
    );

    if (normalMembers > 10) {
      html += `<p class="lib-hint-text">... ${t("andMoreMembers", {
        count: normalMembers - 10,
      })}</p>`;
    }
  }

  // 导出符号统计
  if (exportCount > 0) {
    const exportStatsRows = [[t("libExportCount"), exportCount.toString()]];
    html += createLibTable(t("libExportStats"), exportStatsRows);
    html += `<p class="lib-hint-text"><em>${t(
      "libClickExportsForDetails",
    )}</em></p>`;
  }

  setLibDetails(t("libOverview"), html);
}

/**
 * 显示成员详细信息
 */
function showLibMember(member, index) {
  let html = "";

  // 基本信息
  const basicRows = [
    [t("libMemberName"), escapeHtml(member.name)],
    [t("libMemberIndex"), index.toString()],
    [
      t("libMemberSize"),
      `${member.size} ${t("bytes")}`,
      formatSize(member.size),
    ],
    [t("libMemberOffset"), `0x${member.offset.toString(16).toUpperCase()}`],
  ];

  if (member.timestamp) {
    const date = new Date(member.timestamp * 1000);
    basicRows.push([t("libMemberTimestamp"), date.toLocaleString()]);
  }

  if (member.uid !== undefined) {
    basicRows.push([t("libMemberUID"), member.uid.toString()]);
  }

  if (member.gid !== undefined) {
    basicRows.push([t("libMemberGID"), member.gid.toString()]);
  }

  if (member.mode !== undefined) {
    basicRows.push([t("libMemberMode"), `0${member.mode.toString(8)}`]);
  }

  html += createLibTable(t("libMemberDetails"), basicRows);

  // 十六进制预览
  if (member.data && member.data.length > 0) {
    html += `<h3>${t("libMemberDataPreview")}</h3>`;
    html += '<div class="hex-preview">';

    const previewSize = Math.min(member.size, 256);
    for (let i = 0; i < previewSize; i += 16) {
      const offset = i.toString(16).toUpperCase().padStart(8, "0");
      html += `<div class="hex-line"><span class="hex-offset">${offset}:</span> `;

      let hexPart = "";
      let asciiPart = "";
      for (let j = 0; j < 16; j++) {
        if (i + j < previewSize) {
          const byte = member.data[i + j];
          hexPart += byte.toString(16).toUpperCase().padStart(2, "0") + " ";
          asciiPart +=
            byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".";
        } else {
          hexPart += "   ";
          asciiPart += " ";
        }
      }

      html += `<span class="hex-bytes">${hexPart}</span>`;
      html += `<span class="hex-ascii">${asciiPart}</span>`;
      html += "</div>";
    }

    if (member.size > 256) {
      html += `<div class="hex-more">... ${t("libMoreBytes", {
        count: member.size - 256,
      })}</div>`;
    }

    html += "</div>";
  }

  setLibDetails(`${t("libMemberDetails")}: ${escapeHtml(member.name)}`, html);
}

/**
 * 显示导出符号列表
 */
function showLibExports(symbols) {
  const exportCount = Object.keys(symbols).length;

  // 对符号进行排序
  const sortedSymbols = Object.entries(symbols).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  // 准备数据行
  const maxDisplay = 1000;
  const symbolRows = sortedSymbols
    .slice(0, maxDisplay)
    .map(([symbolName, memberName]) => [
      escapeHtml(symbolName),
      escapeHtml(memberName),
    ]);

  let html = `<p class="lib-section-description">${t("libExportsDescription")}</p>`;

  html += createLibListTable(
    "", // 标题在setLibDetails中设置
    [t("libExportName"), t("libExportMember")],
    symbolRows,
    { searchable: true, searchId: "libExportSearch", maxDisplay: maxDisplay },
  );

  setLibDetails(`${t("libExports")} (${exportCount})`, html);

  // 添加搜索功能
  setupLibExportSearch(sortedSymbols.length, maxDisplay);
}

/**
 * 设置导出符号搜索功能
 */
function setupLibExportSearch(totalCount, maxDisplay) {
  const searchInput = document.getElementById("libExportSearch");
  const searchInfo = document.getElementById("libExportSearchInfo");
  const rows = document.querySelectorAll(".lib-searchable-row");

  if (!searchInput) return;

  searchInput.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase();
    let visibleCount = 0;

    rows.forEach((row) => {
      const symbolName = row.getAttribute("data-search");
      if (!symbolName) {
        row.style.display = "none";
        return;
      }

      if (symbolName.includes(searchTerm)) {
        row.style.display = "";
        visibleCount++;
      } else {
        row.style.display = "none";
      }
    });

    // 更新搜索结果信息
    if (searchTerm && searchInfo) {
      searchInfo.textContent = t("libSearchResults", {
        filtered: visibleCount,
        total: Math.min(totalCount, maxDisplay),
      });
    } else if (searchInfo) {
      searchInfo.textContent = "";
    }
  });
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
