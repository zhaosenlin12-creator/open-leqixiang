# 乐启享数字展厅 — 部署包

机构内部静态站点，独立打成包方便部署到任意 Linux 服务器。

## 包结构

```
deploy-bundle/
├── README.md                                # 本文档
├── index.html                                # 站点入口
├── assets/                                   # Vite 产出的带哈希 JS/CSS chunk
│   ├── index-<hash>.js
│   ├── index-<hash>.css
│   ├── HeroCarousel-<hash>.js
│   ├── CategoryStage-<hash>.js
│   ├── LayeredDrawer-<hash>.js
│   ├── videoPoster-<hash>.js
│   └── maximize-2-<hash>.js
├── images/  home/  staff/  courses/  honors/  about/
├── pricing/  showreel/  brand/  students/  content/        # 图片/视频/海报
├── sections-thumbs-manifest.json              # 缩略图清单
├── students-manifest.json                     # 学员图片清单
├── students-thumbs-manifest.json              # 学员缩略图清单
│
├── nginx/                                    # nginx 配置模板
│   ├── leqixiang-standalone.conf              # 独立站点（独占 80/443）
│   ├── leqixiang-subpath.conf.snippet         # 子路径片段（挂在已有站点下）
│   └── leqixiang-https.conf                   # HTTPS 模板
│
├── scripts/                                  # 上传到服务器后用
│   ├── deploy.sh                             # 一键部署脚本
│   └── update.sh                             # 增量更新脚本
│
└── kiosk/                                    # 大屏 kiosk 自启动（可选）
    ├── leqixiang-kiosk.service               # systemd 单元文件
    └── install-kiosk.sh                      # 一键安装脚本
```

## 部署到 Linux 服务器

### 1) 上传打包

```bash
# 在本地跑打包脚本
bash deploy/scripts/pack.sh
# 生成 deploy-bundle/ 目录和 deploy-bundle.zip

# 把目录整个传到服务器
scp -r deploy-bundle/ user@服务器IP:/tmp/
```

### 2) 服务器上一键部署

```bash
ssh user@服务器IP
cd /tmp/deploy-bundle
sudo bash scripts/deploy.sh
```

脚本会自动：

1. 检测/安装 nginx
2. 把站点文件拷到 `/var/www/leqixiang/`
3. 写入独立 server block（默认监听 80）
4. 校验配置并 reload nginx
5. 放行 80/tcp（ufw / firewalld）

部署完成后浏览器访问 `http://服务器IP/` 即可。

### 3) 自定义部署目录或端口

通过环境变量控制：

```bash
sudo SITE_ROOT=/srv/leqixiang LISTEN_PORT=8080 bash scripts/deploy.sh
```

可选项：

- `SITE_ROOT`：站点根目录（默认 `/var/www/leqixiang`）
- `NGINX_SITE`：nginx 站点名（默认 `leqixiang`）
- `LISTEN_PORT`：监听端口（默认 `80`）
- `SKIP_NGINX=1`：跳过 nginx 配置（自己处理）
- `SKIP_FIREWALL=1`：跳过防火墙配置

## 跟现有应用共存

如果服务器上已经有别的应用占了 80/443：

### 方案 A：换端口（最简单）

```bash
sudo LISTEN_PORT=8080 bash scripts/deploy.sh
#访问 http://服务器IP:8080/
```

### 方案 B：挂在子路径

把 `nginx/leqixiang-subpath.conf.snippet` 整段加到你现有 server { } 里，然后 `sudo nginx -t && sudo systemctl reload nginx`。

假设挂在 `/leqixiang/` 下，访问 `http://你的域名/leqixiang/`。

注意：子路径部署时 `dist/index.html` 内的资源引用已经是相对路径，无需改任何东西。

### 方案 C：HTTPS 独立域名

如果你有自己的域名，走 HTTPS：

1. `sudo apt install certbot python3-certbot-nginx`
2. 把 `nginx/leqixiang-https.conf` 复制成 `/etc/nginx/sites-available/leqixiang`，把里面的 `your-domain.com` 替换成你的真实域名
3. `sudo certbot --nginx -d your-domain.com`（certbot 会自动填证书路径并 reload）
4. `sudo nginx -t && sudo systemctl reload nginx`

## 大屏 kiosk 自启动（可选）

大屏机器装了图形桌面 + Chromium 后：

```bash
sudo KIOSK_URL=http://你的站点IP/ bash kiosk/install-kiosk.sh
```

会写入 `/etc/systemd/system/leqixiang-kiosk.service` 并启用，开机自动全屏启动 Chromium 打开展厅。

常用命令：

```bash
systemctl status leqixiang-kiosk    # 看状态
journalctl -u leqixiang-kiosk -f    # 看日志
systemctl restart leqixiang-kiosk   # 重启
```

## 后续更新

每次改完代码后：

```bash
# 本地
bash deploy/scripts/pack.sh

# 上传新包
scp -r deploy-bundle/ user@服务器IP:/tmp/

# 服务器上增量更新
ssh user@服务器IP "cd /tmp/deploy-bundle && sudo bash scripts/update.sh /var/www/leqixiang"
```

或者直接覆盖：

```bash
ssh user@服务器IP "sudo cp -r /tmp/deploy-bundle/* /var/www/leqixiang/ && sudo systemctl reload nginx"
```

`/assets/` 里的资源带哈希名，访客浏览器会命中 immutable 缓存。
`/index.html` 走 must-revalidate，新版本会自动下发。
访客**强制刷新一次**（Ctrl+F5）即可看到最新版本。

## 资源占用

| 项 | 数量 |
| --- | --- |
| 磁盘 | 300–500 MB（主要是视频） |
| nginx 内存（闲置） | 5–15 MB |
| nginx 内存（千并发） | 30–60 MB |
| CPU | 几乎 0 |

1 核 512 MB RAM 的小机器都跑得动。

## 安全提醒

1. 不要把 dist/ 直接放在能列目录的位置（nginx 配置里已经关掉了 autoindex）
2. 媒体目录虽然走 30 天缓存，但 `index.html` 走 must-revalidate，发布新版本会被拉到
3. 上 HTTPS 时务必打开 HSTS（配置模板里已加）
4. 大屏 kiosk 用户限制为只能跑 chromium，不给 shell 权限（service 里用 kiosk 用户启动）
5. 视频版权提醒：内部使用 OK，不要把站点直接对外公开，除非有授权

## 故障排查

| 现象 | 排查 |
| --- | --- |
| 浏览器访问空白 | `sudo nginx -t` 看配置；`sudo journalctl -u nginx -n 50` 看错误 |
| 视频加载很慢 | 服务器带宽是不是被占满了；视频文件是不是没拷完整 |
| 改完没生效 | `index.html` 是否被缓存；让访客 Ctrl+F5；服务器上 `ls -la /var/www/leqixiang/index.html` 看时间 |
| 首屏出现黑框 | 首页视频缺少 poster；本包已经给 huodong.mp4 自带 poster，其他视频如有黑屏按相同方法补一张 |
| kiosk 不启动 | `journalctl -u leqixiang-kiosk -n 50` 看错误；多数是没装图形桌面或 chromium |

