"""dashboard/data/*.json → 자체완결형 오프라인 HTML 스냅샷.

서버 없이 더블클릭으로 열리는 한 장짜리 리포트. 실시간 대시보드를
그대로 복제하진 않는다 — 그 순간의 핵심 지표·랭킹·주차 페이스를
한 파일에 담아 터널이 끊기거나 인터넷이 없는 곳에서도 훑어볼 수
있게 하는 게 목적이다. 데이터는 파일 안에 그대로 박혀있으니
새로고침해도 갱신되지 않는다 — 최신판이 필요하면 다시 뽑아야 한다.

사용법
    python3 etl/export_offline.py
    python3 etl/export_offline.py --out ~/Desktop/대시보드_오프라인.html
"""
from __future__ import annotations

import argparse
import datetime
import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "dashboard" / "data"
DEFAULT_OUT_DIR = HERE.parent / "exports"

SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"]
GOOD, WARN, CRIT = "#0ca30c", "#d98c00", "#d03b3b"
AXIS = "#8a8a8a"


# ===========================================================================
# 포맷 (dashboard/src/lib/format.ts 그대로 이식 — 숫자가 화면과 어긋나면 안 된다)
# ===========================================================================
def nf0(v):
    return f"{round(v):,}"


def nf1(v):
    return f"{v:,.1f}"


def m(v):
    if v is None:
        return "—"
    x = v / 10
    return nf0(x) if abs(x) >= 1000 else nf1(x)


def won(v):
    if v is None:
        return "—"
    x = v / 10
    if abs(x) >= 10000:
        return f"{nf1(x / 10000)}억"
    if abs(x) >= 1000:
        return f"{nf0(x)}만"
    return f"{nf1(x)}만"


def won_signed(v):
    if v is None:
        return "—"
    x = v / 10
    if abs(x) < 0.05:
        return "0"
    body = nf0(abs(x)) if abs(x) >= 1000 else nf1(abs(x))
    return f"{'+' if x > 0 else '-'}{body}만"


def n(v):
    return "—" if v is None else f"{round(v):,}"


def pct(v, digits=1):
    return "—" if v is None else f"{v:.{digits}f}%"


def md(iso):
    d = datetime.date.fromisoformat(iso)
    return f"{d.month}/{d.day}"


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


# ===========================================================================
# 영업일 / 페이스 (dashboard/src/lib/analytics.ts 그대로 이식)
# ===========================================================================
def days_in_month(iso):
    d = datetime.date.fromisoformat(iso)
    nxt = datetime.date(d.year + 1, 1, 1) if d.month == 12 else datetime.date(d.year, d.month + 1, 1)
    return (nxt - datetime.timedelta(days=1)).day


def month_end(iso):
    return f"{iso[:7]}-{days_in_month(iso):02d}"


def count_business_days(a, b):
    cur, end, cnt = datetime.date.fromisoformat(a), datetime.date.fromisoformat(b), 0
    while cur <= end:
        if cur.weekday() < 5:
            cnt += 1
        cur += datetime.timedelta(days=1)
    return cnt


def pace(as_of, cumulative, target):
    month = as_of[:7]
    first = f"{month}-01"
    elapsed = count_business_days(first, as_of)
    total = count_business_days(first, month_end(as_of))
    per_day = cumulative / elapsed if elapsed > 0 else 0
    projected = per_day * total
    out = {"elapsedBiz": elapsed, "totalBiz": total, "perDay": per_day, "projected": projected,
           "target": None, "achievedPct": None, "gapPp": None, "remaining": None, "projectedPct": None}
    if not target:
        return out
    achieved = cumulative / target * 100
    progress_pct = (elapsed / total * 100) if total > 0 else 0
    out.update(target=target, achievedPct=achieved, gapPp=achieved - progress_pct,
               remaining=max(0, target - cumulative), projectedPct=projected / target * 100)
    return out


def tone_for_gap(gap_pp):
    if gap_pp is None:
        return AXIS
    if gap_pp <= -7:
        return CRIT
    if gap_pp < 0:
        return WARN
    return GOOD


