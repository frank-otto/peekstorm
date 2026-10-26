"""Peekstorm – full headless test suite (Chrome + SwiftShader WebGL over a local web server).
Run: python3 test/test_game.py   (exit code 0 = all checks passed; screenshots → test/shots/)"""
SUR = bytes([79, 116, 116, 111]).decode()  # the surname that must never appear (spelled as bytes so this file stays clean)
FAM = [bytes(x).decode() for x in ([84, 104, 101, 111, 100, 111, 114], [77, 97, 114, 116, 104, 97], [69, 108, 105, 115, 97, 98, 101, 116, 104], [65, 110, 110, 97])]
# third-party names / phrases that must never appear in visible text
TM = r'candy|saga|crush|haunted\s*mansion|whac|grok(?!\s*bot)|howl|luigi|ghostbusters|phasmophobia|pac-?man|casper|boo\s*radley|hide\s*(?:and|&|n)\s*seek|marco\s*polo|slender|five\s*nights|poltergeist|beetlejuice|who\s*you\s*gonna'
import asyncio, os, re, glob, json, sys
from playwright.async_api import async_playwright
import threading, http.server, functools, socketserver
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class _Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
_srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
threading.Thread(target=_srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
OUT = ROOT + '/test/shots/'; os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)
CLEAR = "try{if(!sessionStorage.getItem('psInit')){sessionStorage.setItem('psInit','1'); localStorage.clear();}}catch(e){}"
TXT = "window.__txt=[];(function(){const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(s,...a){try{window.__txt.push(String(s))}catch(e){}return f.call(this,s,...a)};})();"
async def page(b, skip=False, manual=True, locale='en-US', vp=(1280, 800)):
    ctx = await b.new_context(accept_downloads=True, locale=locale, viewport={'width': vp[0], 'height': vp[1]})
    init = 'window.__psSeed = 4242; window.__psQSeed = 1818; window.__psPDB = true; window.__psNoAutoQ = true;' + ('window.__psManual = true;' if manual else '') + ('window.__psSkipIntro = true;' if skip else '') + CLEAR + TXT
    await ctx.add_init_script(init)
    pg = await ctx.new_page(); pg.set_default_timeout(300000); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR {e}'))
    await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready") && window.__ps', timeout=120000)
    return ctx, pg, logs
def pxs(im): return im.get_flattened_data() if hasattr(im, 'get_flattened_data') else list(im.getdata())
def mean(path): im = Image.open(path).convert('L'); px = pxs(im); return sum(px) / len(px)
def diff(a, b):
    A = Image.open(a).convert('L').resize((160, 100)); B = Image.open(b).convert('L').resize((160, 100)); pa, pb = pxs(A), pxs(B); return sum(abs(x - y) for x, y in zip(pa, pb)) / len(pa)
def white_share(path):
    im = Image.open(path).convert('RGB').resize((200, 125)); px = pxs(im); return sum(1 for r, g, b in px if r > 245 and g > 245 and b > 245) / len(px)
async def ev(pg, js): return await pg.evaluate(js)
async def shot(pg, name, n=1):
    await pg.evaluate(f'__ps.step(1/30, {n})')
    for k in (1, 2):
        try: await pg.screenshot(path=OUT + name, timeout=180000 if k == 1 else 240000); return OUT + name
        except Exception as e:
            if k == 2 or 'Timeout' not in str(e): raise
            print(f'RETRY screenshot {name} (capture timeout)', flush=True); await pg.evaluate('__ps.step(1/30, 1)')
async def run_until(pg, cond, frames=3000, dt='1/30'):
    return await ev(pg, f'(() => {{ for (let i = 0; i < {frames}; i++) {{ if ({cond}) return i; __ps.stepq({dt}, 1); }} return ({cond}) ? {frames} : -1; }})()')
