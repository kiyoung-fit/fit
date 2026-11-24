"""앱 아이콘 PNG 생성 (Playwright로 SVG를 렌더). 실행: python -I tools/make_icons.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
# 흰빛 바탕 + 파란 덤벨 (앱 색)
SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#f4f7fb"/>
<g fill="#2f62d9"><rect x="96" y="176" width="44" height="160"/><rect x="152" y="140" width="44" height="232"/>
<rect x="316" y="140" width="44" height="232"/><rect x="372" y="176" width="44" height="160"/>
<rect x="196" y="238" width="120" height="36"/></g></svg>'''
SIZES = {"icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180, "icon-maskable-512.png": 512}
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, size in SIZES.items():
        svg = SVG
        if "maskable" in name:  # 안전영역 80% 안으로 축소
            svg = SVG.replace('<g fill', '<g transform="translate(51.2 51.2) scale(0.8)" fill')
        pg = b.new_page(viewport={"width": size, "height": size})
        pg.set_content(f'<html><body style="margin:0">{svg.replace("<svg ", f"<svg width={size} height={size} ")}</body></html>')
        pg.screenshot(path=str(ROOT / "icons" / name))
        pg.close()
    b.close()
print("ok")