# ===========================================================================
# SVG 미니 차트 — 외부 라이브러리 없이 file:// 에서도 그대로 그려지게
# ===========================================================================
def svg_bars(items, width=640, height=150, unit="만원", baseline=None, pad_left=8, pad_right=8):
    """items: [(label, value, is_highlight)]"""
    if not items:
        return ""
    vals = [v for _, v, _ in items]
    vmax = max(vals + [baseline or 0, 0.0001])
    n_bars = len(items)
    gap = 6
    plot_w = width - pad_left - pad_right
    bar_w = max(6, (plot_w - gap * (n_bars - 1)) / n_bars)
    top_pad, bot_pad = 18, 24
    plot_h = height - top_pad - bot_pad
    parts = [f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" '
             f'class="chart" preserveAspectRatio="xMinYMin meet">']
    if baseline:
        by = top_pad + plot_h - (baseline / vmax) * plot_h
        parts.append(f'<line x1="{pad_left}" y1="{by:.1f}" x2="{width - pad_right}" y2="{by:.1f}" '
                     f'stroke="{AXIS}" stroke-width="1" stroke-dasharray="4 3" />')
    for i, (label, val, hi) in enumerate(items):
        x = pad_left + i * (bar_w + gap)
        bh = (val / vmax) * plot_h if vmax else 0
        y = top_pad + plot_h - bh
        color = SERIES[1] if hi else SERIES[0]
        parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{max(bh,1):.1f}" '
                     f'rx="2" fill="{color}" />')
        parts.append(f'<text x="{x + bar_w / 2:.1f}" y="{y - 4:.1f}" class="chart-val" '
                     f'text-anchor="middle">{m(val)}</text>')
        parts.append(f'<text x="{x + bar_w / 2:.1f}" y="{height - 6}" class="chart-lbl" '
                     f'text-anchor="middle">{esc(label)}</text>')
    parts.append(f'<text x="{width - pad_right}" y="12" class="chart-lbl" text-anchor="end">{unit}</text>')
    parts.append("</svg>")
    return "".join(parts)


def svg_spark(values, width=640, height=90, color=SERIES[0]):
    vals = [v for v in values if v is not None]
    if len(vals) < 2:
        return ""
    vmin, vmax = min(vals), max(vals)
    span = (vmax - vmin) or 1
    pad = 6
    step = (width - pad * 2) / (len(vals) - 1)
    pts = []
    for i, v in enumerate(vals):
        x = pad + i * step
        y = pad + (1 - (v - vmin) / span) * (height - pad * 2)
        pts.append(f"{x:.1f},{y:.1f}")
    area = f"{pad},{height - pad} " + " ".join(pts) + f" {width - pad},{height - pad}"
    return (f'<svg viewBox="0 0 {width} {height}" width="100%" height="{height}" class="chart">'
            f'<polygon points="{area}" fill="{color}" opacity="0.12" />'
            f'<polyline points="{" ".join(pts)}" fill="none" stroke="{color}" stroke-width="2.2" '
            f'stroke-linejoin="round" stroke-linecap="round" /></svg>')


