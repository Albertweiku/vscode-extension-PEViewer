/**
 * LIB 文件 (COFF Archive) 处理器
 */

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
  console.log("showLibOverview called", libData);
  const detailsContent = document.getElementById("peDetails");
  if (!detailsContent) {
    console.error("peDetails element not found");
    return;
  }

  let html = `<h2>${t("libOverview")}</h2>`;

  // 基本信息表格
  html += "<h3>" + t("libBasicInfo") + "</h3>";
  html += "<table>";

  // 成员总数
  const totalMembers = libData.members ? libData.members.length : 0;
  html += `<tr><th>${t("libMemberCount")}</th><td>${totalMembers}</td></tr>`;

  // 普通成员数量
  let normalMembers = 0;
  if (libData.members) {
    normalMembers = libData.members.filter(
      (m) => m.name !== "/" && m.name !== "//",
    ).length;
  }
  html += `<tr><th>${t("libNormalMemberCount")}</th><td>${normalMembers}</td></tr>`;

  // 导出符号数量
  const exportCount = libData.symbols ? Object.keys(libData.symbols).length : 0;
  html += `<tr><th>${t("libExportCount")}</th><td>${exportCount}</td></tr>`;

  // 总大小
  let totalSize = 0;
  if (libData.members) {
    libData.members.forEach((member) => {
      totalSize += member.size || 0;
    });
  }
  html += `<tr><th>${t("libTotalSize")}</th><td>${totalSize} ${t("bytes")} (${formatSize(
    totalSize,
  )})</td></tr>`;

  html += "</table>";

  // 成员文件列表（显示前10个）
  if (normalMembers > 0) {
    html += "<h3>" + t("libTopMembers") + "</h3>";
    html += "<table>";
    html += `<tr><th>${t("libMemberName")}</th><th>${t("libMemberSize")}</th></tr>`;

    let count = 0;
    for (const member of libData.members) {
      if (member.name === "/" || member.name === "//") continue;
      if (count >= 10) break;

      html += `<tr><td>${escapeHtml(member.name)}</td><td>${member.size} ${t(
        "bytes",
      )}</td></tr>`;
      count++;
    }

    if (normalMembers > 10) {
      html += `<tr><td colspan="2"><em>... ${t("andMoreMembers", {
        count: normalMembers - 10,
      })}</em></td></tr>`;
    }
    html += "</table>";
  }

  // 导出符号统计
  if (exportCount > 0) {
    html += "<h3>" + t("libExportStats") + "</h3>";
    html += "<table>";
    html += `<tr><th>${t("libExportCount")}</th><td>${exportCount}</td></tr>`;
    html += `<tr><td colspan="2"><em>${t(
      "libClickExportsForDetails",
    )}</em></td></tr>`;
    html += "</table>";
  }

  console.log("Setting innerHTML", html.substring(0, 200));
  detailsContent.innerHTML = html;
}

/**
 * 显示 LIB 文件头部信息
 */
function showLibHeader(libData) {
  const detailsContent = document.getElementById("peDetails");
  let html = `<h2>${t("libHeader")}</h2>`;

  html += "<table>";
  html += `<tr><th>${t("libMemberCount")}</th><td>${
    libData.members ? libData.members.length : 0
  }</td></tr>`;

  // 统计普通成员数量（排除特殊成员）
  let normalMembers = 0;
  if (libData.members) {
    normalMembers = libData.members.filter(
      (m) => m.name !== "/" && m.name !== "//",
    ).length;
  }
  html += `<tr><th>${t("libNormalMemberCount")}</th><td>${normalMembers}</td></tr>`;

  // 导出符号数量
  if (libData.symbols) {
    html += `<tr><th>${t("libExportCount")}</th><td>${
      Object.keys(libData.symbols).length
    }</td></tr>`;
  }

  // 计算总大小
  let totalSize = 0;
  if (libData.members) {
    libData.members.forEach((member) => {
      totalSize += member.size || 0;
    });
  }
  html += `<tr><th>${t("libTotalSize")}</th><td>${totalSize} ${t(
    "bytes",
  )}</td></tr>`;

  html += "</table>";

  detailsContent.innerHTML = html;
}

/**
 * 显示成员详细信息
 */
