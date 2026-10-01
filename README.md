# Coolcat · AI 艺术作品与提示词

Coolcat（X：[@minaoneday](https://x.com/minaoneday)）是一个带完整提示词的 AI 图像作品集。每张作品都保留提示词、标签和生成信息，主页使用原生 HTML/CSS/JS，详情页和分类页由脚本生成。

## 目录结构

```
index.html                  首页与动态画廊
assets/style.css            深色画廊样式
assets/app.js               分类、搜索、筛选、懒加载和提示词弹窗
data/works.json             全部作品数据（含衍生图路径）
images/general/             综合作品原图
images/women/               人像原图（页面显示为“人像”）
images/web-ui/              视觉系 UI 原图
images/thumbs/              WebP 画廊缩略图
images/og/                  作品分享图
scripts/build-site.mjs      生成静态详情页、分类页、标签页和 sitemap
tools/generate-media.mjs    生成 WebP 缩略图与 OG 图，原 PNG 不修改
```

## 分类与路由

当前数据为 219 件：综合作品 112、人像 101、视觉系 UI 6。首页默认显示全部作品。

- `/gallery/` 全部作品；`/gallery/general/`、`/gallery/portrait/`、`/gallery/ui/` 三个分类。
- `/work/<作品 id>/` 独立详情页，包含完整提示词、元信息、标签和相关作品。
- `/tag/<标签>/` 只为至少 3 件作品使用的标签生成。
- `/about/` 关于作者、使用说明和版权声明。

旧的 `#<作品 id>` 链接仍由首页弹窗兼容；弹窗内可以打开对应的独立详情页。

## 同步和生成

源数据同步后运行：

```bash
node tools/generate-media.mjs
node scripts/build-site.mjs
```

第一个脚本从原始图片生成 WebP 缩略图和 OG 分享图，不会改写原 PNG；第二个脚本生成 219 个作品详情页、分类页、标签页和 `sitemap.xml`。

## 本地预览

`fetch` 不能在 `file://` 下读取 JSON，请使用本地服务器：

```bash
python -m http.server 8000
# 打开 http://localhost:8000/
```

## 部署

这是可直接发布的静态目录，适合 GitHub Pages、Cloudflare Pages、Netlify 或 Vercel。GitHub Pages 使用仓库根目录和 `main` 分支即可。
