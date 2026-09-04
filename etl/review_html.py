"""경인.GA7센터 월마감 리뷰 → 자체완결형 HTML.

review_ga7.py 가 계산한 값을 문서로 조판한다. 서버 없이 열리고,
회의 자리에서 위에서 아래로 훑으며 읽도록 순서를 잡았다.

    python3 etl/review_html.py
"""
from __future__ import annotations

import datetime
import html
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import review_ga7 as R  # noqa: E402

OUT_DIR = HERE.parent / "exports"

S1, S2, S3, S4 = "#2a78d6", "#eb6834", "#1baf7a", "#eda100"
GOOD, WARN, CRIT, AXIS = "#0ca30c", "#d98c00", "#d03b3b", "#8a8a8a"


# ---------------------------------------------------------------------------
# 포맷
# ---------------------------------------------------------------------------
def man(v):
    """천원 → 만원 숫자."""
    return (v or 0) / 10


def m(v, d=1):
    if v is None:
        return "—"
    x = v / 10
    return f"{x:,.0f}" if abs(x) >= 1000 else f"{x:,.{d}f}"


def won(v):
    if v is None:
        return "—"
    x = v / 10
    if abs(x) >= 10000:
        return f"{x/10000:,.1f}억"
    if abs(x) >= 1000:
        return f"{x:,.0f}만"
    return f"{x:,.1f}만"


def n(v):
    return "—" if v is None else f"{round(v):,}"


def pct(v, d=1):
    return "—" if v is None else f"{v:.{d}f}%"


def esc(s):
    return html.escape(str(s if s is not None else ""))


def md(iso):
    d = datetime.date.fromisoformat(iso)
    return f"{d.month}/{d.day}"


def josa(word: str, pair: str) -> str:
    """받침에 맞는 조사를 붙인다. pair 는 '은/는' 처럼 받침있음/없음 순.

    본부 이름이 데이터에서 오기 때문에('탑', '마스터') 문장에 그대로 끼우면
    '탑는', '마스터은' 같은 게 나온다.
    """
    with_b, without_b = pair.split("/")
    ch = word.strip()[-1] if word.strip() else ""
    if "가" <= ch <= "힣":
        return word + (with_b if (ord(ch) - 0xAC00) % 28 else without_b)
    return word + with_b


# ---------------------------------------------------------------------------
# SVG
# ---------------------------------------------------------------------------
def bars(items, width=760, height=170, unit="만원", baseline=None, color=S1, hi=S2):
    """items: [(label, value, highlight)]"""
    if not items:
        return ""
    vmax = max([v for _, v, _ in items] + [baseline or 0, 0.0001])
    pad_l, pad_r, top, bot = 8, 8, 20, 26
    gap = 6
    bw = max(5, (width - pad_l - pad_r - gap * (len(items) - 1)) / len(items))
    ph = height - top - bot
    out = [f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" class="chart">']
    if baseline:
        by = top + ph - baseline / vmax * ph
        out.append(f'<line x1="{pad_l}" y1="{by:.1f}" x2="{width-pad_r}" y2="{by:.1f}" '
                   f'stroke="{AXIS}" stroke-width="1" stroke-dasharray="4 3"/>')
    for i, (lb, v, h) in enumerate(items):
        x = pad_l + i * (bw + gap)
        bh = v / vmax * ph if vmax else 0
        y = top + ph - bh
        out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{max(bh,1):.1f}" '
                   f'rx="2" fill="{hi if h else color}"/>')
        out.append(f'<text x="{x+bw/2:.1f}" y="{y-4:.1f}" class="cv" text-anchor="middle">'
                   f'{v:,.0f}</text>' if v >= 100 else
                   f'<text x="{x+bw/2:.1f}" y="{y-4:.1f}" class="cv" text-anchor="middle">'
                   f'{v:,.1f}</text>')
        out.append(f'<text x="{x+bw/2:.1f}" y="{height-7}" class="cl" text-anchor="middle">'
                   f'{esc(lb)}</text>')
    out.append(f'<text x="{width-pad_r}" y="13" class="cl" text-anchor="end">{unit}</text>')
    return "".join(out) + "</svg>"


def lines(series, labels, width=760, height=230, unit="만원"):
    """series: [(name, [values], color, dashed)] — x축은 labels."""
    allv = [v for _, vs, _, _ in series for v in vs if v is not None]
    if not allv:
        return ""
    vmax = max(allv) * 1.08
    pad_l, pad_r, top, bot = 44, 10, 14, 26
    pw, ph = width - pad_l - pad_r, height - top - bot
    step = pw / max(1, len(labels) - 1)
    out = [f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" class="chart">']
    for g in range(5):
        y = top + ph * g / 4
        val = vmax * (1 - g / 4)
        out.append(f'<line x1="{pad_l}" y1="{y:.1f}" x2="{width-pad_r}" y2="{y:.1f}" '
                   f'stroke="var(--grid)" stroke-width="1"/>')
        out.append(f'<text x="{pad_l-6}" y="{y+3:.1f}" class="cl" text-anchor="end">'
                   f'{val:,.0f}</text>')
    for i, lb in enumerate(labels):
        if len(labels) > 12 and i % 2:
            continue
        out.append(f'<text x="{pad_l+i*step:.1f}" y="{height-8}" class="cl" '
                   f'text-anchor="middle">{esc(lb)}</text>')
    for name, vs, color, dash in series:
        pts = [f"{pad_l+i*step:.1f},{top+ph-(v/vmax*ph):.1f}"
               for i, v in enumerate(vs) if v is not None]
        if len(pts) < 2:
            continue
        da = ' stroke-dasharray="5 4"' if dash else ""
        out.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{color}" '
                   f'stroke-width="{2.6 if not dash else 1.8}" stroke-linejoin="round"{da}/>')
    out.append(f'<text x="{width-pad_r}" y="11" class="cl" text-anchor="end">{unit}</text>')
    return "".join(out) + "</svg>"


