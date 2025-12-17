/**
 * PE 机器类型工具模块
 * 提供机器类型代码到描述的映射和格式化功能
 */

/**
 * 获取机器类型描述
 * @param {number} machineType - 机器类型代码
 * @returns {string} 机器类型描述
 */
function getMachineTypeDescription(machineType) {
  const machineTypes = {
    0x0: "Unknown",
    0x14c: "Intel 386 (x86)",
    0x14d: "Intel i486",
    0x14e: "Intel Pentium",
    0x160: "MIPS R3000",
    0x162: "MIPS R3000 (little endian)",
    0x166: "MIPS R4000 (little endian)",
    0x168: "MIPS R10000",
    0x169: "MIPS little endian WCI v2",
    0x183: "Alpha AXP (old)",
    0x184: "Alpha AXP",
    0x1a2: "Hitachi SH3",
    0x1a3: "Hitachi SH3 DSP",
    0x1a6: "Hitachi SH4",
    0x1a8: "Hitachi SH5",
    0x1c0: "ARM little endian",
    0x1c2: "Thumb",
    0x1c4: "ARMv7 Thumb",
    0x1d3: "Matsushita AM33",
    0x1f0: "PowerPC little endian",
    0x1f1: "PowerPC with floating point",
    0x200: "Intel IA64",
    0x266: "MIPS16",
    0x268: "Motorola 68000",
    0x284: "Alpha AXP 64-bit",
    0x366: "MIPS with FPU",
    0x466: "MIPS16 with FPU",
    0xebc: "EFI Byte Code",
    0x8664: "AMD64 (x64)",
    0x9041: "Mitsubishi M32R",
    0xa64e: "ARM64EC (ARM64 Emulation Compatible)",
    0xaa64: "ARM64 (AArch64)",
    0xc0ee: "clr pure MSIL",
  };

  return (
    machineTypes[machineType] ||
    `Unknown (0x${machineType.toString(16).toUpperCase()})`
  );
}

/**
 * 获取机器类型的完整信息（描述 + 代码）
 * @param {number} machineType - 机器类型代码
 * @returns {string} 完整的机器类型信息，格式: "描述 [0xHEX/DEC]"
 */
function getMachineTypeFullInfo(machineType) {
  const desc = getMachineTypeDescription(machineType);
  const hex = `0x${machineType.toString(16).toUpperCase()}`;
  const dec = machineType;
  return `${desc} [${hex}/${dec}]`;
}