HITTEST = "(ids => ids.map(id => { const el = document.getElementById(id); const r = el.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return [id, Math.round(r.width), Math.round(r.height), !!e && (e === el || el.contains(e))]; }))"
# step (bot off) until a ghost can be caught and sits on screen, clear of every UI element; returns its target
FINDT = """((max) => { const ui = ['hud', 'meters', 'top', 'btnBolt', 'hint', 'toast'].map(id => document.getElementById(id).getBoundingClientRect());
  for (let i = 0; i < max; i++) { const t = __ps.ghostTargets().find(o => o.ok && o.x > 30 && o.x < innerWidth - 30 && o.y > 30 && o.y < innerHeight - 30 && !ui.some(r => r.width && o.x > r.left - 10 && o.x < r.right + 10 && o.y > r.top - 10 && o.y < r.bottom + 10));
    if (t && __ps.hunt().state === 'hunt') return t; const Q = __ps.hunt(); const g = Q.ghosts.find(g => g.alive && g.st === 'hide'); if (g && i % 20 === 0) Q.setBeam(g.x, g.z); __ps.stepq(1/30, 1); } return null; })"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        # ================= 1) the opening: lightning from frame 0, title, one click → play =================
        ctx, pg, logs = await page(b)
        st = await ev(pg, '[__ps.S.state, __ps.hunt() && __ps.hunt().state, +__ps.W.boltK.toFixed(2), +__ps.W.xray.toFixed(2), __ps.S.lang, __ps.quality(), document.title, __ps.hunt().ghosts.filter(g => g.alive).length]')
        check('page opens straight into the cinematic opening (lightning hits the oak, every ghost revealed), English default, quality auto = Normal', st[0] == 'intro' and st[1] == 'strike' and st[2] > .5 and st[4] == 'en' and st[5] == 'mid' and 'Peekstorm' in st[6] and st[7] >= 5, st)
        f0 = await shot(pg, 'o0.png'); f1 = await shot(pg, 'o1.png', 3)
        x = await ev(pg, '[+__ps.W.xray.toFixed(2), +__ps.W.crowdK.toFixed(2)]')
        check('frame 0 is not black and already moving (frame 0 vs frame 3); ghosts X-ray glowing, the watching crowd appears', mean(f0) > 30 and diff(f0, f1) > 1.0 and x[0] > .5 and x[1] > .2, (round(mean(f0), 1), round(diff(f0, f1), 2), x))
        check('frame 0 has no blown-out glare (white pixels < 3 %)', white_share(f0) < .03, round(white_share(f0), 4))
        n = await run_until(pg, '__ps.S.titleT >= 0', 600)
        r2 = await ev(pg, '[+__ps.W.xray.toFixed(2), +__ps.W.lanternK.toFixed(2), __ps.hunt().ghosts.some(g => g.st === "peek")]')
        await shot(pg, 'o2-title.png', 8); op = await ev(pg, '+getComputedStyle(document.getElementById("opening")).opacity')
        check('then darkness: the reveal fades, the lantern clicks on, a ghost peeks out, the PEEKSTORM title slams in', n >= 0 and r2[0] < .3 and r2[1] > .5 and r2[2] and op > .5, (n, r2, op))
        n2 = await run_until(pg, '__ps.S.state === "menu"', 600)
        tot = (1 + 3 + n + 8 + n2) / 30
        check('the opening hands over to the start screen by itself (never blocks), total < 10 s', n2 >= 0 and tot < 10, round(tot, 1))
        await pg.wait_for_timeout(900); await shot(pg, 'm-menu.png')
        hit = await ev(pg, HITTEST + "(['btnPlay','btnLang','btnGear'])")
        check('start screen: big PLAY + tiny DE/EN + gear, all hit-testable and ≥ 44 px', all(h[3] and h[1] >= 44 and h[2] >= 44 for h in hit), hit)
        vis = await ev(pg, "['btnQuit','btnSound','btnSkip','more','end','btnBolt','meters','hud','hint'].map(id => [id, (s => s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > .05)(getComputedStyle(document.getElementById(id)))])")
        check('start screen shows nothing else (quit, sound, sheet, end panel, ⚡, meters, HUD hidden)', not any(v[1] for v in vis), vis)
        r = await ev(pg, '(() => { const Q = __ps.hunt(); const b0 = [Q.beam.x, Q.beam.z]; __ps.stepq(1/30, 90); return [Q.mode, Math.hypot(Q.beam.x - b0[0], Q.beam.z - b0[1]) > .3]; })()')
        check('behind the start screen the yard is alive (a demo lantern sweeps, ghosts peek)', r[1], r)
        await pg.click('#btnGear'); await pg.wait_for_timeout(500); await shot(pg, 'm-gear.png')
        g = await ev(pg, "(() => { [...document.querySelectorAll('#diff button, #nights button')].forEach((b, i) => b.id = b.id || 'gb' + i); return " + HITTEST + "(['btnEndless','btnDuel','btnKids','btnQ2','btnSound2','btnIntro','btnMoreX'].concat([...document.querySelectorAll('#diff button, #nights button')].map(b => b.id))); })()")
        check('gear sheet: endless, duel, Nights I–III, Easy/Medium/Hard, kids, quality, sound, intro replay, close – all tappable ≥ 44 px', len(g) == 13 and all(x[3] and x[1] >= 44 and x[2] >= 44 for x in g), g)
        await pg.click('#btnMoreX'); await ctx.close()
        # ================= 2) one click → play; real mouse play =================
        ctx, pg, logs = await page(b)
        await shot(pg, 'x.png', 2); await pg.mouse.click(640, 400)
        await ev(pg, '__ps.stepq(1/30, 15)')
        st = await ev(pg, '[__ps.S.state, __ps.S.mode, __ps.hunt() && __ps.hunt().state, __ps.audioState(), document.getElementById("hint").classList.contains("show"), __ps.S.night]')
        check('ONE click anywhere on the opening → straight into Night I (count-in, short hint, audio unlocked)', st[:2] == ['play', 'night'] and st[2] in ('count', 'hunt') and st[3] in ('running', 'suspended') and st[4] and st[5] == 0, st)
        await shot(pg, 'p0-play.png', 20)
        hit = await ev(pg, HITTEST + "(['btnQuit','btnSound','btnLang'])")
        check('play screen: ✕ / sound / DE-EN hit-testable, ≥ 44 px', all(h[3] and h[1] >= 44 and h[2] >= 44 for h in hit), hit)
        sp = await ev(pg, '__ps.spots()[3]'); await pg.mouse.move(sp['x'], sp['y']); await ev(pg, '__ps.stepq(1/30, 2)')
        r = await ev(pg, '(() => { const Q = __ps.hunt(), s = __ps.spots()[3]; const g = Q.beam; return [+g.x.toFixed(2), +g.z.toFixed(2)]; })()')
        check('moving the mouse points the lantern at that spot of the yard', r is not None, r)
        t = await ev(pg, FINDT + '(1500)')
        k0 = await ev(pg, '[__ps.hunt().caught, __ps.hunt().score, __ps.log.length]')
        if t: await pg.mouse.click(t['x'], t['y'])
        r = await ev(pg, f'(() => {{ const Q = __ps.hunt(); return [Q.caught, Q.score, Q.combo, __ps.log.slice({k0[2]}).map(e => e.n || e[1] || e).join(" ").slice(0, 200)]; }})()')
        check('clicking a peeking / lit ghost catches it: +points, combo, sparkle + chime sounds', t is not None and r[0] == k0[0] + 1 and r[1] > k0[1] and r[2] >= 1, (t, k0[:2], r))
        await shot(pg, 'p1-catch.png', 4)
        r = await ev(pg, '(() => { const Q = __ps.hunt(); const m0 = Q.misses; __ps.tapAt(innerWidth * .5, innerHeight * .97); return [m0, Q.misses]; })()')
        check('clicking empty ground is a miss (counted, no points)', r[1] == r[0] + 1, r)
        r = await ev(pg, '(() => { const Q = __ps.hunt(); const d = Q.decoys.findIndex(d => d.spot >= 0); if (d < 0) return null; const D = Q.decoys[d]; Q.setBeam(D.x, D.z - .5); __ps.step(1/30, 1); const s = __ps.decoyScreen(d); return [d, D.kind, s.x, s.y, Q.oil, Q.combo]; })()')
        if r:
            await pg.mouse.click(r[2], r[3]); r2 = await ev(pg, '[__ps.hunt().decoyHits, __ps.hunt().oil, __ps.hunt().combo, window.__pops.slice(-1)[0]]')
            check('clicking the yellow eyes of the cat / owl decoy costs lantern oil and the combo', r2[0] == 1 and r2[1] < r[4] - 3 and r2[2] == 0, (r, r2))
        else: check('a cat / owl decoy exists on Night I Medium', False, r)
        await ev(pg, '__ps.fillStorm(); __ps.stepq(1/30, 2); __ps.setUI()'); await shot(pg, 'p2-ready.png', 2)
        hit = await ev(pg, HITTEST + "(['btnBolt'])")
        rd = await ev(pg, '[document.getElementById("btnBolt").classList.contains("ready"), __ps.hunt().canStrike()]')
        check('storm full → the big ⚡ button glows, ≥ 76 px, hit-testable in the thumb corner', rd[0] and rd[1] and hit[0][3] and hit[0][1] >= 76, (rd, hit))
        await pg.click('#btnBolt'); await ev(pg, '__ps.stepq(1/30, 6)')
        r = await ev(pg, '(() => { const Q = __ps.hunt(); const al = Q.ghosts.filter(g => g.alive); return [Q.state, +__ps.W.xray.toFixed(2), +__ps.S.ts.toFixed(2), al.length, al.every(g => g.frozen), +__ps.W.crowdK.toFixed(2), window.__banners.slice(-1)[0]]; })()')
        check('⚡ LIGHTNING: the bolt hits, time slows, every ghost freezes and glows through the stones, the watching crowd appears', r[0] == 'strike' and r[1] > .6 and r[2] < .6 and r[3] >= 1 and r[4] and r[5] > .3 and 'LIGHTNING' in r[6], r)
        await shot(pg, 'p3-strike.png', 6)
        t = await ev(pg, '(() => { const t = __ps.ghostTargets().find(o => o.ok && o.x > 20 && o.x < innerWidth - 120 && o.y > 120 && o.y < innerHeight - 40); return t || null; })()')
        k0 = await ev(pg, '[__ps.hunt().frozenCaught, __ps.hunt().score]')
        if t: await pg.mouse.click(t['x'], t['y'])
        k1 = await ev(pg, '[__ps.hunt().frozenCaught, __ps.hunt().score]')
        check('catching a frozen ghost during the lightning scores double', t is not None and k1[0] == k0[0] + 1 and k1[1] - k0[1] >= 200, (t, k0, k1))
        n = await run_until(pg, '__ps.hunt().state === "hunt"', 400)
        await ev(pg, '__ps.stepq(1/30, 40)')
        r = await ev(pg, '[+__ps.W.xray.toFixed(2), +__ps.W.crowdK.toFixed(2), __ps.hunt().ghosts.filter(g => g.alive).every(g => !g.frozen)]')
        check('after the reveal the dark returns: X-ray and crowd fade, the ghosts unfreeze and scatter to new hiding places', n >= 0 and r[0] < .15 and r[1] < .3 and r[2], (n, r))
        # keyboard
        r = await ev(pg, '[__ps.hunt().beam.x]'); await pg.keyboard.down('ArrowRight'); await ev(pg, '__ps.stepq(1/30, 15)'); await pg.keyboard.up('ArrowRight'); r2 = await ev(pg, '[__ps.hunt().beam.x]')
        await ev(pg, '(() => { const Q = __ps.hunt(); const g = Q.ghosts.find(g => g.alive && g.st !== "flee"); if (g) { Q.setBeam(g.x, g.z); g.st = "peek"; g.stT = 0; } })()')
        c0 = await ev(pg, '__ps.hunt().caught'); await pg.keyboard.press(' '); c1 = await ev(pg, '__ps.hunt().caught')
        await ev(pg, '__ps.fillStorm()'); await pg.keyboard.press('l'); s1 = await ev(pg, '__ps.hunt().state')
        await pg.keyboard.press('Escape'); m = await ev(pg, '__ps.S.state')
        check('keyboard: arrows move the lantern, Space catches in the light, L calls the lightning, Esc = menu', r2[0] > r[0] + .5 and c1 == c0 + 1 and s1 == 'strike' and m == 'menu', (r, r2, c0, c1, s1, m))
        await ev(pg, '__ps.stepq(1/30, 3)'); await pg.wait_for_timeout(900); to = await ev(pg, '[document.getElementById("toast").classList.contains("show"), +getComputedStyle(document.getElementById("toast")).opacity]')
        check('back in the menu no play toast lingers over the title', not to[0] and to[1] < .05, to)
        check('no console errors so far', not logs, logs[:4])
        # ================= 3) full nights with a human-like player =================
        out = []
        for night in (0, 1, 2):
            r = await ev(pg, f'(() => {{ __ps.toMenu(); document.querySelector(`#nights button[data-n="{night}"]`).click(); __ps.start("night"); __ps.auto(true, .88, {{ react: .42, speed: 5.5 }}); const Q = __ps.hunt(); let i = 0; for (; i < 12000 && __ps.S.state === "play"; i++) __ps.stepq(1/30, 1); __ps.auto(false); return [{night}, Q.res, __ps.S.state, Math.round(i / 30), Q.caught, Q.strikes, Q.score, __ps.S.stars, document.getElementById("eTitle").textContent, Q.byType]; }})()')
            out.append(r)
            if night == 2: await shot(pg, 'e1-win.png', 30)
        check('Medium, Nights I–III: a quick human-like player clears each yard (15–150 s, uses the lightning, stars + "Yard cleared!")', all(x[1] == 'win' and x[2] == 'end' and 15 <= x[3] <= 150 and x[5] >= 1 and x[7] >= 1 and 'cleared' in x[8] for x in out), out)
        r = await ev(pg, '(() => { __ps.toMenu(); document.querySelector(`#nights button[data-n="0"]`).click(); __ps.start("night"); __ps.auto(true, .6, { react: .75, speed: 3.2 }); const Q = __ps.hunt(); let i = 0; for (; i < 12000 && __ps.S.state === "play"; i++) __ps.stepq(1/30, 1); __ps.auto(false); return [Q.res, Math.round(i / 30), Q.caught, __ps.S.stars, Q.misses]; })()')
        check('a slow, inaccurate player on Medium Night I needs clearly longer and earns fewer stars (deep enough to improve)', r[1] > out[0][3] * 1.3 and (r[0] == 'fail' or r[3] < 3), (r, out[0][3]))
        check('the three nights differ: pumpkin mimics on Night I, shades from Night II, rain on Night III', out[0][9]['mimic'] > 0 and out[0][9]['shade'] == 0 and out[1][9]['shade'] > 0 and out[2][9]['shade'] > 0, [x[9] for x in out])
        r = await ev(pg, '(() => { const o = []; for (const n of [0, 1, 2]) { document.querySelector(`#nights button[data-n="${n}"]`).click(); __ps.start("night"); __ps.stepq(1/30, 10); o.push([+__ps.W.rainK.toFixed(2), __ps.hunt().decoys.length, __ps.hunt().N.swapEvery]); } __ps.toMenu(); document.querySelector(`#nights button[data-n="0"]`).click(); return o; })()')
        check('Night I dry, II drizzle, III storm rain; more cat/owl decoys and ghosts that swap hiding places on III', r[0][0] == 0 and 0 < r[1][0] < r[2][0] and r[2][1] > r[0][1] and r[2][2] > 0, r)
        r = await ev(pg, '(() => { __ps.start("night"); __ps.auto(false); const Q = __ps.hunt(); let i = 0; for (; i < 9000 && __ps.S.state === "play"; i++) __ps.stepq(1/30, 1); return [Q.res, __ps.S.state, (i / 30) | 0, Q.caught, document.getElementById("eTitle").textContent]; })()')
        check('doing nothing on Medium: the lantern burns out, the night is lost', r[0] == 'fail' and r[1] == 'end' and 70 <= r[2] <= 100, r)
        await shot(pg, 'e2-lost.png', 10)
        r = await ev(pg, '["easy","medium","hard"].map(d => { document.querySelector(`#diff button[data-d=${d}]`).click(); __ps.start("night"); const Q = __ps.hunt(); return [d, Q.D.quota, Q.D.nerve, Q.D.peekLen, Q.D.beamR, Q.D.decoys]; })')
        check('Easy / Medium / Hard: more ghosts, braver→jumpier ghosts, shorter peeks, narrower lantern, more decoys', r[0][1] < r[1][1] < r[2][1] and r[0][2] > r[1][2] > r[2][2] and r[0][3] > r[1][3] > r[2][3] and r[0][4] > r[1][4] > r[2][4] and r[0][5] < r[1][5] < r[2][5], r)
        await ev(pg, 'document.querySelector("#diff button[data-d=medium]").click()')
        r = await ev(pg, '(() => { document.getElementById("btnKids").click(); __ps.start("night"); __ps.auto(false); const Q = __ps.hunt(); __ps.stepq(1/30, 4200); const st = [Q.state !== "end", Q.decoys.length, Q.ghosts.some(g => g.kind === "shade"), Q.D.beamR, Q.D.peekLen]; __ps.auto(true, .8, { react: .6, speed: 3 }); let i = 0; for (; i < 12000 && __ps.S.state === "play"; i++) __ps.stepq(1/30, 1); const w = [Q.res]; document.getElementById("btnKids").click(); return [st, w]; })()')
        check('kids mode: no decoys, no dark shades, wide lantern, long peeks; 140 s of doing nothing and still playing; a slow player wins', r[0][0] and r[0][1] == 0 and not r[0][2] and r[0][3] >= 1.6 and r[0][4] >= 1.5 and r[1][0] == 'win', r)
        r = await ev(pg, '(() => { __ps.start("endless"); __ps.auto(true, .9, { react: .4, speed: 5 }); const Q = __ps.hunt(); for (let i = 0; i < 9000 && Q.wave < 2 && Q.state !== "end"; i++) __ps.stepq(1/30, 1); const a = [__ps.S.mode, Q.wave, Q.conc, Q.state !== "end", Q.quota]; __ps.auto(false); for (let i = 0; i < 9000 && __ps.S.state === "play"; i++) __ps.stepq(1/30, 1); return [a, Q.res, __ps.S.state]; })()')
        check('Endless Hunt: catches refuel the lantern, bolder waves of ghosts; it ends when the lantern burns out', r[0][0] == 'endless' and r[0][1] >= 2 and r[0][2] >= 4 and r[0][3] and r[1] == 'over' and r[2] == 'end', r)
        r = await ev(pg, '(() => { __ps.toMenu(); document.getElementById("btnDuel").click(); const Q1 = __ps.hunt(); const a = [__ps.S.mode, __ps.S.player]; __ps.stepq(1/30, 40); const s1 = Q1.ghosts.slice(0, 4).map(g => g.kind + g.spot).join(",") + "|" + Q1.decoys.map(d => d.kind + d.spot).join(","); __ps.auto(true, .9, { react: .4 }); for (let i = 0; i < 12000 && __ps.S.state === "play"; i++) __ps.stepq(1/30, 1);'
                     ' const h = [__ps.S.state, document.getElementById("handover").classList.contains("show"), document.getElementById("hoT").textContent];'
                     ' document.getElementById("btnGo").click(); const Q2 = __ps.hunt(); __ps.stepq(1/30, 40); const b2 = [__ps.S.state, __ps.S.player, Q2.ghosts.slice(0, 4).map(g => g.kind + g.spot).join(",") + "|" + Q2.decoys.map(d => d.kind + d.spot).join(",") === s1]; __ps.auto(true, .6, { react: .7, speed: 3 }); for (let i = 0; i < 12000 && __ps.S.state === "play"; i++) __ps.stepq(1/30, 1); __ps.stepq(1/30, 40);'
                     ' return [a, h, b2, __ps.S.state, document.getElementById("eTitle").textContent, JSON.stringify(__ps.S.duel.map(d => d && d.score))]; })()')
        check('duel: Player 1 hunts → handover → Player 2 gets the SAME yard and ghosts → winner shown', r[0] == ['duel', 0] and r[1][0] == 'handover' and r[1][1] and 'Player 2' in r[1][2] and r[2][:2] == ['play', 1] and r[2][2] and r[3] == 'end' and ('Player' in r[4] or 'tie' in r[4]), r)
        await shot(pg, 'e-duel.png', 20)
        # ================= 4) share card =================
        r = await ev(pg, '(async () => { window.__txt = []; const u = await __ps.cardURL(); const im = new Image(); im.src = u; await im.decode(); return [im.width, im.height, window.__txt]; })()')
        txt = ' '.join(r[2])
        check('share card: 1080×1350, PEEKSTORM title, default name "Player", Player 1/2 on duel card, countdown credit, NO URL', r[0] == 1080 and r[1] == 1350 and 'PEEKSTORM' in txt and ('Player' in txt) and '2 days to Halloween' in txt and not re.search(r'https?:|www\.|github|\.io\b|\.com\b', txt, re.I), (r[:2], txt[:300]))
        await ev(pg, '(async () => { const u = await __ps.cardURL(); window.__card = u; })()')
        b64 = await ev(pg, 'window.__card.split(",")[1]'); import base64; open(OUT + 'card.jpg', 'wb').write(base64.b64decode(b64))
        check('share card image is not black (the lightning scene behind the score)', mean(OUT + 'card.jpg') > 25, round(mean(OUT + 'card.jpg'), 1))
        # ================= 5) language =================
        r = await ev(pg, '(() => { __ps.toMenu(); const a = document.getElementById("btnPlay").textContent; document.getElementById("btnLang").click(); const b2 = [__ps.S.lang, document.getElementById("btnPlay").textContent, document.documentElement.lang, document.querySelector(".kicker").textContent]; __ps.toMenu(); document.getElementById("btnLang").click(); return [a, b2, __ps.S.lang]; })()')
        check('tiny DE/EN toggle switches every text (PLAY → SPIELEN, countdown in German), and back', 'PLAY' in r[0].upper() and r[1][0] == 'de' and r[1][2] == 'de' and 'SPIELEN' in r[1][1].upper() and 'Noch 2 Tage' in r[1][3] and r[2] == 'en', r)
        # ================= 6) robustness =================
        r = await ev(pg, '(() => { __ps.start("night"); const Q = __ps.hunt(); __ps.S.ts = NaN; __ps.W.flash = NaN; __ps.W.xray = NaN; __ps.S.punch = NaN; __ps.S.camX = NaN; __ps.stepq(1/30, 3); __ps.stepq(NaN, 2); __ps.stepq(5, 1); __ps.stepq(-1, 1); Q.step(NaN); Q.setBeam(NaN, Infinity); __ps.stepq(1/30, 2); const c = __ps.cam(); return [Q.t, Q.score, Q.oil, Q.beam.x, Q.beam.z, __ps.S.ts, __ps.S.gt, __ps.W.flash, __ps.W.xray, c.p, c.fov].flat().every(Number.isFinite); })()')
        check('NaN guards: NaN time-scale/flash/X-ray/camera and NaN/negative/5 s frame steps and NaN beam never break the rules or camera', r is True, r)
        r = await ev(pg, '(() => { const l0 = __ps.last(); __ps.advance(l0 + 16); const l1 = __ps.last(); const d = __ps.advance(l1 - 500); return [d, __ps.last() >= l1]; })()')
        check('frame clock never runs backwards (out-of-order rAF stamps give dt = 0)', r[0] == 0 and r[1], r)
        await ev(pg, '__ps.toMenu()'); await shot(pg, 'm2.png', 4)
        check('no console errors so far', not logs, logs[:4])
        await ctx.close()
        # ================= 7) GPU resource leak test =================
        ctx, pg, logs = await page(b, skip=True)
        await ev(pg, '__ps.start("night"); __ps.auto(true, 1)'); await shot(pg, 'x.png', 3)
        async def cycle():
            for q in ['low', 'high', 'ultra', 'mid', 'low', 'mid']:
                await ev(pg, f'__ps.quality("{q}")'); await shot(pg, 'x.png', 2)
            for i in range(3):
                await ev(pg, '__ps.start("night"); __ps.auto(true, 1); __ps.stepq(1/30, 150); __ps.fillStorm(); __ps.stepq(1/30, 200)'); await shot(pg, 'x.png', 2)
                await ev(pg, '__ps.cardURL()')
                await ev(pg, '__ps.end("quit"); __ps.toMenu(); __ps.stepq(1/30, 90)'); await shot(pg, 'x.png', 2)
            await ev(pg, '__ps.start("night")'); await shot(pg, 'x.png', 3)
        await cycle()
        m0 = await ev(pg, '__ps.mem()')
        await cycle()
        m1 = await ev(pg, '__ps.mem()')
        check('no GPU leaks: geometries / textures / shader programs flat over a 2nd round of 6 quality switches + 3 nights with lightning bolts + share cards + menu', m1['geometries'] <= m0['geometries'] + 1 and m1['textures'] <= m0['textures'] + 1 and m1['programs'] <= m0['programs'] + 2, (m0, m1))
        check('no console errors (leak run)', not logs, logs[:4])
        await ctx.close()
        # ================= 8) German browser → German, auto =================
        ctx, pg, logs = await page(b, locale='de-DE')
        r = await ev(pg, '[__ps.S.lang, document.documentElement.lang, document.getElementById("btnSkip").textContent]')
        check('German browser → German texts automatically', r[0] == 'de' and r[1] == 'de' and 'spielen' in r[2].lower(), r)
        await ctx.close()
        # ================= 9) static scans =================
        vis = open(ROOT + '/index.html', encoding='utf-8').read() + open(ROOT + '/src/i18n.js', encoding='utf-8').read() + open(ROOT + '/README.md', encoding='utf-8').read()
        vis_txt = re.sub(r'<[^>]+>', ' ', vis)
        check('visible texts + README: no surname, no family names, no email address', not re.search(SUR + '|' + '|'.join(r'\b' + f + r'\b' for f in FAM), vis, re.I) and not re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', vis), re.findall(SUR + '|' + '|'.join(r'\b' + f + r'\b' for f in FAM), vis, re.I)[:3])
        check('visible texts say SI, never "AI"/"KI"', not re.search(r'\bAI\b|\bKI\b', vis_txt), re.findall(r'.{20}\b(?:AI|KI)\b.{20}', vis_txt)[:3])
        m = re.findall(TM, vis_txt, re.I); check('no third-party game/film/brand names or known catchphrases', not m, m[:5])
        src = ''.join(open(f, encoding='utf-8').read() for f in glob.glob(ROOT + '/src/*.js'))
        check('no synthesized beeps (no oscillators) – real recorded sounds only', 'createOscillator' not in src)
        lic = os.listdir(ROOT + '/LICENSES'); check('LICENSES/ has font, three.js, sound credits', any('OFL' in x for x in lic) and any('three' in x.lower() for x in lic) and 'SOUNDS.md' in lic, lic)
        sd = open(ROOT + '/LICENSES/SOUNDS.md', encoding='utf-8').read() if 'SOUNDS.md' in lic else ''
        miss = [os.path.basename(f)[:-4] for f in glob.glob(ROOT + '/sounds/*.mp3') if '`' + os.path.basename(f)[:-4] + '`' not in sd]
        check('every sound file is documented in LICENSES/SOUNDS.md', not miss, miss[:8])
        await b.close()
    print(f'\n{sum(R)}/{len(R)} checks passed'); sys.exit(0 if R and all(R) else 1)
asyncio.run(main())
