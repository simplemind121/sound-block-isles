#!/usr/bin/env bash
# 在 VPS 上运行：拉取最新代码 → 安装依赖 → 构建 → 发布到网站目录
#   用法：bash deploy/deploy.sh
#   可用环境变量覆盖默认值：APP_DIR、WEB_ROOT、BRANCH
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sound-block-isles}"
WEB_ROOT="${WEB_ROOT:-/var/www/sound-block-isles}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"
echo "==> 拉取 $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> 安装依赖"
npm ci --no-audit --no-fund

echo "==> 构建"
npm run build

echo "==> 发布到 $WEB_ROOT"
mkdir -p "$WEB_ROOT"
rsync -a --delete dist/ "$WEB_ROOT/"

echo "==> 完成：$(git log -1 --format='%h %s')"
