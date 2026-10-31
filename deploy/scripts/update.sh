#!/usr/bin/env bash
# =============================================================
# 乐启享数字展厅 — 增量更新脚本
#
# 用法（在服务器上）：
#   cd /var/www/leqixiang   # 或者你部署的目录
#   sudo bash /path/to/deploy/scripts/update.sh
#
# 脚本会做：
#   - 备份当前 dist 到 .prev/
#   - 把新文件覆盖进去
#   - reload nginx
# =============================================================

set -euo pipefail

DEPLOY_DIR="${1:-/var/www/leqixiang}"
say() { printf "\033[1;36m[update]\033[0m %s\n" "$*"; }

cd "$(dirname "$0")/.."
say "源目录: $(pwd)"
say "目标目录: $DEPLOY_DIR"

if [[ ! -f index.html ]]; then
  echo "[update] 错误：当前目录里没找到 index.html，请在 deploy/ 根目录下跑这个脚本" >&2
  exit 1
fi

# 备份
if [[ -d "$DEPLOY_DIR/index.html" ]] || [[ -f "$DEPLOY_DIR/index.html" ]]; then
  sudo rm -rf "$DEPLOY_DIR.prev"
  sudo cp -r "$DEPLOY_DIR" "$DEPLOY_DIR.prev"
  say "已备份到 $DEPLOY_DIR.prev"
fi

# 覆盖
sudo mkdir -p "$DEPLOY_DIR"
sudo cp -r ./index.html ./assets ./images ./home ./staff ./courses ./honors ./about ./pricing ./showreel ./brand ./students ./content ./sections-thumbs-manifest.json ./students-manifest.json ./students-thumbs-manifest.json "$DEPLOY_DIR/"

# 校验 + reload
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t && sudo systemctl reload nginx && say "nginx 已 reload"
fi

say "更新完成"

