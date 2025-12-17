/**
 * 二进制文件文档模型
 * 提供统一的文档接口
 */

import * as vscode from "vscode";

import { Disposable } from "./dispose";
import { FileType } from "./fileTypeDetector";

export interface ParsedData {
  fileType: FileType;
  [key: string]: any;
}

/**
 * 文档委托接口
 */
export interface DocumentDelegate {
  getFileData(): Promise<Uint8Array>;
}

/**
 * 二进制文件文档基类
 */
export abstract class BinaryDocument
  extends Disposable
  implements vscode.CustomDocument
{
  private readonly _uri: vscode.Uri;
  protected _documentData: Uint8Array;
  protected _parsedData: ParsedData;
  private readonly _delegate: DocumentDelegate;

  private _onDidDispose: vscode.EventEmitter<void>;
  public onDidDispose: vscode.EventEmitter<void>["event"];

  protected constructor(
    uri: vscode.Uri,
    initialContent: Uint8Array,
    parsedData: ParsedData,
    delegate: DocumentDelegate,
  ) {
    super();
    this._uri = uri;
    this._documentData = initialContent;
    this._parsedData = parsedData;
    this._delegate = delegate;
    this._onDidDispose = this._register(new vscode.EventEmitter<void>());
    this.onDidDispose = this._onDidDispose.event;
  }

  public get uri(): vscode.Uri {
    return this._uri;
  }

  public get documentData(): Uint8Array {
    return this._documentData;
  }

  public get parsedData(): ParsedData {
    return this._parsedData;
  }

  public get delegate(): DocumentDelegate {
    return this._delegate;
  }

  /**
   * 更新文档数据
   */
  public abstract updateData(data: Uint8Array): Promise<void>;

  /**
   * 释放资源
   */
  dispose(): void {
    this._onDidDispose.fire();
    super.dispose();
  }

  /**
   * 读取文件
   */
  protected static async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    if (uri.scheme === "untitled") {
      return new Uint8Array();
    }
    return new Uint8Array(await vscode.workspace.fs.readFile(uri));
  }

  /**
   * 加载数据
   */
  public static async loadData(uri: vscode.Uri): Promise<Uint8Array> {
    return BinaryDocument.readFile(uri);
  }
}