def funnel(total, appr, deal, width=360):
    """설계 → 승인 → 체결 퍼널."""
    if not total:
        return ""
    steps = [("전체 설계", total, S1), ("승인", appr, S3), ("체결", deal, S2)]
    h, gap = 34, 8
    out = [f'<svg viewBox="0 0 {width} {(h+gap)*3}" width="100%" '
           f'height="{(h+gap)*3}" class="chart">']
    for i, (lb, v, c) in enumerate(steps):
        w = max(2, v / total * (width - 120))
        y = i * (h + gap)
        out.append(f'<rect x="0" y="{y}" width="{w:.1f}" height="{h}" rx="4" fill="{c}" '
                   f'opacity="{1-i*0.12:.2f}"/>')
        out.append(f'<text x="{w+8:.1f}" y="{y+h/2+4:.1f}" class="cv">'
                   f'{v:,.0f}건 · {v/total*100:.1f}%</text>')
        out.append(f'<text x="6" y="{y+h/2+4:.1f}" class="fl">{esc(lb)}</text>')
    return "".join(out) + "</svg>"


def barrow(label, value, vmax, color, right=""):
    w = 0 if not vmax else min(100, value / vmax * 100)
    return (f'<div class="br"><span class="br-l">{esc(label)}</span>'
            f'<span class="br-t"><span class="br-f" style="width:{w:.1f}%;background:{color}"></span></span>'
            f'<span class="br-r">{right}</span></div>')


# ---------------------------------------------------------------------------
STYLE = """
:root{--bg:#fff;--card:#fff;--fg:#141414;--mut:#6b6b6b;--bd:#e4e4e4;--tile:#fafafa;
 --grid:#ededed;--chip:#f1f1f1;--barbg:#e9e9e9}
@media(prefers-color-scheme:dark){:root{--bg:#101010;--card:#191919;--fg:#f0f0f0;
 --mut:#a0a0a0;--bd:#2b2b2b;--tile:#161616;--grid:#242424;--chip:#232323;--barbg:#2c2c2c}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-size:14px;line-height:1.55;
 font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:0 24px 90px}
.tnum{font-variant-numeric:tabular-nums}
.mut{color:var(--mut)}.sm{font-size:12px}.rt{text-align:right}
h1{font-size:26px;letter-spacing:-.03em;margin:0 0 6px}
h2{font-size:19px;letter-spacing:-.02em;margin:0 0 4px;display:flex;align-items:baseline;gap:9px}
h2 .num{font-size:12px;color:var(--mut);font-weight:600;letter-spacing:.06em}
h3{font-size:14px;margin:22px 0 9px}
.lead{color:var(--mut);font-size:13px;margin:0 0 18px}
header{padding:34px 0 20px;border-bottom:1px solid var(--bd);margin-bottom:8px}
section{padding:30px 0;border-top:1px solid var(--bd)}
section:first-of-type{border-top:none}

.hero{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin:16px 0 0}
@media(max-width:820px){.hero{grid-template-columns:repeat(2,1fr)}}
.hc{background:var(--card);border:1px solid var(--bd);border-radius:11px;padding:14px 15px}
.hc-l{font-size:11.5px;color:var(--mut)}
.hc-v{font-size:23px;font-weight:650;letter-spacing:-.025em;margin-top:3px;
 font-variant-numeric:tabular-nums}
.hc-v .u{font-size:11.5px;font-weight:400;color:var(--mut);margin-left:2px}
.hc-s{font-size:11.5px;color:var(--mut);margin-top:3px}

.panel{background:var(--card);border:1px solid var(--bd);border-radius:11px;padding:16px 18px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:13px}
@media(max-width:820px){.cols{grid-template-columns:1fr}}
.chart{display:block}
.cv{font-size:10px;fill:var(--fg)}
.cl{font-size:10px;fill:var(--mut)}
.fl{font-size:11px;fill:#fff;font-weight:600}

table{width:100%;border-collapse:collapse;font-size:12.5px}
.tw{overflow-x:auto;border:1px solid var(--bd);border-radius:11px}
th{text-align:left;color:var(--mut);font-weight:500;font-size:11.5px;padding:9px 11px;
 border-bottom:1px solid var(--bd);white-space:nowrap}
td{padding:8px 11px;border-bottom:1px solid var(--bd);white-space:nowrap}
tr:last-child td{border-bottom:none}
tr.me td{background:color-mix(in srgb,var(--fg) 6%,transparent);font-weight:600}
tr.sum td{border-top:2px solid var(--bd);font-weight:600}

.chip{display:inline-block;background:var(--chip);border-radius:999px;padding:2px 9px;
 font-size:11.5px}
.chip-g{background:color-mix(in srgb,#0ca30c 18%,transparent);color:#0a8a0a}
.chip-r{background:color-mix(in srgb,#d03b3b 18%,transparent);color:#c53131}
@media(prefers-color-scheme:dark){.chip-g{color:#4ade4a}.chip-r{color:#ff6b6b}}

.br{display:grid;grid-template-columns:104px 1fr 116px;align-items:center;gap:10px;
 margin:7px 0;font-size:12.5px}
.br-l{color:var(--mut)}
.br-t{height:9px;background:var(--barbg);border-radius:999px;overflow:hidden}
.br-f{display:block;height:100%;border-radius:999px}
.br-r{text-align:right;font-variant-numeric:tabular-nums}

.note{background:var(--tile);border:1px solid var(--bd);border-left:3px solid var(--fg);
 border-radius:0 9px 9px 0;padding:12px 15px;margin:14px 0;font-size:13px}
.note b{font-weight:650}
.note.warn{border-left-color:#d98c00}
.note.good{border-left-color:#0ca30c}
.kv{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
ul.pts{margin:9px 0 0;padding-left:19px;font-size:13px}
ul.pts li{margin:5px 0}
@media print{section{break-inside:avoid}}
"""


