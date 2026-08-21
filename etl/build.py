"""스냅샷 → 팀 / 영업단 / 센터 3단 계층 JSON 생성.

핵심 아이디어
-------------
원본은 "월 누적 스냅샷"이다. 일간 매출은 파일에 없고 연속된 두 스냅샷의
차분으로만 만들어진다.  일간(D) = 누적(D) − 누적(D−1)

조직 계층
---------
    팀(본부)  →  영업단(부서)  →  센터(지점)  →  지사  →  설계사
    수도권2팀      7개              30개          2,026개   12,366명

각 층은 같은 모양의 레코드로 만들어서 화면 컴포넌트를 그대로 재사용한다.
자식 목록(children)과 대리점 롤업(agencies)이 층마다 붙는다.

지표
----
  실적(cred) : '인실적'. 매출의 유일한 기준. 단위 천원
  달성률     : 실적 ÷ 목표. 목표가 있는 조직만
  인당생산성 : 실적 ÷ 재적 — 목표가 없어도 규모 보정 비교가 되는 잣대
  모멘텀     : 최근 3일 속도 ÷ 이전 3일 속도
  z          : 동료 집단 안에서의 로버스트 편차 (stats.py)

출력
----
  data/index.json        조직 트리 + 메타
  data/team.json         팀
  data/dept/{코드}.json  영업단
  data/center/{코드}.json 센터
"""
from __future__ import annotations

import argparse
import datetime
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import reader   # noqa: E402
import schema   # noqa: E402
import stats    # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEFAULT_SRC = Path("/Users/hoons/Documents/RAW DATA")
DEFAULT_OUT = ROOT / "dashboard" / "data"
TARGETS_FILE = HERE / "targets.json"

FOCUS_CENTER = "경인.GA7센터"

# 실적 구간 코호트. 원본 단위가 천원이라 100 = 10만원.
TIERS = [(100, "10만 가동"), (200, "20만 가동")]


def r(x, n=1):
    return None if x is None else round(x, n)


def load_targets(month: str):
    """센터별 목표 묶음 + 영업단장 이름.

    값이 숫자면 매출목표만 있던 옛 포맷이므로 그대로 감싸서 받는다.
    """
    if not TARGETS_FILE.exists():
        return {}, {}
    raw = json.loads(TARGETS_FILE.read_text(encoding="utf-8"))
    mon = raw.get("months", {}).get(month, {})
    out = {}
    for name, v in mon.get("centers", {}).items():
        out[name] = {"revenue": v, "prev10man": 0, "target20man": 0, "head": None} \
            if isinstance(v, (int, float)) else v
    return out, mon.get("deptHeads", {})


def attach_ranks(units):
    """자식 목록에 지표별 순위를 매긴다. 표·배지 어디서든 바로 쓴다."""
    n = {}
    for f in ("cred", "achievedPct", "perCapita", "activeRate", "momentum"):
        n[f] = rank_by(units, f)
    return n


def my_rank(units, key, field):
    """이 조직이 형제들 사이에서 몇 위인지."""
    me = next((u for u in units if u["key"] == key), None)
    if not me or me.get(f"{field}Rank") is None:
        return None
    total = sum(1 for u in units if u.get(field) is not None)
    return {"rank": me[f"{field}Rank"], "of": total, "value": me[field]}


def rank_by(units, field, reverse=True):
    """공동 순위를 인정하는 순위 매김. 값이 없으면 순위도 없다.

    동점은 같은 순위를 받고 그만큼 다음 순위를 건너뛴다(1·2·2·4).
    분모는 값이 있는 **조직 수**다. 서로 다른 값의 가짓수를 세면
    동점이 하나만 생겨도 '5/6위' 처럼 분모가 줄어 실제보다 작아 보인다.
    """
    scored = [u for u in units if u.get(field) is not None]
    order = sorted({u[field] for u in scored}, reverse=reverse)
    seen, pos = 0, {}
    for v in order:
        pos[v] = seen + 1
        seen += sum(1 for u in scored if u[field] == v)
    for u in units:
        u[f"{field}Rank"] = pos.get(u.get(field))
    return len(scored)


