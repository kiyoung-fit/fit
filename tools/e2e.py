"""아이폰 크기로 앱 전체 흐름 점검. 실행: python -I .claude/skills/webapp-testing/scripts/with_server.py --server "python -m http.server 8765" --port 8765 -- python -I tools/e2e.py"""
import threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding="utf-8")
OUT = Path(__file__).resolve().parent / "shots"
ROOT = Path(__file__).resolve().parent.parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{srv.server_address[1]}/"
errors = []

def shot(pg, name):
    pg.screenshot(path=str(OUT / f"{name}.png"), full_page=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="ko-KR")
    pg = ctx.new_page()
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_load_state("networkidle")
    shot(pg, "01-intro")
    nxt = lambda: pg.click("[data-nav=next]")
    nxt()                                           # intro
    pg.click("[data-set=sex][data-value=m]"); pg.wait_for_timeout(300)
    pg.fill("input[name=birth]", "1992-03-15"); nxt()
    pg.fill("input[name=height]", "176"); pg.dispatch_event("input[name=height]", "input"); nxt()
    pg.fill("input[name=weight]", "78"); pg.dispatch_event("input[name=weight]", "input"); nxt()
    shot(pg, "02-inbody"); pg.click("[data-nav=skip]")
    pg.click("[data-set=activity][data-value='1.2']"); pg.wait_for_timeout(300)
    pg.click("[data-set=experience][data-value=int]"); pg.wait_for_timeout(300)
    pg.click("[data-set=days][data-value='4']"); pg.wait_for_timeout(300)
    pg.click("[data-set=sessionMin][data-value='60']"); pg.wait_for_timeout(300)
    pg.click("[data-toggle=back]"); shot(pg, "03-injury"); nxt()
    pg.click("[data-set=goal][data-value=cut]"); pg.wait_for_timeout(300)
    pg.fill("input[name=targetWeight]", "72"); pg.dispatch_event("input[name=targetWeight]", "input"); nxt()
    shot(pg, "04-result")
    print("result:", pg.inner_text(".calc").replace("\n", " | "))
    nxt(); pg.wait_for_timeout(600)
    shot(pg, "05-home")
    for tab in ["plan", "food", "health", "settings"]:
        pg.goto(URL + "#/" + tab); pg.wait_for_timeout(600); shot(pg, f"06-{tab}")
    # 운동
    pg.goto(URL + "#/workout"); pg.wait_for_timeout(600); shot(pg, "07-workout-start")
    print("broken thumbs:", pg.evaluate("[...document.querySelectorAll('.ex-thumb img')].filter(i => i.complete && i.naturalWidth === 0).length"))
    pg.click("[data-act=start]"); pg.wait_for_timeout(600)
    # 첫 종목 무게 입력 후 세트 완료
    first = pg.locator(".ex").first
    rows = first.locator(".sets .set:not(.set--warm)")
    for i in range(rows.count()):
        r = rows.nth(i)
        if r.locator("input[name=w]").count():
            r.locator("input[name=w]").fill("60"); r.locator("input[name=w]").dispatch_event("input")
        r.locator("[data-act=done]").click()
    first.locator("[data-act=add-set]").click(); pg.wait_for_timeout(200)
    shot(pg, "08-session")
    print("rest visible:", pg.is_visible("#rest"), pg.inner_text(".rest-time"))
    pg.click("[data-act=swap] >> nth=1"); pg.wait_for_timeout(300); shot(pg, "09-swap"); pg.click("dialog [data-act=close]")
    pg.click(".ex-title >> nth=0"); pg.wait_for_timeout(900); pg.screenshot(path=str(OUT / "09b-info.png"))
    print("anim imgs loaded:", pg.evaluate("[...document.querySelectorAll('dialog .ex-anim img')].map(i => i.naturalWidth)"))
    pg.click("dialog [data-act=close]")
    print("in-session cardio button gone:", pg.locator("[data-act=add-cardio]").count() == 0)
    print("balance:", pg.inner_text("#sess-balance"))
    # 세션 중 유산소 따로 기록
    pg.click("[data-act=cardio-apart]"); pg.wait_for_timeout(300); shot(pg, "10-cardio"); pg.click("dialog [data-act=save]"); pg.wait_for_timeout(500)
    print("apart notice:", pg.inner_text("#notice"))
    # 종목 추가 시트: 부위 상태, 내 운동 추가 (부위 필수)
    pg.click("[data-act=add-ex]"); pg.wait_for_timeout(500); shot(pg, "10b-add-sheet")
    print("add status:", " ".join(pg.inner_text("#add-status").split()))
    pg.click("dialog [data-act=new]"); pg.wait_for_timeout(400)
    pg.fill("dialog input[name=name]", "해머 로우 머신")
    pg.click("dialog [data-act=muscle][data-v=chest]"); pg.wait_for_timeout(150)
    pg.click("dialog [data-act=muscle][data-v=back]"); pg.wait_for_timeout(150)
    pg.click("dialog [data-act=pattern][data-v=hpull]")
    pg.click("dialog [data-act=save]"); pg.wait_for_timeout(700); shot(pg, "10c-custom-added")
    print("custom in session:", pg.locator(".ex .ex-name", has_text="해머 로우 머신").count(), "tile:", pg.locator(".ex .ex-tile").count())
    cust = pg.locator(".ex", has_text="해머 로우 머신")
    cr = cust.locator(".sets .set").first
    cr.locator("input[name=w]").fill("50"); cr.locator("input[name=w]").dispatch_event("input"); cr.locator("[data-act=done]").click()
    pg.click("[data-act=finish]"); pg.wait_for_timeout(800); shot(pg, "11-finish")
    print("finish:", pg.inner_text("dialog .stats").replace("\n", " "), "|", " ".join(pg.inner_text("dialog .note").split()))
    pg.click("dialog [data-act=close]"); pg.wait_for_timeout(400)
    # 지난 운동 고치기: 첫 세트 무게 600으로 잘못 넣은 셈 치고 고쳐서 저장
    pg.goto(URL + "#/workout"); pg.wait_for_timeout(600)
    print("history rows:", [" ".join(t.split()) for t in pg.locator("section[aria-labelledby=hist-h] .row").all_inner_texts()], "dialogs open:", pg.locator("dialog[open]").count())
    pg.locator("section[aria-labelledby=hist-h] .row", has_text="상체").first.click(); pg.wait_for_timeout(500)
    v0 = pg.inner_text("dialog .stats")
    w0 = pg.locator("dialog .sets .set:not(.set--warm) input[name=w]").first
    w0.fill("70"); w0.dispatch_event("input")
    pg.click("dialog [data-act=save]"); pg.wait_for_timeout(600)
    if not pg.locator("section[aria-labelledby=hist-h] .row", has_text="상체").count():
        shot(pg, "debug-after-save"); print("DEBUG errors so far:", errors, pg.locator("dialog[open]").count())
    pg.locator("section[aria-labelledby=hist-h] .row", has_text="상체").first.click(); pg.wait_for_timeout(500)
    print("edit volume:", " ".join(v0.split()), "->", " ".join(pg.inner_text("dialog .stats").split()))
    pg.click("dialog [data-act=close]"); pg.wait_for_timeout(300)
    # 유산소 따로 기록
    pg.goto(URL + "#/workout"); pg.wait_for_timeout(600)
    pg.click("[data-act=cardio]"); pg.wait_for_timeout(300)
    pg.click("dialog [data-t=cycle]"); pg.click("dialog [data-act=save]"); pg.wait_for_timeout(700)
    shot(pg, "11b-cardio-logged")
    print("cardio block:", " ".join(pg.inner_text("section[aria-labelledby=cardio-h]").split())[:120])
    print("history top:", " ".join(pg.locator("section[aria-labelledby=hist-h] .row").first.inner_text().split()))
    # 식단
    pg.goto(URL + "#/food"); pg.wait_for_timeout(600)
    pg.click("[data-act=add][data-slot=lunch]"); pg.wait_for_timeout(300)
    pg.fill("#q", "닭가슴살"); pg.dispatch_event("#q", "input"); pg.wait_for_timeout(1500)
    shot(pg, "12-search")
    print("search top:", [t.replace("\n", " / ") for t in pg.locator("#results .row").all_inner_texts()[:5]])
    pg.locator("#results .row").first.click(); pg.wait_for_timeout(300); shot(pg, "13-amount")
    pg.click("dialog [data-act=add]"); pg.wait_for_timeout(600)
    pg.click("[data-act=add][data-slot=dinner]"); pg.wait_for_timeout(300)
    pg.fill("#q", "소주"); pg.dispatch_event("#q", "input"); pg.wait_for_timeout(800)
    print("soju:", pg.locator("#results .row").all_inner_texts()[:2])
    pg.click("dialog [data-act=close]")
    shot(pg, "14-food")
    # 건강
    pg.goto(URL + "#/health"); pg.wait_for_timeout(500)
    pg.click("[data-act=log]"); pg.wait_for_timeout(300)
    pg.fill("dialog input[name=weight]", "77.2"); pg.fill("dialog input[name=sleep]", "7")
    pg.click("dialog [data-act=save]"); pg.wait_for_timeout(600); shot(pg, "15-health")
    # 플랜 목적 변경 미리보기
    pg.goto(URL + "#/plan"); pg.wait_for_timeout(500)
    pg.click("[data-act=change-goal]"); pg.wait_for_timeout(300)
    pg.click("dialog [data-f=goal][data-v=bulk]"); pg.wait_for_timeout(600); shot(pg, "16-goal-change")
    print("preview:", pg.inner_text("#preview").replace("\n", " | "))
    pg.click("dialog [data-act=close]")
    pg.goto(URL + "#/home"); pg.wait_for_timeout(600); shot(pg, "17-home-after")
    # 새로고침 후 유지
    pg.reload(); pg.wait_for_timeout(800)
    print("after reload home has weight:", "77" in pg.inner_text("main"))
    # 백업 왕복 + 조작된 백업 거부
    res = pg.evaluate("""async () => {
      const db = await import('./js/db.js');
      const data = await db.exportAll();
      const n = data.workouts.length;
      await db.importAll(JSON.parse(JSON.stringify(data)));
      const ok = (await db.all('workouts')).length === n;
      const bad = JSON.parse(JSON.stringify(data));
      bad.meals.push({ id: '"><img src=x onerror=alert(1)>', date: '2026-01-01', slot: 'lunch', name: 'x', kcal: 1, p: 0, c: 0, f: 0 });
      let rejected = false;
      try { await db.importAll(bad); } catch { rejected = true; }
      return { ok, rejected, n };
    }""")
    print("backup:", res)
    # 턱걸이 우선 넣기 + 세션 고치기 + 시간 미리보기
    pg.goto(URL + "#/plan"); pg.wait_for_timeout(700)
    pg.click("[data-act=pullup-yes]"); pg.wait_for_timeout(800)
    print("pullup in plan:", pg.locator(".row", has_text="풀업").count())
    pg.click("[data-act=edit] >> nth=0"); pg.wait_for_timeout(400)
    before = pg.locator("dialog .edit-row").count()
    pg.click("dialog .edit-row >> nth=0 >> [data-act=more]"); pg.wait_for_timeout(200)
    pg.click("dialog [data-act=m][data-m=triceps]"); pg.wait_for_timeout(200)
    pg.click("dialog [data-act=add] >> nth=0"); pg.wait_for_timeout(300); shot(pg, "19b-edit-session")
    print("edit rows:", before, "->", pg.locator("dialog .edit-row").count(), "|", " ".join(pg.inner_text("dialog .sheet-body > p.muted").split())[:90])
    pg.click("dialog .sheet-body [data-act=close]"); pg.wait_for_timeout(600)
    pg.click("[data-act=change]"); pg.wait_for_timeout(400)
    pg.click("dialog [data-f=sessionMin][data-v='90']"); pg.wait_for_timeout(700)
    print("preview:", " ".join(pg.inner_text("#preview").split())[:260])
    pg.click("dialog [data-act=close]")
    # 턱걸이 세션: 추가 무게 칸
    idx = pg.evaluate("import('./js/db.js').then(async db => (await db.kv('plan')).sessions.findIndex(s => s.items.some(i => i.exId === 'pullup')))")
    pg.goto(URL + "#/workout"); pg.wait_for_timeout(600); pg.click("[data-act=pick]"); pg.wait_for_timeout(300)
    pg.click(f"dialog [data-act=go][data-idx='{idx}']"); pg.wait_for_timeout(600)
    pu = pg.locator(".ex", has_text="풀업")
    print("pullup head:", " ".join(pu.locator(".set--head").inner_text().split()), "| sug:", pu.locator(".ex-sug").inner_text()[:60])
    r0 = pu.locator(".sets .set").first
    r0.locator("input[name=w]").fill("5"); r0.locator("input[name=w]").dispatch_event("input")
    r0.locator("input[name=r]").fill("8"); r0.locator("input[name=r]").dispatch_event("input"); r0.locator("[data-act=done]").click()
    pg.click("[data-act=finish]"); pg.wait_for_timeout(800)
    print("pullup finish:", " ".join(pg.inner_text("dialog .stats").split()))
    pg.click("dialog [data-act=close]"); pg.wait_for_timeout(300)
    print("pullup saved:", pg.evaluate("import('./js/db.js').then(async db => (await db.all('workouts')).flatMap(w => w.exercises).filter(e => e.exId === 'pullup').map(e => e.sets[0]))"))
    # 백업: 내 운동 포함, 조작된 사진 거부
    res2 = pg.evaluate("""async () => {
      const db = await import('./js/db.js');
      const data = await db.exportAll();
      const hasCustom = (data.kv.find(r => r.key === 'customExercises')?.value || []).length;
      const bad = JSON.parse(JSON.stringify(data));
      bad.kv.push({ key: 'exPhoto:c_x', value: 'javascript:alert(1)' });
      let rejected = false; try { await db.importAll(bad); } catch { rejected = true; }
      return { hasCustom, rejected };
    }""")
    print("backup custom:", res2)
    # 예전 규칙 플랜이 새 규칙으로 바뀌는지
    pg.evaluate("import('./js/db.js').then(async db => { const p = await db.kv('plan'); delete p.rules; await db.setKv('plan', p); })")
    pg.goto(URL + "#/plan"); pg.wait_for_timeout(800); shot(pg, "19-plan-upgraded")
    print("upgrade note:", pg.is_visible(".note--accent"), "| weekly:", " ".join(pg.inner_text("section[aria-labelledby=vol-h] table").split()))
    print("arms in upper:", pg.evaluate("[...document.querySelectorAll('.block')].filter(b => b.querySelector('h2')?.textContent.startsWith('상체')).map(b => /컬|트라이셉스|푸시다운|익스텐션/.test(b.textContent))"))
    # 휴식 끝: 삐 3번(오실레이터 3개), 화면 깜빡임 5번
    pg.evaluate("""() => { window.__osc = 0; const C = window.AudioContext; const orig = C.prototype.createOscillator;
      C.prototype.createOscillator = function () { window.__osc++; return orig.call(this); }; }""")
    pg.click("#settings-link"); pg.wait_for_timeout(300)  # 클릭으로 소리 깨우기
    pg.evaluate("import('./js/ui.js').then(u => { u.unlockAudio(); u.startRest(1); })")
    pg.wait_for_timeout(300); shot(pg, "18-rest-bar")
    seen = 0
    for _ in range(14):
        pg.wait_for_timeout(125)
        seen += pg.evaluate("document.getElementById('flash').classList.contains('flash--on')")
    print("rest end: beeps", pg.evaluate("window.__osc"), "flash frames on", seen, "label", pg.inner_text(".rest-label"))
    b.close()
srv.shutdown()
print("ERRORS:", errors if errors else "none")
