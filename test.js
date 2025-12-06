const fs = require("fs");
const { Parse } = require("pe-parser");

// 尝试读取一个系统文件来查看结构
try {
    const buffer = fs.readFileSync("C:/Windows/System32/notepad.exe");
    const parsed = Parse(Buffer.from(buffer));
    console.log("Parsed data structure:");
    console.log(JSON.stringify(parsed, (key, value) => (typeof value === "bigint" ? value.toString() : value), 2));
} catch (e) {
    console.log("Error:", e.message);
    // 尝试读取当前目录下的文件
    try {
        const files = fs.readdirSync(".");
        const exeFiles = files.filter((f) => f.endsWith(".exe"));
        if (exeFiles.length > 0) {
            const buffer = fs.readFileSync(exeFiles[0]);
            const parsed = Parse(Buffer.from(buffer));
            console.log("Parsed data structure:");
            console.log(JSON.stringify(parsed, (key, value) => (typeof value === "bigint" ? value.toString() : value), 2));
        }
    } catch (e2) {
        console.log("Error 2:", e2.message);
    }
}