# ===========================================================================
# 집계 헬퍼
# ===========================================================================
def daily_rows(per_date, dates, keep):
    """주어진 필터(keep)를 통과한 사람들만으로 일간 시계열을 만든다."""
    out, prev, prev_d = [], None, None
    for i, d in enumerate(dates):
        cur = {k: p for k, p in per_date[i].items() if keep(p)}
        cred = sum(p["cred"] for p in cur.values())
        active = sum(1 for p in cur.values() if p["cred"] > 0)
        if prev is None:
            d_cred = new_active = span = None
        else:
            d_cred = cred - sum(p["cred"] for p in prev.values())
            new_active = sum(1 for k, p in cur.items()
                             if p["cred"] > 0 and (k not in prev or prev[k]["cred"] <= 0))
            span = (datetime.date.fromisoformat(d) - datetime.date.fromisoformat(prev_d)).days
        out.append({
            "date": d, "cred": r(cred), "dCred": r(d_cred), "spanDays": span,
            "roster": len(cur), "active": active, "newActive": new_active,
        })
        prev, prev_d = cur, d
    return out


def rollup(per_date, dates, keep, group, headcount_map, targets=None):
    """자식 조직 단위 롤업 + 각 자식의 일별 누적 시계열."""
    series = defaultdict(dict)
    for i, d in enumerate(dates):
        agg = defaultdict(lambda: [0.0, 0, 0])
        for p in per_date[i].values():
            if not keep(p):
                continue
            g = group(p)
            if g is None:
                continue
            a = agg[g]
            a[0] += p["cred"]
            a[1] += 1
            a[2] += 1 if p["cred"] > 0 else 0
        for g, v in agg.items():
            series[g][d] = v

    units = []
    for g, ser in series.items():
        key, name = g if isinstance(g, tuple) else (g, g)
        cur = ser.get(dates[-1], [0.0, 0, 0])
        prev = ser.get(dates[-2], [0.0, 0, 0]) if len(dates) > 1 else [0.0, 0, 0]
        hc = headcount_map.get(key, 0)
        tgt = (targets or {}).get(key)
        units.append({
            "key": str(key), "name": name,
            "cred": r(cur[0]), "dCred": r(cur[0] - prev[0]),
            "roster": cur[1], "active": cur[2], "headcount": hc,
            "target": tgt,
            "achievedPct": r(cur[0] / tgt * 100, 1) if tgt else None,
            "activeRate": r(cur[2] / hc * 100, 1) if hc else None,
            "perCapita": r(cur[0] / hc, 2) if hc else None,
            "perActive": r(cur[0] / cur[2], 1) if cur[2] else None,
            "series": [{"date": d, "cred": r(ser.get(d, [0, 0, 0])[0])} for d in dates],
        })
    return units


def add_stats(units, dates):
    """동료 집단 안에서의 위치와 궤도 이탈 판정을 붙인다."""
    # 모멘텀: 각 자식의 누적 시계열에서 일간 속도를 되살려 계산
    for u in units:
        s = u["series"]
        dl = []
        for i in range(1, len(s)):
            span = (datetime.date.fromisoformat(s[i]["date"])
                    - datetime.date.fromisoformat(s[i - 1]["date"])).days
            dl.append({"dCred": s[i]["cred"] - s[i - 1]["cred"], "spanDays": span})
        u["momentum"] = r(stats.momentum(dl), 2)

    # 비교 잣대: 목표가 모두 있으면 달성률, 아니면 인당생산성
    has_target = all(u["achievedPct"] is not None for u in units) and len(units) > 2
    field = "achievedPct" if has_target else "perCapita"
    vals = [u[field] for u in units if u[field] is not None]
    med = stats.median(vals)
    scale = stats.mad(vals, med)
    for u in units:
        u["z"] = r(stats.robust_z(u[field], vals, med, scale), 2)
    return {
        "field": field,
        "label": "달성률" if has_target else "인당생산성",
        "band": stats.band(vals),
    }


def agency_rollup(per_date, dates, keep, top=15):
    """운영 대리점(GA 법인) 단위 롤업 — 팀·영업단 화면의 '큰 류'."""
    last, prev = per_date[-1], (per_date[-2] if len(dates) > 1 else {})
    agg = defaultdict(lambda: [0.0, 0.0, 0, set(), set()])
    for p in last.values():
        if not keep(p):
            continue
        a = agg[p["agency"]]
        a[0] += p["cred"]
        a[2] += 1 if p["cred"] > 0 else 0
        a[3].add(p["center"])
        a[4].add(p["branchCode"] or p["branch"])
    for p in prev.values():
        if keep(p) and p["agency"] in agg:
            agg[p["agency"]][1] += p["cred"]
    tot = sum(v[0] for v in agg.values()) or 1
    rows = [{
        "name": k, "cred": r(v[0]), "dCred": r(v[0] - v[1]),
        "active": v[2], "centers": len(v[3]), "branches": len(v[4]),
        "share": r(v[0] / tot * 100, 1),
    } for k, v in agg.items()]
    rows.sort(key=lambda x: -x["cred"])
    return rows[:top], len(rows), stats.concentration([v[0] for v in agg.values()])


