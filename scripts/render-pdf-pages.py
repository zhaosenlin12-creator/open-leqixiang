from pathlib import Path
import json

import fitz

ROOT = Path(__file__).resolve().parents[1]
PDF = next(ROOT.glob("*.pdf"))
OUT = ROOT / "public" / "assets" / "pdf"
CONTENT = ROOT / "public" / "content"

KEY_PAGES = {
    1: "课程规划卡汇总封面",
    30: "AI编程年卡权益图",
    32: "乐高年卡权益图",
    34: "产品使用权利说明",
    36: "暑假活动价格图",
    39: "机器人编程费用明细",
    41: "暑假班课程宣传",
    61: "科创小达人奖状"
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    CONTENT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)
    assets = []
    for page_number, title in KEY_PAGES.items():
        index = page_number - 1
        if index >= len(doc):
            continue
        page = doc[index]
        pix = page.get_pixmap(matrix=fitz.Matrix(1.6, 1.6), alpha=False)
        filename = f"page-{page_number:02d}.webp"
        output = OUT / filename
        pix.pil_save(output, format="WEBP", quality=88)
        assets.append({
            "id": f"pdf-page-{page_number:02d}",
            "title": title,
            "type": "image",
            "source": "pdf",
            "path": f"/assets/pdf/{filename}",
            "displayable": True,
            "privacy": "public",
            "tags": ["pdf", "poster"]
        })
    (CONTENT / "assets.pdf.json").write_text(
        json.dumps(assets, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Rendered {len(assets)} PDF pages from {PDF.name}.")


if __name__ == "__main__":
    main()

