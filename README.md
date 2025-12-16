**[中文版本 (Chinese Version)](README.zh-cn.md)**

# PEViewer - PE/ELF File Viewer & Analyzer

A professional VS Code extension for viewing and analyzing Windows PE (Portable Executable) and Linux ELF (Executable and Linkable Format) file structures. Features advanced capabilities including import/export symbol parsing, resource viewing, and automatic function name demangling.

![PEViewer Screenshot](./media/image.png)

## Features

### Core Capabilities

- 📁 **Structured View**: Display PE/ELF file components in an intuitive tree structure
- 🔍 **Detailed Information**: View headers, section tables, symbol tables, and more
- 📊 **Multi-format Display**: Show decimal, hexadecimal, and binary formats simultaneously
- 💻 **VS Code Integration**: Perfectly integrated with VS Code themes and interface
- 🌐 **Multi-language Support**: Available in English and Chinese

### Windows PE File Support

- 📦 **Import/Export Tables**: View DLL import functions and export function lists
- 🎨 **Resource Viewer**: View icons, bitmaps, string tables, version info, and more
- 🔧 **Function Name Decoding**: Automatically decode MSVC/Itanium/Rust symbol names
- 🔎 **Search Functionality**: Quickly search through imports and exports
- 📄 **Pagination**: Browse large function lists with pagination support

### Linux ELF File Support

- 🐧 **Complete Parsing**: Full support for Linux .so shared object files
- 📊 **Architecture Support**: x86, x86-64, ARM, AArch64, RISC-V, and more
- 📜 **Symbol Tables**: Export symbols with address, size, type, and binding info
- 🔗 **Dependencies**: Smart parsing of imported symbols and library dependencies
- 🛠️ **Multi-system**: Supports HarmonyOS, Android, Linux compiled SO libraries

## Use Cases

- 🔍 **Reverse Engineering**: Analyze binary file structures and understand program behavior
- 🐛 **Troubleshooting**: Check DLL/SO dependencies and resolve loading issues
- 🔧 **Development**: View exported symbols after compilation and verify build results
- 📚 **Learning**: Study PE/ELF file formats and understand operating system principles
- ⚙️ **Cross-platform**: Check architecture and symbol compatibility of cross-platform libraries

## Usage

1. Install this extension
2. Open a PE file (like .exe or .dll) in VS Code
3. Right-click the file and select **"Open With"** > **"code"**
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

### Install from VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions view
3. Search for **"PE/ELF Viewer"** or **"PEViewer"**
4. Click **Install** button

### Install from VSIX File

1. Download the `.vsix` file
2. Press `Ctrl+Shift+P` to open Command Palette in VS Code
3. Type **"Extensions: Install from VSIX..."**
4. Select the downloaded `.vsix` file

#### New Features

- ✨ **Complete ELF File Support**: Full parsing for Linux .so shared libraries
- 📊 **Multi-architecture**: x86, x86-64, ARM, AArch64, RISC-V, and more
- 📚 **Smart Dependency Parsing**: DT_NEEDED library name resolution
- 🔗 **Symbol Table Parsing**: Export/import symbols with address, size, type info
- 🔧 **Function Name Demangling**: MSVC/Itanium/Rust symbol auto-decoding
- 🔍 **Search Functionality**: Quick search in import/export tables
- 📄 **Pagination**: Browse large function lists (100 items per page)

#### Technical Improvements

- ⚡ Enhanced direct ELF symbol parsing
- 🔄 Multi-level fallback parsing strategies
- 🛡️ Robust error handling

### 0.0.1 - Initial Release

- ✨ Basic PE file structure viewer
- 📁 Tree view for file navigation
- 🔍 Detailed information panels
- 📊 Import/Export table parsing
- 🎨 Resource section viewer
- 💻 VS Code theme integration

For detailed changes, see [CHANGELOG.md](CHANGELOG.md).

## Multi-language Support

Supports Chinese and English interfaces, automatically adapts to VS Code language settings.

## Development

```bash
npm install
npm run compile

npm run format
```

## License

MIT
