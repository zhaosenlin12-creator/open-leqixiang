#!/usr/bin/env bash
set -euo pipefail

SITE_ROOT="${SITE_ROOT:-/var/www/leqixiang}"
NGINX_SITE="${NGINX_SITE:-leqixiang}"
LISTEN_PORT="${LISTEN_PORT:-80}"

say() { printf "\033[1;36m[deploy]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[deploy]\033[0m %s\n" "$*" >&2; exit 1; }

if [[ "${SKIP_NGINX:-0}" != "1" ]]; then
  if ! command -v nginx >/dev/null 2>&1; then
    say "nginx 未安装，尝试自动安装..."
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update && sudo apt-get install -y nginx
    elif command -v dnf >/dev/null 2>&1; then
      sudo dnf install -y nginx
    elif command -v yum >/dev/null 2>&1; then
      sudo yum install -y nginx
    else
      die "未找到 apt-get/dnf/yum，请手动安装 nginx 后重试，或设置 SKIP_NGINX=1 自己处理"
    fi
  fi
  say "nginx 已就绪: $(nginx -v 2>&1)"
fi

say "拷贝站点文件 -> $SITE_ROOT"
sudo mkdir -p "$SITE_ROOT"
sudo cp -r ../index.html ../assets ../images ../home ../staff ../courses ../honors ../about ../pricing ../showreel ../brand ../students ../content ../sections-thumbs-manifest.json ../students-manifest.json ../students-thumbs-manifest.json "$SITE_ROOT/" 2>/dev/null || true
say "站点文件已就位"

if [[ "${SKIP_NGINX:-0}" != "1" ]]; then
  say "写入 nginx server block"
  TMP_CONF=$(mktemp)
  if [[ "$LISTEN_PORT" == "80" ]]; then
    sed "s/listen 8080;/listen 80;/" "../nginx/leqixiang-standalone.conf" > "$TMP_CONF"
  else
    sed "s/listen 8080;/listen $LISTEN_PORT;/" "../nginx/leqixiang-standalone.conf" > "$TMP_CONF"
  fi
  sed -i "s|/var/www/leqixiang|$SITE_ROOT|g" "$TMP_CONF"

  sudo cp "$TMP_CONF" "/etc/nginx/sites-available/$NGINX_SITE"
  rm -f "$TMP_CONF"

  if [[ -d /etc/nginx/sites-enabled ]]; then
    sudo ln -sf "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-enabled/$NGINX_SITE"
    if [[ -f /etc/nginx/sites-enabled/default ]]; then
      sudo rm -f /etc/nginx/sites-enabled/default
      say "移除了 nginx 默认站点避免端口冲突"
    fi
  elif [[ -d /etc/nginx/conf.d ]]; then
    sudo cp "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/conf.d/$NGINX_SITE.conf"
  fi

  if sudo nginx -t; then
    say "nginx 配置校验通过，reload..."
    sudo systemctl reload nginx
  else
    die "nginx 配置校验失败"
  fi
fi

if [[ "${SKIP_FIREWALL:-0}" != "1" ]]; then
  if command -v ufw >/dev/null 2>&1; then
    say "ufw 放行 ${LISTEN_PORT}/tcp"
    sudo ufw allow "${LISTEN_PORT}/tcp" || true
  elif command -v firewall-cmd >/dev/null 2>&1; then
    say "firewalld 放行 ${LISTEN_PORT}/tcp"
    sudo firewall-cmd --permanent --add-port="${LISTEN_PORT}/tcp" || true
    sudo firewall-cmd --reload || true
  else
    say "未检测到 ufw/firewalld，请自行放行 ${LISTEN_PORT}/tcp，云服务器还需在安全组放行"
  fi
fi

say ""
say "============================================================"
say "部署完成"
say "访问地址：http://服务器IP:${LISTEN_PORT}/"
say "站点目录：$SITE_ROOT"
say "nginx 配置：/etc/nginx/sites-available/$NGINX_SITE"
say "============================================================"

