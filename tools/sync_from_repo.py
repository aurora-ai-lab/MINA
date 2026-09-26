#!/usr/bin/env python3
"""Sync works from the private GitHub repo aurora-ai-lab/coolcat-prompts.

Uses the already-authenticated `gh` CLI (`gh api`), no git clone.
Supports two layouts in the source repo:
  * flat (legacy):  prompts/*.md            + images/*          -> category "general"
  * categorized:    prompts/<cat>/*.md      + images/<cat>/*    (cat = general | women)
Category priority: '- 分类：general|women' line > folder name > "general".
Downloads each referenced image into ./images/<category>/, removes stale images
there, and regenerates ./data/works.json (newest first).

Usage:  python3 tools/sync_from_repo.py [--repo owner/name] [--ref branch]
"""
import argparse, hashlib, json, os, posixpath, re, subprocess, sys
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "images")
DATA_FILE = os.path.join(ROOT, "data", "works.json")
VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v"}
CATEGORIES = ("general", "women")
CAT_ALIASES = {"general": "general", "综合": "general", "综合作品": "general",
               "women": "women", "woman": "women", "女性": "women", "女性人像": "women"}


def gh_api(path, raw=False, allow_404=False):
    cmd = ["gh", "api", path]
    if raw:
        cmd += ["-H", "Accept: application/vnd.github.raw"]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        if allow_404 and b"404" in r.stderr + r.stdout:
            return None
        sys.exit(f"gh api {path} failed: {r.stderr.decode(errors='replace')}")
    return r.stdout


def sections(md):
    """Split markdown into {H2 title: body}; '' holds text before the first H2."""
    out, cur, buf, fence = {}, "", [], False
    for line in md.splitlines():
        if line.strip().startswith("```"):
            fence = not fence
        if not fence and line.startswith("## "):
            out[cur] = "\n".join(buf).strip()
            cur, buf = line[3:].strip(), []
        else:
            buf.append(line)
    out[cur] = "\n".join(buf).strip()
    return out


def field(text, *names):
    for n in names:
        m = re.search(r"^[-*]\s*" + re.escape(n) + r"\s*[：:]\s*(.+)$", text, re.M)
        if m:
            return m.group(1).strip()
    return ""


def code_block(text):
    m = re.search(r"```[^\n]*\n(.*?)\n```", text, re.S)
    return (m.group(1) if m else text).strip()


def unquote_block(text):
    lines = [re.sub(r"^>\s?", "", l) for l in text.splitlines()]
    return "\n".join(lines).strip()


TAG_RULES = [
    ("山海经", ["山海经", "shan hai jing", "shanhaijing"]),
    ("神话", ["神话", "myth", "dragon", "龙", "deity", "god"]),
    ("龙", ["dragon", "龙", "serpent"]),
    ("人像", ["portrait", "人像", "woman", "man ", "girl", "boy"]),
    ("风景", ["landscape", "mountain", "风景", "山水"]),
    ("猫", ["cat ", "cat,", "kitten", "猫"]),
    ("宇宙", ["cosmic", "galaxy", "stardust", "宇宙", "星"]),
    ("赛博朋克", ["cyberpunk", "赛博"]),
]


def derive_tags(*texts):
    blob = " ".join(texts).lower()
    tags = [t for t, kws in TAG_RULES if any(k.lower() in blob for k in kws)]
    return tags[:3]


