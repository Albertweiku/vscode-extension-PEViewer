// @ts-check

/**
 * 函数名解码（demangle）工具模块
 * 支持Microsoft (MSVC)、Itanium (GCC/Clang)、Rust等多种编译器符号
 */

/**
 * 函数名解码（demangle）- 参考demumble实现
 * @param {string} mangled - 被编码的符号名称
 * @returns {string} - 解码后的函数名,如果无法解码则返回原始名称
 */
function demangleFunctionName(mangled) {
  // 检查是否为可能的符号前缀
  function isPlausibleItaniumPrefix(/** @type {string} */ s) {
    // Itanium符号以1-4个下划线+Z开头
    const prefix = s.substring(0, 5);
    return prefix.includes("_Z");
  }

  function isPlausibleRustPrefix(/** @type {string} */ s) {
    // Rust符号以_R开头
    return s.startsWith("_R");
  }

  // 尝试解码MSVC符号
  if (mangled.startsWith("?")) {
    return demangleMsvc(mangled);
  }

  // 尝试解码Itanium符号 (_Z开头)
  if (isPlausibleItaniumPrefix(mangled)) {
    return demangleItanium(mangled);
  }

  // 尝试解码Rust符号 (_R开头)
  if (isPlausibleRustPrefix(mangled)) {
    return demangleRust(mangled);
  }

  // 无法识别的符号,返回原始名称
  return mangled;
}

/**
 * 解码MSVC符号
 * @param {string} mangled
 * @returns {string}
 */
