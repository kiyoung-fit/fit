"""운동 이미지 만들기: free-exercise-db(퍼블릭 도메인, github.com/yuhonas/free-exercise-db)의
시작·끝 자세 사진 2장을 받아, 앱 색에 맞춘 파란 2색 톤으로 바꿔 img/ex/<id>-0.webp, -1.webp로 저장.
실행: python -I tools/make_ex_images.py
"""
import base64, sys, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tools" / "raw" / "exdb"
OUT = ROOT / "img" / "ex"
BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"

# 앱 종목 id -> free-exercise-db id (같은 동작이 없으면 가장 가까운 동작)
MAP = {
    "bench": "Barbell_Bench_Press_-_Medium_Grip", "db_bench": "Dumbbell_Bench_Press", "incline_db": "Incline_Dumbbell_Press",
    "chest_press": "Leverage_Chest_Press", "incline_press_m": "Leverage_Incline_Chest_Press", "pec_fly": "Butterfly",
    "cable_fly": "Cable_Crossover", "dip": "Dips_-_Chest_Version", "pushup": "Pushups",
    "lat_pd": "Wide-Grip_Lat_Pulldown", "pullup": "Pullups", "assist_pullup": "Band_Assisted_Pull-Up",
    "bb_row": "Bent_Over_Barbell_Row", "db_row": "One-Arm_Dumbbell_Row", "seated_row": "Seated_Cable_Rows",
    "row_m": "Leverage_Iso_Row", "tbar_row": "T-Bar_Row_with_Handle", "straight_pd": "Straight-Arm_Pulldown",
    "squat": "Barbell_Squat", "leg_press": "Leg_Press", "hack_squat": "Hack_Squat", "goblet": "Goblet_Squat",
    "rdl": "Romanian_Deadlift", "db_rdl": "Stiff-Legged_Dumbbell_Deadlift", "deadlift": "Barbell_Deadlift",
    "hip_thrust": "Barbell_Hip_Thrust", "hip_thrust_m": "Barbell_Glute_Bridge", "lunge": "Dumbbell_Lunges",
    "split_squat": "Split_Squat_with_Dumbbells", "leg_ext": "Leg_Extensions", "leg_curl": "Lying_Leg_Curls",
    "calf_raise": "Standing_Calf_Raises", "adductor": "Thigh_Adductor", "abductor": "Thigh_Abductor",
    "ohp": "Standing_Military_Press", "db_ohp": "Dumbbell_Shoulder_Press", "shoulder_press_m": "Leverage_Shoulder_Press",
    "lat_raise": "Side_Lateral_Raise", "cable_lat": "Cable_Seated_Lateral_Raise", "rear_fly": "Reverse_Machine_Flyes",
    "face_pull": "Face_Pull", "bb_curl": "Barbell_Curl", "db_curl": "Dumbbell_Bicep_Curl", "hammer": "Hammer_Curls",
    "cable_curl": "Standing_Biceps_Cable_Curl", "pushdown": "Triceps_Pushdown_-_Rope_Attachment",
    "oh_ext": "Cable_Rope_Overhead_Triceps_Extension", "skull": "EZ-Bar_Skullcrusher", "plank": "Plank",
    "cable_crunch": "Cable_Crunch", "leg_raise": "Hanging_Leg_Raise", "ab_crunch_m": "Ab_Crunch_Machine",
}

# 2색 톤: 어두운 곳은 남색, 밝은 곳은 흰빛 하늘색 (tokens.css의 잉크·종이 색과 같은 계열)
JS = """async ([src, w, h]) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const s = Math.max(w / img.width, h / img.height);
  x.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
  const d = x.getImageData(0, 0, w, h), p = d.data;
  const dark = [18, 42, 84], light = [242, 247, 253];
  for (let i = 0; i < p.length; i += 4) {
    let l = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255;
    l = Math.min(1, Math.max(0, (l - 0.06) * 1.25));
    for (let k = 0; k < 3; k++) p[i + k] = dark[k] + (light[k] - dark[k]) * l;
  }
  x.putImageData(d, 0, 0);
  return c.toDataURL('image/webp', 0.72);
}"""


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        for app_id, src_id in MAP.items():
            for n in (0, 1):
                raw = RAW / f"{src_id}_{n}.jpg"
                if not raw.exists():
                    urllib.request.urlretrieve(f"{BASE}{src_id}/{n}.jpg", raw)
                data = "data:image/jpeg;base64," + base64.b64encode(raw.read_bytes()).decode()
                url = pg.evaluate(JS, [data, 480, 320])
                (OUT / f"{app_id}-{n}.webp").write_bytes(base64.b64decode(url.split(",", 1)[1]))
        b.close()
    total = sum(f.stat().st_size for f in OUT.glob("*.webp"))
    print(f"{len(MAP)}종, {len(list(OUT.glob('*.webp')))}장, {total // 1024}KB")


if __name__ == "__main__":
    main()
