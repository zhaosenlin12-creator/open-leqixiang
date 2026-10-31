#!/usr/bin/env bash
# =============================================================
# 乐启享数字展厅 — 本地打包脚本
#
# 在项目根目录跑，会：
#   1) 重新构建 dist/
#   2) 把 dist/ + deploy/nginx/ + deploy/scripts/ + deploy/kiosk/ 合成
#      一个独立的 deploy-bundle/ 目录
#   3) 打成 zip 方便上传
# =============================================================

set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT=$(pwd)

echo "[pack] 1/3 构建 dist/"
npm run build
node scripts/postbuild-css-defer.mjs >/dev/null

OUT="$ROOT/deploy-bundle"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "[pack] 2/3 拷贝产物到 $OUT/"
cp -r dist/. "$OUT/"

# 复制部署相关的脚手架
mkdir -p "$OUT/nginx" "$OUT/scripts" "$OUT/kiosk"
cp deploy/nginx/*.conf* "$OUT/nginx/"
cp deploy/scripts/*.sh "$OUT/scripts/"
cp deploy/kiosk/* "$OUT/kiosk/"
cp deploy/README.md "$OUT/README.md"

chmod +x "$OUT/scripts/"*.sh "$OUT/kiosk/"*.sh

echo "[pack] 3/3 打包 zip"
ZIP="$ROOT/deploy-bundle.zip"
rm -f "$ZIP"
# 用系统 zip；没装的话用 powershell Compress-Archive
if command -v zip >/dev/null 2>&1; then
  (cd "$OUT/.." && zip -r "$ZIP" "$(basename "$OUT")" >/dev/null)
elif command -v powershell >/dev/null 2>&1; then
  powershell -NoProfile -Command "Compress-Archive -Path '$OUT\\*' -DestinationPath '$ZIP' -Force"
fi

echo ""
echo "============================================================"
echo "打包完成"
echo "目录: $OUT"
echo "压缩包: $ZIP"
echo "============================================================"

