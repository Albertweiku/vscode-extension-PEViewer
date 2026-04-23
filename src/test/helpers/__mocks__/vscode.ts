// Stub for vscode module - used when resolving transitive imports in unit tests
export const Uri = {
  parse: (s: string) => ({ scheme: "file", fsPath: s, toString: () => s }),
  file: (s: string) => ({ scheme: "file", fsPath: s, toString: () => s }),
};

export const workspace = {
  fs: {
    readFile: async () => new Uint8Array(),
  },
};

export const window = {
  showErrorMessage: () => {},
  showInformationMessage: () => {},
};

export const EventEmitter = class {
  event = () => {};
  fire() {}
  dispose() {}
};

export const Disposable = class {
  static from() {
    return { dispose() {} };
  }
};
