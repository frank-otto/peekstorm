"""Peekstorm – phone start-screen + play-screen regression test (real touch emulation).
WebKit (iPhone 13, iPhone 8 = 375×667, iPhone SE 320×568) + Chromium (Pixel 7), portrait and landscape.
Checks: ONE tap from page load lands in a playable night (⚡ + quit / sound / DE-EN all tappable, the start hint and the controls cover no hiding spot);
a real tap on a peeking ghost catches it, a real tap on ⚡ calls the lightning; every start-screen and options control can be TAPPED (nothing covers it, nothing off-screen, no scrolling);
language auto-detect; no overflow in German; no console errors.
Run: python3 test/test_mobile.py [base-url]   (exit code 0 = all checks passed; screenshots → test/shots/mobile/)"""
import asyncio, os, sys, threading, http.server, functools, socketserver, json
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('PS_SHOTS', ROOT + '/test/shots/mobile/'); os.makedirs(OUT, exist_ok=True)
if len(sys.argv) > 1: URL = sys.argv[1]
else:
    class _Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    _srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
    threading.Thread(target=_srv.serve_forever, daemon=True).start(); URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
ONLY = os.environ.get('PS_ONLY', '')
R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)
DEVICES = [  # engine, descriptor, landscape, browser locale
    ('webkit', 'iPhone 13', False, 'en-US'), ('webkit', 'iPhone 13', True, 'de-DE'),
    ('webkit', 'iPhone 8', False, 'de-AT'), ('webkit', 'iPhone 8', True, 'en-US'),
    ('webkit', 'iPhone SE', False, 'en-GB'), ('webkit', 'iPhone SE', True, 'de-DE'),
    ('chromium', 'Pixel 7', False, 'de-DE'), ('chromium', 'Pixel 7', True, 'en-US')]
HIT = """ids => ids.map(sel => { const e = document.querySelector(sel); if (!e) return [sel, 'missing'];
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2) return [sel, 'hidden'];
  if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return [sel, 'off-screen ' + [r.left, r.top, r.right, r.bottom].map(Math.round)];
  for (const [fx, fy] of [[.5, .5], [.2, .5], [.8, .5]]) { const t = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); if (!t || !(t === e || e.contains(t))) return [sel, 'covered by ' + (t ? (t.id || t.tagName) : 'nothing')]; }
  if (r.height < 44 || r.width < 44) return [sel, 'too small ' + Math.round(r.width) + 'x' + Math.round(r.height)]; return [sel, 'ok']; })"""
COVER = """(() => { const ids = ['hud', 'meters', 'top', 'btnBolt']; const R = ids.map(id => [id, document.getElementById(id).getBoundingClientRect()]).filter(([i, r]) => r.width > 0);
  const sp = __ps.spots().filter(p => p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight && p.z < 1);
  const hits = []; sp.forEach((p, k) => R.forEach(([id, r]) => { if (p.x > r.left - 4 && p.x < r.right + 4 && p.y > r.top - 4 && p.y < r.bottom + 4) hits.push([id, Math.round(p.x), Math.round(p.y)]); }));
  return { onScreen: sp.length, hits }; })()"""
NOSCROLL = "document.scrollingElement.scrollHeight <= innerHeight + 1 && document.scrollingElement.scrollWidth <= innerWidth + 1"
async def ev(pg, js): return await pg.evaluate(js)
async def until(pg, js, secs=20):
    for _ in range(int(secs * 5)):
        try:
            if await pg.evaluate(js): return True
        except Exception: pass
        await pg.wait_for_timeout(200)
    return False
async def tap(pg, sel):
    """Tap with a short settle + one retry: headless WebKit/SwiftShader frames can stall the actionability wait. Same checks, no force."""
    for k in (1, 2):
        try:
            await pg.wait_for_selector(sel, state='visible', timeout=20000); await pg.tap(sel, timeout=20000); return
        except Exception as e:
            if k == 2 or 'Timeout' not in str(e): raise
            print(f'RETRY tap {sel} (timeout, retrying once after 1 s)', flush=True); await pg.wait_for_timeout(1000)
