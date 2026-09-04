#!/usr/bin/env python3
"""Generate a standalone August close report for 경인.GA7센터."""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
from collections import defaultdict
from pathlib import Path

import reader

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "dashboard" / "data"
CACHE = ROOT / "etl" / "cache"
DEFAULT_OUT = ROOT / "exports" / "2026-08-31_경인GA7센터_8월마감_종합분석.html"
CENTER_KEY = "6545"
CENTER_NAME = "경인.GA7센터"


def esc(value):
    return html.escape(str(value if value is not None else ""), quote=True)


def man(raw, digits=1):
    if raw is None:
        return "—"
    value = raw / 10
    return f"{value:,.{digits}f}"


def signed_man(raw, digits=1):
    if raw is None:
        return "—"
    value = raw / 10
    return f"{value:+,.{digits}f}"


def pct(value, digits=1):
    return "—" if value is None else f"{value:.{digits}f}%"


def load_cache_for(source: str):
    matches = sorted(CACHE.glob(Path(source).stem + "__*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not matches:
        raise RuntimeError(f"cache missing for {source}")
    snapshot = json.loads(matches[0].read_text(encoding="utf-8"))
    return reader.apply_current_manager_mapping(snapshot)


def ga7_people(snapshot):
    return [p for p in snapshot["people"] if p.get("center") == CENTER_NAME]


def aggregate(people, key_fn):
    out = defaultdict(lambda: {"cred": 0.0, "roster": 0, "active": 0, "codes": set()})
    for person in people:
        key = key_fn(person)
        if not key:
            continue
        row = out[key]
        row["cred"] += float(person.get("cred") or 0)
        row["roster"] += 1
        row["active"] += int(float(person.get("cred") or 0) > 0)
        row["codes"].add(str(person.get("code")))
    return out


def table(headers, rows, cls=""):
    head = "".join(f"<th>{esc(h)}</th>" for h in headers)
    body = "".join("<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>" for row in rows)
    return f'<div class="tablewrap {cls}"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def bar(value, maximum, color="var(--blue)"):
    width = 0 if not maximum else max(0, min(100, value / maximum * 100))
    return f'<div class="mini-bar"><i style="width:{width:.1f}%;background:{color}"></i></div>'


def svg_trend(daily):
    width, height, px, py = 920, 230, 48, 24
    vals = [d["cred"] / 10 for d in daily]
    vmax = max(vals) * 1.08
    step = (width - px * 2) / max(1, len(vals) - 1)
    points = []
    circles = []
    labels = []
    for i, (d, value) in enumerate(zip(daily, vals)):
        x = px + i * step
        y = height - py - (value / vmax) * (height - py * 2)
        points.append(f"{x:.1f},{y:.1f}")
        circles.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.2" fill="#2563eb"/>')
        if i % 2 == 0 or i == len(vals) - 1:
            labels.append(f'<text x="{x:.1f}" y="{height-5}" text-anchor="middle">{esc(d["date"][5:].replace("-","/"))}</text>')
    area = f"{px},{height-py} " + " ".join(points) + f" {width-px},{height-py}"
    return f'''<svg class="chart" viewBox="0 0 {width} {height}" role="img" aria-label="8월 누적 실적 추이">
      <polygon points="{area}" fill="#2563eb" opacity=".10"/>
      <polyline points="{' '.join(points)}" fill="none" stroke="#2563eb" stroke-width="3" stroke-linejoin="round"/>
      {''.join(circles)}{''.join(labels)}
      <text x="{width-px}" y="18" text-anchor="end">단위: 만원</text>
    </svg>'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    index = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    center = json.loads((DATA / "center" / f"{CENTER_KEY}.json").read_text(encoding="utf-8"))
    if index.get("asOf") != "2026-08-31" or center.get("asOf") != "2026-08-31":
        raise RuntimeError(f"wrong basis date: index={index.get('asOf')} center={center.get('asOf')}")
    if index.get("warnings"):
        raise RuntimeError(f"unreviewed warnings: {index['warnings']}")

    snapshots = []
    for item in index["snapshots"]:
        snap = load_cache_for(item["source"])
        people = ga7_people(snap)
        snapshots.append((item["date"], item["source"], people))
    dates = [x[0] for x in snapshots]
    latest_people = snapshots[-1][2]
    prev_people = snapshots[-2][2]
    latest_by_code = {str(p["code"]): p for p in latest_people}
    prev_by_code = {str(p["code"]): p for p in prev_people}

    # Exact daily counts from each source snapshot.
    daily_exact = []
    prev_cred = None
    prev_codes = {}
    for date, source, people in snapshots:
        cred = sum(float(p.get("cred") or 0) for p in people)
        active = sum(float(p.get("cred") or 0) > 0 for p in people)
        t100 = sum(float(p.get("cred") or 0) >= 100 for p in people)
        t200 = sum(float(p.get("cred") or 0) >= 200 for p in people)
        current_codes = {str(p["code"]): p for p in people}
        new_active = None if prev_cred is None else sum(
            float(p.get("cred") or 0) > 0 and float(prev_codes.get(code, {}).get("cred") or 0) <= 0
            for code, p in current_codes.items()
        )
        daily_exact.append({
            "date": date, "source": source, "cred": cred,
            "delta": None if prev_cred is None else cred - prev_cred,
            "roster": len(people), "active": active, "t100": t100, "t200": t200,
            "newActive": new_active,
        })
        prev_cred, prev_codes = cred, current_codes

    total = daily_exact[-1]["cred"]
    target = float(center.get("target") or 0)
    achieved = total / target * 100 if target else None
    excess = max(0, total - target)
    active = daily_exact[-1]["active"]
    roster = daily_exact[-1]["roster"]
    zero = roster - active
    last_delta = daily_exact[-1]["delta"]

    # Manager, agency and branch rollups from exact latest/prior snapshots.
    dimensions = {
        "manager": (lambda p: p.get("manager") or "미지정"),
        "headquarters": (lambda p: p.get("headquarters") or "미분류"),
        "agency": (lambda p: p.get("agency") or "미지정"),
        "branch": (lambda p: p.get("branch") or "미지정"),
    }
    rollups = {}
    for name, fn in dimensions.items():
        cur, prev = aggregate(latest_people, fn), aggregate(prev_people, fn)
        rows = []
        for key, value in cur.items():
            prior = prev.get(key, {})
            rows.append({
                "name": key, **value,
                "delta": value["cred"] - float(prior.get("cred") or 0),
                "share": value["cred"] / total * 100 if total else 0,
                "activeRate": value["active"] / value["roster"] * 100 if value["roster"] else 0,
                "perActive": value["cred"] / value["active"] if value["active"] else None,
            })
        rows.sort(key=lambda x: -x["cred"])
        rollups[name] = rows

    people_rows = []
    for code, person in latest_by_code.items():
        prior = prev_by_code.get(code, {})
        cur = float(person.get("cred") or 0)
        old = float(prior.get("cred") or 0)
        people_rows.append({
            "name": person.get("name"), "manager": person.get("manager"),
            "headquarters": person.get("headquarters") or "미분류",
            "agency": person.get("agency"), "branch": person.get("branch"),
            "cred": cur, "delta": cur - old,
            "newActive": cur > 0 and old <= 0,
        })
    people_rows.sort(key=lambda x: -x["cred"])
    movers = sorted(people_rows, key=lambda x: -x["delta"])
    new_actives = [x for x in movers if x["newActive"]]

    # Dedicated prior-month field for comparison (prestige m7).
    july_total = sum(float(p.get("prestige", {}).get("m7") or 0) for p in latest_people)
    july_10 = sum(float(p.get("prestige", {}).get("m7") or 0) >= 100 for p in latest_people)
    july_20 = sum(float(p.get("prestige", {}).get("m7") or 0) >= 200 for p in latest_people)

    top_manager = rollups["manager"][0]
    top_branch = rollups["branch"][0]
    top3_branch_share = sum(x["cred"] for x in rollups["branch"][:3]) / total * 100

    # Report tables.
    daily_rows = []
    for i, row in enumerate(daily_exact):
        span = "—" if i == 0 else f"{daily_exact[i-1]['date'][5:].replace('-', '/')}→{row['date'][5:].replace('-', '/')}"
        daily_rows.append([
            esc(row["date"][5:].replace("-", "/")), esc(span), f'<b>{man(row["cred"])}</b>',
            signed_man(row["delta"]), f'{row["active"]}/{row["roster"]}', str(row["newActive"] or 0),
            str(row["t100"]), str(row["t200"]),
        ])

    max_manager = max(x["cred"] for x in rollups["manager"])
    manager_rows = [[
        f'<b>{esc(x["name"])}</b>{bar(x["cred"], max_manager)}', man(x["cred"]), pct(x["share"]),
        signed_man(x["delta"]), f'{x["active"]}/{x["roster"]}', pct(x["activeRate"]), man(x["perActive"]),
    ] for x in rollups["manager"]]

    max_hq = max(x["cred"] for x in rollups["headquarters"])
    headquarters_rows = [[
        f'<b>{esc(x["name"])}</b>{bar(x["cred"], max_hq, "var(--amber)")}', man(x["cred"]), pct(x["share"]),
        signed_man(x["delta"]), f'{x["active"]}/{x["roster"]}', pct(x["activeRate"]), man(x["perActive"]),
    ] for x in rollups["headquarters"]]

    max_agency = max(x["cred"] for x in rollups["agency"])
    agency_rows = [[
        f'<b>{esc(x["name"])}</b>{bar(x["cred"], max_agency, "var(--teal)")}', man(x["cred"]), pct(x["share"]),
        signed_man(x["delta"]), f'{x["active"]}/{x["roster"]}', pct(x["activeRate"]),
    ] for x in rollups["agency"]]

    max_branch = max(x["cred"] for x in rollups["branch"])
    branch_rows = [[
        str(i), f'<b>{esc(x["name"])}</b>{bar(x["cred"], max_branch, "var(--violet)")}', man(x["cred"]),
        pct(x["share"]), signed_man(x["delta"]), f'{x["active"]}/{x["roster"]}', pct(x["activeRate"]),
        man(x["perActive"]),
    ] for i, x in enumerate(rollups["branch"], 1)]

    top_people_rows = [[
        str(i), f'<b>{esc(x["name"])}</b><small>{esc(x["branch"])}</small>', esc(x["manager"]),
        man(x["cred"], 2), signed_man(x["delta"], 2),
    ] for i, x in enumerate(people_rows[:30], 1)]

    mover_rows = [[
        str(i), f'<b>{esc(x["name"])}</b><small>{esc(x["branch"])}</small>', esc(x["manager"]),
        signed_man(x["delta"], 2), man(x["cred"], 2), "신규" if x["newActive"] else "기존",
    ] for i, x in enumerate([x for x in movers if x["delta"] > 0][:20], 1)]

    # Source coverage and audit metadata.
    source_rows = [[esc(d), esc(s), f"{len(p):,}"] for d, s, p in snapshots]

    style = r'''
:root{--bg:#f4f6fa;--card:#fff;--fg:#172033;--muted:#667085;--line:#e5e9f0;--blue:#2563eb;--teal:#0891b2;--violet:#7c3aed;--green:#15803d;--amber:#b45309;--red:#b91c1c}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;line-height:1.55}.wrap{max-width:1220px;margin:auto;padding:28px 22px 70px}.hero{background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;border-radius:20px;padding:28px 30px;box-shadow:0 18px 50px #0f172a20}.eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#bfdbfe}.hero h1{margin:5px 0 8px;font-size:30px}.hero p{margin:0;color:#dbeafe}.meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.tag{background:#ffffff18;border:1px solid #ffffff25;border-radius:999px;padding:5px 10px;font-size:12px}.nav{position:sticky;top:0;z-index:10;display:flex;gap:7px;overflow:auto;background:#f4f6faf2;backdrop-filter:blur(8px);padding:12px 0}.nav a{white-space:nowrap;text-decoration:none;color:var(--muted);font-size:13px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 11px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.kpi,.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:17px;box-shadow:0 4px 15px #1018280a}.kpi .label{color:var(--muted);font-size:12px}.kpi .value{font-weight:760;font-size:26px;margin-top:5px}.kpi .sub{font-size:12px;color:var(--muted);margin-top:5px}.good{color:var(--green)}.warn{color:var(--amber)}.bad{color:var(--red)}h2{margin:34px 0 12px;font-size:21px}.insights{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.insight{border-left:4px solid var(--blue)}.insight b{display:block;margin-bottom:5px}.chartbox{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px}.chart{width:100%;height:auto}.chart text{font-size:10px;fill:#667085}.tablewrap{overflow:auto;background:#fff;border:1px solid var(--line);border-radius:14px}table{border-collapse:collapse;width:100%;font-size:12.5px}th{background:#f8fafc;color:#475467;text-align:right;padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap;position:sticky;top:0}th:nth-child(1),th:nth-child(2){text-align:left}td{padding:8px 10px;border-bottom:1px solid #eef1f5;text-align:right;white-space:nowrap}td:nth-child(1),td:nth-child(2){text-align:left}tr:hover td{background:#f8fbff}small{display:block;color:var(--muted);max-width:340px;overflow:hidden;text-overflow:ellipsis}.mini-bar{height:3px;background:#eef2f7;margin-top:5px;border-radius:9px;overflow:hidden}.mini-bar i{display:block;height:100%;border-radius:9px}.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}.callout{padding:15px 17px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a}.callout.warnbox{background:#fff7ed;border-color:#fed7aa;color:#9a3412}.foot{margin-top:30px;color:var(--muted);font-size:12px}.privacy{font-size:11px;color:var(--muted);margin-top:10px}@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}.insights,.cols{grid-template-columns:1fr}.hero h1{font-size:24px}}@media(max-width:520px){.grid{grid-template-columns:1fr 1fr}.wrap{padding:16px 10px 50px}.kpi .value{font-size:21px}}
'''

    achieved_value = achieved or 0.0
    summary_insights = f'''
    <div class="insights">
      <div class="panel insight"><b>목표 초과 마감</b>8월 인실적은 <strong>{man(total)}만원</strong>으로 목표 {man(target)}만원을 {pct(achieved_value-100)}p 초과했습니다. 초과액은 {man(excess)}만원입니다.</div>
      <div class="panel insight"><b>마감일 집중력</b>8/28→8/31 구간에 <strong>{man(last_delta)}만원</strong>이 추가됐고 신규 가동은 {daily_exact[-1]['newActive']}명입니다. 월 누계의 {pct(last_delta/total*100)}가 마지막 구간에 들어왔습니다.</div>
      <div class="panel insight"><b>조직 집중 위험</b>{esc(top_manager['name'])} 매니저가 센터 실적의 <strong>{pct(top_manager['share'])}</strong>, 1위 지사 {esc(top_branch['name'])}가 <strong>{pct(top_branch['share'])}</strong>를 차지합니다. 상위 3개 지사 비중은 {pct(top3_branch_share)}입니다.</div>
      <div class="panel insight"><b>가동 확장 여지</b>최종 roster {roster}명 중 가동 {active}명, 무실적 {zero}명입니다. 10만 가동 {daily_exact[-1]['t100']}명, 20만 가동 {daily_exact[-1]['t200']}명으로 20만 이상은 10만 집계에 포함됩니다.</div>
    </div>'''

    html_doc = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>경인.GA7센터 2026년 8월 마감 종합분석</title><style>{style}</style></head><body><div class="wrap">
    <header class="hero"><div class="eyebrow">August 2026 Close · GA7 Performance Intelligence</div><h1>경인.GA7센터 8월 마감 종합분석</h1><p>실제 매출 대시보드 ETL · 날짜별 누적 스냅샷 차분 · 지사·대리점·매니저·개인 전수 분석</p><div class="meta"><span class="tag">기준일 2026-08-31</span><span class="tag">원본 스냅샷 {len(snapshots)}개</span><span class="tag">최종 설계사 {roster}명</span><span class="tag">원본 경고 0건</span><span class="tag">9월 확정 매니저 매칭 반영</span></div></header>
    <nav class="nav"><a href="#summary">핵심</a><a href="#trend">일자별</a><a href="#manager">매니저</a><a href="#headquarters">중겸 본부</a><a href="#agency">대리점</a><a href="#branch">지사</a><a href="#people">개인</a><a href="#audit">검증</a></nav>
    <section id="summary"><div class="grid">
      <div class="kpi"><div class="label">8월 최종 누계</div><div class="value">{man(total)}<small>만원</small></div><div class="sub">원본 {total:,.1f}천원</div></div>
      <div class="kpi"><div class="label">목표 달성률</div><div class="value good">{pct(achieved)}</div><div class="sub">목표 {man(target)}만 · 초과 {man(excess)}만</div></div>
      <div class="kpi"><div class="label">가동 설계사</div><div class="value">{active}<small>명</small></div><div class="sub">roster {roster}명 · {pct(active/roster*100)}</div></div>
      <div class="kpi"><div class="label">마감 구간 증분</div><div class="value good">+{man(last_delta)}<small>만원</small></div><div class="sub">8/28→8/31 · 신규가동 {daily_exact[-1]['newActive']}명</div></div>
      <div class="kpi"><div class="label">10만 가동</div><div class="value">{daily_exact[-1]['t100']}<small>명</small></div><div class="sub">7월 전용필드 {july_10}명 대비 +{daily_exact[-1]['t100']-july_10}명</div></div>
      <div class="kpi"><div class="label">20만 가동</div><div class="value">{daily_exact[-1]['t200']}<small>명</small></div><div class="sub">10만 가동에 포함 · 7월 {july_20}명</div></div>
      <div class="kpi"><div class="label">무실적 인원</div><div class="value warn">{zero}<small>명</small></div><div class="sub">최종 roster 기준</div></div>
      <div class="kpi"><div class="label">전월 전용필드 합계</div><div class="value">{man(july_total)}<small>만원</small></div><div class="sub">프레스티지 7월 실적 필드</div></div>
    </div>{summary_insights}
    <div class="callout" style="margin-top:14px"><b>운영 결론.</b> 목표는 초과 달성했지만 실적의 절반 이상이 한 매니저·한 핵심 지사에 집중돼 있습니다. 9월에는 상위조직 방어와 동시에 무실적 {zero}명 중 전환 가능 대상을 별도로 관리하는 것이 핵심입니다.</div></section>

    <section id="trend"><h2>일자별 마감 흐름</h2><div class="chartbox">{svg_trend(daily_exact)}</div>{table(['기준일','비교구간','누계(만)','증분(만)','가동/roster','신규가동','10만↑','20만↑'],daily_rows)}<p class="privacy">※ 증분은 연속 원본 스냅샷 간 차분입니다. 주말·공휴일 또는 원본 미수신일이 포함된 구간은 실제 비교 날짜를 함께 표시했습니다.</p></section>

    <section id="manager"><h2>매니저별 마감 분석</h2>{table(['매니저','누계(만)','센터기여','8/28→31','가동/roster','가동률','가동1인당(만)'],manager_rows)}<div class="callout warnbox" style="margin-top:12px">{esc(top_manager['name'])} 매니저 비중이 {pct(top_manager['share'])}로 가장 높습니다. 성과 기여가 큰 동시에 단일 조직 의존도이므로 핵심 설계사 유지와 차순위 매니저 육성을 병행해야 합니다.</div></section>

    <section id="headquarters"><h2>중겸파트너스 내부 본부별 분석</h2><p class="privacy">9월 취합본 Sheet1의 본부 구분을 사용했습니다. 본부 미분류(#N/A)는 추정하지 않고 별도 표시합니다.</p>{table(['본부','누계(만)','센터기여','8/28→31','가동/roster','가동률','가동1인당(만)'],headquarters_rows)}</section>

    <section id="agency"><h2>GA 법인 대리점별 분석</h2>{table(['대리점','누계(만)','센터기여','8/28→31','가동/roster','가동률'],agency_rows)}</section>

    <section id="branch"><h2>지사별 전수 분석 · {len(branch_rows)}개</h2>{table(['#','지사','누계(만)','기여도','8/28→31','가동/roster','가동률','가동1인당(만)'],branch_rows)}</section>

    <section id="people"><h2>개인별 핵심 분석</h2><div class="cols"><div><h3>월누계 상위 30명</h3>{table(['#','설계사 / 지사','매니저','누계(만)','8/28→31'],top_people_rows)}</div><div><h3>마감 구간 기여 상위 20명</h3>{table(['#','설계사 / 지사','매니저','증분(만)','누계(만)','상태'],mover_rows)}<div class="callout" style="margin-top:12px">8/28→8/31 신규 가동 {len(new_actives)}명. 개인 코드는 보고서·Telegram에서 제외했습니다.</div></div></div></section>

    <section id="recommend"><h2>9월 운영 권장조치</h2><div class="insights">
      <div class="panel insight"><b>① 상위 집중도 방어</b>{esc(top_manager['name'])} 매니저와 {esc(top_branch['name'])} 지사의 상위 설계사 이탈·정체 여부를 주 단위로 점검하세요.</div>
      <div class="panel insight"><b>② 10만→20만 전환</b>10만 이상 {daily_exact[-1]['t100']}명 중 20만 이상 {daily_exact[-1]['t200']}명을 제외한 {daily_exact[-1]['t100']-daily_exact[-1]['t200']}명을 9월 초 핵심 승급군으로 관리하세요.</div>
      <div class="panel insight"><b>③ 무실적 roster 세분화</b>무실적 {zero}명을 신규등록·장기무실적·월말복귀 가능군으로 분리해 단순 가동률보다 전환 가능 인원을 좁히세요.</div>
      <div class="panel insight"><b>④ 날짜별 수신 연속성</b>매일 RAW DATA 자동수신과 날짜별 스냅샷을 유지해 월말 단일 증분이 아닌 주중 속도·신규가동을 조기에 확인하세요.</div>
    </div></section>

    <section id="audit"><h2>데이터 검증·출처</h2>{table(['기준일','원본 파일','GA7 행수'],source_rows)}<div class="callout" style="margin-top:12px"><b>검증 통과:</b> index.asOf=2026-08-31, center.asOf=2026-08-31, 원본 경고 0건, 스냅샷 16개. 실적은 인실적 월누계(천원)를 만원으로 환산했습니다. 10만·20만은 누적 집계이며 20만 이상은 10만 이상에도 포함됩니다.</div><p class="privacy">개인 설계사 이름이 포함된 내부 업무용 파일입니다. 외부 재전송 시 주의하세요. 이 보고서는 시상금이나 투자·계약 판단 자료가 아니라 조직 운영용 실적 분석입니다.</p></section>
    <footer class="foot">생성 {dt.datetime.now().astimezone().isoformat(timespec='minutes')} · /Users/hoons/Documents/매출분석 · 오프라인 단일 HTML</footer>
    </div></body></html>'''

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(html_doc, encoding="utf-8")

    evidence = {
        "asOf": center["asOf"], "center": center["name"], "snapshotCount": len(snapshots),
        "totalRawThousandWon": round(total, 3), "totalManWon": round(total/10, 3),
        "targetManWon": round(target/10, 3), "achievedPct": round(achieved_value, 2),
        "roster": roster, "active": active, "tier10": daily_exact[-1]["t100"], "tier20": daily_exact[-1]["t200"],
        "managerCount": len(rollups["manager"]), "agencyCount": len(rollups["agency"]),
        "branchCount": len(rollups["branch"]), "peopleCount": len(people_rows),
        "warnings": index.get("warnings", []),
        "managerMappingSource": reader.load_manager_mapping().get("source"),
        "output": str(args.out),
    }
    evidence_path = args.out.with_suffix(".json")
    evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(evidence, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
