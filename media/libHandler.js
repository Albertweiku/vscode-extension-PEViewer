/**
 * LIB 文件 (COFF Archive) 处理器
 */

/**
 * 构建 LIB 文件的树形结构
 */
function buildLibTree(parsedData) {
  console.log("Building LIB tree structure");

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
  libTreeStructure.innerHTML = "";

  // 确保存在 libData
  if (!parsedData || !parsedData.libData) {
    console.error("No LIB data found");
    return;
  }

  const libData = parsedData.libData;

  // 创建 LIB 文件头部节点
  const libHeader = document.createElement("div");
  libHeader.className = "tree-item";
  libHeader.innerHTML = `<span id="lib_header" class="tree-label clickable">${t(
    "libHeader",
  )}</span>`;

  // 创建成员列表节点
  const libMembers = document.createElement("div");
  libMembers.className = "tree-item";
  const memberCount = libData.members ? libData.members.length : 0;
  libMembers.innerHTML = `<span class="tree-label">${t("libMembers")} (${memberCount})</span>`;

  const membersList = document.createElement("ul");
  membersList.id = "libMembersList";
  membersList.className = "tree-children";

  // 添加所有成员
  if (libData.members) {
    libData.members.forEach((member, index) => {
      // 跳过特殊成员（链接器成员和长文件名表）
      if (member.name === "/" || member.name === "//") {
        return;
      }

      const memberItem = document.createElement("li");
      memberItem.className = "tree-item";
      memberItem.innerHTML = `<span id="lib_member_${
        index
      }" class="tree-label clickable">${member.name}</span>`;
      membersList.appendChild(memberItem);

      // 添加点击事件
      document
        .getElementById(`lib_member_${index}`)
        .addEventListener("click", function () {
          showLibMember(member, index);
        });
    });
  }

  libMembers.appendChild(membersList);

  // 添加到 DOM
  libTreeStructure.appendChild(libHeader);
  libTreeStructure.appendChild(libMembers);

  // 创建符号列表节点（如果有）
  if (libData.symbols && Object.keys(libData.symbols).length > 0) {
    const libSymbols = document.createElement("div");
    libSymbols.className = "tree-item";
    const symbolCount = Object.keys(libData.symbols).length;
    libSymbols.innerHTML = `<span id="lib_symbols" class="tree-label clickable">${t(
      "libSymbols",
    )} (${symbolCount})</span>`;

    libTreeStructure.appendChild(libSymbols);

    // 添加符号点击事件
    document
      .getElementById("lib_symbols")
      ?.addEventListener("click", function () {
        showLibSymbols(libData.symbols);
      });
  }

  // 添加 LIB 文件头部点击事件
  document.getElementById("lib_header").addEventListener("click", function () {
    showLibHeader(libData);
  });

  // 默认显示 LIB 头部信息
  showLibHeader(libData);
}

/**
 * 显示 LIB 文件头部信息
 */
function showLibHeader(libData) {
  const detailsContent = document.getElementById("detailsContent");
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

  // 符号数量
  if (libData.symbols) {
    html += `<tr><th>${t("libSymbolCount")}</th><td>${
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
  const detailsContent = document.getElementById("detailsContent");
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
 * 显示符号索引表
 */
function showLibSymbols(symbols) {
  const detailsContent = document.getElementById("detailsContent");
  let html = `<h2>${t("libSymbols")} (${Object.keys(symbols).length})</h2>`;

  html += "<table>";
  html += `<tr><th>${t("libSymbolName")}</th><th>${t("libSymbolMember")}</th></tr>`;

  // 对符号进行排序
  const sortedSymbols = Object.entries(symbols).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  // 限制显示数量，避免太长
  const maxDisplay = 1000;
  let displayCount = 0;

  for (const [symbolName, memberName] of sortedSymbols) {
    if (displayCount >= maxDisplay) {
      html += `<tr><td colspan="2"><em>${t("libMoreSymbols", {
        count: sortedSymbols.length - maxDisplay,
      })}</em></td></tr>`;
      break;
    }
    html += `<tr><td>${escapeHtml(symbolName)}</td><td>${escapeHtml(
      memberName,
    )}</td></tr>`;
    displayCount++;
  }

  html += "</table>";

  detailsContent.innerHTML = html;
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