# ===========================================================================
# 조각 렌더러
# ===========================================================================
def rank_badges(ranks):
    if not ranks:
        return ""
    fields = [("achievedPct", "달성률", lambda v: pct(v)),
              ("cred", "실적", lambda v: f"{m(v)}만"),
              ("perCapita", "인당", lambda v: f"{m(v * 10)}만"),
              ("activeRate", "가동률", lambda v: pct(v))]
    chips = []
    for key, label, _fmt in fields:
        r = ranks.get(key)
        if not r:
            continue
        top = r["rank"] <= max(1, -(-r["of"] // 3))
        cls = "chip chip-top" if top else "chip"
        chips.append(f'<span class="{cls}">{label} {r["rank"]}/{r["of"]}위</span>')
    if not chips:
        return ""
    return f'<div class="rankrow"><span class="rankscope">{esc(ranks["scope"])}</span>{"".join(chips)}</div>'


def kpi_tiles(daily, target, as_of, headcount):
    last = daily[-1]
    prev_with_delta = [d for d in daily if d.get("dCred") is not None]
    dl = prev_with_delta[-1] if prev_with_delta else None
    p = pace(as_of, last["cred"], target)
    active_rate = (last["active"] / headcount * 100) if headcount else None
    per_capita = (last["cred"] / headcount) if headcount else None

    tiles = []
    tiles.append(("당월 누적 실적", f'{m(last["cred"])}<span class="unit">만원</span>',
                  won_signed(dl["dCred"]) + f" ({md(dl['date'])})" if dl else None,
                  GOOD if dl and dl["dCred"] and dl["dCred"] > 0 else None))

    if p["target"] is not None:
        gap = p["gapPp"]
        tiles.append(("목표 달성률", f'{p["achievedPct"]:.1f}<span class="unit">%</span>',
                      f'영업일 진척 대비 {"+" if gap >= 0 else ""}{gap:.1f}%p · 남은 {won(p["remaining"])}원',
                      tone_for_gap(gap)))
    else:
        tiles.append(("인당 생산성", f'{m(per_capita * 10) if per_capita else "—"}<span class="unit">만원/명</span>',
                      "재적 1인당", None))

    tiles.append(("월말 예상", f'{m(p["projected"])}<span class="unit">만원</span>',
                  f'목표의 {p["projectedPct"]:.0f}%' if p["projectedPct"] is not None else f'영업일 평균 {won(p["perDay"])}원',
                  None))

    tiles.append((f'{md(as_of)} 실적', f'{m(dl["dCred"]) if dl else 0}<span class="unit">만원</span>',
                  None, None))

    tiles.append(("가동 인원", f'{n(last["active"])}<span class="unit">명 / {n(headcount)}명</span>',
                  f'가동률 {pct(active_rate)}' if active_rate is not None else None, None))

    out = ['<div class="tiles">']
    for label, val, sub, tone in tiles:
        style = f' style="color:{tone}"' if tone else ""
        out.append(f'<div class="tile"><div class="tile-label">{esc(label)}</div>'
                    f'<div class="tile-val">{val}</div>'
                    + (f'<div class="tile-sub"{style}>{esc(sub) if not tone else sub}</div>' if sub else "")
                    + "</div>")
    out.append("</div>")
    return "".join(out), p


def target_panel(p, cumulative):
    if p["target"] is None:
        return ""
    ach = min(100, p["achievedPct"])
    prog = (p["elapsedBiz"] / p["totalBiz"] * 100) if p["totalBiz"] else 0
    gap = p["gapPp"]
    return f"""
    <div class="panel">
      <div class="panel-row">
        <span class="panel-label">목표 달성</span>
        <span class="panel-right">{m(cumulative)}만 / {m(p['target'])}만 · {p['achievedPct']:.1f}%</span>
      </div>
      <div class="bar"><div class="bar-fill" style="width:{ach:.1f}%;background:{GOOD if gap and gap>=0 else (WARN if gap and gap>-7 else CRIT)}"></div></div>
      <div class="panel-row" style="margin-top:10px">
        <span class="panel-label">영업일 진척</span>
        <span class="panel-right">{p['elapsedBiz']} / {p['totalBiz']}일 · {prog:.1f}%</span>
      </div>
      <div class="bar bar-muted"><div class="bar-fill bar-fill-muted" style="width:{prog:.1f}%"></div></div>
      <div class="panel-foot" style="color:{tone_for_gap(gap)}">계획 대비 {"+" if gap>=0 else ""}{gap:.1f}%p</div>
      <div class="grid2" style="margin-top:12px">
        <div class="fact"><div class="fact-label">남은 목표</div><div class="fact-val">{won(p['remaining'])}원</div></div>
        <div class="fact"><div class="fact-label">필요 일평균</div><div class="fact-val">{won(p['remaining']/max(1, p['totalBiz']-p['elapsedBiz']))}원</div></div>
      </div>
    </div>"""


def tier_cards(tiers, level):
    if not tiers:
        return ""
    out = ['<div class="tiles tiles-2">']
    for t in tiers:
        ref_html = ""
        if t.get("ref") and t.get("refPct") is not None:
            p = t["refPct"]
            tone = GOOD if (p >= 100) else (WARN if p >= (90 if t["ref"]["kind"] == "prev" else 80) else CRIT)
            ref_html = (f'<div class="tile-sub" style="display:flex;justify-content:space-between">'
                        f'<span>{esc(t["ref"]["label"])} {n(t["ref"]["value"])}명</span>'
                        f'<span style="color:{tone};font-weight:600">{p:.0f}%</span></div>'
                        f'<div class="bar bar-sm"><div class="bar-fill" style="width:{min(100,p):.1f}%;background:{tone}"></div></div>')
        out.append(f'<div class="tile">'
                    f'<div class="tile-label">{esc(t["label"])}</div>'
                    f'<div class="tile-val">{n(t["count"])}<span class="unit">명</span></div>'
                    + ref_html
                    + f'<div class="tile-sub">실적 {won(t["cred"])}원</div>')
        people = t.get("people") or []
        if people:
            rows = []
            for i, pr in enumerate(people, 1):
                extra = f'<span class="muted"> · {esc(pr["center"])}</span>' if level != "center" and pr.get("center") else ""
                rows.append(f'<tr><td class="tnum muted">{i}</td>'
                            f'<td>{esc(pr["name"])}{extra}'
                            + (f'<div class="muted small">{esc(pr.get("branch",""))}</div>' if pr.get("branch") else "")
                            + f'</td><td class="tnum right">{m(pr["cred"])}만</td></tr>')
            trunc = t.get("truncated") or 0
            more = f'<p class="muted small">상위 {len(people)}명만 표시 · {n(trunc)}명 더 있음</p>' if trunc else ""
            out.append(f'<details class="tier-people"><summary>대상자 명단 보기 ({n(t["count"])}명)</summary>'
                        f'{more}<table class="mini"><tbody>{"".join(rows)}</tbody></table></details>')
        out.append("</div>")
    out.append("</div>")
    return "".join(out)


def week_panel(weeks, week_pace):
    if not weeks or not week_pace:
        return ""
    live = [w for w in weeks if w["state"] not in ("none", "upcoming")]
    if not live:
        return ""
    cur = week_pace.get("current")
    html_out = ['<div class="subhead">주차별 페이스</div>']
    if cur:
        ratio = cur.get("paceRatio")
        tone = GOOD if (ratio or 0) >= 1 else (WARN if (ratio or 0) >= 0.85 else CRIT)
        pct_now = min(140, (cur["cred"] / cur["expectedNow"] * 100)) if cur.get("expectedNow") else 0
        html_out.append(f"""
        <div class="panel">
          <div class="panel-row">
            <span class="panel-label">{cur['week']}주차 진행 중 · 영업일 {cur['bizDays']}/{cur.get('totalBizDays','?')}일</span>
            <span class="chip" style="color:{tone}">기대 대비 {ratio:.2f}배</span>
          </div>
          <div class="panel-row" style="margin-top:8px"><span>지금까지 실적</span><span class="tnum">{won(cur['cred'])}원</span></div>
          <div class="bar"><div class="bar-fill" style="width:{pct_now:.1f}%;background:{tone}"></div></div>
          <div class="panel-row" style="margin-top:6px"><span>지금 시점 기대값</span><span class="tnum">{won(cur['expectedNow'])}원</span></div>
          <div class="grid2" style="margin-top:12px">
            <div class="fact"><div class="fact-label">이번 주차 마감 기대</div><div class="fact-val">{won(cur.get('expectedFull'))}원</div></div>
            <div class="fact"><div class="fact-label">이 속도면</div><div class="fact-val">{won(cur.get('projected'))}원</div></div>
          </div>
        </div>""")
    bars = [(w["label"], w["cred"] / w["bizDays"] if w.get("bizDays") else 0, w["state"] == "running") for w in live if w.get("bizDays")]
    if bars:
        html_out.append(f'<div class="chartbox">{svg_bars(bars, unit="만원/영업일", baseline=week_pace.get("baselinePerDay"))}'
                        f'<p class="muted small">기준선 {won(week_pace.get("baselinePerDay"))}원/영업일(완료 주차 평균) · 직전 주차 {won(week_pace.get("prevPerDay"))}원</p></div>')
    return "".join(html_out)


def daily_chart(daily):
    rows = [d for d in daily if d.get("dCred") is not None]
    if len(rows) < 2:
        return ""
    bars = [(md(d["date"]), d["dCred"], i == len(rows) - 1) for i, d in enumerate(rows[-10:])]
    return f'<div class="subhead">일간 실적 (만원)</div><div class="chartbox">{svg_bars(bars, unit="만원")}</div>'


def children_table(children, label, has_children_link=False):
    if not children:
        return ""
    has_target = any(c.get("achievedPct") is not None for c in children)
    key = "achievedPct" if has_target else "cred"
    rows = sorted(children, key=lambda c: (c.get(key) if c.get(key) is not None else -1e18), reverse=True)
    head_cells = ['<th class="tnum">#</th>', f"<th>{esc(label)}</th>"]
    if has_target:
        head_cells.append('<th class="right">달성률</th>')
    head_cells += ['<th class="right">실적</th>', '<th class="right">가동/재적</th>',
                   '<th class="right">가동률</th>', '<th class="right">인당</th>']
    body = []
    for i, c in enumerate(rows, 1):
        rank = c.get(f"{key}Rank") or i
        cells = [f'<td class="tnum muted">{rank}</td>',
                 f'<td><span class="dot" style="background:{level_color(c)}"></span>{esc(c["name"])}'
                 + (f'<div class="muted small">{esc(c["agency"])}</div>' if c.get("agency") else "") + "</td>"]
        if has_target:
            cells.append(f'<td class="tnum right strong">{pct(c.get("achievedPct"))}</td>')
        cells += [f'<td class="tnum right">{m(c["cred"])}</td>',
                  f'<td class="tnum right muted">{n(c.get("active"))} / {n(c.get("headcount"))}</td>',
                  f'<td class="tnum right">{pct(c.get("activeRate"))}</td>',
                  f'<td class="tnum right">{m(c["perCapita"] * 10) if c.get("perCapita") is not None else "—"}</td>']
        body.append(f"<tr>{''.join(cells)}</tr>")
    return (f'<div class="subhead">{esc(label)} 상세 (금액 만원)</div>'
            f'<div class="tablewrap"><table><thead><tr>{"".join(head_cells)}</tr></thead>'
            f'<tbody>{"".join(body)}</tbody></table></div>')


def level_color(c):
    gap = None
    if c.get("achievedPct") is not None:
        pass
    z = c.get("z")
    if z is not None:
        if z <= -2:
            return CRIT
        if z <= -1.5:
            return WARN
    mom = c.get("momentum")
    if mom is not None:
        if mom < 0.7:
            return CRIT
        if mom < 0.9:
            return WARN
    return GOOD


# ===========================================================================
# 조직 섹션 조립
# ===========================================================================
def render_org(anchor_id, org, subtitle, is_first=False):
    daily = org["daily"]
    as_of = org["asOf"]
    target = org.get("target")
    headcount = org.get("headcount")
    tiles_html, p = kpi_tiles(daily, target, as_of, headcount)

    badges = [f'<span class="badge">목표 {won(target)}원</span>' if target else '<span class="badge badge-muted">목표 미등록</span>',
              f'<span class="badge">재적 {n(headcount)}명</span>',
              f'<span class="badge">영업일 {p["elapsedBiz"]}/{p["totalBiz"]}</span>']

    parts = [f'<section id="{anchor_id}" class="org">',
             '<div class="org-head">',
             f'<h2>{esc(org["name"])}</h2>',
             f'<div class="badges">{"".join(badges)}</div>',
             '</div>',
             f'<p class="subtitle">{subtitle}</p>' if subtitle else "",
             rank_badges(org.get("ranks")),
             tiles_html,
             '<div class="cols2">',
             target_panel(p, daily[-1]["cred"]),
             tier_cards(org.get("tiers"), org.get("level", "")),
             '</div>',
             week_panel(org.get("weeks"), org.get("weekPace")),
             daily_chart(daily),
             children_table(org.get("children"), org.get("childLabel", "하위 조직")),
             "</section>"]
    return "".join(parts)


def build_sidebar(index):
    items = [f'<li><a href="#s-team">{esc(index["team"])}</a></li>']
    for dep in index["tree"]:
        items.append(f'<li><a href="#s-dept-{dep["key"]}">{esc(dep["name"])}</a><ul>')
        for c in dep["centers"]:
            items.append(f'<li class="sub"><a href="#s-center-{c["key"]}">{esc(c["name"])}</a></li>')
        items.append("</ul></li>")
    return f'<nav class="side"><div class="side-title">조직도</div><ul>{"".join(items)}</ul></nav>'


STYLE = """
:root{
  --bg:#ffffff; --card:#ffffff; --fg:#171717; --muted:#737373; --border:#e5e5e5;
  --tile:#fafafa; --chip-bg:#f2f2f2; --barbg:#e9e9e9;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#121212; --card:#1c1c1c; --fg:#f2f2f2; --muted:#a3a3a3; --border:#2e2e2e;
    --tile:#1a1a1a; --chip-bg:#242424; --barbg:#303030;
  }
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
  font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  font-size:14px;line-height:1.5;}
a{color:inherit}
.tnum{font-variant-numeric:tabular-nums}
.muted{color:var(--muted)}
.small{font-size:12px}
.strong{font-weight:600}
.right{text-align:right}

.cover{padding:28px 28px 20px;border-bottom:1px solid var(--border)}
.cover h1{margin:0 0 6px;font-size:22px;letter-spacing:-0.02em}
.cover p{margin:2px 0;color:var(--muted);font-size:13px}
.cover .warn{margin-top:10px;padding:10px 12px;background:var(--tile);border:1px solid var(--border);
  border-radius:8px;font-size:12.5px}

.layout{display:flex;align-items:flex-start}
.side{position:sticky;top:0;width:250px;flex:0 0 250px;height:100vh;overflow-y:auto;
  border-right:1px solid var(--border);padding:14px 10px;font-size:12.5px}
.side-title{color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-size:11px;
  padding:4px 8px 8px}
.side ul{list-style:none;margin:0;padding:0}
.side li>a{display:block;padding:5px 8px;border-radius:6px;text-decoration:none;color:var(--fg)}
.side li>a:hover{background:var(--chip-bg)}
.side li.sub>a{padding-left:20px;color:var(--muted);font-size:12px}
.main{flex:1;min-width:0;padding:24px 28px 80px}

.org{padding-top:6px;margin-bottom:36px;scroll-margin-top:12px}
.org+.org{border-top:1px solid var(--border);padding-top:28px}
.org-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:10px}
.org-head h2{margin:0;font-size:19px;letter-spacing:-0.01em}
.subtitle{margin:4px 0 0;color:var(--muted);font-size:12.5px}
.badges{display:flex;gap:6px;flex-wrap:wrap}
.badge{border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:11.5px;color:var(--muted)}
.badge-muted{opacity:.7}

.rankrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px}
.rankscope{font-size:11.5px;color:var(--muted);margin-right:2px}
.chip{background:var(--chip-bg);border-radius:999px;padding:2px 9px;font-size:11.5px}
.chip-top{background:color-mix(in oklab, var(--fg) 8%, var(--chip-bg));font-weight:600}

.tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:14px}
.tiles-2{grid-template-columns:repeat(2,1fr)}
@media(max-width:1000px){.tiles{grid-template-columns:repeat(2,1fr)}}
.tile{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px}
.tile-label{color:var(--muted);font-size:11.5px;display:flex;align-items:center;gap:5px}
.tile-val{font-size:20px;font-weight:600;letter-spacing:-0.02em;margin-top:4px;font-variant-numeric:tabular-nums}
.tile-val .unit{font-size:11px;font-weight:400;color:var(--muted);margin-left:2px}
.tile-sub{font-size:11.5px;color:var(--muted);margin-top:4px}

.cols2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
@media(max-width:900px){.cols2{grid-template-columns:1fr}}
.panel{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px}
.panel-row{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px;gap:8px}
.panel-label{font-weight:600}
.panel-right{color:var(--muted);font-variant-numeric:tabular-nums}
.panel-foot{font-size:11.5px;color:var(--muted);margin-top:4px}
.bar{height:9px;background:var(--barbg);border-radius:999px;overflow:hidden;margin-top:6px}
.bar-sm{height:6px}
.bar-fill{height:100%;border-radius:999px}
.bar-fill-muted{background:var(--muted)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fact{border:1px solid var(--border);border-radius:8px;padding:8px 10px}
.fact-label{font-size:11px;color:var(--muted)}
.fact-val{font-size:14px;font-weight:600;margin-top:2px;font-variant-numeric:tabular-nums}

.tier-people{margin-top:10px;font-size:12px}
.tier-people summary{cursor:pointer;color:var(--muted)}
table.mini{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
table.mini td{padding:3px 4px;border-top:1px solid var(--border)}

.subhead{font-size:13px;font-weight:600;margin:18px 0 8px}
.chartbox{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 8px}
.chart-val{font-size:9px;fill:var(--muted)}
.chart-lbl{font-size:10px;fill:var(--muted)}
.chart{display:block}

.tablewrap{overflow-x:auto;border:1px solid var(--border);border-radius:10px}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{text-align:left;color:var(--muted);font-weight:500;font-size:11.5px;padding:8px 10px;
  border-bottom:1px solid var(--border);white-space:nowrap}
th.right{text-align:right}
td{padding:7px 10px;border-bottom:1px solid var(--border);white-space:nowrap}
tr:last-child td{border-bottom:none}
.dot{display:inline-block;width:6px;height:6px;border-radius:999px;margin-right:6px}

@media print{.side{display:none}.main{padding:0}}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=DATA)
    ap.add_argument("--out", type=Path, default=None)
    a = ap.parse_args()

    index = json.loads((a.data / "index.json").read_text(encoding="utf-8"))
    team = json.loads((a.data / "team.json").read_text(encoding="utf-8"))

    sections = [render_org("s-team", team, "", is_first=True)]
    for dep in index["tree"]:
        d = json.loads((a.data / "dept" / f'{dep["key"]}.json').read_text(encoding="utf-8"))
        sub = f'{esc(d["parent"]["name"])}' + (f' · 단장 {esc(d["head"])}' if d.get("head") else "") \
              + f' · 센터 {len(d["children"])}개 · 지사 {n(d.get("branchCount"))}개'
        sections.append(render_org(f's-dept-{dep["key"]}', d, sub))
        for c in dep["centers"]:
            cd = json.loads((a.data / "center" / f'{c["key"]}.json').read_text(encoding="utf-8"))
            sub = f'{esc(cd["parent"]["name"])} · 센터장 {esc(cd.get("head") or "—")} ' \
                  f'· 지사 {len(cd["children"])}개 · 실적 설계사 {n(len(cd.get("people", [])))}명'
            sections.append(render_org(f's-center-{c["key"]}', cd, sub))

    sidebar = build_sidebar(index)
    generated_at = index.get("generatedAt", "")
    as_of = index.get("asOf", "")
    month = index.get("month", "")
    snapshots = index.get("snapshots", [])

    cover = f"""
    <div class="cover">
      <h1>{esc(team["name"])} · 매출 대시보드 — 오프라인 스냅샷</h1>
      <p>기준일 <b>{esc(as_of)}</b> ({esc(month)}) · 생성 {esc(generated_at[:16].replace('T',' '))} ·
        스냅샷 {len(snapshots)}개 반영</p>
      <div class="warn">
        이 파일은 <b>{esc(as_of)} 기준으로 고정된 스냅샷</b>입니다 — 열어도 새 데이터로 갱신되지 않습니다.
        최신판이 필요하면 <code>./refresh.sh</code> 뒤 다시 뽑으세요.<br>
        설계사 개인정보가 담겨 있습니다. 공유·전송 시 주의하세요.
      </div>
    </div>"""

    doc = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(team["name"])} 매출 대시보드 — {esc(as_of)} 오프라인 스냅샷</title>
<style>{STYLE}</style>
</head>
<body>
{cover}
<div class="layout">
  {sidebar}
  <main class="main">{"".join(sections)}</main>
</div>
</body>
</html>"""

    out_dir = a.out.parent if a.out else DEFAULT_OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = a.out or (out_dir / f"매출대시보드_오프라인_{as_of.replace('-', '')}.html")
    out_path.write_text(doc, encoding="utf-8")

    kb = out_path.stat().st_size / 1024
    print(f"✓ {out_path}  ({kb:,.0f} KB)")


if __name__ == "__main__":
    main()
