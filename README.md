# Coolcat · AI 艺术作品与提示词

Coolcat（X：[@aicoolcat](https://x.com/aicoolcat)）的 AI 作品画廊。纯静态网站（HTML + CSS + 原生 JS，无需构建），点击任意作品即可查看完整提示词并一键复制。

## 目录结构

```
index.html              页面骨架
assets/style.css        样式（深色宇宙主题）
assets/app.js           画廊逻辑：分类标签页、搜索、标签筛选、弹窗、#hash 深链
assets/favicon.svg
data/works.json         全部作品数据（由同步脚本生成，最新在前）
images/general/         「综合作品」图片（神话、风景、生物等）
images/women/           「女性人像」图片
tools/sync_from_repo.py 从私有仓库 aurora-ai-lab/coolcat-prompts 同步作品
.nojekyll               让 GitHub Pages 原样发布所有文件
```

## 两个分类

| category  | 页面标签 | 图片目录          |
|-----------|----------|-------------------|
| `general` | 综合作品（默认） | `images/general/` |
| `women`   | 女性人像 | `images/women/`   |

搜索与标签筛选只在当前标签页内生效。链接：
- `…/#women` 直接打开「女性人像」，`…/#general` 或无 hash 为「综合作品」；
- `…/#<作品 id>`（如 `#2026-09-27-zhulong`）直接打开该作品弹窗，并自动切换到它所在的分类。

## 如何新增作品

1. 在私有仓库 `aurora-ai-lab/coolcat-prompts` 中新增：
   - `prompts/general/<YYYY-MM-DD-slug>.md` 或 `prompts/women/<YYYY-MM-DD-slug>.md`
   - 对应图片放在 `images/general/` 或 `images/women/`（视频 `.mp4/.webm/.mov` 也可以，会自动识别为视频）
2. Markdown 格式（与现有条目一致）：

   ````markdown
   # 作品标题

   - 日期：2026-09-27
   - 分类：general            # 或 women；缺省时按所在文件夹，旧的平铺文件默认 general
   - 模型：xxx                # 可选
   - 标签：山海经, 神话        # 可选；缺省时脚本会根据标题/提示词自动推断 1–3 个
   - 来源：xxx
   - 典故：xxx                # 可选，会显示在弹窗中

   ## 提示词

   ```
   英文或中文提示词……
   ```

   ## 成图

   ![标题](../../images/general/2026-09-27-slug.png)

   ## 推文文案

   > 推文内容……

   ## 备注

   - 备注内容……
   ````

3. 在本站目录运行同步脚本（需要已登录、且有该私有仓库读取权限的 `gh` CLI）：

   ```bash
   python3 tools/sync_from_repo.py            # 默认仓库 aurora-ai-lab/coolcat-prompts
   # 可选参数：--repo owner/name  --ref <分支或提交>
   ```

   脚本通过 `gh api` 读取（不 clone）`prompts/*.md`（旧平铺结构，默认 general）以及 `prompts/general/*.md`、`prompts/women/*.md`，
   解析标题、日期、分类、模型、标签、来源、典故、提示词、成图、推文文案和备注，把图片下载到 `images/<分类>/`，
   删除分类目录中已不再引用的旧图片，并重写 `data/works.json`（按日期倒序）。
   **注意：`data/works.json` 会被整体覆盖，请不要手动编辑它**——需要修改内容时改源仓库再同步。

4. 本地预览后提交并推送本站仓库。

## 本地预览

`fetch` 不能在 `file://` 下读取 JSON，所以请用本地服务器：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/
```

## 部署（GitHub Pages）

站内所有路径都是相对路径，可以直接部署在子路径下（如 `https://aurora-ai-lab.github.io/coolcat-gallery/`）。

1. 把本目录内容作为仓库根目录推送（例如仓库 `coolcat-gallery`，分支 `main`）。
2. 仓库 Settings → Pages → Source 选 “Deploy from a branch”，分支 `main`，目录 `/ (root)`。
3. 等待一两分钟即可访问 `https://<user>.github.io/<repo>/`。

也可以部署到任何静态托管（Cloudflare Pages、Netlify、Vercel 等），无需构建命令，发布目录即为本目录。

> 提醒：GitHub Pages 发布的网站是公开的，即使源码仓库为私有（私有仓库使用 Pages 需要付费计划）。同步到本站的图片和提示词都会公开可见。