# ---------------------------------------------------------------------------
def build():
    d = R.collect()
    mgr_map, hq_map = R.load_match()
    design, ddates = R.load_design()

    C = R.CENTER
    tg, cc, sc = d["targets"], d["closeCenters"], d["sepCenters"]
    g8, t8 = cc[C], tg[C]
    ach = g8["cred"] / t8 * 100

    # ---- 랭킹
    rk = sorted(((v["cred"] / tg[k] * 100, k, v) for k, v in cc.items() if k in tg),
                reverse=True)
    rank8 = [i for i, (_, k, _) in enumerate(rk, 1) if k == C][0]
    pcs = sorted(((v["cred"] / v["roster"], k) for k, v in cc.items()), reverse=True)
    pcrank = [i for i, (_, k) in enumerate(pcs, 1) if k == C][0]
    ars = sorted(((v["active"] / v["roster"], k) for k, v in cc.items()), reverse=True)
    arrank = [i for i, (_, k) in enumerate(ars, 1) if k == C][0]
    dep = sorted(((v["cred"] / tg[k] * 100, k, v) for k, v in cc.items()
                  if k in tg and v["dept"] == R.DEPT), reverse=True)

    srk = sorted(((v["cred"], k, v) for k, v in sc.items()), reverse=True)
    rank9 = [i for i, (_, k, _) in enumerate(srk, 1) if k == C][0]

    aug = d["augSeries"]
    sep = d["sepSeries"]
    g9 = sc[C]

    # 9월 페이스 — 3영업일 경과 / 22영업일
    SEP_BIZ, sep_done = 22, len(sep)
    per_day9 = g9["cred"] / sep_done
    proj9 = per_day9 * SEP_BIZ
    aug_open_per_day = aug[0]["cred"] / 5     # 8/7 스냅샷 = 8/3~8/7, 5영업일

    people8 = {str(x["code"]).removesuffix(".0"): x
               for x in d["close"]["people"] if x["center"] == C}
    people9 = {str(x["code"]).removesuffix(".0"): x
               for x in d["sepLast"]["people"] if x["center"] == C}

    # ---- 종별 시상
    awards = []
    for a in d["augAwards"]:
        k = a["key"]
        awards.append({
            "key": k, "kind": R.award_kind(k), "window": a["window"],
            "n": sum(1 for p in people8.values() if p["awards"].get(k, {}).get("money", 0) > 0),
            "perf": sum(p["awards"].get(k, {}).get("perf", 0) for p in people8.values()),
            "money": sum(p["awards"].get(k, {}).get("money", 0) for p in people8.values()),
        })
    kinds = defaultdict(lambda: {"n": 0, "money": 0.0, "items": 0})
    for a in awards:
        kk = kinds[a["kind"]]
        kk["money"] += a["money"]
        kk["n"] += a["n"]
        kk["items"] += 1
    money_tot = sum(a["money"] for a in awards)

    # ---- 설계 퍼널
    gd = design.get(C, {})
    gsum = {k: sum(sum(v.get(k, [])) for v in gd.values()) for k in ("전체", "승인", "체결")}
    tsum = {k: sum(sum(v.get(k, [])) for mm in design.values() for v in mm.values())
            for k in ("전체", "승인", "체결")}
    nmgr = sum(len(v) for v in design.values())

    # 센터별 체결율 → GA7 위치
    cconv = []
    for ct, mm in design.items():
        a = sum(sum(v.get("전체", [])) for v in mm.values())
        c = sum(sum(v.get("체결", [])) for v in mm.values())
        if a > 300:
            cconv.append((c / a * 100, ct))
    cconv.sort(reverse=True)
    convrank = [i for i, (_, k) in enumerate(cconv, 1) if k == C]
    convrank = convrank[0] if convrank else None

    # 일별 설계 합계
    dtot = [sum(v.get("전체", [0] * len(ddates))[i] for v in gd.values())
            for i in range(len(ddates))]
    ddeal = [sum(v.get("체결", [0] * len(ddates))[i] for v in gd.values())
             for i in range(len(ddates))]

    # ---- 중겸 본부
    codes = set(people8) | set(people9)
    hq_rows = defaultdict(list)
    for c in codes:
        if c in hq_map:
            hq_rows[R.HQ_SHORT.get(hq_map[c], hq_map[c])].append(c)
    order = [R.HQ_SHORT[k] for k in R.HQ_ORDER] + ["미분류"]
    hqs = []
    for h in order:
        cs = hq_rows.get(h, [])
        if not cs:
            continue
        a = sum(people8[c]["cred"] for c in cs if c in people8)
        an = sum(1 for c in cs if c in people8 and people8[c]["cred"] > 0)
        s = sum(people9[c]["cred"] for c in cs if c in people9)
        sn = sum(1 for c in cs if c in people9 and people9[c]["cred"] > 0)
        hqs.append({"name": h, "cnt": len(cs), "aug": a, "augN": an,
                    "sep": s, "sepN": sn, "per": a / len(cs)})
    jg_aug = sum(h["aug"] for h in hqs)
    jg_sep = sum(h["sep"] for h in hqs)

    # ---- 매니저별 (신규 매칭 반영)
    def mgr_of(p):
        c = str(p["code"]).removesuffix(".0")
        return mgr_map.get(c) or p.get("manager") or "미지정"

    mg8, mg9 = defaultdict(lambda: [0.0, 0, 0]), defaultdict(lambda: [0.0, 0, 0])
    for p in people8.values():
        r = mg8[mgr_of(p)]
        r[0] += p["cred"]; r[1] += 1; r[2] += 1 if p["cred"] > 0 else 0
    for p in people9.values():
        r = mg9[mgr_of(p)]
        r[0] += p["cred"]; r[1] += 1; r[2] += 1 if p["cred"] > 0 else 0

    # =======================================================================
    P = []
    A = P.append

    head = next((p.get("centerHead") for p in d["close"]["people"]
                 if p["center"] == C and p.get("centerHead")), None)
    A(f'<header><div class="wrap"><h1>{esc(C)} — 8월 마감 &amp; 9월 초 리뷰</h1>'
      f'<p class="lead">{"센터장 " + esc(head) + " · " if head else ""}{R.DEPT} · 수도권마케팅2팀<br>'
      f'8월 최종 마감(9/1 확정) + 9월 {sep_done}영업일 경과 기준 · '
      f'작성 {datetime.datetime.now():%Y-%m-%d %H:%M}</p>'
      f'<div class="hero">'
      f'<div class="hc"><div class="hc-l">8월 최종 실적</div>'
      f'<div class="hc-v">{m(g8["cred"])}<span class="u">만원</span></div>'
      f'<div class="hc-s">목표 {m(t8,0)}만원</div></div>'
      f'<div class="hc"><div class="hc-l">목표 달성률</div>'
      f'<div class="hc-v" style="color:{GOOD}">{ach:.1f}<span class="u">%</span></div>'
      f'<div class="hc-s">전체 센터 <b>{rank8}/{len(rk)}위</b></div></div>'
      f'<div class="hc"><div class="hc-l">8월 가동</div>'
      f'<div class="hc-v">{n(g8["active"])}<span class="u">명</span></div>'
      f'<div class="hc-s">재적 {n(g8["roster"])}명 · {pct(g8["active"]/g8["roster"]*100)}</div></div>'
      f'<div class="hc"><div class="hc-l">9월 {sep_done}영업일</div>'
      f'<div class="hc-v">{m(g9["cred"])}<span class="u">만원</span></div>'
      f'<div class="hc-s">가동 {n(g9["active"])}명 · 일 {won(per_day9)}원</div></div>'
      f'</div></div></header><div class="wrap">')

    # ---------------- 1. 8월 마감
    A('<section><h2><span class="num">01</span>8월 마감 — 목표 대비 전체 1위</h2>'
      '<p class="lead">달성률은 30개 센터 중 1위. 다만 같은 성적표를 다른 잣대로 보면 '
      '그림이 정반대라, 두 축을 같이 놓고 읽어야 한다.</p>')

    A('<div class="cols"><div class="panel">'
      '<h3 style="margin-top:0">잣대별 GA7 위치 (30개 센터)</h3>')
    for lb, rr, val, tone in [
        ("목표 달성률", rank8, f"{ach:.1f}%", GOOD),
        ("인당 생산성", pcrank, f"{man(g8['cred']/g8['roster']):.2f}만/명", CRIT),
        ("가동률", arrank, pct(g8["active"] / g8["roster"] * 100), WARN),
    ]:
        A(barrow(lb, len(rk) - rr + 1, len(rk), tone, f"{rr}/{len(rk)}위 · {val}"))
    A(f'<p class="sm mut" style="margin:12px 0 0">막대가 길수록 상위. '
      f'인당 생산성 1위는 {esc(pcs[0][1])} {man(pcs[0][0]):.2f}만/명, '
      f'중앙값 {man(pcs[len(pcs)//2][0]):.2f}만/명.</p></div>')

    A('<div class="panel"><h3 style="margin-top:0">8월 누적 곡선</h3>')
    labels = [md(s["date"]) for s in aug] + ["마감"]
    vals = [man(s["cred"]) for s in aug] + [man(g8["cred"])]
    tgt_line = [man(t8) * (i + 1) / len(vals) for i in range(len(vals))]
    A(lines([("실적", vals, S1, False), ("목표 균등선", tgt_line, AXIS, True)], labels))
    A(f'<p class="sm mut">8/24에 목표({m(t8,0)}만)를 넘겼고, 마감까지 '
      f'{won(g8["cred"]-t8)}원을 더 쌓았다. 8/31 스냅샷({m(aug[-1]["cred"])}만) 이후 '
      f'최종 확정에서 <b>{won(g8["cred"]-aug[-1]["cred"])}원</b>이 추가로 잡혔다.</p>'
      '</div></div>')

    A(f'<div class="note"><b>같은 성적, 두 개의 결론.</b> 목표 대비로는 전체 1위지만, '
      f'인당 생산성은 {pcrank}/{len(pcs)}위다. GA7 목표({m(t8,0)}만원)가 30개 센터 중 '
      f'가장 작아서 달성률이 크게 나온 구조다. '
      f'<b>목표를 넘긴 것은 사실이고, 규모·생산성은 아직 하위</b> — 둘 다 맞다.</div>')

    A('<h3>경인영업단 8개 센터 8월 마감</h3><div class="tw"><table>'
      '<thead><tr><th>#</th><th>센터</th><th class="rt">달성률</th><th class="rt">실적</th>'
      '<th class="rt">목표</th><th class="rt">가동/재적</th><th class="rt">가동률</th>'
      '<th class="rt">인당</th></tr></thead><tbody>')
    for i, (p, k, v) in enumerate(dep, 1):
        cls = ' class="me"' if k == C else ""
        A(f'<tr{cls}><td class="tnum mut">{i}</td><td>{esc(k)}</td>'
          f'<td class="tnum rt"><b>{p:.1f}%</b></td><td class="tnum rt">{m(v["cred"])}</td>'
          f'<td class="tnum rt mut">{m(tg[k],0)}</td>'
          f'<td class="tnum rt mut">{v["active"]} / {v["roster"]}</td>'
          f'<td class="tnum rt">{pct(v["active"]/v["roster"]*100)}</td>'
          f'<td class="tnum rt">{man(v["cred"]/v["roster"]):.1f}</td></tr>')
    A('</tbody></table></div>')

    A('<h3>전체 센터 달성률 — 상위 6 / GA7 / 하위 3</h3><div class="tw"><table>'
      '<thead><tr><th>#</th><th>센터</th><th class="rt">달성률</th><th class="rt">실적</th>'
      '<th class="rt">목표</th><th class="rt">인당</th></tr></thead><tbody>')
    for i, (p, k, v) in enumerate(rk, 1):
        if not (i <= 6 or k == C or i > len(rk) - 3):
            continue
        cls = ' class="me"' if k == C else ""
        A(f'<tr{cls}><td class="tnum mut">{i}</td><td>{esc(k)}</td>'
          f'<td class="tnum rt"><b>{p:.1f}%</b></td><td class="tnum rt">{m(v["cred"])}</td>'
          f'<td class="tnum rt mut">{m(tg[k],0)}</td>'
          f'<td class="tnum rt">{man(v["cred"]/v["roster"]):.1f}</td></tr>')
    A('</tbody></table></div></section>')

    # ---------------- 2. 종별
    A('<section><h2><span class="num">02</span>종별 분석 — 무엇으로 벌었나</h2>'
      f'<p class="lead">8월 시상 종목 {len(awards)}개. GA7이 받은 시상금 합계 '
      f'<b>{won(money_tot)}원</b>. 실적이 아니라 <b>시상 종목별</b>로 쪼개면 '
      f'어떤 상품·캠페인이 센터를 끌고 갔는지가 보인다.</p>')

    A('<div class="cols"><div class="panel"><h3 style="margin-top:0">종별 시상금 구성</h3>')
    kk = sorted(kinds.items(), key=lambda kv: -kv[1]["money"])
    A(bars([(k, man(v["money"]), False) for k, v in kk], height=160, unit="만원"))
    A('<p class="sm mut">한 사람이 여러 종목에 중복 수상하므로 인원은 합산하지 않는다.</p>'
      '</div>')

    A('<div class="panel"><h3 style="margin-top:0">종별 비중</h3>')
    for k, v in kk:
        A(barrow(k, v["money"], money_tot, S1,
                 f'{won(v["money"])}원 · {v["money"]/money_tot*100:.0f}%'))
    A('</div></div>')

    A('<h3>시상 종목 상세 (14종)</h3><div class="tw"><table>'
      '<thead><tr><th>종목</th><th>종별</th><th>기간</th><th class="rt">달성 인원</th>'
      '<th class="rt">인정 실적</th><th class="rt">시상금</th></tr></thead><tbody>')
    for a in awards:
        A(f'<tr><td>{esc(a["key"])}</td><td class="mut">{esc(a["kind"])}</td>'
          f'<td class="mut sm">{esc(a["window"] or "—")}</td>'
          f'<td class="tnum rt">{a["n"]}명</td>'
          f'<td class="tnum rt mut">{m(a["perf"])}</td>'
          f'<td class="tnum rt"><b>{m(a["money"])}</b></td></tr>')
    A(f'<tr class="sum"><td colspan="5">시상금 합계</td>'
      f'<td class="tnum rt">{m(money_tot)}</td></tr></tbody></table></div>')

    wt = next(a for a in awards if "월드투어" in a["key"])
    yg = next(a for a in awards if a["key"] == "8~9월 연속가동")
    A(f'<div class="note good"><b>잘한 지점.</b> '
      f'시상금 1위는 <b>{kk[0][0]}</b>({won(kk[0][1]["money"])}원, '
      f'{kk[0][1]["money"]/money_tot*100:.0f}%). '
      f'특히 <b>8~9월 연속가동에 {yg["n"]}명</b>이 걸렸다 — 종목 중 최다 인원이고, '
      f'9월까지 이어지는 캠페인이라 <b>이번 달 초반 가동의 발판</b>이 된다. '
      f'월드투어는 {wt["n"]}명이 {won(wt["money"])}원을 받았다(7~9월 3개월 누적 집계).</div>')

    zero = [a for a in awards if a["n"] == 0]
    if zero:
        A(f'<div class="note warn"><b>비어 있는 칸.</b> '
          f'{", ".join(esc(a["key"]) for a in zero)} — 달성자 0명. '
          f'3주차 신담보는 인정 실적 {m(zero[0]["perf"])}만원이 잡혔는데도 '
          f'수상 요건에 닿은 사람이 없었다. 9월에 신담보 종목이 다시 열려 있으니 '
          f'요건을 미리 공유할 여지가 있다.</div>')
    A('</section>')

    # ---------------- 3. 설계 퍼널
    A('<section><h2><span class="num">03</span>설계 추이 — 어떻게 만들어졌나</h2>'
      f'<p class="lead">GA매니저일보 기준 8월 {len(ddates)}영업일'
      f'({md(ddates[0])}~{md(ddates[-1])}). 실적은 결과고, '
      f'설계는 그 앞단이다. GA7 매니저 {len(gd)}명이 '
      f'<b>{gsum["전체"]:,.0f}건</b>을 설계해 <b>{gsum["체결"]:,.0f}건</b>을 체결했다.</p>')

    A('<div class="cols"><div class="panel"><h3 style="margin-top:0">GA7 전환 퍼널</h3>')
    A(funnel(gsum["전체"], gsum["승인"], gsum["체결"]))
    A(f'<div class="kv"><span class="chip">승인율 {gsum["승인"]/gsum["전체"]*100:.1f}%</span>'
      f'<span class="chip">체결율 {gsum["체결"]/gsum["전체"]*100:.1f}%</span></div></div>')

    A('<div class="panel"><h3 style="margin-top:0">팀 전체 전환 퍼널</h3>')
    A(funnel(tsum["전체"], tsum["승인"], tsum["체결"]))
    A(f'<div class="kv"><span class="chip">승인율 {tsum["승인"]/tsum["전체"]*100:.1f}%</span>'
      f'<span class="chip">체결율 {tsum["체결"]/tsum["전체"]*100:.1f}%</span>'
      f'<span class="chip mut">매니저 {nmgr}명</span></div></div></div>')

    gap_a = gsum["승인"] / gsum["전체"] * 100 - tsum["승인"] / tsum["전체"] * 100
    gap_c = gsum["체결"] / gsum["전체"] * 100 - tsum["체결"] / tsum["전체"] * 100
    A(f'<div class="note warn"><b>여기가 약한 고리다.</b> '
      f'GA7 승인율 {gsum["승인"]/gsum["전체"]*100:.1f}%는 팀 평균보다 '
      f'<b>{gap_a:.1f}%p</b>, 체결율 {gsum["체결"]/gsum["전체"]*100:.1f}%는 '
      f'<b>{gap_c:.1f}%p</b> 낮다'
      + (f' (센터 체결율 {convrank}/{len(cconv)}위).' if convrank else '.')
      + f' 설계량으로 목표를 넘긴 셈이라, <b>같은 설계량에서 팀 평균 체결율만 맞춰도 '
        f'체결이 {gsum["전체"]*tsum["체결"]/tsum["전체"]-gsum["체결"]:,.0f}건 더 나온다.</b> '
        f'9월 개선 여지가 가장 큰 항목.</div>')

    A('<h3>매니저별 설계 (8월 누계)</h3><div class="tw"><table>'
      '<thead><tr><th>매니저</th><th class="rt">전체 설계</th><th class="rt">승인</th>'
      '<th class="rt">체결</th><th class="rt">승인율</th><th class="rt">체결율</th>'
      '<th class="rt">일평균</th></tr></thead><tbody>')
    mrows = sorted(gd.items(), key=lambda kv: -sum(kv[1].get("전체", [0])))
    for mgr, v in mrows:
        a, b, c = (sum(v.get(k, [])) for k in ("전체", "승인", "체결"))
        cr = c / a * 100 if a else 0
        tone = ' style="color:%s"' % (CRIT if cr < 5 else (WARN if cr < 10 else GOOD))
        A(f'<tr><td><b>{esc(mgr)}</b></td><td class="tnum rt">{a:,.0f}</td>'
          f'<td class="tnum rt">{b:,.0f}</td><td class="tnum rt">{c:,.0f}</td>'
          f'<td class="tnum rt">{b/a*100 if a else 0:.1f}%</td>'
          f'<td class="tnum rt"{tone}><b>{cr:.1f}%</b></td>'
          f'<td class="tnum rt mut">{v.get("일평균",0):.1f}</td></tr>')
    A(f'<tr class="sum"><td>GA7 합계</td><td class="tnum rt">{gsum["전체"]:,.0f}</td>'
      f'<td class="tnum rt">{gsum["승인"]:,.0f}</td><td class="tnum rt">{gsum["체결"]:,.0f}</td>'
      f'<td class="tnum rt">{gsum["승인"]/gsum["전체"]*100:.1f}%</td>'
      f'<td class="tnum rt">{gsum["체결"]/gsum["전체"]*100:.1f}%</td>'
      f'<td class="tnum rt mut">—</td></tr></tbody></table></div>')

    lo = [x for x in mrows if sum(x[1].get("전체", [])) > 100
          and sum(x[1].get("체결", [])) / sum(x[1].get("전체", [])) * 100 < 5]
    if lo:
        top2 = sorted(((sum(v.get("체결", [])) / sum(v.get("전체", [])) * 100, k)
                       for k, v in mrows if sum(v.get("전체", [])) > 100),
                      reverse=True)[:2]
        spread = top2[0][0] - min(sum(v.get("체결", [])) / sum(v.get("전체", [])) * 100
                                  for _, v in lo) if top2 else 0
        A('<div class="note"><b>편차가 크다.</b> '
          + ", ".join(f'{esc(k)} 체결율 '
                      f'{sum(v.get("체결",[]))/sum(v.get("전체",[]))*100:.1f}%'
                      for k, v in lo)
          + (f' — 상위 매니저({", ".join(f"{esc(k)} {p:.1f}%" for p, k in top2)})와 '
             f'{spread:.0f}%p 벌어진다. ' if top2 else ' — ')
          + '설계량이 아니라 <b>설계의 질</b>에서 갈린 것이라, 케이스 리뷰가 필요한 구간.</div>')

    A('<h3>일별 설계량 추이 (GA7 합계)</h3><div class="panel">')
    A(bars([(md(ddates[i]), dtot[i], False) for i in range(len(ddates))],
           height=150, unit="건"))
    A('<p class="sm mut" style="margin-top:10px">체결 건수</p>')
    A(bars([(md(ddates[i]), ddeal[i], False) for i in range(len(ddates))],
           height=120, unit="건", color=S2))
    A('</div></section>')

    # ---------------- 4. 중겸
    A('<section><h2><span class="num">04</span>중겸금융파트너스 — 본부별</h2>'
      f'<p class="lead">GA7 재적 {n(len(people9))}명 중 중겸 {n(sum(h["cnt"] for h in hqs))}명. '
      f'8월 실적의 <b>{jg_aug/g8["cred"]*100:.1f}%</b>가 중겸에서 나왔다. '
      f'미라클·탑·리드·마스터 4개 본부로 나눠 본다.</p>')

    A('<div class="cols"><div class="panel"><h3 style="margin-top:0">본부별 8월 실적</h3>')
    A(bars([(h["name"], man(h["aug"]), False) for h in hqs], height=155))
    A('</div><div class="panel"><h3 style="margin-top:0">본부별 인당 생산성 (8월)</h3>')
    A(bars([(h["name"], man(h["per"]), False) for h in hqs], height=155,
           color=S3, unit="만원/명"))
    A('</div></div>')

    A('<h3>본부별 상세</h3><div class="tw"><table>'
      '<thead><tr><th>본부</th><th class="rt">인원</th><th class="rt">8월 실적</th>'
      '<th class="rt">8월 가동</th><th class="rt">가동률</th><th class="rt">인당</th>'
      '<th class="rt">9월 실적</th><th class="rt">9월 가동</th></tr></thead><tbody>')
    for h in hqs:
        A(f'<tr><td><b>{esc(h["name"])}</b></td><td class="tnum rt">{h["cnt"]}</td>'
          f'<td class="tnum rt">{m(h["aug"])}</td>'
          f'<td class="tnum rt mut">{h["augN"]}명</td>'
          f'<td class="tnum rt">{h["augN"]/h["cnt"]*100:.1f}%</td>'
          f'<td class="tnum rt">{man(h["per"]):.1f}</td>'
          f'<td class="tnum rt"><b>{m(h["sep"])}</b></td>'
          f'<td class="tnum rt mut">{h["sepN"]}명</td></tr>')
    tot_cnt = sum(h["cnt"] for h in hqs)
    A(f'<tr class="sum"><td>중겸 계</td><td class="tnum rt">{tot_cnt}</td>'
      f'<td class="tnum rt">{m(jg_aug)}</td>'
      f'<td class="tnum rt">{sum(h["augN"] for h in hqs)}명</td>'
      f'<td class="tnum rt">{sum(h["augN"] for h in hqs)/tot_cnt*100:.1f}%</td>'
      f'<td class="tnum rt">{man(jg_aug/tot_cnt):.1f}</td>'
      f'<td class="tnum rt">{m(jg_sep)}</td>'
      f'<td class="tnum rt">{sum(h["sepN"] for h in hqs)}명</td></tr>'
      '</tbody></table></div>')

    best = max(hqs, key=lambda h: h["per"])
    worst = min((h for h in hqs if h["name"] != "미분류"), key=lambda h: h["per"])
    sep_best = max(hqs, key=lambda h: h["sep"])
    A(f'<div class="note"><b>본부마다 색이 다르다.</b> '
      f'8월 인당 생산성은 <b>{esc(best["name"])} {man(best["per"]):.1f}만/명</b>이 가장 높고, '
      f'<b>{esc(josa(worst["name"],"은/는"))} {man(worst["per"]):.1f}만/명</b>으로 '
      f'{best["per"]/worst["per"]:.1f}배 차이가 난다. '
      f'{esc(josa(worst["name"],"은/는"))} 인원이 {worst["cnt"]}명으로 가장 많은데 실적은 하위 — '
      f'<b>머릿수가 아니라 가동이 문제</b>다(가동률 {worst["augN"]/worst["cnt"]*100:.0f}%).<br>'
      f'9월 {sep_done}영업일 기준으로는 <b>{esc(josa(sep_best["name"],"이/가"))} {won(sep_best["sep"])}원</b>으로 '
      f'앞서 있다.</div>')

    A('<h3>매니저별 (9월 확정 매칭 반영)</h3>'
      '<p class="sm mut">9월 매칭 취합본의 사용인별 배정을 적용했다. '
      '원본 실적 파일의 매니저 표기와 다를 수 있다.</p><div class="tw"><table>'
      '<thead><tr><th>매니저</th><th class="rt">담당 인원</th><th class="rt">8월 실적</th>'
      '<th class="rt">8월 가동</th><th class="rt">9월 실적</th><th class="rt">9월 가동</th>'
      '</tr></thead><tbody>')
    for mgr in sorted(set(mg8) | set(mg9), key=lambda k: -mg8.get(k, [0])[0]):
        a, b = mg8.get(mgr, [0, 0, 0]), mg9.get(mgr, [0, 0, 0])
        A(f'<tr><td><b>{esc(mgr)}</b></td><td class="tnum rt">{b[1] or a[1]}</td>'
          f'<td class="tnum rt">{m(a[0])}</td><td class="tnum rt mut">{a[2]}명</td>'
          f'<td class="tnum rt"><b>{m(b[0])}</b></td>'
          f'<td class="tnum rt mut">{b[2]}명</td></tr>')
    A('</tbody></table></div></section>')

    # ---------------- 5. 9월
    A(f'<section><h2><span class="num">05</span>9월 {sep_done}영업일</h2>'
      f'<p class="lead">9/1~9/3 마감 기준. 아직 9월 목표는 배정 전이라 '
      f'<b>8월 출발 속도와 견준다.</b></p>')

    A('<div class="hero">'
      f'<div class="hc"><div class="hc-l">9월 누적</div>'
      f'<div class="hc-v">{m(g9["cred"])}<span class="u">만원</span></div>'
      f'<div class="hc-s">전체 센터 {rank9}/{len(srk)}위</div></div>'
      f'<div class="hc"><div class="hc-l">영업일당</div>'
      f'<div class="hc-v" style="color:{GOOD}">{man(per_day9):.1f}<span class="u">만원</span></div>'
      f'<div class="hc-s">8월 출발 {man(aug_open_per_day):.1f}만 대비 '
      f'<b>{per_day9/aug_open_per_day*100-100:+.0f}%</b></div></div>'
      f'<div class="hc"><div class="hc-l">가동 인원</div>'
      f'<div class="hc-v">{n(g9["active"])}<span class="u">명</span></div>'
      f'<div class="hc-s">재적 {n(g9["roster"])}명 · {pct(g9["active"]/g9["roster"]*100)}</div></div>'
      f'<div class="hc"><div class="hc-l">이 속도면 월말</div>'
      f'<div class="hc-v">{m(proj9)}<span class="u">만원</span></div>'
      f'<div class="hc-s">8월 마감의 {proj9/g8["cred"]*100:.0f}% · 22영업일 환산</div></div>'
      '</div>')

    A('<div class="cols" style="margin-top:14px"><div class="panel">'
      '<h3 style="margin-top:0">9월 일별 실적</h3>')
    prev = 0
    dl = []
    for s in sep:
        dl.append((md(s["date"]), man(s["cred"] - prev), False))
        prev = s["cred"]
    A(bars(dl, height=150))
    A('<p class="sm mut">스냅샷은 전일 마감 기준 — 9/2 파일이 9/1 실적이다.</p></div>')

    A('<div class="panel"><h3 style="margin-top:0">8월 vs 9월 출발 속도</h3>')
    A(barrow("8월 초 5영업일", man(aug_open_per_day), man(per_day9), AXIS,
             f"{man(aug_open_per_day):.1f}만/일"))
    A(barrow("9월 3영업일", man(per_day9), man(per_day9), GOOD,
             f"{man(per_day9):.1f}만/일"))
    A(f'<p class="sm mut" style="margin-top:12px">8월은 5영업일 지나 {m(aug[0]["cred"])}만원이었다. '
      f'9월은 <b>3영업일 만에 {m(g9["cred"])}만원</b> — 같은 영업일로 환산하면 '
      f'{per_day9/aug_open_per_day:.1f}배 빠른 출발이다.</p></div></div>')

    A(f'<div class="note good"><b>출발은 좋다.</b> '
      f'8월 첫 5영업일 일평균 {man(aug_open_per_day):.1f}만원 → '
      f'9월 첫 3영업일 <b>{man(per_day9):.1f}만원</b>. '
      f'8~9월 연속가동 시상({yg["n"]}명 진행 중)이 초반 가동을 밀어주고 있다. '
      f'다만 절대 실적은 30개 센터 중 {rank9}위 — 규모 자체는 여전히 작다.</div>')

    A('<h3>9월 실적 상위 5 / GA7</h3><div class="tw"><table>'
      '<thead><tr><th>#</th><th>센터</th><th class="rt">9월 실적</th>'
      '<th class="rt">가동</th><th class="rt">재적</th><th class="rt">가동률</th>'
      '</tr></thead><tbody>')
    for i, (c, k, v) in enumerate(srk, 1):
        if not (i <= 5 or k == C):
            continue
        cls = ' class="me"' if k == C else ""
        A(f'<tr{cls}><td class="tnum mut">{i}</td><td>{esc(k)}</td>'
          f'<td class="tnum rt"><b>{m(c)}</b></td>'
          f'<td class="tnum rt">{v["active"]}</td>'
          f'<td class="tnum rt mut">{v["roster"]}</td>'
          f'<td class="tnum rt">{pct(v["active"]/v["roster"]*100)}</td></tr>')
    A('</tbody></table></div>')

    sa = d["sepAwards"]
    if sa:
        A('<h3>9월 시상 종목 (진행 중)</h3><div class="tw"><table>'
          '<thead><tr><th>종목</th><th>기간</th><th class="rt">달성 인원</th>'
          '<th class="rt">시상금</th></tr></thead><tbody>')
        for a in sa:
            k = a["key"]
            nn = sum(1 for p in people9.values() if p["awards"].get(k, {}).get("money", 0) > 0)
            mo = sum(p["awards"].get(k, {}).get("money", 0) for p in people9.values())
            A(f'<tr><td>{esc(k)}</td><td class="mut sm">{esc(a["window"] or "—")}</td>'
              f'<td class="tnum rt">{nn}명</td><td class="tnum rt">{m(mo)}</td></tr>')
        A('</tbody></table></div>')
    A('</section>')

    # ---------------- 6. 정리
    A('<section><h2><span class="num">06</span>리뷰 포인트</h2>')
    A('<div class="cols"><div class="panel"><h3 style="margin-top:0" '
      f'>잘한 것</h3><ul class="pts">'
      f'<li><b>목표 달성률 153.1%로 30개 센터 1위.</b> 8/24에 목표를 넘기고 '
      f'마감까지 {won(g8["cred"]-t8)}원을 더 쌓았다.</li>'
      f'<li><b>가동 인원이 꾸준히 늘었다.</b> 8/7 45명 → 마감 {g8["active"]}명. '
      f'월중 내내 우상향했고 꺾인 구간이 없다.</li>'
      f'<li><b>8~9월 연속가동에 {yg["n"]}명</b>을 걸어놨다. 종목 중 최다 인원이고 '
      f'9월 초반 가동으로 이어지고 있다.</li>'
      f'<li><b>9월 출발이 8월보다 {per_day9/aug_open_per_day:.1f}배 빠르다.</b> '
      f'영업일당 {man(per_day9):.1f}만원.</li></ul></div>')

    A('<div class="panel"><h3 style="margin-top:0">고쳐야 할 것</h3><ul class="pts">'
      f'<li><b>체결율 {gsum["체결"]/gsum["전체"]*100:.1f}%는 팀 평균보다 {abs(gap_c):.1f}%p 낮다.</b> '
      f'같은 설계량에서 팀 평균만 맞춰도 체결 '
      f'{gsum["전체"]*tsum["체결"]/tsum["전체"]-gsum["체결"]:,.0f}건이 더 나온다.</li>'
      f'<li><b>매니저 간 체결율 편차가 10%p 이상</b> 벌어진다. 설계량이 아니라 '
      f'설계의 질 문제.</li>'
      f'<li><b>인당 생산성 {man(g8["cred"]/g8["roster"]):.2f}만/명은 30위.</b> '
      f'재적 {n(g8["roster"])}명 대비 실적 규모가 작다.</li>'
      f'<li><b>{esc(worst["name"])} 본부: 인원 {worst["cnt"]}명(최다)인데 인당 '
      f'{man(worst["per"]):.1f}만/명(최저).</b> 가동률 '
      f'{worst["augN"]/worst["cnt"]*100:.0f}%부터 손봐야 한다.</li></ul></div></div>')

    A(f'<div class="note"><b>한 줄로.</b> 8월은 <b>목표를 넘겼고</b>(달성률 1위), '
      f'그 방식은 <b>설계량과 가동 인원을 밀어올린 것</b>이었다. '
      f'전환율은 팀 하위권이라 <b>같은 노력으로 더 받을 수 있는 여지</b>가 남아 있다. '
      f'9월은 출발 속도가 8월의 {per_day9/aug_open_per_day:.1f}배 — '
      f'체결율만 팀 평균에 붙이면 규모까지 같이 올라간다.</div>')

    A('<p class="sm mut" style="margin-top:26px">'
      '실적 단위는 만원(원본 천원). 8월은 9/1 확정 최종본, 9월은 9/4 스냅샷(9/3 마감) 기준. '
      '설계 데이터는 26.08 마켓리딩본부 GA매니저일보(8/31), '
      '매니저·본부 배정은 9월매칭 취합본(2)을 따랐다.<br>'
      '설계사 개인정보가 포함된 문서입니다. 공유·전송에 주의하세요.</p>')
    A("</section></div>")

    doc = (f'<!doctype html><html lang="ko"><head><meta charset="utf-8">'
           f'<meta name="viewport" content="width=device-width, initial-scale=1">'
           f'<title>경인.GA7센터 8월 마감 &amp; 9월 초 리뷰</title>'
           f"<style>{STYLE}</style></head><body>{''.join(P)}</body></html>")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"GA7센터_8월마감_9월리뷰_{datetime.date.today():%Y%m%d}.html"
    out.write_text(doc, encoding="utf-8")
    print(f"✓ {out}  ({out.stat().st_size/1024:,.0f} KB)")
    return out


if __name__ == "__main__":
    build()
