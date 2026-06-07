from __future__ import annotations

import html
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = Path("/data00/home/liangweifeng/workspace/.cc-connect/attachments/置身钉内.pdf")
SITE_DIR = ROOT / "sites" / "zhishendingnei"
ASSET_DIR = SITE_DIR / "assets"
IMAGE_DIR = ASSET_DIR / "images"
SKIP_DUPLICATE_IMAGE_NAMES = {
    "p015-00.png",
    "p028-00.png",
    "p037-00.png",
    "p039-00.png",
    "p041-00.png",
    "p050-00.png",
    "p052-00.png",
    "p062-00.jpeg",
}


@dataclass
class TextRun:
    page: int
    x: float
    y: float
    size: float
    text: str


@dataclass
class ImageRun:
    page: int
    x: float
    y: float
    w: float
    h: float
    src: str


def normalize_text(value: str) -> str:
    value = value.replace("\xa0", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = value.replace(" ,", ",").replace(" .", ".")
    value = value.replace(" )", ")").replace("( ", "(")
    value = re.sub(r"\s+([，。！？；：、）】》」])", r"\1", value)
    value = re.sub(r"([（【《「])\s+", r"\1", value)
    return value.strip()


def polish_inline(value: str) -> str:
    value = normalize_text(value)
    value = re.sub(r"([\u4e00-\u9fff])([A-Za-z0-9][A-Za-z0-9.+#/-]*)", r"\1 \2", value)
    value = re.sub(r"([A-Za-z0-9][A-Za-z0-9.+#/-]*)([\u4e00-\u9fff])", r"\1 \2", value)
    value = re.sub(r"\s+([，。！？；：、）】》」])", r"\1", value)
    value = re.sub(r"([（【《「])\s+", r"\1", value)
    value = re.sub(r"\s{2,}", " ", value)
    return value.strip()


def is_header_footer(text: str, y: float, page_height: float) -> bool:
    normalized = normalize_text(text)
    if not normalized:
        return True
    if y < 30 and ("置身钉内.md" in normalized or "2026-06-04" in normalized):
        return True
    if y > page_height - 30 and re.fullmatch(r"\d+\s*/\s*105", normalized):
        return True
    return False


def clean_join(left: str, right: str) -> str:
    left = left.rstrip()
    right = right.lstrip()
    if not left:
        return right
    if not right:
        return left
    if re.search(r"[A-Za-z0-9]$", left) and re.match(r"^[A-Za-z0-9]", right):
        return left + " " + right
    if left.endswith(("—", "-", "/", "／")):
        return left + right
    return left + right


def likely_heading(text: str, size: float, x: float) -> str | None:
    compact = re.sub(r"\s+", "", text)
    if not compact:
        return None
    if size >= 19:
        return "h1"
    if size >= 15:
        return "h2"
    if size >= 12 and len(compact) <= 24:
        return "h3"
    small_heading_patterns = [
        r"^FBIWarning",
        r"^最美逆行者$",
        r"^前情结算$",
        r"^环境背景$",
        r"^外部环境",
        r"^内部环境",
        r"^个人背景$",
        r"^ONE的发心$",
        r"^学徒$",
        r"^什么是产品定位$",
        r"^\\d+\\.用户定位",
        r"^\\d+\\.场景定位",
        r"^\\d+\\.价值定位",
        r"^ONE的产品定位$",
        r"^所设想的典型工作场景$",
        r"^场景[一二三]：",
        r"^两个影响用户定位的关键决策$",
        r"^老板v\\.s\\.员工$",
        r"^发信人v\\.s\\.收信人$",
        r"^竞争定位",
        r"^I\\.为什么是钉钉$",
        r"^II\\.为什么是ONE",
        r"^动态变化的定位与阶段目标$",
        r"^辐射大多数用户$",
        r"^不可能N角$",
        r"^用「工作\\+发现」",
        r"^工作内容如何寄身卡片$",
        r"^卡片形态的必要性讨论$",
        r"^卡片设计的风险$",
        r"^IM消息如何寄身卡片$",
        r"^IM消息在ONE呈现的必要性讨论$",
        r"^落成移动端$",
        r"^曾经PC难为水$",
        r"^实时性问题$",
        r"^重要性排序$",
        r"^卡点\\d+：",
        r"^已读恐怖主义$",
        r"^无望的补丁",
        r"^卡片的可玩性$",
        r"^对标原场域$",
        r"^成本问题$",
        r"^重新拆题",
        r"^寻找甜区$",
        r"^默认值的权力",
        r"^探索非卡片的可能性",
        r"^放弃大包大揽$",
        r"^小结",
        r"^用户如何买单离场$",
        r"^预期与履约$",
        r"^钉钉的共创文化$",
        r"^泥泞的用户现场$",
        r"^当内测玩家",
        r"^当用户说谎$",
        r"^当设计在计划外",
        r"^定性研究",
        r"^迭代与汇报节奏$",
        r"^每日一包$",
        r"^汇报技巧$",
        r"^BeatingAroundtheBush$",
        r"^一鼓作气",
        r"^90分Agent",
        r"^AI跃进下的技术债$",
        r"^文牍先行$",
        r"^什么是钉钉的优先级$",
        r"^基于Scrum",
        r"^AI带来的管理变革$",
        r"^体验报告$",
        r"^流水线逻辑",
        r"^雅典学院v\\.s\\.西点军校$",
        r"^探马$",
        r"^事以密成$",
        r"^战场改名",
        r"^发布会里的机锋$",
        r"^Agent：",
        r"^望舒",
        r"^西南航空",
        r"^总结：",
        r"^人是目的",
        r"^不得不单独",
        r"^消失的",
        r"^秉笔设计$",
        r"^「钉钉不培养」设计$",
        r"^\\d+[.．].{2,34}$",
        r"^表层：",
        r"^中层：",
        r"^实操要点$",
        r"^十句精髓$",
    ]
    if len(compact) <= 38 and not compact.endswith(("。", "，", "；", "、")):
        if any(re.search(pattern, compact) for pattern in small_heading_patterns):
            return "h3"
    return None


def paragraph_class(text: str) -> str:
    if re.match(r"^\d+[.．]\s*", text):
        return " listish"
    compact = re.sub(r"\s+", "", text)
    minor_patterns = [
        r"^举几个具体的例子",
        r"^更具体地，要说清产品定位",
        r"^老板v\\.s\\.员工$",
        r"^发信人v\\.s\\.收信人$",
        r"^I\\.为什么是钉钉$",
        r"^II\\.为什么是ONE",
        r"^ONE期望多个目标",
        r"^最核心的处于量子纠缠态",
        r"^这三件事很难同时成",
        r"^用「工作\\+发现」",
        r"^卡点\\d+：",
        r"^横滑结构设计",
        r"^ToBorNotToB",
        r"^延伸：",
        r"^非常抱歉地更正",
        r"^时间在哪，爱就在哪$",
        r"^错误的注意力导致错花的时间$",
        r"^什么是Scrum$",
        r"^短期和长期臧否$",
        r"^上有政策，下有对策$",
        r"^失落的中层$",
        r"^又要马儿跑",
        r"^挣扎试用期$",
        r"^自驱才能顿悟$",
        r"^这个「入口」不只是",
        r"^这五路打法",
        r"^什么工作养人",
        r"^快就是慢，慢就是快$",
        r"^职业的本质",
        r"^角色模糊化$",
        r"^三条黄金法则$",
        r"^五个关键概念$",
        r"^客户反馈有三个层次",
        r"^关键追问句",
        r"^每次客户对话应该遵循",
        r"^每次对话结束",
    ]
    if any(re.search(pattern, compact) for pattern in minor_patterns):
        return " minor-head"
    if text.startswith(("「", "“")) and len(text) < 80:
        return " quoteish"
    if "——" in text and len(text) < 120:
        return " emphasis"
    return ""


def should_continue(prev: TextRun, curr: TextRun) -> bool:
    prev_text = prev.text
    curr_text = curr.text
    cross_page = curr.page != prev.page
    y_gap = curr.y - prev.y
    same_indent = abs(curr.x - prev.x) < 10
    continuation_indent = curr.x > prev.x + 8 and curr.x < 90
    if cross_page:
        if likely_heading(prev_text, prev.size, prev.x) or likely_heading(curr_text, curr.size, curr.x):
            return False
        if prev_text.endswith(("。", "！", "？", "；")):
            return False
        return abs(curr.x - prev.x) < 18 or curr.x > prev.x + 8
    if y_gap < 0:
        return False
    if y_gap > 24:
        return False
    if likely_heading(prev_text, prev.size, prev.x):
        return False
    if likely_heading(curr_text, curr.size, curr.x):
        return False
    if prev_text.endswith(("。", "！", "？", "；", "：")) and y_gap > 17:
        return False
    if re.match(r"^\d+[.．]\s*", curr_text):
        return False
    if curr_text.startswith(("第", "I.", "II.", "III.")) and len(curr_text) < 40:
        return False
    return same_indent or continuation_indent


def slugify(text: str, index: int) -> str:
    ascii_part = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    if ascii_part:
        return f"s{index}-{ascii_part[:36]}"
    return f"s{index}"


def extract_runs() -> tuple[list[TextRun | ImageRun], dict]:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    for old in IMAGE_DIR.glob("*"):
        old.unlink()

    doc = fitz.open(PDF_PATH)
    runs: list[TextRun | ImageRun] = []
    raw_images = 0
    kept_images = 0
    text_chars = 0

    for page_index, page in enumerate(doc, start=1):
        page_area = page.rect.width * page.rect.height
        blocks = page.get_text("dict")["blocks"]
        for block_index, block in enumerate(blocks):
            x0, y0, x1, y1 = block["bbox"]
            if block["type"] == 0:
                lines: list[str] = []
                max_size = 0.0
                for line in block["lines"]:
                    line_text = "".join(span["text"] for span in line["spans"])
                    for span in line["spans"]:
                        if span["text"].strip():
                            max_size = max(max_size, float(span["size"]))
                    line_text = normalize_text(line_text)
                    if line_text:
                        lines.append(line_text)
                text = normalize_text(" ".join(lines))
                if is_header_footer(text, y0, page.rect.height):
                    continue
                if text:
                    text_chars += len(text)
                    runs.append(TextRun(page_index, x0, y0, max_size, text))
            elif block["type"] == 1:
                raw_images += 1
                area = max(0.0, (x1 - x0) * (y1 - y0))
                if area / page_area > 0.82:
                    continue
                image_bytes = block.get("image")
                if not image_bytes:
                    continue
                ext = block.get("ext") or "png"
                filename = f"p{page_index:03d}-{block_index:02d}.{ext}"
                if filename in SKIP_DUPLICATE_IMAGE_NAMES:
                    continue
                kept_images += 1
                (IMAGE_DIR / filename).write_bytes(image_bytes)
                runs.append(ImageRun(page_index, x0, y0, x1 - x0, y1 - y0, f"assets/images/{filename}"))

    meta = {
        "pages": doc.page_count,
        "raw_images": raw_images,
        "kept_images": kept_images,
        "text_chars": text_chars,
    }
    return runs, meta


def runs_to_article(runs: list[TextRun | ImageRun]) -> tuple[str, list[dict]]:
    chunks: list[str] = []
    toc: list[dict] = []
    paragraph: TextRun | None = None
    heading_index = 0

    def flush_paragraph() -> None:
        nonlocal paragraph
        if paragraph is None:
            return
        text = polish_inline(paragraph.text)
        level = likely_heading(text, paragraph.size, paragraph.x)
        if level:
            nonlocal heading_index
            heading_index += 1
            anchor = slugify(text, heading_index)
            if level in {"h2", "h3"}:
                toc.append({"level": level, "text": text, "id": anchor, "page": paragraph.page})
            chunks.append(
                f'<{level} id="{anchor}"><span>{html.escape(text)}</span></{level}>'
            )
        else:
            cls = paragraph_class(text)
            chunks.append(
                f'<p class="para{cls}" data-page="{paragraph.page}">{html.escape(text)}</p>'
            )
        paragraph = None

    for run in runs:
        if isinstance(run, ImageRun):
            flush_paragraph()
            orientation = " wide" if run.w / max(run.h, 1) > 2.3 else ""
            chunks.append(
                '<figure class="figure%s" data-page="%s">'
                '<button class="image-button" type="button" aria-label="放大图片">'
                '<img src="%s" loading="lazy" alt="第 %s 页插图">'
                '</button>'
                '</figure>'
                % (orientation, run.page, html.escape(run.src), run.page)
            )
            continue

        if paragraph is None:
            paragraph = TextRun(run.page, run.x, run.y, run.size, run.text)
        elif should_continue(paragraph, run):
            paragraph.text = clean_join(paragraph.text, run.text)
            paragraph.y = run.y
            paragraph.size = max(paragraph.size, run.size)
        else:
            flush_paragraph()
            paragraph = TextRun(run.page, run.x, run.y, run.size, run.text)

    flush_paragraph()
    return "\n".join(chunks), toc


def build_html(article: str, toc: list[dict], meta: dict) -> str:
    toc_items = "\n".join(
        '<a class="%s" href="#%s"><span>%s</span><small>P%s</small></a>'
        % (
            "toc-" + item["level"],
            html.escape(item["id"]),
            html.escape(item["text"]),
            item["page"],
        )
        for item in toc
    )
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f7f3ed">
  <title>置身钉内</title>
  <link rel="stylesheet" href="assets/style.css?v=20260608-2">
</head>
<body>
  <div class="progress" aria-hidden="true"><span></span></div>
  <button class="reader-button" type="button" id="readerToggle" aria-label="阅读设置" aria-expanded="false" aria-controls="readerPanel">Aa</button>
  <section class="reader-panel" id="readerPanel" aria-label="阅读设置" hidden>
    <label>字号 <input id="fontSizeControl" type="range" min="17" max="23" value="19"></label>
    <label>行距 <input id="lineHeightControl" type="range" min="1.65" max="2.15" step="0.05" value="1.9"></label>
    <div class="reader-actions">
      <button type="button" data-theme="system">系统</button>
      <button type="button" data-theme="light">浅色</button>
      <button type="button" data-theme="warm">暖纸</button>
      <button type="button" data-theme="dark">深色</button>
    </div>
  </section>
  <header class="hero">
    <div class="hero-inner">
      <h1>置身钉内</h1>
      <p class="dek">楔：钉钉是一只雨燕</p>
      <p class="meta">2026-06-04</p>
    </div>
  </header>

  <main class="layout">
    <aside class="rail" id="toc">
      <div class="rail-card">
        <p class="rail-title">目录</p>
        <div class="toc-list">{toc_items}</div>
      </div>
    </aside>
    <article class="article" id="article">
      {article}
    </article>
  </main>

  <dialog class="lightbox" id="lightbox">
    <button type="button" class="close" aria-label="关闭">关闭</button>
    <img alt="">
  </dialog>
  <script src="assets/main.js?v=20260608-2"></script>
</body>
</html>
"""


def main() -> None:
    SITE_DIR.mkdir(parents=True, exist_ok=True)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    runs, meta = extract_runs()
    article, toc = runs_to_article(runs)
    (SITE_DIR / "index.html").write_text(build_html(article, toc, meta), encoding="utf-8")


if __name__ == "__main__":
    main()