def week_windows(latest, month):
    """주차별 날짜 구간을 원본 시상 헤더에서 읽는다.

    '1주차(인)' 항목의 실적 컬럼 헤더가 '8.1~9일' 처럼 구간을 그대로 담고 있다.
    주차 경계가 매달 다르고 균등하지도 않아서(8월은 9일·8일·6일) 계산으로
    맞히려 하지 않고 파일이 말하는 값을 쓴다.
    """
    y, mo = int(month[:4]), int(month[5:7])
    found = {}
    for a in latest.get("awardDefs", []):
        m = re.match(r"(\d+)주차", str(a["label"]))
        w = a.get("window")
        if not m or not w or int(m[1]) in found:
            continue
        g = re.match(r"(\d+)\.(\d+)\s*~\s*(?:(\d+)\.)?(\d+)", w)
        if not g:
            continue
        m1, d1, m2, d2 = int(g[1]), int(g[2]), int(g[3] or g[1]), int(g[4])
        if m1 != mo:
            continue
        found[int(m[1])] = (datetime.date(y, m1, d1), datetime.date(y, m2, d2))
    return found


def week_rows(latest, keep, windows, as_of):
    """주차별 실적 + 그 주차의 영업일 진척."""
    rows = [p for p in latest["people"] if keep(p)]
    today = datetime.date.fromisoformat(as_of)
    out = []
    for w in range(5):
        span = windows.get(w + 1)
        total = biz = None
        state = "none"
        if span:
            lo, hi = span
            total = stats.business_days(lo, hi)
            if today > hi:
                biz, state = total, "done"
            elif today >= lo:
                # 스냅샷은 전일 마감 기준이라 today 하루 전까지가 반영분이다.
                biz = stats.business_days(lo, today - datetime.timedelta(days=1))
                state = "running"
            else:
                biz, state = 0, "upcoming"
        cred = sum(p["weeks"][w] for p in rows)
        out.append({
            "week": w + 1, "label": f"{w+1}주차",
            "cred": r(cred),
            "people": sum(1 for p in rows if p["weeks"][w] > 0),
            "from": span[0].isoformat() if span else None,
            "to": span[1].isoformat() if span else None,
            "bizDays": biz, "totalBizDays": total, "state": state,
        })
    return out


def week_pace(weeks):
    """진행 중인 주차가 앞선 주차 대비 어느 정도 속도인지.

    비교 잣대는 '영업일당 실적'이다. 주차마다 영업일 수가 달라서(9일·8일·6일)
    주차 총액을 그대로 비교하면 짧은 주차가 무조건 나빠 보인다.
    """
    done = [w for w in weeks if w["state"] == "done" and w["totalBizDays"]]
    cur = next((w for w in weeks if w["state"] == "running"), None)
    if not done:
        return None

    rates = [w["cred"] / w["totalBizDays"] for w in done]
    base = sum(rates) / len(rates)
    prev_rate = rates[-1]

    out = {
        "done": [{"week": w["week"], "cred": r(w["cred"]),
                  "bizDays": w["totalBizDays"],
                  "perDay": r(w["cred"] / w["totalBizDays"])} for w in done],
        "baselinePerDay": r(base),
        "prevPerDay": r(prev_rate),
        "current": None,
    }
    if cur and cur["bizDays"]:
        expected_now = base * cur["bizDays"]
        out["current"] = {
            "week": cur["week"],
            "cred": r(cur["cred"]),
            "bizDays": cur["bizDays"],
            "totalBizDays": cur["totalBizDays"],
            "perDay": r(cur["cred"] / cur["bizDays"]),
            "expectedNow": r(expected_now),
            "expectedFull": r(base * cur["totalBizDays"]) if cur["totalBizDays"] else None,
            "projected": r(cur["cred"] / cur["bizDays"] * cur["totalBizDays"])
            if cur["totalBizDays"] else None,
            "paceRatio": r(cur["cred"] / expected_now, 3) if expected_now else None,
        }
    return out


