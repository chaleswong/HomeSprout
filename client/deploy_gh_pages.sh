#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status.
set -e

echo "🌱 [HomeSprout] 开始构建并发布 GitHub Pages 在线预览 Demo..."

# 保证在 client 目录下
cd /home/bark/workspace/HomeSprout/client

# 1. 运行生产打包 (Vite 会注入 /HomeSprout/ 基础路径)
echo "📦 正在编译打包前端静态文件..."
NODE_ENV=production npm run build

# 2. 进入打包输出目录 dist
cd dist

# 3. 在打包结果目录中初始化一个独立的 Git 仓库，并强制推送到 gh-pages 分支
echo "🐙 正在发布至 gh-pages 分支..."
git init
git branch -m main
git config user.name "chaleswong"
git config user.email "chaolubark@gmail.com"
git add -A
git commit -m "Deploy HomeSprout interactive sandbox demo to GitHub Pages"

# 强制推送
git push -f git@github.com:chaleswong/HomeSprout.git main:gh-pages

echo "🎉 [HomeSprout] 在线预览 Demo 已成功部署至 GitHub Pages！"
echo "🔗 访问链接：https://chaleswong.github.io/HomeSprout/"