function demangleMsvc(mangled) {
  try {
    let pos = 1; // 跳过开头的?
    const str = mangled;

    function peek() {
      return pos < str.length ? str[pos] : "";
    }

    function read() {
      return pos < str.length ? str[pos++] : "";
    }

    function readSourceName() {
      let name = "";
      // 处理模板名称: ?$name@template_args@
      if (peek() === "?" && pos + 1 < str.length && str[pos + 1] === "$") {
        pos += 2; // 跳过 ?$
        // 读取模板名称
        while (pos < str.length && str[pos] !== "@") {
          name += str[pos++];
        }

        // 读取并简化模板参数
        if (peek() === "@") {
          pos++; // 跳过 @
          let templateArgs = "";
          let depth = 1;
          const argStart = pos;

          while (pos < str.length && depth > 0) {
            const ch = str[pos];
            if (ch === "@") {
              // 检查下一个字符来判断是否结束
              if (
                pos + 1 < str.length &&
                str[pos + 1] !== "$" &&
                str[pos + 1] !== "?"
              ) {
                // 这是模板参数的结束
                depth--;
                if (depth === 0) {
                  templateArgs = str.substring(argStart, pos);
                  pos++; // 跳过结束的 @
                  break;
                }
              }
            } else if (
              ch === "?" &&
              pos + 1 < str.length &&
              str[pos + 1] === "$"
            ) {
              // 嵌套模板
              depth++;
            }
            pos++;
          }

          // 简化模板参数显示
          if (templateArgs) {
            // MSVC 模板参数编码规则：
            // $0A@ = 0, $00@ = 1, $01@ = 2, etc.
            // $H = int, $D = char, $N = bool, etc.
            let simplifiedArgs = templateArgs;

            // 数字模板参数
            if (templateArgs.startsWith("$0")) {
              const numPart = templateArgs.substring(1);
              if (numPart === "0A") {
                simplifiedArgs = "0";
              } else if (numPart.match(/^0[0-9A-F]$/)) {
                // $00=1, $01=2, ... $09=10, $0A=0(循环), $0B=11, etc.
                const hexDigit = numPart[1];
                if (hexDigit >= "0" && hexDigit <= "9") {
                  simplifiedArgs = String(parseInt(hexDigit, 10) + 1);
                } else {
                  simplifiedArgs = String(parseInt(hexDigit, 16));
                }
              }
            }
            // 类型模板参数（简化显示）
            else if (templateArgs === "$H") {
              simplifiedArgs = "int";
            } else if (templateArgs === "$D") {
              simplifiedArgs = "char";
            } else if (templateArgs === "$_N") {
              simplifiedArgs = "bool";
            }

            name += `<${simplifiedArgs}>`;
          }
        }
        return name;
      }

      // 普通名称
      while (pos < str.length && str[pos] !== "@") {
        name += str[pos++];
      }
      return name;
    }

    function readQualifiedName() {
      const parts = [];
      while (pos < str.length) {
        if (peek() === "@") {
          pos++;
          if (peek() === "@") {
            pos++;
            break;
          }
          continue;
        }
        const part = readSourceName();
        if (part) {
          parts.push(part);
        }
      }
      return parts.reverse().join("::");
    }

    // 特殊操作符映射
    const specialNames = {
      0: "constructor",
      1: "destructor",
      2: "operator new",
      3: "operator delete",
      4: "operator=",
      5: "operator>>",
      6: "operator<<",
      7: "operator!",
      8: "operator==",
      9: "operator!=",
      A: "operator[]",
      C: "operator->",
      D: "operator*",
      E: "operator++",
      F: "operator--",
      G: "operator-",
      H: "operator+",
      I: "operator&",
      J: "operator->*",
      K: "operator/",
      L: "operator%",
      M: "operator<",
      N: "operator<=",
      O: "operator>",
      P: "operator>=",
      Q: "operator,",
      R: "operator()",
      S: "operator~",
      T: "operator^",
      U: "operator|",
      V: "operator&&",
      W: "operator||",
      X: "operator*=",
      Y: "operator+=",
      Z: "operator-=",
    };

    const extendedNames = {
      _0: "operator/=",
      _1: "operator%=",
      _2: "operator>>=",
      _3: "operator<<=",
      _4: "operator&=",
      _5: "operator|=",
      _6: "operator^=",
      _7: "`vftable'",
      _8: "`vbtable'",
      _9: "`vcall'",
      _A: "`typeof'",
      _B: "`local static guard'",
      _C: "`string'",
      _D: "`vbase destructor'",
      _E: "`vector deleting destructor'",
      _F: "`default constructor closure'",
      _G: "`scalar deleting destructor'",
      _H: "`vector constructor iterator'",
      _I: "`vector destructor iterator'",
      _J: "`vector vbase constructor iterator'",
      _K: "`virtual displacement map'",
      _L: "`eh vector constructor iterator'",
      _M: "`eh vector destructor iterator'",
      _N: "`eh vector vbase constructor iterator'",
      _O: "`copy constructor closure'",
      _P: "`udt returning'",
      _R: "RTTI Type Descriptor",
      _S: "`local vftable'",
      _T: "`local vftable constructor closure'",
      _U: "operator new[]",
      _V: "operator delete[]",
      _X: "`placement delete closure'",
      _Y: "`placement delete[] closure'",
    };

    // 解析函数参数类型
    function parseArgumentTypes() {
      // 跳过访问修饰符和调用约定 (如 QEAA, AEAA等)
      while (pos < str.length && /[A-Z]/.test(str[pos])) {
        const ch = str[pos];
        if (ch === "X" || ch === "Z") {
          break; // X=void, Z=结束
        }
        pos++;
      }

      if (pos >= str.length) {
        return "";
      } // 解析参数
      const args = [];
      while (pos < str.length && str[pos] !== "Z" && str[pos] !== "@") {
        const type = parseType();
        if (type) {
          args.push(type);
        } else {
          break;
        }
      }

      return args.length > 0 ? args.join(", ") : "void";
    }

    // 解析单个类型
    /**
     * @returns {string}
     */
    function parseType() {
      if (pos >= str.length) {
        return "";
      }

      const ch = str[pos++];

      // 基本类型
      const typeMap = {
        X: "void",
        D: "char",
        E: "unsigned char",
        F: "short",
        G: "unsigned short",
        H: "int",
        I: "unsigned int",
        J: "long",
        K: "unsigned long",
        M: "float",
        N: "double",
        _N: "bool",
        O: "long double",
        _J: "__int64",
        _K: "unsigned __int64",
      };

      // 修饰符
      if (ch === "P") {
        // 指针
        if (peek() === "E" && pos + 1 < str.length && str[pos + 1] === "A") {
          // PEA = 引用 &
          pos += 2;
          return parseType() + " &";
        } else if (peek() === "6") {
          // P6 = 函数指针
          pos++; // 跳过 6
          let returnType = parseType();
          if (peek() === "A") {
            pos++; // 跳过调用约定
          }
          let params = [];
          while (pos < str.length && str[pos] !== "Z" && str[pos] !== "@") {
            const paramType = parseType();
            if (paramType) {
              params.push(paramType);
            } else {
              break;
            }
          }
          if (peek() === "Z") {
            pos++; // 跳过结束符
          }
          const paramList = params.length > 0 ? params.join(", ") : "void";
          return `${returnType} (*)(${paramList})`;
        }
        return parseType() + " *";
      } else if (ch === "A") {
        // A开头可能是引用或其他
        if (peek() === "E") {
          pos++;
          return parseType() + " &";
        }
        return parseType();
      } else if (ch === "Q") {
        // Q = const
        return "const " + parseType();
      } else if (ch === "R") {
        // R = volatile
        return "volatile " + parseType();
      } else if (ch === "_") {
        // 扩展类型
        const next = peek();
        if (next === "N") {
          pos++;
          return "bool";
        } else if (next === "J") {
          pos++;
          return "__int64";
        } else if (next === "K") {
          pos++;
          return "unsigned __int64";
        }
      }

      // 检查基本类型映射
      // @ts-ignore
      if (typeMap[ch]) {
        // @ts-ignore
        return typeMap[ch];
      }

      // 未识别的类型，返回空
      return "";
    }

    // 检查特殊名称
    if (peek() === "?") {
      pos++;
      const opCode = read();
      let opName = "";

      if (opCode === "_") {
        const extCode = read();
        const key = "_" + extCode;
        // @ts-ignore
        opName = extendedNames[key] || `operator_${extCode}`;
      } else {
        // @ts-ignore
        opName = specialNames[opCode] || `operator${opCode}`;
      }

      const className = readQualifiedName();

      // 解析函数参数
      const params = parseArgumentTypes();

      if (opName === "constructor") {
        const simpleName = className.split("::").pop() || className;
        return `${className}::${simpleName}(${params})`;
      } else if (opName === "destructor") {
        const simpleName = className.split("::").pop() || className;
        return `${className}::~${simpleName}()`;
      }
      return `${className}::${opName}`;
    }

    // 普通函数或成员函数
    const funcName = readSourceName();
    const scope = readQualifiedName();

    // 解析函数参数
    const params = parseArgumentTypes();

    if (scope) {
      return `${scope}::${funcName}(${params})`;
    }
    return funcName ? `${funcName}(${params})` : mangled;
  } catch (e) {
    return mangled;
  }
}