def tier_cohorts(latest, keep, goal=None, limit=1000):
    """실적 구간별 대상자. 10만/20만 가동은 현장에서 바로 쓰는 관리 단위다.

    goal 이 있으면 10만은 **전월 실적** 대비, 20만은 **이번 달 목표** 대비로 보여준다.
    (원본이 10만은 전월 실적만, 20만은 목표만 주기 때문에 비교 대상이 다르다.)
    """
    rows = sorted((p for p in latest["people"] if keep(p)), key=lambda p: -p["cred"])
    out = []
    for thr, label in TIERS:
        hit = [p for p in rows if p["cred"] >= thr]
        ref = None
        if goal:
            if thr == 100 and goal.get("prev10man"):
                ref = {"kind": "prev", "label": "전월", "value": goal["prev10man"]}
            elif thr == 200 and goal.get("target20man"):
                ref = {"kind": "target", "label": "목표", "value": goal["target20man"]}
        out.append({
            "key": f"t{thr}", "label": label, "threshold": thr,
            "count": len(hit),
            "ref": ref,
            "refPct": r(len(hit) / ref["value"] * 100, 1) if ref and ref["value"] else None,
            "cred": r(sum(p["cred"] for p in hit)),
            "people": [{
                "name": p["name"], "cred": r(p["cred"], 3),
                "center": p["center"], "branch": p["branch"],
                "manager": p["manager"],
            } for p in hit[:limit]],
            "truncated": max(0, len(hit) - limit),
        })
    return out


def top_branches(per_date, dates, keep, hc_branch, top=15):
    """지사 단위 상위 목록 — 영업단·센터 화면."""
    last, prev = per_date[-1], (per_date[-2] if len(dates) > 1 else {})
    agg = defaultdict(lambda: [0.0, 0.0, 0, 0, "", "", ""])
    for p in last.values():
        if not keep(p):
            continue
        k = p["branchCode"] or p["branch"]
        a = agg[k]
        a[0] += p["cred"]
        a[2] += 1 if p["cred"] > 0 else 0
        a[3] += 1
        a[4], a[5], a[6] = p["branch"], p["agency"], p["center"]
    for p in prev.values():
        if keep(p):
            k = p["branchCode"] or p["branch"]
            if k in agg:
                agg[k][1] += p["cred"]
    rows = [{
        "key": str(k), "name": v[4], "agency": v[5], "center": v[6],
        "cred": r(v[0]), "dCred": r(v[0] - v[1]),
        "active": v[2], "roster": v[3], "headcount": hc_branch.get(k, 0),
        "activeRate": r(v[2] / hc_branch[k] * 100, 1) if hc_branch.get(k) else None,
    } for k, v in agg.items()]
    rows.sort(key=lambda x: -x["cred"])
    return rows[:top], len(rows)


