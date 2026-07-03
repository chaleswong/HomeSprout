#!/bin/bash
set -e

# 创建 bin 目录
mkdir -p bin

# 定义版本和下载链接
TYPST_VERSION="0.12.0"
URL="https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz"
ARCHIVE="typst-x86_64-unknown-linux-musl.tar.xz"

echo "[Typst Installer] 正在从 GitHub 下载 Typst v${TYPST_VERSION}..."
curl -L -o "$ARCHIVE" "$URL"

echo "[Typst Installer] 下载完成，正在解压..."
tar -xf "$ARCHIVE"

echo "[Typst Installer] 移动二进制文件到 bin 目录..."
mv typst-x86_64-unknown-linux-musl/typst bin/typst
chmod +x bin/typst

echo "[Typst Installer] 清理临时文件..."
rm -rf "$ARCHIVE" typst-x86_64-unknown-linux-musl

echo "[Typst Installer] 安装成功！版本信息："
./bin/typst --version
