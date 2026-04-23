import { describe, expect, it } from "vitest";

import { getNonce } from "../../../common/util";

describe("getNonce", () => {
  it("should return a string of length 32", () => {
    expect(getNonce()).toHaveLength(32);
  });

  it("should contain only alphanumeric characters", () => {
    const nonce = getNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("should generate different values on successive calls", () => {
    const a = getNonce();
    const b = getNonce();
    // Probability of collision is negligible (62^32)
    expect(a).not.toBe(b);
  });

  it("should generate 100 unique values", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) {
      set.add(getNonce());
    }
    expect(set.size).toBe(100);
  });
});