# ===========================================================================
# 센터 상세 (지사 · 설계사 · 시상)
# ===========================================================================
def center_detail(snaps, dates, per_date, center, hc_branch, branch_meta):
    latest = snaps[-1]
    award_defs = latest.get("awardDefs", [])
    award_label = {a["key"]: a["label"] for a in award_defs}
    rows = [p for p in latest["people"] if p["center"] == center]
    last = {k: p for k, p in per_date[-1].items() if p["center"] == center}
    prev = {k: p for k, p in per_date[-2].items() if p["center"] == center} if len(dates) > 1 else {}

    people = []
    for k, p in last.items():
        pv = prev.get(k)
        items = sorted(({"label": award_label.get(ak, ak), "money": a["money"]}
                        for ak, a in p["awards"].items() if a["money"] > 0),
                       key=lambda x: -x["money"])
        ser = []
        for i, d in enumerate(dates):
            q = per_date[i].get(k)
            ser.append({"date": d, "cred": q["cred"] if q else 0.0})
        people.append({
            "code": p["code"], "name": p["name"], "branch": p["branch"],
            "agency": p["agency"], "manager": p["manager"],
            "cred": p["cred"], "weeks": p["weeks"],
            "dCred": r(p["cred"] - (pv["cred"] if pv else 0.0), 3),
            "awardMoney": r(sum(a["money"] for a in items), 0),
            "awardItems": items, "series": ser,
        })
    people.sort(key=lambda x: -x["cred"])
    for i, p in enumerate(people):
        p["rank"] = i + 1

    awards = []
    for adef in award_defs:
        key, label = adef["key"], adef["label"]
        paid = [p["awards"][key]["perf"] for p in latest["people"]
                if key in p["awards"] and p["awards"][key]["money"] > 0]
        th = min(paid) if paid else None
        elig = [p for p in rows if key in p["awards"]]
        if not elig:
            continue
        done = [p for p in elig if p["awards"][key]["money"] > 0]
        near = []
        if th:
            for p in elig:
                a = p["awards"][key]
                if a["money"] > 0:
                    continue
                gap = th - a["perf"]
                if 0 < gap <= th * 0.5:
                    near.append({"name": p["name"], "branch": p["branch"],
                                 "manager": p["manager"], "perf": a["perf"], "gap": r(gap, 3)})
            near.sort(key=lambda x: x["gap"])
        awards.append({
            "key": key, "label": label, "window": adef.get("window"),
            "eligible": len(elig), "achieved": len(done),
            "rate": r(len(done) / len(elig) * 100, 1), "threshold": th, "near": near[:20],
        })
    awards.sort(key=lambda a: (-a["achieved"], -len(a["near"])))

    mgr = defaultdict(lambda: {"cred": 0.0, "dCred": 0.0, "roster": 0, "active": 0, "b": set()})
    for p in people:
        m = mgr[p["manager"] or "미지정"]
        m["cred"] += p["cred"]; m["dCred"] += p["dCred"]; m["roster"] += 1
        m["active"] += 1 if p["cred"] > 0 else 0
        m["b"].add(p["branch"])
    managers = sorted(({
        "manager": k, "cred": r(v["cred"]), "dCred": r(v["dCred"]),
        "roster": v["roster"], "active": v["active"], "branches": len(v["b"]),
        "activeRate": r(v["active"] / v["roster"] * 100, 1) if v["roster"] else 0,
    } for k, v in mgr.items()), key=lambda x: -x["cred"])

    return people, awards, managers


