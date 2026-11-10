# 构建与分发

## 唯一的发布构建命令

```bash
npm run build:app          # 生成 exe（不含安装包），并自动校验
npm run build:installer    # 生成 NSIS 安装包，并自动校验
```

产物：`src-tauri/target/release/daynote.exe`

## 不要用 cargo 直接构建

`cargo build --release` 会生成一个**看起来是发布版、实际打不开**的 exe：
窗口能弹出，但里面显示 `localhost 拒绝连接 / ERR_CONNECTION_REFUSED`。

原因是 Tauri 的开发/生产切换由 **CLI 驱动，而不是 cargo profile**：
裸 cargo 构建时 `tauri-build` 没有被要求内嵌前端，运行时仍然去连
`tauri.conf.json` 里的 `devUrl`（`http://localhost:1420`）。

只有走 `tauri build` 时，`tauri::generate_context!` 才会把 `../dist`
的内容真正编进二进制。

### 如何判断一个 exe 是好的

运行 `npm run verify:build`。它检查 `dist/assets/` 下每一个文件名
是否都出现在 exe 里：

- ✓ 全部命中 → 前端已内嵌，可直接分发
- ✗ 有缺失 → 这个 exe 会去连 localhost，需要重新构建

**不要**用"二进制里有没有 `localhost:1420`"来判断。那是 Tauri 运行时的
死常量，正确的构建里也有它。唯一可靠的验证是：双击运行，看界面能不能出来。

## 开发模式

```bash
npm run tauri dev
```

开发模式需要 Vite dev server 常驻（`localhost:1420`），关掉 dev server
后窗口就会显示拒绝连接——这是正常的，不是 bug。要给别人用，必须用上面的
发布构建。