function showLibMember(member, index) {
  const detailsContent = document.getElementById("peDetails");
  let html = `<h2>${t("libMemberDetails")}: ${member.name}</h2>`;

  html += "<table>";
  html += `<tr><th>${t("libMemberName")}</th><td>${member.name}</td></tr>`;
  html += `<tr><th>${t("libMemberIndex")}</th><td>${index}</td></tr>`;
  html += `<tr><th>${t("libMemberSize")}</th><td>${member.size} ${t(
    "bytes",
  )}</td></tr>`;
  html += `<tr><th>${t("libMemberOffset")}</th><td>0x${member.offset
    .toString(16)
    .toUpperCase()}</td></tr>`;

  // 时间戳
  if (member.timestamp) {
    const date = new Date(member.timestamp * 1000);
    html += `<tr><th>${t("libMemberTimestamp")}</th><td>${date.toLocaleString()}</td></tr>`;
  }

  // UID/GID/Mode
  if (member.uid !== undefined) {
    html += `<tr><th>${t("libMemberUID")}</th><td>${member.uid}</td></tr>`;
  }
  if (member.gid !== undefined) {
    html += `<tr><th>${t("libMemberGID")}</th><td>${member.gid}</td></tr>`;
  }
  if (member.mode !== undefined) {
    html += `<tr><th>${t("libMemberMode")}</th><td>0${member.mode.toString(
      8,
    )}</td></tr>`;
  }

  html += "</table>";

  // 如果有数据，显示十六进制预览
  if (member.data && member.data.length > 0) {
    html += `<h3>${t("libMemberDataPreview")}</h3>`;
    html += '<div class="hex-preview">';

    // 只显示前 256 字节
    const previewSize = Math.min(member.size, 256);
    for (let i = 0; i < previewSize; i += 16) {
      const offset = i.toString(16).toUpperCase().padStart(8, "0");
      html += `<div class="hex-line"><span class="hex-offset">${offset}:</span> `;

      // 十六进制部分
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
      html += `<div class="hex-more">... (${t("libMoreBytes", {
        count: member.size - 256,
      })})</div>`;
    }

    html += "</div>";
  }

  detailsContent.innerHTML = html;
}

/**
 * 显示导出符号列表
 */
function showLibExports(symbols) {
  const detailsContent = document.getElementById("peDetails");
  const exportCount = Object.keys(symbols).length;

  let html = `<h2>${t("libExports")} (${exportCount})</h2>`;

  // 添加说明
  html += `<p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 16px;">${t(
    "libExportsDescription",
  )}</p>`;

  // 添加搜索框
  html += `<div style="margin-bottom: 16px;">`;
  html += `<input type="text" id="libExportSearch" placeholder="${t(
    "libSearchPlaceholder",
  )}" style="width: 100%; padding: 6px 8px; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); font-family: var(--vscode-font-family); font-size: 13px;" />`;
  html += `<div id="libExportSearchInfo" style="margin-top: 8px; font-size: 12px; color: var(--vscode-descriptionForeground);"></div>`;
  html += `</div>`;

  // 对符号进行排序
  const sortedSymbols = Object.entries(symbols).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  // 创建表格容器
  html += `<div id="libExportTableContainer">`;
  html += "<table id='libExportTable'>";
  html += `<tr><th>${t("libExportName")}</th><th>${t("libExportMember")}</th></tr>`;

  // 限制显示数量，避免太长
  const maxDisplay = 1000;
  let displayCount = 0;

  for (const [symbolName, memberName] of sortedSymbols) {
    if (displayCount >= maxDisplay) {
      html += `<tr class="lib-export-row"><td colspan="2"><em>${t(
        "libMoreExports",
        {
          count: sortedSymbols.length - maxDisplay,
        },
      )}</em></td></tr>`;
      break;
    }
    html += `<tr class="lib-export-row" data-symbol="${escapeHtml(
      symbolName.toLowerCase(),
    )}"><td class="lib-export-name">${escapeHtml(symbolName)}</td><td>${escapeHtml(
      memberName,
    )}</td></tr>`;
    displayCount++;
  }

  html += "</table>";
  html += "</div>";

  detailsContent.innerHTML = html;

  // 添加搜索事件监听器
  const searchInput = document.getElementById("libExportSearch");
  const searchInfo = document.getElementById("libExportSearchInfo");
  const rows = document.querySelectorAll(".lib-export-row");

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      const searchTerm = this.value.toLowerCase();
      let visibleCount = 0;

      rows.forEach((row) => {
        const symbolName = row.getAttribute("data-symbol");
        if (!symbolName) {
          // 这是"更多导出"提示行，始终隐藏
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
      if (searchTerm) {
        searchInfo.textContent = t("libSearchResults", {
          filtered: visibleCount,
          total: Math.min(sortedSymbols.length, maxDisplay),
        });
      } else {
        searchInfo.textContent = "";
      }
    });
  }
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
