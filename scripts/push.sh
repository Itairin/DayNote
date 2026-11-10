# 一键推送（绕过 Steam++ 证书问题）
#
# 为什么需要这个脚本：
#   Steam++ 加速 GitHub 的方式是本地 TLS 中间人（MITM），它用自己的
#   "SteamTools Certificate" 替换了 github.com / api.github.com 的证书。
#   git 走 Windows 证书库时可能报 CRYPT_E_NO_REVOCATION_CHECK；
#   gh 用 Go 的 TLS 栈、不读 Windows 证书库，会直接握手失败。
#
# 用法：
#   1. 先登录一次（任选其一）：
#      a) 在浏览器建 classic PAT（勾 repo 权限），然后：
#         echo YOUR_TOKEN | gh auth login --with-token
#      b) 或者手动登录：gh auth login
#   2. 运行本脚本：  bash scripts/push.sh
#
# 注意：把 token 贴在对话里会留在记录中，更安全的做法是你自己在终端执行。

set -euo pipefail

export PATH="$PATH:/c/Program Files/GitHub CLI"
export MSYS_NO_PATHCONV=1

echo "==> 检查 gh 登录状态"
if ! gh auth status >/dev/null 2>&1; then
  echo "✗ 还没登录。请先执行下面任一条："
  echo "    gh auth login                              # 交互式"
  echo "    echo YOUR_PAT | gh auth login --with-token  # 用 PAT"
  exit 1
fi

echo "==> 登录正常"
gh auth status 2>&1 | sed 's/^/    /'

echo "==> 推送 main"
git -c http.sslVerify=false push origin main

echo "==> 完成"
git status -sb | head -2
