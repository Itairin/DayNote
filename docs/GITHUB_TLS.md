# GitHub 推送与 Steam++ 证书问题

## 现象

执行 `git push` 或 `gh` 命令时报错：

```
fatal: unable to access 'https://github.com/...': schannel:
next InitializeSecurityContext failed: CRYPT_E_NO_REVOCATION_CHECK (0x80092012)
```

或 `gh auth login` 卡住后报 `context deadline exceeded`。

## 根因

Steam++（Watt Toolkit）加速 GitHub 的方式是**本地 TLS 中间人**，不是普通代理：

1. 它把 `github.com`、`api.github.com` 等域名在 `hosts` 里指向 `127.0.0.1`
2. 由 `Steam++.Accelerator.exe` 监听 443，用自己的证书替换真实证书
3. 证书签发者是 `CN=SteamTools Certificate, O=BeyondDimension`

于是所有走 HTTPS 的程序看到的都是这张自签证书，而：

- **git（schannel 后端）**：读 Windows 证书库，但吊销检查失败 → `CRYPT_E_NO_REVOCATION_CHECK`
- **gh（Go TLS 栈）**：**不读** Windows 证书库 → 握手直接失败 → 设备码流程超时
- **curl（schannel）**：同样报吊销检查失败

> 这不是网络不通。实测 `curl --ssl-no-revoke https://github.com` 返回 200。

## 解决办法

### 方案 A：让 git 跳过证书校验（简单，仅用于推送）

```bash
git -c http.sslVerify=false push origin main
```

一次性生效，不改全局配置。`scripts/push.sh` 里已经这么写。

### 方案 B：让 gh 信任 Steam++ 的根证书

gh 用 Go，认 `SSL_CERT_FILE` 环境变量：

```bash
# 从 Windows 证书库导出 SteamTools 根证书
powershell -NoProfile -Command "
  Get-ChildItem Cert:\\LocalMachine\\Root |
    Where-Object { \$_.Subject -like '*SteamTools*' } |
    ForEach-Object {
      \$b = \$_.Export('Cert')
      \$b64 = [Convert]::ToBase64String(\$b, 'InsertLineBreaks')
      \"-----BEGIN CERTIFICATE-----\" + [Environment]::NewLine + \$b64 +
        [Environment]::NewLine + \"-----END CERTIFICATE-----\"
    }" > steamtools_ca.pem

export SSL_CERT_FILE="$PWD/steamtools_ca.pem"
```

之后 `gh` 可以正常访问 API。**但 `gh auth login` 的设备码流程仍可能因
长连接被中间人干扰而超时**，推荐改用 PAT：

```bash
echo YOUR_PAT | gh auth login --with-token
```

PAT 在 https://github.com/settings/tokens 创建（classic，勾 `repo`）。

### 方案 C：关掉 Steam++ 的 GitHub 加速（最干净）

在 Steam++ 设置里取消 GitHub 加速项，只保留 Steam 加速。之后所有工具
都能正常工作，代价是 GitHub 访问变慢。

## 建议

- 只是推代码 → 方案 A，零配置
- 要用 gh 的 PR/issue 功能 → 方案 B + PAT
- 长期开发、工具链多 → 方案 C

## 相关文件

- `scripts/push.sh` — 带 `sslVerify=false` 的一键推送
- `scripts/verify-build.mjs` — 构建产物校验（与证书无关）
