"""스냅샷들을 모아 대시보드용 JSON 을 생성한다.

핵심 아이디어
-------------
원본 파일은 "월 누적 스냅샷"이다. 일간 매출은 파일 안에 없고,
연속된 두 스냅샷의 차분(diff)으로만 만들어진다.

    일간 실적(D) = 누적(D) - 누적(D-1)

그래서 과거 파일을 계속 보관해야 하고, 파일이 빠진 날은 구간(spanDays)으로
표시해 "일평균"으로 환산할 수 있게 한다.

지표
----
  실적(cred) : '인실적' 컬럼. **매출의 유일한 기준.** 단위는 천원.
               주차별로 쪼개져 있어 주간 분석도 이 값으로 한다.
  환산P      : 프로본부 환산성적. 현업에서 안 쓰는 지표라 화면에 띄우지 않는다.
               데이터 검증용으로만 payload 에 남겨 둔다.
  가동       : 당월 실적 > 0 인 설계사
  가동률     : 가동인원 / 지사 재적 설계사수

시상금은 설계사 개인이 받는 돈이라 조직 단위로 합산하지 않는다.
항목별로는 '몇 명이 받는가'만 보고, 금액은 설계사별로만 노출한다.

목표
----
지점마다 목표가 크게 다르다. 절대 실적으로 지점을 줄 세우면 목표가 큰 지점이
무조건 위로 가서 아무 의미가 없다. **달성률이 진짜 성적표**다.
목표는 etl/targets.json 에서 읽는다(단위 천원, 월별).

사용법
------
    python3 etl/build.py            # 기본 경로
    python3 etl/build.py --src ... --out ...
"""
from __future__ import annotations

import argparse
import datetime
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import reader  # noqa: E402
import schema  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEFAULT_SRC = Path("/Users/hoons/Documents/private")
DEFAULT_OUT = ROOT / "dashboard" / "public" / "data"

FOCUS_CENTER = "경인.GA7센터"
AWARD_LABEL = {k: label for k, label, *_ in schema.AWARDS}
TARGETS_FILE = HERE / "targets.json"


def r(x, n=1):
    return round(x, n)


def load_targets(month: str):
    """{지점명: 목표(천원)} — 해당 월 정의가 없으면 빈 dict."""
    if not TARGETS_FILE.exists():
        return {}
    raw = json.loads(TARGETS_FILE.read_text(encoding="utf-8"))
    return raw.get("months", {}).get(month, {}).get("centers", {})


