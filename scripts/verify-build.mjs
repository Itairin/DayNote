#!/usr/bin/env node
/**
 * 校验 release exe 是真的内嵌了前端，而不是指向 devUrl。
 *
 * 背景：cargo build --release 会生成一个"看起来是发布版"的 exe，
 * 但 tauri-build 没被要求内嵌 dist，运行时仍会去连 localhost:1420，
 * 用户双击后看到 ERR_CONNECTION_REFUSED。只有 npm run tauri build 才正确内嵌。
 *
 * 判定依据：Tauri 会把 dist 里的每个资源以 "资源名 + 内容" 的形式编进二进制。
 * 所以我们检查 dist/assets/ 下的实际文件名是否出现在 exe 里。
 *
 * 不能用"二进制里有没有 localhost:1420"来判断 —— 那是 Tauri 运行时的死常量，
 * 任何构建（包括正确构建）都包含它。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const exe = join("src-tauri", "target", "release", "daynote.exe");
const assetsDir = join("dist", "assets");
const distIndex = join("dist", "index.html");

if (!existsSync(exe)) {
  console.error("✗ 找不到 " + exe + "，请先运行 npm run tauri build -- --no-bundle");
  process.exit(1);
}
if (!existsSync(distIndex) || !existsSync(assetsDir)) {
  console.error("✗ dist/ 不完整，前端未构建");
  process.exit(1);
}

const buf = readFileSync(exe);
const assets = readdirSync(assetsDir);
if (assets.length === 0) {
  console.error("✗ dist/assets 为空，前端未构建");
  process.exit(1);
}

// 每个资源在二进制里以其文件名出现；要求全部命中
const missing = assets.filter((name) => !buf.includes(Buffer.from(name, "utf8")));

console.log("exe:     " + exe + "  (" + statSync(exe).size + " bytes)");
console.log("assets:  " + assets.length + " 个");

if (missing.length === 0) {
  console.log("✓ 前端已内嵌（" + assets.length + "/" + assets.length + " 个资源命中），可直接分发");
  process.exit(0);
}

console.error("✗ 前端未内嵌，缺失 " + missing.length + " 个资源：");
for (const m of missing.slice(0, 5)) console.error("   - " + m);
console.error("  这个 exe 会去连 localhost，请用 npm run tauri build -- --no-bundle 重新构建");
process.exit(1);
