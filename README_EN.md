# PEViewer - PE File Viewer

A VS Code extension for viewing and analyzing Windows PE (Portable Executable) file structures.

![PEViewer Screenshot](https://raw.githubusercontent.com/your-username/vscode-extension-PEViewer/main/media/ScreenShot_2025-12-07_010545_842.png)

## Features

- 📁 **Structured View**: Display PE file components in a tree structure
- 🔍 **Detailed Information**: View DOS header, NT header, optional header, section table details
- 📊 **Multi-format Display**: Show decimal, hexadecimal, and binary formats simultaneously
- 📦 **Import/Export Tables**: View DLL import functions and export function lists
- 🎨 **Resource Viewer**: View PE file resource section information and common resource types
- 🔧 **Function Name Decoding**: Automatically decode MSVC/Itanium/Rust symbol names
- 💻 **VS Code Integration**: Perfectly integrated with VS Code themes and interface style
- 📏 **Multiple Format Support**: .exe, .dll, .ocx, .sys, .scr, .drv, .cpl, etc.

## Usage

1. Install this extension
2. Open a PE file (like .exe or .dll) in VS Code
3. Right-click the file and select **"Open With"** > **"PEViewer"**
4. Click on various nodes in the left tree view to see detailed information

## Supported File Types

- `.exe` - Executable files
- `.dll` - Dynamic Link Libraries
- `.ocx` - ActiveX Controls
- `.sys` - System drivers
- `.scr` - Screen savers
- `.drv` - Driver programs
- `.cpl` - Control Panel programs

## Installation

Search for **PEViewer** in the VS Code Extension Marketplace and install.

## Multi-language Support

Supports Chinese and English interfaces, automatically adapts to VS Code language settings.

## Development

```bash
npm install
npm run compile
```

## License

MIT