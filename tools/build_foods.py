"""식약처 식품영양성분 표준데이터(CSV) -> 앱용 js/data/foods.json

입력 (tools/raw/, data.go.kr 에서 내려받은 그대로, cp949):
  food.csv : 전국통합식품영양성분정보(음식)표준데이터       15100070
  raw.csv  : 전국통합식품영양성분정보(원재료성식품)표준데이터 15100065

출력 형식: {"v":1, "f":[[이름, 업체, kcal, 단백질, 탄수, 지방, 1회량, 단위, 출처], ...]}
  - 영양값은 100g(또는 100ml)당
  - 출처 0=음식, 1=원재료, 2=앱 기본값(시판 제품 일반값)
실행: python -I tools/build_foods.py
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tools" / "raw"
OUT = ROOT / "js" / "data" / "foods.json"


def num(s):
    try:
        return round(float(str(s).replace(",", "").strip()), 1)
    except ValueError:
        return 0.0


def amount(s):
    m = re.match(r"\s*([\d.]+)\s*(g|ml|mL)?", s or "")
    if not m:
        return 100.0, "g"
    return round(float(m.group(1))), (m.group(2) or "g").lower()


def clean(name):
    return re.sub(r"\s+", " ", name.replace("_", " ")).strip()


# 음식: 같은 이름·업체가 여러 출처로 겹치면 성인 1인분에 가까운 출처 우선
PRIORITY = ["외식(분석", "가정식", "외식(프랜차이즈", "외식(재료량", "산업체급식", "중고등학교급식", "초등학교급식"]


def prio(origin):
    for i, p in enumerate(PRIORITY):
        if origin.startswith(p):
            return i
    return 99


def load_dishes():
    rows = list(csv.reader(open(RAW / "food.csv", encoding="cp949")))[1:]
    best = {}
    for r in rows:
        name, origin, brand = r[1], r[5], r[45]
        brand = "" if brand == "해당없음" else brand
        kcal = num(r[17])
        if not name or kcal <= 0 and "커피" not in name and "차" not in name:
            continue
        base, unit = amount(r[16])
        serv, sunit = amount(r[44])
        key = (clean(name), brand)
        item = [clean(name), brand, kcal, num(r[19]), num(r[22]), num(r[20]), serv or 100, unit, 0]
        if key not in best or prio(origin) < best[key][0]:
            best[key] = (prio(origin), item)
    return [v[1] for v in best.values()]


# 원재료: 수산물의 산지·월별 세부 측정값은 빼고 대표값만
SERVING = {"달걀": 50, "바나나": 120, "사과": 200, "고구마": 150, "감자": 150, "귀리": 40,
           "우유": 200, "닭고기 가슴": 120, "방울토마토": 100, "아보카도": 100}


def load_raw():
    rows = list(csv.reader(open(RAW / "raw.csv", encoding="cp949")))[1:]
    out, seen = [], set()
    for r in rows:
        name = r[1]
        if r[7] == "어패류 및 기타 수산물":
            if "대표_평균" in name:
                name = name.replace("_대표_평균", "")
            elif re.search(r"_\d{1,2}월|_평균", name):
                continue
        n = clean(name)
        if n in seen:
            continue
        seen.add(n)
        base, unit = amount(r[16])
        serv = next((v for k, v in SERVING.items() if n.startswith(k)), 100)
        out.append([n, "", num(r[17]), num(r[19]), num(r[22]), num(r[20]), serv, unit, 1])
    return out


# 시판 제품·술 등 공공 DB에 없는 헬스 필수 식품 (제품 라벨 평균값, 100g/ml당)
STAPLES = [
    ("프로틴 파우더 (웨이 1스쿱)", 400, 80, 10, 5, 30, "g"),
    ("닭가슴살 (시판 훈제·수비드)", 110, 23, 1, 1.5, 100, "g"),
    ("닭가슴살 소시지", 150, 17, 7, 6, 70, "g"),
    ("즉석밥 흰쌀밥", 150, 2.4, 33, 0.3, 210, "g"),
    ("즉석밥 현미밥", 148, 3, 32, 1, 210, "g"),
    ("두부 (부침용)", 88, 9, 2, 5, 150, "g"),
    ("연두부", 50, 5, 2, 2.5, 120, "g"),
    ("그릭요거트 (무가당)", 95, 9, 5, 4.5, 100, "g"),
    ("오트밀 (퀵오트)", 380, 13, 66, 7, 40, "g"),
    ("아몬드", 600, 21, 20, 52, 25, "g"),
    ("땅콩버터", 590, 25, 20, 50, 15, "g"),
    ("올리브유", 884, 0, 0, 100, 10, "g"),
    ("우유 (일반)", 65, 3.2, 4.8, 3.5, 200, "ml"),
    ("저지방 우유", 42, 3.3, 5, 1, 200, "ml"),
    ("두유 (무가당)", 50, 3.6, 2.5, 2.4, 190, "ml"),
    ("프로틴 바", 367, 33, 37, 12, 60, "g"),
    ("프로틴 음료 (RTD)", 70, 10, 4, 1.5, 250, "ml"),
    ("라면 (봉지, 조리)", 417, 8.5, 65, 14, 120, "g"),
    ("컵라면 (큰컵)", 455, 9, 62, 19, 110, "g"),
    ("소주 (1병)", 113, 0, 0, 0, 360, "ml"),
    ("맥주", 43, 0.4, 3.5, 0, 500, "ml"),
    ("막걸리", 50, 1.6, 2, 0, 750, "ml"),
    ("와인 (레드)", 83, 0.1, 2.6, 0, 150, "ml"),
    ("하이볼", 60, 0, 6, 0, 350, "ml"),
    ("콜라", 42, 0, 10.6, 0, 355, "ml"),
    ("제로 콜라·제로 음료", 0, 0, 0, 0, 355, "ml"),
    ("크레아틴", 0, 0, 0, 0, 5, "g"),
    ("BCAA·EAA 음료", 0, 0, 0, 0, 500, "ml"),
]


def main():
    foods = load_dishes() + load_raw()
    foods += [[n, "", k, p, c, f, s, u, 2] for n, k, p, c, f, s, u in STAPLES]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {"v": 1, "src": "식품의약품안전처 식품영양성분DB(공공데이터포털 15100070·15100065) + 앱 기본값", "f": foods}
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    counts = [sum(1 for x in foods if x[8] == i) for i in range(3)]
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"음식 {counts[0]} / 원재료 {counts[1]} / 기본값 {counts[2]} -> {OUT} ({OUT.stat().st_size // 1024}KB)")


if __name__ == "__main__":
    main()
