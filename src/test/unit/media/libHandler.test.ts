import { beforeAll, describe, expect, it } from "vitest";

import { loadScripts } from "../../helpers/scriptLoader";

let ctx: Record<string, any>;

beforeAll(() => {
  ctx = loadScripts(["shared/locales.js", "lib/libHandler.js"], {
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: (tag: string) => ({
        textContent: "",
        get innerHTML() {
          return (this.textContent as string)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
        },
      }),
      title: "",
    },
  });
});

// ---------------------------------------------------------------------------
// formatSize
// ---------------------------------------------------------------------------
describe("formatSize", () => {
  it("should format bytes", () => {
    expect(ctx.formatSize(0)).toBe("0 B");
    expect(ctx.formatSize(512)).toBe("512 B");
    expect(ctx.formatSize(1023)).toBe("1023 B");
  });

  it("should format kilobytes", () => {
    expect(ctx.formatSize(1024)).toBe("1.00 KB");
    expect(ctx.formatSize(1536)).toBe("1.50 KB");
    expect(ctx.formatSize(10240)).toBe("10.00 KB");
  });

  it("should format megabytes", () => {
    expect(ctx.formatSize(1048576)).toBe("1.00 MB");
    expect(ctx.formatSize(5 * 1024 * 1024)).toBe("5.00 MB");
  });

  it("should format gigabytes", () => {
    expect(ctx.formatSize(1073741824)).toBe("1.00 GB");
    expect(ctx.formatSize(2.5 * 1024 * 1024 * 1024)).toBe("2.50 GB");
  });
});

// ---------------------------------------------------------------------------
// createLibTable
// ---------------------------------------------------------------------------
describe("createLibTable", () => {
  it("should generate HTML with title and rows", () => {
    const html = ctx.createLibTable("Test Table", [
      ["Label1", "Value1"],
      ["Label2", "Value2"],
    ]);
    expect(html).toContain("<h3>Test Table</h3>");
    expect(html).toContain("<th>Label1</th>");
    expect(html).toContain("<td>Value1");
    expect(html).toContain("<th>Label2</th>");
    expect(html).toContain("<td>Value2");
  });

  it("should include description when provided", () => {
    const html = ctx.createLibTable("T", [["L", "V", "Desc text"]]);
    expect(html).toContain("lib-description");
    expect(html).toContain("Desc text");
  });

  it("should not include description span when absent", () => {
    const html = ctx.createLibTable("T", [["L", "V"]]);
    expect(html).not.toContain("lib-description");
  });

  it("should handle empty rows", () => {
    const html = ctx.createLibTable("Empty", []);
    expect(html).toContain("<table>");
    expect(html).toContain("</table>");
  });
});

// ---------------------------------------------------------------------------
// createLibListTable
// ---------------------------------------------------------------------------
describe("createLibListTable", () => {
  it("should generate table with headers and rows", () => {
    const html = ctx.createLibListTable(
      "List",
      ["Col1", "Col2"],
      [
        ["a", "b"],
        ["c", "d"],
      ],
    );
    expect(html).toContain("<h3>List</h3>");
    expect(html).toContain("<th>Col1</th>");
    expect(html).toContain("<th>Col2</th>");
    expect(html).toContain("<td>a</td>");
    expect(html).toContain("<td>d</td>");
  });

  it("should respect maxDisplay option", () => {
    const rows = Array.from({ length: 20 }, (_, i) => [String(i)]);
    const html = ctx.createLibListTable("Limit", ["#"], rows, {
      maxDisplay: 5,
    });
    // Should contain rows 0-4 but not 5+
    expect(html).toContain("<td>0</td>");
    expect(html).toContain("<td>4</td>");
    expect(html).not.toContain("<td>5</td>");
  });

  it("should add search UI when searchable is true", () => {
    const html = ctx.createLibListTable("S", ["H"], [["r"]], {
      searchable: true,
      searchId: "testSearch",
    });
    expect(html).toContain('id="testSearch"');
    expect(html).toContain("lib-search-input");
  });

  it("should not add search UI by default", () => {
    const html = ctx.createLibListTable("S", ["H"], [["r"]]);
    expect(html).not.toContain("lib-search-input");
  });
});
