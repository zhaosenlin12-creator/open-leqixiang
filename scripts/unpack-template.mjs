import { readFileSync, writeFileSync } from "node:fs";

const f = readFileSync("src/data/exhibition.ts", "utf8");

// 关键模式: "... = `[...JSON...]`;" → "... = [...JSON...];"
// 实际：找到 "= `" 然后找对应的 ";\n"，删除两侧的反引号
// 简化做法: 找所有 `= `["[]...["]`;` 形式，把外面的 ` 删掉
let out = f;
out = out.replace(/= `(\[[\s\S]*?\])`;/g, "= $1;");
out = out.replace(/= `(\{[\s\S]*?\})`;/g, "= $1;");
out = out.replace(/= `(\[[\s\S]*?\])`/g, "= $1");
out = out.replace(/= `(\{[\s\S]*?\})`/g, "= $1");

writeFileSync("src/data/exhibition.ts", out, "utf8");
console.log("rewrote", out.length, "bytes");