async def run(p, eng, dev, land, loc):
    d = dict(p.devices[dev]); d.pop('default_browser_type', None)
    if land: d['viewport'] = {'width': d['viewport']['height'], 'height': d['viewport']['width']}
    W, H = d['viewport']['width'], d['viewport']['height']; tag = f"{dev.replace(' ', '')}-{'land' if land else 'port'}"; T = f'[{tag} {eng} {W}×{H} {loc}]'
    kw = {} if eng == 'webkit' else dict(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    b = await (p.webkit if eng == 'webkit' else p.chromium).launch(**kw)
    ctx = await b.new_context(**d, locale=loc); await ctx.add_init_script("window.__psNoAutoQ = true; try{if(!sessionStorage.getItem('psInit')){sessionStorage.setItem('psInit','1'); localStorage.clear();}}catch(e){}")
    pg = await ctx.new_page(); pg.set_default_timeout(30000); errs = []
    pg.on('console', lambda m: errs.append(m.text[:160]) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)[:160]))
    await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready") && window.__ps', timeout=90000)
    # ---------- 1) ONE TAP from page load → playable night ----------
    await pg.wait_for_timeout(1200); st0 = await ev(pg, '__ps.S.state'); await pg.screenshot(path=f'{OUT}{tag}-0-opening.png')
    sk = dict(await ev(pg, f"({HIT})(['#btnSkip'])"))['#btnSkip'] if st0 == 'intro' else 'n/a'
    sktxt = await ev(pg, "document.getElementById('btnSkip').textContent")
    check(f'{T} opens on the cinematic opening (lightning reveal), "tap to play" label on screen (touch wording)', st0 == 'intro' and (sk == 'ok' or sk.startswith('covered')) and ('Tap' in sktxt or 'Tippen' in sktxt), (st0, sk, sktxt))
    want = 'de' if loc.startswith('de') else 'en'; check(f'{T} language auto-detected from the browser ({want})', await ev(pg, '__ps.S.lang') == want and await ev(pg, 'document.documentElement.lang') == want)
    await pg.touchscreen.tap(W / 2, H * .4)  # ONE tap, anywhere
    ok = await until(pg, "__ps.S.state === 'play'", 10)
    info = await ev(pg, '[__ps.S.state, __ps.S.mode, __ps.hunt() && __ps.hunt().state]')
    check(f'{T} a single tap goes straight into Night I (count-in / hunt running)', ok and info[:2] == ['play', 'night'] and info[2] in ('count', 'hunt'), info)
    check(f'{T} sound unlocks on that first tap (sound on by default)', await until(pg, "__ps.audioState() !== 'none'", 5) and not await ev(pg, "document.getElementById('btnSound').textContent.includes('🔇')"), await ev(pg, '__ps.audioState()'))
    hint = await until(pg, "document.getElementById('hint').classList.contains('show')", 20)
    await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}{tag}-1-play-hint.png')
    await ev(pg, 'window.__psManual = true')
    lay = await ev(pg, """(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const h = r('#hint'), hud = r('#hud'), top = r('#top'), met = r('#meters'), bolt = r('#btnBolt');
      const ov = (x, y) => !(x.bottom <= y.top || x.top >= y.bottom || x.right <= y.left || x.left >= y.right);
      const sp = __ps.spots().filter(p => p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight); const b = __ps.beamScreen();
      return { hint: [h.left, h.top, h.right, h.bottom].map(Math.round), hintSpot: sp.filter(p => p.x > h.left && p.x < h.right && p.y > h.top && p.y < h.bottom).map(p => [Math.round(p.x), Math.round(p.y)]),
        hintBeam: b.x > h.left && b.x < h.right && b.y > h.top && b.y < h.bottom, hintUi: ov(h, hud) || ov(h, top) || ov(h, met) || ov(h, bolt), noscroll: """ + NOSCROLL + """ }; })()""")
    check(f'{T} the short start hint shows and covers no hiding spot, not the lantern pool, not the HUD / ⚡; no scrolling', hint and not lay['hintSpot'] and not lay['hintBeam'] and not lay['hintUi'] and lay['noscroll'], lay)
    cov = []
    for bx in (-5.5, 0, 5.5):
        await ev(pg, f'__ps.hunt().setBeam({bx}, 0); __ps.stepq(1/30, 90)'); c = await ev(pg, COVER); cov.append([bx, c['onScreen'], c['hits']])
    check(f'{T} the controls never cover the action: no hiding spot on screen sits under the HUD, meters, ✕/sound/DE or ⚡ (lantern left / centre / right)', all(not x[2] and x[1] >= 6 for x in cov), cov)
    await ev(pg, "__ps.fillStorm(); __ps.stepq(1/30, 2); __ps.setUI(); document.getElementById('hint').classList.remove('show')")
    sel = ['#btnBolt', '#btnQuit', '#btnSound', '#btnLang']
    hit = dict(await ev(pg, f'({HIT})({json.dumps(sel)})')); bad = {k: v for k, v in hit.items() if v != 'ok'}
    check(f'{T} play screen: ⚡ + ✕ / sound / DE-EN all on screen, ≥ 44 px, tappable', not bad, bad or 'ok')
    bz = await ev(pg, "(() => { const r = document.getElementById('btnBolt').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.left), (r.top + r.height / 2) > innerHeight * (innerWidth > innerHeight ? .6 : .7) && (r.left + r.width / 2) > innerWidth * .6, Math.round(r.width)]; })()")
    check(f'{T} the ⚡ button sits in the lower right thumb zone, ≥ 76 px', bz[2] and bz[3] >= 76, bz)
    await ev(pg, '__ps.hunt().storm = 0; __ps.hunt().stormReady = false')
    t = await ev(pg, """(() => { const ui = ['hud', 'meters', 'top', 'btnBolt', 'toast'].map(id => document.getElementById(id).getBoundingClientRect()); const Q = __ps.hunt();
      for (let i = 0; i < 2400; i++) { const t = __ps.ghostTargets().find(o => o.ok && o.st !== 'flee' && o.x > 30 && o.x < innerWidth - 30 && o.y > 30 && o.y < innerHeight - 30 && !ui.some(r => r.width && o.x > r.left - 10 && o.x < r.right + 10 && o.y > r.top - 10 && o.y < r.bottom + 10));
        if (t && Q.state === 'hunt') return t; const g = Q.ghosts.find(g => g.alive && g.st === 'hide'); if (g && i % 25 === 0) Q.setBeam(g.x, g.z); __ps.stepq(1/30, 1); } return null; })()""")
    c0 = await ev(pg, '__ps.hunt().caught'); await ev(pg, '__ps.step(1/30, 1)')
    if t: await pg.touchscreen.tap(t['x'], t['y'])
    c1 = await ev(pg, '[__ps.hunt().caught, __ps.hunt().score]')
    check(f'{T} a real finger tap on a peeking / lit ghost catches it (+points)', t is not None and c1[0] == c0 + 1 and c1[1] > 0, (t, c0, c1))
    await ev(pg, '__ps.step(1/30, 6)'); await pg.screenshot(path=f'{OUT}{tag}-1b-catch.png')
    await ev(pg, '__ps.fillStorm(); __ps.stepq(1/30, 1); __ps.setUI()'); await tap(pg, '#btnBolt'); s1 = await ev(pg, '__ps.hunt().state')
    await ev(pg, '__ps.step(1/30, 10)'); await pg.screenshot(path=f'{OUT}{tag}-1c-lightning.png')
    check(f'{T} a real tap on the glowing ⚡ calls the lightning reveal', s1 == 'strike', s1)
    await ev(pg, '__ps.stepq(1/30, 200)'); await ev(pg, 'window.__psManual = false')
    check(f'{T} the hint is gone after a few seconds (visibility:hidden)', await until(pg, "getComputedStyle(document.getElementById('hint')).visibility === 'hidden'", 9), await ev(pg, "getComputedStyle(document.getElementById('hint')).visibility"))
    # ---------- 2) the start screen: one big PLAY, everything else behind the gear ----------
    await ev(pg, '__ps.toMenu()'); await pg.wait_for_timeout(1300); await pg.screenshot(path=f'{OUT}{tag}-2-menu.png')
    lay = await ev(pg, """(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const p = r('#btnPlay'), h = r('#menu h1'), c = r('#menu .credit');
      return { p: [p.left, p.top, p.width, p.height].map(Math.round), cy: (p.top + p.height / 2) / innerHeight, overlap: !(h.bottom <= p.top || h.top >= p.bottom) && !(h.right <= p.left || h.left >= p.right),
        scroll: !(""" + NOSCROLL + """) || document.getElementById('menu').scrollHeight > document.getElementById('menu').clientHeight + 1, inView: c.bottom <= innerHeight + 1 && h.top >= 0 }; })()""")
    check(f'{T} start screen: one big glowing PLAY (≥ 60 px tall, ≥ 220 px wide) in the thumb zone, title clear of it, no scrolling', lay['p'][3] >= 60 and lay['p'][2] >= 220 and (.45 if land else .55) <= lay['cy'] <= .92 and not lay['overlap'] and not lay['scroll'] and lay['inView'], lay)
    hit = dict(await ev(pg, f'({HIT})(["#btnPlay", "#btnGear", "#btnLang"])')); bad = {k: v for k, v in hit.items() if v != 'ok'}
    check(f'{T} start screen: PLAY, gear and the tiny DE/EN are all tappable (≥ 44 px, nothing covers them)', not bad, bad or hit)
    l0 = await ev(pg, '__ps.S.lang'); await tap(pg, '#btnLang'); l1 = await ev(pg, '__ps.S.lang'); await tap(pg, '#btnLang'); l2 = await ev(pg, '__ps.S.lang')
    check(f'{T} tap DE/EN toggles the language and back', l0 != l1 and l2 == l0, (l0, l1, l2))
    await ev(pg, "__ps.S.lang === 'de' || document.getElementById('btnLang').click()")
    of = await ev(pg, "[...document.querySelectorAll('#menu button, #more button, #menu h1 span, #menu .kicker, #btnBolt')].filter(e => e.offsetParent !== null || e.closest('#more')).filter(e => e.scrollWidth > e.clientWidth + 2 || e.getBoundingClientRect().right > innerWidth + 1).map(e => e.id || e.className || e.tagName)")
    check(f'{T} German: no text overflows its button or the screen (menu + options)', not of, of)
    await tap(pg, '#btnGear'); await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{OUT}{tag}-3-options-de.png')
    sh = await ev(pg, "(() => { const m = document.getElementById('more'); return [m.classList.contains('show'), m.scrollHeight > m.clientHeight + 1]; })()")
    sel = ['#btnMoreX', '#btnEndless', '#btnDuel', '#nights button[data-n="0"]', '#nights button[data-n="1"]', '#nights button[data-n="2"]', '#diff button[data-d=easy]', '#diff button[data-d=medium]', '#diff button[data-d=hard]', '#btnKids', '#btnQ2', '#btnSound2', '#btnIntro']
    hit = dict(await ev(pg, f'({HIT})({json.dumps(sel)})')); bad = {k: v for k, v in hit.items() if v != 'ok'}
    check(f'{T} gear sheet: endless, duel, nights I–III, difficulty, kids, quality, sound, intro, close – all on screen, ≥ 44 px, tappable without scrolling', sh[0] and not sh[1] and not bad, (bad or 'ok', sh))
    q0 = await ev(pg, '__ps.quality()'); await tap(pg, '#btnQ2'); await pg.wait_for_timeout(600); q1 = await ev(pg, '__ps.quality()'); await ev(pg, "__ps.quality('mid')")
    await tap(pg, '#btnKids'); k1 = await ev(pg, '__ps.S.kids'); await tap(pg, '#btnKids'); k2 = await ev(pg, '__ps.S.kids')
    await tap(pg, '#diff button[data-d=easy]'); d1 = await ev(pg, '__ps.S.diff'); await tap(pg, '#diff button[data-d=medium]'); d2 = await ev(pg, '__ps.S.diff')
    await tap(pg, '#nights button[data-n="1"]'); n1 = await ev(pg, '__ps.S.night'); await tap(pg, '#nights button[data-n="0"]'); n0 = await ev(pg, '__ps.S.night')
    s0 = await ev(pg, "document.getElementById('btnSound2').textContent"); await tap(pg, '#btnSound2'); s1 = await ev(pg, "document.getElementById('btnSound2').textContent"); await tap(pg, '#btnSound2')
    check(f'{T} options by tap: quality switches, kids on/off, difficulty easy → medium, night II → I, sound off/on', q0 != q1 and k1 and not k2 and d1 == 'easy' and d2 == 'medium' and n1 == 1 and n0 == 0 and s0 != s1, (q0, q1, k1, k2, d1, d2, n1, n0, s0, s1))
    await tap(pg, '#btnMoreX'); await pg.wait_for_timeout(500); closed = not await ev(pg, "document.getElementById('more').classList.contains('show')")
    await tap(pg, '#btnGear'); await pg.wait_for_timeout(600); await tap(pg, '#btnDuel'); duel = await until(pg, "__ps.S.state === 'play' && __ps.S.mode === 'duel'", 8)
    check(f'{T} close (✕) works; duel (Player 1 vs Player 2) starts by tap', closed and duel, (closed, duel))
    await ev(pg, '__ps.toMenu()'); await pg.wait_for_timeout(700); await tap(pg, '#btnGear'); await pg.wait_for_timeout(600); await tap(pg, '#btnEndless'); en = await until(pg, "__ps.S.state === 'play' && __ps.S.mode === 'endless'", 8)
    await ev(pg, '__ps.toMenu()'); await pg.wait_for_timeout(700); await tap(pg, '#btnGear'); await pg.wait_for_timeout(600); await tap(pg, '#btnIntro'); intro = await until(pg, "__ps.S.state === 'intro'", 5)
    await pg.wait_for_timeout(800); await pg.touchscreen.tap(W * .5, H * .3); intro2 = await until(pg, "__ps.S.state === 'play'", 8)
    check(f'{T} endless, intro replay, and a tap on the replayed intro goes into play', en and intro and intro2, (en, intro, intro2))
    await ev(pg, '__ps.toMenu()'); await pg.wait_for_timeout(900); await tap(pg, '#btnPlay'); pl = await until(pg, "__ps.S.state === 'play' && __ps.S.mode === 'night'", 8)
    check(f'{T} tap PLAY starts the night', pl)
    # end screen fits and is tappable
    await ev(pg, '__ps.end("fail")'); await pg.wait_for_timeout(900); await pg.screenshot(path=f'{OUT}{tag}-4-end.png')
    hit = dict(await ev(pg, f'({HIT})(["#btnAgain", "#btnMenu", "#btnCard", "#btnShare", "#eName"])')); bad = {k: v for k, v in hit.items() if v != 'ok'}
    check(f'{T} end screen: play again, menu, save card, share, name field tappable (>=44px, on screen, uncovered)', not bad, bad or hit)
    if land:
        es = await ev(pg, "(() => { const e = document.getElementById('end'), r = e.getBoundingClientRect(); return { sh: e.scrollHeight, ch: e.clientHeight, sw: e.scrollWidth, cw: e.clientWidth, top: Math.round(r.top), bottom: Math.round(r.bottom), page: " + NOSCROLL + " }; })()")
        check(f'{T} landscape end screen fits without any scrolling (panel and page)', es['sh'] <= es['ch'] + 1 and es['sw'] <= es['cw'] + 1 and es['top'] >= 0 and es['bottom'] <= H and es['page'], es)
    check(f'{T} no console errors', not errs, errs[:3])
    await b.close()
async def main():
    async with async_playwright() as p:
        for eng, dev, land, loc in DEVICES:
            if ONLY and ONLY not in dev.replace(' ', '') + ('-land' if land else '-port'): continue
            for attempt in (1, 2):  # headless WPE WebKit's software compositor sometimes segfaults: retry once, say so
                n0 = len(R)
                try: await run(p, eng, dev, land, loc); break
                except Exception as e:
                    import traceback; tb = traceback.extract_tb(e.__traceback__); ln = next((f.lineno for f in reversed(tb) if f.filename.endswith('test_mobile.py')), '?')
                    msg = f'line {ln}: ' + str(e).split('\n')[0][:300]
                    if attempt == 1 and 'crashed' in msg.lower(): del R[n0:]; print(f'RETRY [{dev} {"land" if land else "port"}] browser process crashed ({msg}) – rerunning this device once', flush=True); continue
                    check(f'[{dev} {"land" if land else "port"}] run finished', False, msg)
    print(f'\n{sum(R)}/{len(R)} checks passed'); sys.exit(0 if R and all(R) else 1)
asyncio.run(main())
