import { beforeAll, describe, expect, it } from "vitest";

import { loadScript } from "../../helpers/scriptLoader";

let demangleFunctionName: (mangled: string) => string;
let demangleMsvc: (mangled: string) => string;
let demangleItanium: (mangled: string) => string;
let demangleRust: (mangled: string) => string;

beforeAll(() => {
  const ctx = loadScript("shared/demangle.js");
  demangleFunctionName = ctx.demangleFunctionName;
  demangleMsvc = ctx.demangleMsvc;
  demangleItanium = ctx.demangleItanium;
  demangleRust = ctx.demangleRust;
});

// ---------------------------------------------------------------------------
// demangleFunctionName - 路由逻辑
// ---------------------------------------------------------------------------
describe("demangleFunctionName", () => {
  it("should return plain names unchanged", () => {
    expect(demangleFunctionName("main")).toBe("main");
    expect(demangleFunctionName("printf")).toBe("printf");
    expect(demangleFunctionName("__libc_start_main")).toBe("__libc_start_main");
  });

  it("should route MSVC symbols (starting with ?)", () => {
    const result = demangleFunctionName("?foo@Bar@@QEAAXXZ");
    expect(result).not.toBe("?foo@Bar@@QEAAXXZ");
    expect(result).toContain("Bar");
    expect(result).toContain("foo");
  });

  it("should route Itanium symbols (containing _Z)", () => {
    const result = demangleFunctionName("_Z3foov");
    expect(result).toContain("foo");
  });

  it("should route Rust symbols (starting with _R)", () => {
    const result = demangleFunctionName("_Rfoo3bar");
    expect(result).not.toBe("_Rfoo3bar");
  });
});

// ---------------------------------------------------------------------------
// demangleMsvc
// ---------------------------------------------------------------------------
describe("demangleMsvc", () => {
  it("should demangle a simple MSVC function", () => {
    // ?func@Class@@QEAAXXZ → Class::func(void)
    const result = demangleMsvc("?func@Class@@QEAAXXZ");
    expect(result).toContain("Class");
    expect(result).toContain("func");
  });

  it("should demangle constructor (??0)", () => {
    // ??0MyClass@@QEAA@XZ → MyClass::MyClass
    const result = demangleMsvc("??0MyClass@@QEAA@XZ");
    expect(result).toContain("MyClass");
  });

  it("should demangle destructor (??1)", () => {
    // ??1MyClass@@QEAA@XZ → MyClass::~MyClass
    const result = demangleMsvc("??1MyClass@@QEAA@XZ");
    expect(result).toContain("~");
    expect(result).toContain("MyClass");
  });

  it("should demangle operator== (??8)", () => {
    const result = demangleMsvc("??8MyClass@@QEAAXXZ");
    expect(result).toContain("operator==");
  });

  it("should demangle nested namespaces", () => {
    const result = demangleMsvc("?method@Inner@Outer@@QEAAXXZ");
    expect(result).toContain("Outer");
    expect(result).toContain("Inner");
    expect(result).toContain("method");
  });

  it("should return original on malformed input", () => {
    const malformed = "?";
    const result = demangleMsvc(malformed);
    // Should not throw; returns something
    expect(typeof result).toBe("string");
  });

  it("should handle vftable (??_7)", () => {
    const result = demangleMsvc("??_7MyClass@@6B@");
    expect(result).toContain("vftable");
  });

  it("should handle operator new[] (??_U)", () => {
    const result = demangleMsvc("??_UMyClass@@QEAAXXZ");
    expect(result).toContain("operator new[]");
  });
});

// ---------------------------------------------------------------------------
// demangleItanium
// ---------------------------------------------------------------------------
describe("demangleItanium", () => {
  it("should demangle _Z3foov → foo()", () => {
    const result = demangleItanium("_Z3foov");
    expect(result).toBe("foo()");
  });

  it("should demangle _Z3bar3baz → bar::baz()", () => {
    const result = demangleItanium("_Z3bar3baz");
    expect(result).toBe("bar::baz()");
  });

  it("should handle double underscore prefix __Z3foov", () => {
    const result = demangleItanium("__Z3foov");
    expect(result).toContain("foo");
  });

  it("should return original for non-Itanium symbols", () => {
    expect(demangleItanium("printf")).toBe("printf");
    expect(demangleItanium("_notZ")).toBe("_notZ");
  });

  it("should handle longer name segments", () => {
    const result = demangleItanium("_Z10helloWorld5utils");
    expect(result).toContain("helloWorld");
    expect(result).toContain("utils");
  });
});

// ---------------------------------------------------------------------------
// demangleRust
// ---------------------------------------------------------------------------
describe("demangleRust", () => {
  it("should strip _R prefix", () => {
    const result = demangleRust("_Rfoo");
    expect(result.startsWith("_R")).toBe(false);
  });

  it("should return original for non-Rust symbols", () => {
    expect(demangleRust("printf")).toBe("printf");
  });

  it("should remove trailing 17-char hex hash", () => {
    const result = demangleRust("_Rhello" + "a".repeat(17));
    expect(result).not.toContain("a".repeat(17));
  });

  it("should convert digit runs to ::", () => {
    const result = demangleRust("_Rstd3fmt5write");
    expect(result).toContain("::");
  });
});
