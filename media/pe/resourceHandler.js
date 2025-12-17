/**
 * PE 资源文件处理模块
 * 负责资源文件的显示、解析和交互逻辑
 */

(function () {
  "use strict";

  /**
   * 显示资源总览
   * @param {any} parsedData - 解析后的PE数据
   * @param {HTMLElement} peDetails - 详情显示容器
   * @param {HTMLElement} detailsTitle - 标题元素
   * @param {Function} createTable - 创建表格的函数
   * @param {Function} formatAddress - 格式化地址的函数
   * @param {Function} hideSearchBox - 隐藏搜索框的函数
   * @param {Function} showEmptyMessage - 显示空消息的函数
   * @param {Function} t - 翻译函数
   */
  window.showResourcesOverview = function showResourcesOverview(
    parsedData,
    peDetails,
    detailsTitle,
    createTable,
    formatAddress,
    hideSearchBox,
    showEmptyMessage,
    t,
  ) {
    console.log("[ResourceHandler] showResourcesOverview called", {
      parsedData: parsedData,
      peDetails: peDetails,
      detailsTitle: detailsTitle,
      hasResources: parsedData && parsedData.resources,
      resourceCount:
        parsedData && parsedData.resources
          ? Object.keys(parsedData.resources).length
          : 0,
    });

    if (!parsedData || !peDetails || !detailsTitle) {
      console.error("[ResourceHandler] Missing required parameters");
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

        const typeName = resourceTypeMap[typeId] || t("unknownType");
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
  };

  /**
   * 辅助函数：在容器中显示单个图标
   * @param {any} entry - 图标资源条目
   * @param {number|string} iconId - 图标ID
   * @param {HTMLElement} container - 容器元素
   * @param {string} logPrefix - 日志前缀
   * @param {Function} t - 翻译函数
   */
  window.showIconInContainer = function showIconInContainer(
    entry,
    iconId,
    container,
    logPrefix,
    t,
  ) {
    showIconInContainerWithSize(
      entry,
      iconId,
      container,
      logPrefix,
      null,
      null,
      null,
      t,
    );
  };

  /**
   * 辅助函数：在容器中显示单个图标(带尺寸信息)
   * @param {any} entry - 图标资源条目
   * @param {number|string} iconId - 图标ID
   * @param {HTMLElement} container - 容器元素
   * @param {string} logPrefix - 日志前缀
   * @param {number|null} width - 宽度
   * @param {number|null} height - 高度
   * @param {number|null} bitCount - 位深度
   * @param {Function} t - 翻译函数
   */
  window.showIconInContainerWithSize = function showIconInContainerWithSize(
    entry,
    iconId,
    container,
    logPrefix,
    width,
    height,
    bitCount,
    t,
  ) {
    try {
      console.log(`[Icon ${logPrefix}] Starting to process icon ID ${iconId}`);

      // 获取图标数据
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
  };

  /**
   * 显示特定资源类型
   * @param {string} resourceType - 资源类型ID
   * @param {any} parsedData - 解析后的PE数据
   * @param {HTMLElement} peDetails - 详情显示容器
   * @param {HTMLElement} detailsTitle - 标题元素
   * @param {Function} createTable - 创建表格的函数
   * @param {Function} hideSearchBox - 隐藏搜索框的函数
   * @param {Function} showEmptyMessage - 显示空消息的函数
   * @param {Function} t - 翻译函数
   */
  window.showResourceType = function showResourceType(
    resourceType,
    parsedData,
    peDetails,
    detailsTitle,
    createTable,
    hideSearchBox,
    showEmptyMessage,
    t,
  ) {
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

    const resInfo = resourceTypeMap[typeId] || {
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

    // 根据类型调用不同的处理函数
    if (typeId === 3) {
      showIconResources(entries, peDetails, t);
    } else if (typeId === 2) {
      showBitmapResources(entries, peDetails, t);
    } else if (typeId === 14) {
      showIconGroupResources(entries, parsedData, peDetails, t);
    } else if (typeId === 6) {
      showStringTableResources(entries, peDetails, createTable, t);
    } else if (typeId === 16) {
      showVersionInfoResources(entries, peDetails, createTable, t);
    } else if (typeId === 24) {
      showManifestResources(entries, peDetails, t);
    }
  };

  /**
   * 显示图标资源
   */
  const showIconResources = function (entries, peDetails, t) {
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
      showIconInContainer(entry, entry.id, iconContainer, String(index), t);
    });

    peDetails.appendChild(iconContainer);
  };

  /**
   * 显示位图资源
   */
  const showBitmapResources = function (entries, peDetails, t) {
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
        const entryData = entry.data;
        const dataArray = entryData.data || entryData;
        const dibData = new Uint8Array(dataArray);

        // PE资源中的位图缺少BITMAPFILEHEADER (14字节)
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

        // 计算调色板大小
        let paletteSize = 0;
        if (bitCount <= 8) {
          const colorsUsed =
            dibData[32] |
            (dibData[33] << 8) |
            (dibData[34] << 16) |
            (dibData[35] << 24);
          paletteSize = (colorsUsed || 1 << bitCount) * 4;
        }

        const pixelDataOffset = 14 + headerSize + paletteSize;

        // 构建BITMAPFILEHEADER
        const fileHeader = new Uint8Array(14);
        fileHeader[0] = 0x42; // 'B'
        fileHeader[1] = 0x4d; // 'M'

        const fileSize = 14 + dibData.length;
        fileHeader[2] = fileSize & 0xff;
        fileHeader[3] = (fileSize >> 8) & 0xff;
        fileHeader[4] = (fileSize >> 16) & 0xff;
        fileHeader[5] = (fileSize >> 24) & 0xff;

        fileHeader[10] = pixelDataOffset & 0xff;
        fileHeader[11] = (pixelDataOffset >> 8) & 0xff;
        fileHeader[12] = (pixelDataOffset >> 16) & 0xff;
        fileHeader[13] = (pixelDataOffset >> 24) & 0xff;

        const bmpData = new Uint8Array(fileHeader.length + dibData.length);
        bmpData.set(fileHeader, 0);
        bmpData.set(dibData, fileHeader.length);

        const bitmapWrapper = document.createElement("div");
        bitmapWrapper.style.border = "1px solid var(--vscode-panel-border)";
        bitmapWrapper.style.padding = "10px";
        bitmapWrapper.style.borderRadius = "4px";
        bitmapWrapper.style.backgroundColor = "var(--vscode-editor-background)";

        const bitmapId =
          typeof entry.id === "string" ? entry.id : `#${entry.id}`;
        const infoDiv = document.createElement("div");
        infoDiv.style.marginBottom = "8px";
        infoDiv.style.fontSize = "11px";
        infoDiv.style.color = "var(--vscode-descriptionForeground)";
        infoDiv.textContent = `位图 ${bitmapId} (${width}x${Math.abs(height)}, ${bitCount}bit)`;
        bitmapWrapper.appendChild(infoDiv);

        const blob = new Blob([bmpData], { type: "image/bmp" });
        const url = URL.createObjectURL(blob);

        const img = document.createElement("img");
        img.src = url;
        img.style.maxWidth = "300px";
        img.style.maxHeight = "300px";
        img.style.display = "block";
        img.style.border = "1px solid var(--vscode-input-border)";
        img.style.backgroundColor = "#ffffff";
        img.style.cursor = "pointer";
        img.title = "点击保存位图";

        img.addEventListener("click", () => {
          const a = document.createElement("a");
          a.href = url;
          a.download = `bitmap_${bitmapId.replace(/[^a-zA-Z0-9]/g, "_")}.bmp`;
          a.click();
        });

        img.onload = () => {
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
  };

  /**
   * 显示图标组资源
   */
  const showIconGroupResources = function (entries, parsedData, peDetails, t) {
    const allIcons = parsedData.resources[3] || [];

    entries.forEach((groupEntry, groupIndex) => {
      const groupTitle = document.createElement("h4");
      const groupId =
        typeof groupEntry.id === "string" ? groupEntry.id : `#${groupEntry.id}`;
      groupTitle.textContent = `${t("iconGroup")} ${groupId}`;
      groupTitle.style.marginTop = groupIndex === 0 ? "20px" : "30px";
      peDetails.appendChild(groupTitle);

      try {
        const groupData = groupEntry.data;
        const groupArray = groupData.data || groupData;
        const groupBytes = new Uint8Array(groupArray);

        if (groupBytes.length < 6) {
          console.warn(`[Icon Group ${groupIndex}] Data too small`);
          return;
        }

        const iconCount = groupBytes[4] | (groupBytes[5] << 8);
        console.log(
          `[Icon Group ${groupIndex}] ID: ${groupId}, Count: ${iconCount}`,
        );

        const iconInfos = [];

        for (
          let i = 0;
          i < iconCount && 6 + i * 14 + 14 <= groupBytes.length;
          i++
        ) {
          const entryOffset = 6 + i * 14;
          const width = groupBytes[entryOffset] || 256;
          const height = groupBytes[entryOffset + 1] || 256;
          const bitCount =
            groupBytes[entryOffset + 6] | (groupBytes[entryOffset + 7] << 8);
          const iconId =
            groupBytes[entryOffset + 12] | (groupBytes[entryOffset + 13] << 8);

          const iconEntry = allIcons.find((icon) => icon.id === iconId);

          if (iconEntry) {
            iconInfos.push({
              entry: iconEntry,
              iconId: iconId,
              width: width,
              height: height,
              bitCount: bitCount,
              size: width * height,
            });
          }
        }

        iconInfos.sort((a, b) => b.size - a.size);

        const iconContainer = document.createElement("div");
        iconContainer.style.display = "flex";
        iconContainer.style.flexWrap = "wrap";
        iconContainer.style.gap = "10px";
        iconContainer.style.marginTop = "10px";

        iconInfos.forEach((info, index) => {
          showIconInContainerWithSize(
            info.entry,
            info.iconId,
            iconContainer,
            `${groupIndex}-${index}`,
            info.width,
            info.height,
            info.bitCount,
            t,
          );
        });

        peDetails.appendChild(iconContainer);
      } catch (error) {
        console.error(`[Icon Group ${groupIndex}] Parse error:`, error);
      }
    });
  };

  /**
   * 显示字符串表资源
   */
  const showStringTableResources = function (
    entries,
    peDetails,
    createTable,
    t,
  ) {
    const stringTableTitle = document.createElement("h4");
    stringTableTitle.textContent = t("stringContent");
    stringTableTitle.style.marginTop = "20px";
    peDetails.appendChild(stringTableTitle);

    try {
      const allStrings = [];

      entries.forEach((entry, entryIndex) => {
        const blockId =
          typeof entry.id === "number"
            ? entry.id
            : parseInt(String(entry.id).replace(/^#/, ""), 10);

        try {
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
        allStrings.sort((a, b) => a.id - b.id);

        const tableContainer = document.createElement("div");
        tableContainer.style.marginTop = "10px";

        const table = document.createElement("table");
        table.className = "pe-string-table";
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.marginBottom = "15px";

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
            th.style.width = "60px";
          } else if (index === 1) {
            th.style.width = "80px";
          }
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        allStrings.forEach((str) => {
          const row = document.createElement("tr");

          const idCell = document.createElement("td");
          idCell.textContent = String(str.id);
          idCell.className = "pe-details-value";
          idCell.style.width = "60px";
          idCell.style.padding = "4px 8px";
          idCell.style.borderBottom = "1px solid var(--vscode-panel-border)";
          idCell.style.fontFamily = "'Courier New', monospace";
          idCell.style.fontSize = "11px";
          row.appendChild(idCell);

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

          const contentCell = document.createElement("td");
          contentCell.style.padding = "4px 8px";
          contentCell.style.borderBottom =
            "1px solid var(--vscode-panel-border)";
          const textInput = document.createElement("input");
          textInput.type = "text";
          textInput.value = str.value || t("emptyString");
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
  };

  /**
   * 显示版本信息资源
   */
  const showVersionInfoResources = function (
    entries,
    peDetails,
    createTable,
    t,
  ) {
    const versionTitle = document.createElement("h4");
    versionTitle.textContent = t("versionInfoDetails");
    versionTitle.style.marginTop = "20px";
    peDetails.appendChild(versionTitle);

    try {
      const entryData = entries[0].data;
      const dataArray = entryData.data || entryData;
      const versionData = parseVersionInfo(dataArray);
      if (versionData) {
        const versionRows = Object.entries(versionData).map(([key, value]) => [
          key,
          String(value),
        ]);
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
  };

  /**
   * 显示清单文件资源
   */
  const showManifestResources = function (entries, peDetails, t) {
    const manifestTitle = document.createElement("h4");
    manifestTitle.textContent = t("manifestContent");
    manifestTitle.style.marginTop = "20px";
    peDetails.appendChild(manifestTitle);

    const entry = entries[0];
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
  };

  /**
   * 解析字符串表块
   * @param {Array<number>|Uint8Array} data - 字符串表块数据
   * @param {number} blockId - 块ID
   * @return {Array<{id: number, value: string, length: number}>}
   */
  const parseStringTableBlock = function (data, blockId) {
    try {
      const dataArray = Array.isArray(data) ? new Uint8Array(data) : data;
      const strings = [];
      const baseStringId = (blockId - 1) * 16;

      let offset = 0;
      for (let i = 0; i < 16 && offset < dataArray.length; i++) {
        if (offset + 2 > dataArray.length) {
          break;
        }

        const strLength = dataArray[offset] | (dataArray[offset + 1] << 8);
        offset += 2;

        if (strLength > 0) {
          if (offset + strLength * 2 > dataArray.length) {
            break;
          }

          const chars = [];
          for (let j = 0; j < strLength; j++) {
            const charCode =
              dataArray[offset + j * 2] | (dataArray[offset + j * 2 + 1] << 8);
            chars.push(charCode);
          }

          const strValue = String.fromCharCode(...chars);
          strings.push({
            id: baseStringId + i,
            value: strValue,
            length: strLength,
          });

          offset += strLength * 2;
        }
      }

      return strings;
    } catch (error) {
      console.error("Error parsing string table block:", error);
      return [];
    }
  };

  /**
   * 解析版本信息资源
   * @param {Array<number>|Uint8Array} data - 版本信息数据
   * @return {Object | null}
   */
  const parseVersionInfo = function (data) {
    try {
      const dataArray = Array.isArray(data) ? new Uint8Array(data) : data;
      const versionInfo = {};

      // 简化的版本信息解析
      // 实际的VS_VERSIONINFO结构比较复杂，这里只做基本解析
      if (dataArray.length > 40) {
        const fixedFileInfo = {
          dwSignature:
            dataArray[6] |
            (dataArray[7] << 8) |
            (dataArray[8] << 16) |
            (dataArray[9] << 24),
          dwStrucVersion:
            dataArray[10] |
            (dataArray[11] << 8) |
            (dataArray[12] << 16) |
            (dataArray[13] << 24),
          dwFileVersionMS:
            dataArray[14] |
            (dataArray[15] << 8) |
            (dataArray[16] << 16) |
            (dataArray[17] << 24),
          dwFileVersionLS:
            dataArray[18] |
            (dataArray[19] << 8) |
            (dataArray[20] << 16) |
            (dataArray[21] << 24),
        };

        if (fixedFileInfo.dwSignature === 0xfeef04bd) {
          const majorVer = (fixedFileInfo.dwFileVersionMS >> 16) & 0xffff;
          const minorVer = fixedFileInfo.dwFileVersionMS & 0xffff;
          const buildVer = (fixedFileInfo.dwFileVersionLS >> 16) & 0xffff;
          const revisionVer = fixedFileInfo.dwFileVersionLS & 0xffff;

          versionInfo["File Version"] =
            `${majorVer}.${minorVer}.${buildVer}.${revisionVer}`;
          return versionInfo;
        }
      }

      return null;
    } catch (error) {
      console.error("Error parsing version info:", error);
      return null;
    }
  };
})(); // 结束IIFE