# ===========================================================================
# 메인
# ===========================================================================
def build(src: Path, out: Path):
    files = reader.discover(src)
    if not files:
        raise SystemExit(f"스냅샷 파일을 찾지 못했습니다: {src}")

    snaps = []
    for p in files:
        s = reader.load_snapshot(p, HERE / "cache")
        if not s["asOf"]:
            print(f"  ! 기준일 없음, 건너뜀: {p.name}")
            continue
        snaps.append(s)
        print(f"  · {s['asOf']}  {p.name}  ({len(s['people']):,}행)")
    dedup = {s["asOf"]: s for s in sorted(snaps, key=lambda x: x["asOf"])}
    snaps = [dedup[k] for k in sorted(dedup)]
    dates = [s["asOf"] for s in snaps]
    latest = snaps[-1]

    targets, dept_heads = load_targets(dates[-1][:7])
    print(f"  · 목표 {len(targets)}개 지점 로드 ({dates[-1][:7]})" if targets
          else f"  ! {dates[-1][:7]} 목표 없음 — 인당생산성으로 비교")

    # 재적 인원 (지사 시트) --------------------------------------------------
    hc_branch, hc_center, hc_dept, branch_meta = {}, defaultdict(int), defaultdict(int), {}
    team = latest["people"][0]["hq"]
    for s in reversed(snaps):
        if not s["branches"]:
            continue
        for b in s["branches"]:
            if b["hq"] != team:
                continue
            k = b["branchCode"] or b["branch"]
            hc_branch[k] = b["headcount"]
            branch_meta[k] = b
            hc_center[str(b["centerCode"])] += b["headcount"]
            hc_dept[str(b["deptCode"])] += b["headcount"]
        break

    per_date = [{(p["code"] or p["name"]): p for p in s["people"]} for s in snaps]
    ALL = lambda p: True  # noqa: E731

    # 조직 트리 --------------------------------------------------------------
    dept_of, center_of = {}, {}
    for p in latest["people"]:
        dept_of[str(p["deptCode"])] = p["dept"]
        center_of[str(p["centerCode"])] = (p["center"], str(p["deptCode"]), p["centerHead"])

    # 센터 코드 → 목표 묶음. 상위 조직은 소속 센터를 전부 갖췄을 때만 합산한다.
    goal_center = {code: targets[nm] for code, (nm, _dc, _h) in center_of.items()
                   if nm in targets}
    tgt_center = {c: g["revenue"] for c, g in goal_center.items()}

    goal_dept, tgt_dept = {}, {}
    for dc in dept_of:
        cs = [c for c, (_n, d, _h) in center_of.items() if d == dc]
        if not cs or not all(c in goal_center for c in cs):
            continue
        goal_dept[dc] = {k: sum(goal_center[c][k] for c in cs)
                         for k in ("revenue", "prev10man", "target20man")}
        tgt_dept[dc] = goal_dept[dc]["revenue"]

    goal_team = ({k: sum(g[k] for g in goal_dept.values())
                  for k in ("revenue", "prev10man", "target20man")}
                 if len(goal_dept) == len(dept_of) else None)

    out.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(out / "dept", ignore_errors=True)
    shutil.rmtree(out / "center", ignore_errors=True)
    (out / "dept").mkdir(parents=True, exist_ok=True)
    (out / "center").mkdir(parents=True, exist_ok=True)

    windows = week_windows(latest, dates[-1][:7])
    if not windows:
        print("  ! 주차 구간을 헤더에서 못 읽었습니다 — 주차 분석 생략")

    # ---------------------------------------------------------------- 팀 ---
    t_daily = daily_rows(per_date, dates, ALL)
    depts = rollup(per_date, dates, ALL,
                   lambda p: (str(p["deptCode"]), p["dept"]), hc_dept, tgt_dept)
    d_meta = add_stats(depts, dates)
    for u in depts:
        u["href"] = f"/dept/{u['key']}"
        u["centers"] = sum(1 for c, (_n, dc, _h) in center_of.items() if dc == u["key"])
        u["head"] = dept_heads.get(u["name"])
    attach_ranks(depts)
    depts.sort(key=lambda x: -x["cred"])

    all_centers = rollup(per_date, dates, ALL,
                         lambda p: (str(p["centerCode"]), p["center"]), hc_center, tgt_center)
    add_stats(all_centers, dates)
    attach_ranks(all_centers)

    ag_rows, ag_n, ag_conc = agency_rollup(per_date, dates, ALL)
    t_weeks = week_rows(latest, ALL, windows, dates[-1])
    team_tgt = sum(tgt_dept.values()) if len(tgt_dept) == len(dept_of) else None

    team_payload = {
        "level": "team", "name": team, "asOf": dates[-1], "dates": dates,
        "target": team_tgt, "headcount": sum(hc_dept.values()),
        "daily": t_daily, "children": depts, "childLabel": "영업단",
        "compare": d_meta, "agencies": ag_rows, "agencyCount": ag_n,
        "agencyConcentration": ag_conc,
        "partialTargets": {"have": len(tgt_dept), "total": len(dept_of)},
        "weeks": t_weeks, "weekPace": week_pace(t_weeks),
        "tiers": tier_cohorts(latest, ALL, goal_team),
    }
    (out / "team.json").write_text(json.dumps(team_payload, ensure_ascii=False), encoding="utf-8")

    # ------------------------------------------------------------ 영업단 ---
    for dc, dname in dept_of.items():
        keep = lambda p, _d=dc: str(p["deptCode"]) == _d  # noqa: E731
        centers = rollup(per_date, dates, keep,
                         lambda p: (str(p["centerCode"]), p["center"]), hc_center, tgt_center)
        c_meta = add_stats(centers, dates)
        for u in centers:
            u["href"] = f"/center/{u['key']}"
            u["head"] = center_of.get(u["key"], ("", "", ""))[2]
        attach_ranks(centers)
        centers.sort(key=lambda x: -x["cred"])
        a_rows, a_n, a_conc = agency_rollup(per_date, dates, keep, top=12)
        b_rows, b_n = top_branches(per_date, dates, keep, hc_branch, top=15)
        d_weeks = week_rows(latest, keep, windows, dates[-1])
        (out / "dept" / f"{dc}.json").write_text(json.dumps({
            "level": "dept", "key": dc, "name": dname, "asOf": dates[-1], "dates": dates,
            "parent": {"name": team, "href": "/"},
            "target": tgt_dept.get(dc), "headcount": hc_dept.get(dc, 0),
            "daily": daily_rows(per_date, dates, keep),
            "children": centers, "childLabel": "센터", "compare": c_meta,
            "agencies": a_rows, "agencyCount": a_n, "agencyConcentration": a_conc,
            "branches": b_rows, "branchCount": b_n,
            "weeks": d_weeks, "weekPace": week_pace(d_weeks),
            "tiers": tier_cohorts(latest, keep, goal_dept.get(dc)),
            "head": dept_heads.get(dname),
            "ranks": {
                "scope": "팀 내 영업단",
                "cred": my_rank(depts, dc, "cred"),
                "achievedPct": my_rank(depts, dc, "achievedPct"),
                "perCapita": my_rank(depts, dc, "perCapita"),
                "activeRate": my_rank(depts, dc, "activeRate"),
            },
            "siblings": [{"key": u["key"], "name": u["name"], "href": u["href"]} for u in depts],
        }, ensure_ascii=False), encoding="utf-8")

    # -------------------------------------------------------------- 센터 ---
    for cc, (cname, dc, head) in center_of.items():
        keep = lambda p, _c=cc: str(p["centerCode"]) == _c  # noqa: E731
        branches = rollup(per_date, dates, keep,
                          lambda p: (p["branchCode"] or p["branch"], p["branch"]), hc_branch)
        b_meta = add_stats(branches, dates)
        for u in branches:
            bm = branch_meta.get(int(u["key"]) if u["key"].isdigit() else u["key"], {})
            u["agency"] = bm.get("agency")
            u["worldTour"] = bm.get("worldTour", [])
        attach_ranks(branches)
        branches.sort(key=lambda x: -x["cred"])
        people, awards, managers = center_detail(
            snaps, dates, per_date, cname, hc_branch, branch_meta)
        c_weeks = week_rows(latest, keep, windows, dates[-1])
        sib = [{"key": c, "name": n, "href": f"/center/{c}"}
               for c, (n, d, _h) in center_of.items() if d == dc]
        (out / "center" / f"{cc}.json").write_text(json.dumps({
            "level": "center", "key": cc, "name": cname, "head": head,
            "asOf": dates[-1], "dates": dates,
            "parent": {"name": dept_of.get(dc, ""), "href": f"/dept/{dc}"},
            "grandparent": {"name": team, "href": "/"},
            "target": tgt_center.get(cc), "headcount": hc_center.get(cc, 0),
            "daily": daily_rows(per_date, dates, keep),
            "children": branches, "childLabel": "지사", "compare": b_meta,
            "weeks": c_weeks, "weekPace": week_pace(c_weeks),
            "tiers": tier_cohorts(latest, keep, goal_center.get(cc)),
            "ranks": {
                "scope": "전체 센터",
                "cred": my_rank(all_centers, cc, "cred"),
                "achievedPct": my_rank(all_centers, cc, "achievedPct"),
                "perCapita": my_rank(all_centers, cc, "perCapita"),
                "activeRate": my_rank(all_centers, cc, "activeRate"),
            },
            "people": people, "awards": awards, "managers": managers,
            "siblings": sorted(sib, key=lambda x: x["name"]),
        }, ensure_ascii=False), encoding="utf-8")

    # -------------------------------------------------------------- 색인 ---
    (out / "index.json").write_text(json.dumps({
        "generatedAt": datetime.datetime.now().isoformat(timespec="seconds"),
        "asOf": dates[-1], "month": dates[-1][:7], "team": team,
        "snapshots": [{"date": s["asOf"], "source": s["source"], "rows": len(s["people"])}
                      for s in snaps],
        "warnings": sorted({w for s in snaps for w in s["warnings"]}),
        "tree": [{
            "key": u["key"], "name": u["name"], "href": u["href"],
            "centers": sorted(
                ({"key": c, "name": n, "href": f"/center/{c}"}
                 for c, (n, d, _h) in center_of.items() if d == u["key"]),
                key=lambda x: x["name"]),
        } for u in depts],
        "focus": next((c for c, (n, _d, _h) in center_of.items() if n == FOCUS_CENTER), None),
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    n = lambda p: sum(1 for _ in p)  # noqa: E731
    print(f"\n✓ {out}")
    print(f"   index.json + team.json + dept/{len(dept_of)}개 + center/{len(center_of)}개")
    tot = sum(f.stat().st_size for f in out.rglob("*.json"))
    print(f"   총 {tot/1024:.0f} KB")
    if team_payload["partialTargets"]["have"] < team_payload["partialTargets"]["total"]:
        h, t = team_payload["partialTargets"].values()
        print(f"   ! 목표가 등록된 영업단 {h}/{t} — 나머지는 인당생산성으로 비교")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    a = ap.parse_args()
    build(a.src, a.out)
