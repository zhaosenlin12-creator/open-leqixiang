#!/usr/bin/env bash
# =============================================================
# 乐启享数字展厅 — 大屏 kiosk 模式安装脚本（Linux + Chromium）
#
# 前置条件：
#   - 已按 scripts/deploy.sh 部署好站点，假设监听 80 端口
#   - 大屏机器装了图形桌面（GNOME / KDE / XFCE 都行）
#   - 装了 chromium-browser 或 google-chrome
#
# 用法：
#   sudo KIOSK_URL=http://你的站点IP/ bash install-kiosk.sh
# =============================================================

set -euo pipefail

KIOSK_URL="${KIOSK_URL:-http://127.0.0.1/}"

# 1. 检测 chromium
if command -v chromium >/dev/null 2>&1; then
  CHROMIUM_BIN=$(command -v chromium)
elif command -v chromium-browser >/dev/null 2>&1; then
  CHROMIUM_BIN=$(command -v chromium-browser)
elif command -v google-chrome >/dev/null 2>&1; then
  CHROMIUM_BIN=$(command -v google-chrome)
else
  echo "[kiosk] 没找到 chromium / google-chrome，先装一个：" >&2
  echo "  sudo apt install -y chromium        # Debian/Ubuntu" >&2
  echo "  sudo dnf install -y chromium         # CentOS/RHEL/Fedora" >&2
  exit 1
fi
echo "[kiosk] 浏览器: $CHROMIUM_BIN"

# 2. 创建 kiosk 用户（如果还没有）
if ! id kiosk >/dev/null 2>&1; then
  useradd -m -s /bin/bash kiosk
  echo "[kiosk] 已创建用户 kiosk"
fi

# 3. 安装 systemd 服务
SERVICE_FILE="/etc/systemd/system/leqixiang-kiosk.service"
sed -e "s|/usr/bin/chromium|$CHROMIUM_BIN|g" \
    -e "s|http://127.0.0.1/|$KIOSK_URL|g" \
    "$(dirname "$0")/leqixiang-kiosk.service" > "$SERVICE_FILE"
echo "[kiosk] 已写入 $SERVICE_FILE"

# 4. 让 kiosk 用户可以访问图形会话
if [[ -f /etc/X11/Xwrapper.config ]]; then
  sed -i "s/allowed_users=.*/allowed_users=anybody/" /etc/X11/Xwrapper.config || true
fi

# 5. 启用并启动
systemctl daemon-reload
systemctl enable leqixiang-kiosk.service
systemctl start leqixiang-kiosk.service

echo ""
echo "============================================================"
echo "kiosk 已启动，开机自启"
echo "访问地址: $KIOSK_URL"
echo ""
echo "常用命令："
echo "  查看状态: systemctl status leqixiang-kiosk"
echo "  看日志:   journalctl -u leqixiang-kiosk -f"
echo "  停止:     systemctl stop leqixiang-kiosk"
echo "============================================================"