/**
 * 解码Itanium C++ ABI符号 (GCC/Clang使用)
 * @param {string} mangled
 * @returns {string}
 */
function demangleItanium(mangled) {
  // 简化的Itanium解码实现
  // 完整实现需要LLVM的Demangle库,这里只做基本解析
  try {
    // 去除前导下划线
    let symbol = mangled;
    while (symbol.startsWith("_") && symbol.length > 2) {
      symbol = symbol.substring(1);
    }

    if (!symbol.startsWith("Z")) {
      return mangled;
    }

    // 基本模式: _Z + 长度 + 名称
    let pos = 1; // 跳过Z
    const nameParts = [];

    while (pos < symbol.length) {
      // 读取长度
      let len = 0;
      while (pos < symbol.length && symbol[pos] >= "0" && symbol[pos] <= "9") {
        len = len * 10 + (symbol.charCodeAt(pos) - 48);
        pos++;
      }

      if (len === 0) {
        break;
      }

      // 读取名称部分
      const part = symbol.substring(pos, pos + len);
      nameParts.push(part);
      pos += len;

      // 检查是否还有更多部分
      if (pos >= symbol.length || symbol[pos] < "0" || symbol[pos] > "9") {
        break;
      }
    }

    if (nameParts.length > 0) {
      return nameParts.join("::") + "()";
    }

    return mangled;
  } catch (e) {
    return mangled;
  }
}

/**
 * 解码Rust符号
 * @param {string} mangled
 * @returns {string}
 */
function demangleRust(mangled) {
  // 简化的Rust解码实现
  // Rust v0规范:
  // https://rust-lang.github.io/rfcs/2603-rust-symbol-name-mangling-v0.html
  try {
    if (!mangled.startsWith("_R")) {
      return mangled;
    }

    // 基本解析,移除哈希和特殊字符
    let result = mangled.substring(2);

    // 移除结尾的哈希值 (通常是17个十六进制字符)
    result = result.replace(/[0-9a-f]{17}$/, "");

    // 将路径分隔符转换为::
    result = result.replace(/(\d+)/g, (match, num) => {
      return "::";
    });

    // 清理多余的分隔符
    result = result.replace(/^::+|::+$/g, "").replace(/::+/g, "::");

    return result || mangled;
  } catch (e) {
    return mangled;
  }
}