def parse(md, filename, folder_cat="general"):
    sec = sections(md)
    head = sec.get("", "")
    m = re.search(r"^#\s+(.+)$", head, re.M)
    title = m.group(1).strip() if m else filename
    date = field(head, "日期", "Date") or filename[:10]
    source = field(head, "来源", "Source")
    tags_line = field(head, "标签", "Tags")
    cat_line = field(head, "分类", "Category").lower()
    category = CAT_ALIASES.get(cat_line, folder_cat)
    if cat_line and cat_line not in CAT_ALIASES:
        print(f"  warn   {filename}: unknown 分类 '{cat_line}', using '{category}'")
    img_sec = sec.get("成图", "")
    im = re.search(r"!\[[^\]]*\]\(([^)\s]+)", img_sec) or re.search(r"(images/[^\s)]+)", img_sec)
    img_ref = im.group(1) if im else ""
    prompt = code_block(sec.get("提示词", ""))
    tags = [t.strip() for t in re.split(r"[,，、]", tags_line) if t.strip()] if tags_line \
        else derive_tags(title, source, prompt)
    work = {
        "id": os.path.splitext(filename)[0],
        "title": title,
        "date": date,
        "image": "",
        "mediaType": "image",
        "category": category,
        "model": field(head, "模型", "Model"),
        "tags": tags,
        "source": source,
        "prompt": prompt,
        "tweet": unquote_block(sec.get("推文文案", "")),
        "notes": sec.get("备注", "").strip(),
    }
    story = field(head, "典故")
    if story:
        work["story"] = story
    return work, img_ref


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default="aurora-ai-lab/coolcat-prompts")
    ap.add_argument("--ref", default="")
    a = ap.parse_args()
    ref = f"?ref={quote(a.ref)}" if a.ref else ""
    os.makedirs(IMG_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

    md_files = []  # (repo path, folder category)
    for item in json.loads(gh_api(f"repos/{a.repo}/contents/prompts{ref}")):
        if item["type"] == "file" and item["name"].endswith(".md"):
            md_files.append((item["path"], "general"))
        elif item["type"] == "dir" and item["name"] in CATEGORIES:
            sub = json.loads(gh_api(f"repos/{a.repo}/contents/{quote(item['path'])}{ref}"))
            md_files += [(x["path"], item["name"]) for x in sub
                         if x["type"] == "file" and x["name"].endswith(".md")]

    works, keep, seen = [], {c: set() for c in CATEGORIES}, set()
    for path, folder_cat in sorted(md_files):
        filename = posixpath.basename(path)
        md = gh_api(f"repos/{a.repo}/contents/{quote(path)}{ref}", raw=True).decode("utf-8")
        work, img_ref = parse(md, filename, folder_cat)
        cat = work["category"]
        if work["id"] in seen:
            work["id"] = f"{cat}-{work['id']}"
        seen.add(work["id"])
        if img_ref:
            name = posixpath.basename(img_ref)
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(path), img_ref)).lstrip("/")
            candidates = [c for c in (resolved, f"images/{cat}/{name}", f"images/{name}")
                          if c.startswith("images/")]
            data = repo_path = None
            for c in dict.fromkeys(candidates):
                data = gh_api(f"repos/{a.repo}/contents/{quote(c)}{ref}", raw=True, allow_404=True)
                if data is not None:
                    repo_path = c
                    break
            if data is None:
                print(f"  warn   {filename}: image '{img_ref}' not found (tried {candidates})")
            else:
                os.makedirs(os.path.join(IMG_DIR, cat), exist_ok=True)
                with open(os.path.join(IMG_DIR, cat, name), "wb") as f:
                    f.write(data)
                keep[cat].add(name)
                work["image"] = f"images/{cat}/{name}?v={hashlib.md5(data).hexdigest()[:8]}"
                if os.path.splitext(name)[1].lower() in VIDEO_EXT:
                    work["mediaType"] = "video"
                print(f"  image  {repo_path} -> {work['image']} ({len(data)} bytes)")
        else:
            print(f"  warn   {filename}: no image under '## 成图'")
        works.append(work)
        print(f"  work   [{cat}] {work['id']}: {work['title']}")

    # remove images that are no longer referenced (only inside the category folders)
    for cat in CATEGORIES:
        d = os.path.join(IMG_DIR, cat)
        os.makedirs(d, exist_ok=True)
        for fn in os.listdir(d):
            if fn not in keep[cat] and not fn.startswith("."):
                os.remove(os.path.join(d, fn))
                print(f"  clean  images/{cat}/{fn}")

    works.sort(key=lambda w: (w["date"], w["id"]), reverse=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(works, f, ensure_ascii=False, indent=2)
        f.write("\n")
    counts = {c: sum(w["category"] == c for w in works) for c in CATEGORIES}
    print(f"Wrote {len(works)} work(s) to data/works.json {counts}")


if __name__ == "__main__":
    main()
