import * as fs from "fs";
import * as vscode from "vscode";

import { BinaryDocument, DocumentDelegate } from "./binaryDocument";
import { disposeAll } from "./dispose";
import { BinaryFileDocument } from "./documentFactory";
import { getNonce } from "./util";

/**
 * 二进制文件查看器的提供者 (PE/ELF/LIB)
 */
export class BinaryViewerProvider implements vscode.CustomEditorProvider<BinaryDocument> {
  private static newFileId = 1;

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      BinaryViewerProvider.viewType,
      new BinaryViewerProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      },
    );
  }

  private static readonly viewType = "peviewer.peViewer";

  /**
   * 跟踪所有已知的 webview
   */
  private readonly webviews = new WebviewCollection();

  constructor(private readonly _context: vscode.ExtensionContext) {}

  // #region CustomEditorProvider

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: { backupId?: string },
    _token: vscode.CancellationToken,
  ): Promise<BinaryDocument> {
    const document: BinaryDocument = await BinaryFileDocument.create(
      uri,
      openContext.backupId,
      {
        getFileData: async () => {
          const webviewsForDocument = Array.from(this.webviews.get(uri));
          if (!webviewsForDocument.length) {
            throw new Error("Could not find webview to save for");
          }
          const panel = webviewsForDocument[0];
          const response = await this.postMessageWithResponse<number[]>(
            panel,
            "getFileData",
            {},
          );
          return new Uint8Array(response);
        },
      },
    );

    const listeners: vscode.Disposable[] = [];

    document.onDidDispose(() => disposeAll(listeners));

    return document;
  }

  async resolveCustomEditor(
    document: BinaryDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    // Add the webview to our internal set of active webviews
    this.webviews.add(document.uri, webviewPanel);

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    webviewPanel.webview.onDidReceiveMessage((e) =>
      this.onMessage(document, e),
    );

    // Wait for the webview to be properly ready before we init
    webviewPanel.webview.onDidReceiveMessage((e) => {
      if (e.type === "ready") {
        if (document.uri.scheme === "untitled") {
          this.postMessage(webviewPanel, "init", {
            untitled: true,
            editable: true,
            language: vscode.env.language,
          });
        } else {
          const editable = vscode.workspace.fs.isWritableFileSystem(
            document.uri.scheme,
          );

          this.postMessage(webviewPanel, "init", {
            value: JSON.parse(
              JSON.stringify(document.parsedData, (key, value) => {
                if (typeof value === "bigint") {
                  return value.toString();
                }
                if (value instanceof Map) {
                  return Object.fromEntries(value);
                }
                return value;
              }),
            ),
            editable,
            language: vscode.env.language,
          });
        }
      }
    });
  }

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<BinaryDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  public saveCustomDocument(
    document: BinaryDocument,
    cancellation: vscode.CancellationToken,
  ): Thenable<void> {
    return this.doSave(document, document.uri, cancellation);
  }

  public saveCustomDocumentAs(
    document: BinaryDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken,
  ): Thenable<void> {
    return this.doSave(document, destination, cancellation);
  }

  public revertCustomDocument(
    document: BinaryDocument,
    cancellation: vscode.CancellationToken,
  ): Thenable<void> {
    return BinaryDocument.loadData(document.uri).then(async (data) => {
      await document.updateData(data);
      this.postMessageToAll(document.uri, "update", {
        parsedData: JSON.parse(
          JSON.stringify(document.parsedData, (key, value) => {
            if (typeof value === "bigint") {
              return value.toString();
            }
            if (value instanceof Map) {
              return Object.fromEntries(value);
            }
            return value;
          }),
        ),
      });
    });
  }

  public backupCustomDocument(
    document: BinaryDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken,
  ): Thenable<vscode.CustomDocumentBackup> {
    return this.doSave(document, context.destination, cancellation).then(() => {
      return {
        id: context.destination.toString(),
        delete: async () => {
          try {
            await vscode.workspace.fs.delete(context.destination);
          } catch {
            // noop
          }
        },
      };
    });
  }

  // #endregion

  private async doSave(
    document: BinaryDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken,
  ): Promise<void> {
    const fileData = await document.delegate.getFileData();
    if (cancellation.isCancellationRequested) {
      return;
    }
    await vscode.workspace.fs.writeFile(destination, fileData);
  }

  private postMessageToAll(uri: vscode.Uri, type: string, body: any): void {
    for (const webview of this.webviews.get(uri)) {
      this.postMessage(webview, type, body);
    }
  }

  private postMessageWithResponse<R = unknown>(
    panel: vscode.WebviewPanel,
    type: string,
    body: any,
  ): Promise<R> {
    const requestId = this._requestId++;
    const p = new Promise<R>((resolve) =>
      this._callbacks.set(requestId, resolve),
    );
    panel.webview.postMessage({ type, requestId, body });
    return p;
  }

  private postMessage(
    panel: vscode.WebviewPanel,
    type: string,
    body: any,
  ): void {
    panel.webview.postMessage({ type, body });
  }

  private onMessage(document: BinaryDocument, message: any) {
    switch (message.type) {
      case "response":
        const callback = this._callbacks.get(message.requestId);
        callback?.(message.body);
        return;
    }
  }

  private _requestId = 1;
  private readonly _callbacks = new Map<number, (response: any) => void>();

  /**
   * Get the static HTML used for in our editor's webviews.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Local path to script and css for the webview
    const peViewerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "peViewer.js"),
    );
    const localesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "locales.js"),
    );
    const machineTypesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._context.extensionUri,
        "media",
        "machineTypes.js",
      ),
    );
    const resourceHandlerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._context.extensionUri,
        "media",
        "resourceHandler.js",
      ),
    );
    const peHandlerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "peHandler.js"),
    );
    const elfHandlerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "elfHandler.js"),
    );
    const libHandlerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "libHandler.js"),
    );

    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "reset.css"),
    );

    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "vscode.css"),
    );

    const styleCommonUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "common.css"),
    );

    const stylePEUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "pe.css"),
    );

    const styleELFUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "elf.css"),
    );

    const styleLIBUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "lib.css"),
    );

    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "peViewer.css"),
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    // Read HTML template
    const htmlContent = fs.readFileSync(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "peViewer.html")
        .fsPath,
      "utf8",
    );

    // Replace placeholders
    return htmlContent
      .replace(/\$\{webview\.cspSource\}/g, webview.cspSource)
      .replace(/\$\{nonce\}/g, nonce)
      .replace(/\$\{styleResetUri\}/g, styleResetUri.toString())
      .replace(/\$\{styleVSCodeUri\}/g, styleVSCodeUri.toString())
      .replace(/\$\{styleCommonUri\}/g, styleCommonUri.toString())
      .replace(/\$\{stylePEUri\}/g, stylePEUri.toString())
      .replace(/\$\{styleELFUri\}/g, styleELFUri.toString())
      .replace(/\$\{styleLIBUri\}/g, styleLIBUri.toString())
      .replace(/\$\{styleMainUri\}/g, styleMainUri.toString())
      .replace(/\$\{localesUri\}/g, localesUri.toString())
      .replace(/\$\{machineTypesUri\}/g, machineTypesUri.toString())
      .replace(/\$\{resourceHandlerUri\}/g, resourceHandlerUri.toString())
      .replace(/\$\{peHandlerUri\}/g, peHandlerUri.toString())
      .replace(/\$\{elfHandlerUri\}/g, elfHandlerUri.toString())
      .replace(/\$\{libHandlerUri\}/g, libHandlerUri.toString())
      .replace(/\$\{peViewerUri\}/g, peViewerUri.toString());
  }
}

/**
 * Tracks all webviews.
 */
class WebviewCollection {
  private readonly _webviews = new Set<{
    readonly resource: string;
    readonly webviewPanel: vscode.WebviewPanel;
  }>();

  /**
   * Get all known webviews for a given uri.
   */
  public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
    const key = uri.toString();
    for (const entry of this._webviews) {
      if (entry.resource === key) {
        yield entry.webviewPanel;
      }
    }
  }

  /**
   * Add a new webview to the collection.
   */
  public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
    const entry = { resource: uri.toString(), webviewPanel };
    this._webviews.add(entry);

    webviewPanel.onDidDispose(() => {
      this._webviews.delete(entry);
    });
  }
}