def build(src: Path, out: Path, focus: str):
    files = reader.discover(src)
    if not files:
        raise SystemExit(f"스냅샷 파일을 찾지 못했습니다: {src}")

    snaps = []
    for p in files:
        snap = reader.load_snapshot(p, HERE / "cache")
        if not snap["asOf"]:
            print(f"  ! 기준일을 못 읽음, 건너뜀: {p.name}")
            continue
        snaps.append(snap)
        print(f"  · {snap['asOf']}  {p.name}  ({len(snap['people'])}행)")
    snaps.sort(key=lambda s: s["asOf"])

    # 같은 기준일이 둘 이상이면 뒤엣것으로 덮어씀
    dedup = {}
    for s in snaps:
        dedup[s["asOf"]] = s
    snaps = [dedup[k] for k in sorted(dedup)]

    dates = [s["asOf"] for s in snaps]
    latest = snaps[-1]
    targets = load_targets(dates[-1][:7])
    if targets:
        print(f"  · 목표 {len(targets)}개 지점 로드 ({dates[-1][:7]})")
    else:
        print(f"  ! {dates[-1][:7]} 목표가 targets.json 에 없습니다 — 달성률 표시 생략")

    # ---------------- 지사 재적 인원 (최신 xlsb 기준) ----------------------
    headcount = {}
    branch_meta = {}
    for s in reversed(snaps):
        if s["branches"]:
            for b in s["branches"]:
                key = b["branchCode"] or b["branch"]
                headcount[key] = b["headcount"]
                branch_meta[key] = b
            break

    # ---------------- 포커스 조직 정보 ------------------------------------
    focus_rows = [p for p in latest["people"] if p["center"] == focus]
    if not focus_rows:
        centers = sorted({p["center"] for p in latest["people"] if p["center"]})
        raise SystemExit(f"'{focus}' 를 찾지 못했습니다. 가능한 지점명:\n  " + "\n  ".join(centers))
    focus_info = {
        "center": focus,
        "dept": focus_rows[0]["dept"],
        "hq": focus_rows[0]["hq"],
        "centerHead": focus_rows[0]["centerHead"],
    }

    # =====================================================================
    # 1) 포커스 센터 : 일간 시계열
    # =====================================================================
    def key_of(p):
        return p["code"] or p["name"]

    per_date = []          # [{code: person_record}]
    for s in snaps:
        per_date.append({key_of(p): p for p in s["people"] if p["center"] == focus})

    daily = []
    prev_map = None
    prev_date = None
    for i, d in enumerate(dates):
        cur = per_date[i]
        conv = sum(p["convP"] for p in cur.values())
        cred = sum(p["cred"] for p in cur.values())
        active = sum(1 for p in cur.values() if p["cred"] > 0)
        active_conv = sum(1 for p in cur.values() if p["convP"] > 0)
        if prev_map is None:
            d_conv = d_cred = None
            new_active = None
            span = None
        else:
            d_conv = conv - sum(p["convP"] for p in prev_map.values())
            d_cred = cred - sum(p["cred"] for p in prev_map.values())
            new_active = sum(
                1 for k, p in cur.items()
                if p["cred"] > 0 and (k not in prev_map or prev_map[k]["cred"] <= 0)
            )
            span = (datetime.date.fromisoformat(d) - datetime.date.fromisoformat(prev_date)).days
        daily.append({
            "date": d,
            "convP": r(conv),
            "cred": r(cred),
            "dConvP": None if d_conv is None else r(d_conv),
            "dCred": None if d_cred is None else r(d_cred),
            "spanDays": span,
            "dConvPPerDay": None if d_conv is None or not span else r(d_conv / span),
            "roster": len(cur),
            "active": active,
            "activeConv": active_conv,
            "newActive": new_active,
        })
        prev_map, prev_date = cur, d

    # =====================================================================
    # 2) 주차별 인실적 (최신 스냅샷)
    # =====================================================================
    weeks = []
    for w in range(5):
        total = sum(p["weeks"][w] for p in focus_rows)
        movers = sum(1 for p in focus_rows if p["weeks"][w] > 0)
        weeks.append({"week": w + 1, "label": f"{w+1}주차", "cred": r(total), "people": movers})

    # =====================================================================
    # 3) 지사(branch) 롤업
    # =====================================================================
    branch_series = defaultdict(dict)   # branchKey -> {date: (conv, cred, active)}
    for i, d in enumerate(dates):
        agg = defaultdict(lambda: [0.0, 0.0, 0])
        for p in per_date[i].values():
            k = p["branchCode"] or p["branch"]
            a = agg[k]
            a[0] += p["convP"]
            a[1] += p["cred"]
            a[2] += 1 if p["cred"] > 0 else 0
        for k, v in agg.items():
            branch_series[k][d] = v

    branches = []
    for p in focus_rows:
        k = p["branchCode"] or p["branch"]
        if any(b["key"] == k for b in branches):
            continue
        ser = branch_series.get(k, {})
        cur = ser.get(dates[-1], [0.0, 0.0, 0])
        prev = ser.get(dates[-2], [0.0, 0.0, 0]) if len(dates) > 1 else [0.0, 0.0, 0]
        hc = headcount.get(k, 0)
        bm = branch_meta.get(k, {})
        branches.append({
            "key": k,
            "branch": p["branch"],
            "agency": p["agency"],
            "manager": p["manager"],
            "headcount": hc,
            "worldTour": bm.get("worldTour", []),
            "convP": r(cur[0]),
            "cred": r(cur[1]),
            "dConvP": r(cur[0] - prev[0]),
            "dCred": r(cur[1] - prev[1]),
            "activePeople": cur[2],
            "roster": sum(1 for q in focus_rows if (q["branchCode"] or q["branch"]) == k),
            "activeRate": r(cur[2] / hc * 100, 1) if hc else None,
            # 인당생산성도 실적 기준. 재적 1명당 천원.
            "perHead": r(cur[1] / hc, 2) if hc else None,
            "series": [
                {"date": d, "convP": r(ser.get(d, [0, 0, 0])[0]), "cred": r(ser.get(d, [0, 0, 0])[1])}
                for d in dates
            ],
        })
    branches.sort(key=lambda b: -b["cred"])
    for i, b in enumerate(branches):
        b["rank"] = i + 1

    # =====================================================================
    # 4) 설계사 단위
    # =====================================================================
    people = []
    last = per_date[-1]
    prev = per_date[-2] if len(per_date) > 1 else {}
    for k, p in last.items():
        ser = []
        for i, d in enumerate(dates):
            q = per_date[i].get(k)
            ser.append({"date": d, "convP": q["convP"] if q else 0.0, "cred": q["cred"] if q else 0.0})
        pv = prev.get(k)
        # 시상금은 개인이 받는 돈이라 사람 단위로만 붙인다.
        award_items = sorted(
            (
                {"label": AWARD_LABEL[key], "money": a["money"]}
                for key, a in p["awards"].items()
                if a["money"] > 0
            ),
            key=lambda x: -x["money"],
        )
        award_money = sum(a["money"] for a in award_items)
        people.append({
            "awardItems": award_items,
            "code": p["code"],
            "name": p["name"],
            "branch": p["branch"],
            "agency": p["agency"],
            "manager": p["manager"],
            "convP": p["convP"],
            "cred": p["cred"],
            "weeks": p["weeks"],
            "dConvP": r(p["convP"] - (pv["convP"] if pv else 0.0), 3),
            "dCred": r(p["cred"] - (pv["cred"] if pv else 0.0), 3),
            "awardMoney": r(award_money, 0),
            "prestigeGrade": p["prestige"]["grade"],
            "series": ser,
        })
    people.sort(key=lambda x: -x["cred"])
    for i, p in enumerate(people):
        p["rank"] = i + 1

    # =====================================================================
    # 5) 시상 진척 — 지급 기준선은 전사(수도권마케팅2팀) 데이터에서 역산
    # =====================================================================
    awards = []
    for key, label, *_ in schema.AWARDS:
        paid_perf = [
            p["awards"][key]["perf"]
            for p in latest["people"]
            if key in p["awards"] and p["awards"][key]["money"] > 0
        ]
        threshold = min(paid_perf) if paid_perf else None

        eligible = [p for p in focus_rows if key in p["awards"]]
        if not eligible:
            continue
        achieved = [p for p in eligible if p["awards"][key]["money"] > 0]
        near = []
        if threshold:
            for p in eligible:
                a = p["awards"][key]
                if a["money"] > 0:
                    continue
                gap = threshold - a["perf"]
                if 0 < gap <= threshold * 0.5:
                    near.append({
                        "name": p["name"], "branch": p["branch"], "manager": p["manager"],
                        "perf": a["perf"], "gap": r(gap, 3),
                    })
            near.sort(key=lambda x: x["gap"])
        awards.append({
            "key": key,
            "label": label,
            "eligible": len(eligible),
            "achieved": len(achieved),
            "rate": r(len(achieved) / len(eligible) * 100, 1) if eligible else 0,
            "threshold": threshold,
            "near": near[:20],
        })
    # 금액이 아니라 '몇 명이 받는가' 순. 시상금 합산은 의미가 없다.
    awards.sort(key=lambda a: (-a["achieved"], -len(a["near"])))

    # =====================================================================
    # 6) 매니저 단위 (담당자별 관리 현황)
    # =====================================================================
    mgr = defaultdict(lambda: {"cred": 0.0, "dCred": 0.0, "roster": 0, "active": 0,
                               "branches": set()})
    for p in people:
        m = mgr[p["manager"] or "미지정"]
        m["cred"] += p["cred"]
        m["dCred"] += p["dCred"]
        m["roster"] += 1
        m["active"] += 1 if p["cred"] > 0 else 0
        m["branches"].add(p["branch"])
    managers = [{
        "manager": k, "cred": r(v["cred"]), "dCred": r(v["dCred"]),
        "roster": v["roster"], "active": v["active"], "branches": len(v["branches"]),
        "activeRate": r(v["active"] / v["roster"] * 100, 1) if v["roster"] else 0,
    } for k, v in mgr.items()]
    managers.sort(key=lambda x: -x["cred"])

    # =====================================================================
    # 7) 벤치마크 : 같은 본부의 모든 지점 비교
    # =====================================================================
    center_series = defaultdict(dict)
    center_dept = {}
    for i, d in enumerate(dates):
        agg = defaultdict(lambda: [0.0, 0.0, 0, 0])
        for p in snaps[i]["people"]:
            c = p["center"]
            if not c:
                continue
            a = agg[c]
            a[0] += p["convP"]
            a[1] += p["cred"]
            a[2] += 1
            a[3] += 1 if p["cred"] > 0 else 0
            center_dept[c] = p["dept"]
        for c, v in agg.items():
            center_series[c][d] = v

    centers = []
    for c, ser in center_series.items():
        cur = ser.get(dates[-1], [0.0, 0.0, 0, 0])
        pv = ser.get(dates[-2], [0.0, 0.0, 0, 0]) if len(dates) > 1 else [0.0, 0.0, 0, 0]
        hc = sum(b["headcount"] for b in branch_meta.values() if b["center"] == c)
        centers.append({
            "center": c,
            "dept": center_dept.get(c),
            "cred": r(cur[1]),
            "dCred": r(cur[1] - pv[1]),
            "roster": cur[2],
            "active": cur[3],
            "headcount": hc,
            "activeRate": r(cur[3] / hc * 100, 1) if hc else None,
            "target": targets.get(c),
            "achievedPct": r(cur[1] / targets[c] * 100, 1) if targets.get(c) else None,
            "isFocus": c == focus,
            "series": [
                {"date": d, "cred": r(ser.get(d, [0, 0, 0, 0])[1])}
                for d in dates
            ],
        })
    # 절대 실적 순위와 달성률 순위를 둘 다 매긴다. 목표가 지점마다 달라
    # 절대 실적만으로 줄 세우면 목표가 큰 지점이 무조건 위로 간다.
    centers.sort(key=lambda x: -x["cred"])
    for i, c in enumerate(centers):
        c["rank"] = i + 1
    ranked = sorted(
        [c for c in centers if c["achievedPct"] is not None],
        key=lambda x: -x["achievedPct"],
    )
    for i, c in enumerate(ranked):
        c["achievedRank"] = i + 1
    for c in centers:
        c.setdefault("achievedRank", None)

    depts = defaultdict(lambda: {"cred": 0.0, "dCred": 0.0, "roster": 0, "active": 0})
    for c in centers:
        dd = depts[c["dept"] or "미지정"]
        dd["cred"] += c["cred"]
        dd["dCred"] += c["dCred"]
        dd["roster"] += c["roster"]
        dd["active"] += c["active"]
    dept_list = [{"dept": k, **{kk: r(vv) if isinstance(vv, float) else vv for kk, vv in v.items()}}
                 for k, v in depts.items()]
    dept_list.sort(key=lambda x: -x["cred"])

    # =====================================================================
    # 출력
    # =====================================================================
    out.mkdir(parents=True, exist_ok=True)
    month = dates[-1][:7]
    warnings = sorted({w for s in snaps for w in s["warnings"]})

    meta = {
        "generatedAt": datetime.datetime.now().isoformat(timespec="seconds"),
        "asOf": dates[-1],
        "month": month,
        "focus": focus_info,
        "snapshots": [{"date": s["asOf"], "source": s["source"], "rows": len(s["people"])} for s in snaps],
        "warnings": warnings,
        "metrics": {
            "cred": {
                "label": "실적",
                "unit": "천원",
                "desc": "원본 '인실적' 컬럼. 월 누적, 단위는 천원. 매출의 유일한 기준",
            },
        },
    }
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    center_payload = {
        "focus": focus_info,
        "asOf": dates[-1],
        "target": targets.get(focus),
        "dates": dates,
        "daily": daily,
        "weeks": weeks,
        "branches": branches,
        "people": people,
        "awards": awards,
        "managers": managers,
        "headcount": sum(b["headcount"] for b in branch_meta.values() if b["center"] == focus),
    }
    (out / "center.json").write_text(json.dumps(center_payload, ensure_ascii=False), encoding="utf-8")

    (out / "benchmark.json").write_text(json.dumps(
        {"asOf": dates[-1], "dates": dates, "centers": centers, "depts": dept_list},
        ensure_ascii=False), encoding="utf-8")

    print(f"\n✓ {out}")
    for f in ("meta.json", "center.json", "benchmark.json"):
        print(f"   {f:16} {(out / f).stat().st_size/1024:8.1f} KB")
    if warnings:
        print("\n⚠ 레이아웃 경고")
        for w in warnings:
            print("   -", w)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--focus", default=FOCUS_CENTER)
    a = ap.parse_args()
    build(a.src, a.out, a.focus)
