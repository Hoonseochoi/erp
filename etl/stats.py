"""영업관리용 통계.

조직을 줄 세우는 건 쉽다. 어려운 건 **"어디가 정상 궤도를 벗어났나"** 를
가려내는 것이다. 여기 모인 함수들이 그 판단을 담당한다.

왜 평균·표준편차를 안 쓰나
--------------------------
조직 수가 4~30개로 적고, 한두 곳이 유난히 크거나 작다. 이런 표본에서
평균과 표준편차는 이상치 자신에게 끌려간다(=이상치가 자기를 정상으로 만든다).
그래서 **중앙값과 MAD**(중앙값 절대편차)를 쓴다. 표본의 절반이 망가져도
버티는 로버스트 통계다.
"""
from __future__ import annotations


def median(xs):
    s = sorted(x for x in xs if x is not None)
    if not s:
        return None
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def mad(xs, med=None):
    """중앙값 절대편차. 정규분포에서 표준편차와 눈금을 맞추려고 1.4826 을 곱한다."""
    s = [x for x in xs if x is not None]
    if len(s) < 2:
        return None
    m = median(s) if med is None else med
    d = median([abs(x - m) for x in s])
    return (d * 1.4826) if d else None


def robust_z(x, xs, med=None, scale=None):
    """동료 집단 안에서 이 조직이 중앙값으로부터 몇 σ 떨어져 있나.

    |z| >= 2  →  주목할 이탈
    |z| >= 3  →  확실한 이탈
    MAD 가 0(대부분 값이 같음)이면 판정을 포기하고 None 을 준다.
    """
    if x is None:
        return None
    m = median(xs) if med is None else med
    s = mad(xs, m) if scale is None else scale
    if m is None or not s:
        return None
    return (x - m) / s


def momentum(daily, window=3):
    """최근 n일 평균 일간실적 ÷ 그 앞 n일 평균.

    1.0 = 같은 속도, 0.7 = 30% 감속, 1.3 = 30% 가속.
    월말이 다가올수록 이 값이 1 아래면 목표 미달 위험이 커진다.
    daily 는 [{'dCred':..., 'spanDays':...}, ...] 형태(오래된 순).
    """
    rates = [d["dCred"] / d["spanDays"] for d in daily
             if d.get("dCred") is not None and d.get("spanDays")]
    if len(rates) < window * 2:
        return None
    recent = rates[-window:]
    prior = rates[-window * 2:-window]
    pa = sum(prior) / len(prior)
    if pa <= 0:
        return None
    return (sum(recent) / len(recent)) / pa


def contribution_gap(units, key_actual="cred", key_target="target"):
    """목표 미달분을 조직별로 쪼갠다.

    '어느 조직 때문에 팀이 목표에 못 미치나'를 금액으로 답한다.
    기대치 = 그 조직 목표 × 팀 전체 달성률.
    기대보다 덜 한 만큼이 그 조직이 만든 갭이다(음수 = 초과 달성).
    """
    tt = sum(u.get(key_target) or 0 for u in units)
    ta = sum(u.get(key_actual) or 0 for u in units)
    if not tt:
        return {}
    rate = ta / tt
    out = {}
    for u in units:
        t = u.get(key_target)
        if not t:
            continue
        out[u["key"]] = round(t * rate - (u.get(key_actual) or 0), 1)
    return out


def band(xs):
    """차트에 깔 정상 범위. 중앙값 ± 1·2 MAD."""
    m = median(xs)
    s = mad(xs, m)
    if m is None:
        return None
    return {
        "median": round(m, 2),
        "mad": round(s, 2) if s else None,
        "lo1": round(m - s, 2) if s else None,
        "hi1": round(m + s, 2) if s else None,
        "lo2": round(m - 2 * s, 2) if s else None,
        "hi2": round(m + 2 * s, 2) if s else None,
    }


def concentration(values):
    """상위 편중도. 소수 조직이 전체를 떠받치고 있는지 본다."""
    v = sorted((x for x in values if x and x > 0), reverse=True)
    tot = sum(v)
    if not tot:
        return None
    def share(n):
        return round(sum(v[:n]) / tot * 100, 1)
    # HHI: 점유율 제곱합. 2500 이상이면 매우 집중된 것으로 본다.
    hhi = round(sum((x / tot * 100) ** 2 for x in v), 0)
    return {"n": len(v), "top1": share(1), "top3": share(3), "top5": share(5),
            "top20pct": share(max(1, round(len(v) * 0.2))), "hhi": hhi}


# --------------------------------------------------------------------------
def diagnose(unit, peers_z_field="perCapita", pace_gap=None, mom=None, z=None):
    """조직 하나에 대한 최종 판정.

    우선순위: 목표가 있으면 '페이스 갭'이 1순위 근거다(가장 직접적).
    목표가 없으면 동료 대비 인당생산성 z-score 로 대체한다.
    """
    flags = []
    level = "ok"          # ok | watch | alert
    if pace_gap is not None:
        if pace_gap <= -15:
            level, _ = "alert", flags.append(f"목표 페이스 {pace_gap:+.1f}%p")
        elif pace_gap <= -7:
            level, _ = "watch", flags.append(f"목표 페이스 {pace_gap:+.1f}%p")
        elif pace_gap >= 7:
            flags.append(f"목표 페이스 {pace_gap:+.1f}%p")
    if z is not None:
        if z <= -2:
            level = "alert"
            flags.append(f"동료 대비 {z:.1f}σ")
        elif z <= -1.5 and level == "ok":
            level = "watch"
            flags.append(f"동료 대비 {z:.1f}σ")
        elif z >= 2:
            flags.append(f"동료 대비 +{z:.1f}σ")
    if mom is not None:
        if mom < 0.7:
            level = "alert" if level != "alert" else level
            flags.append(f"속도 {mom:.2f}배")
        elif mom < 0.9 and level == "ok":
            level = "watch"
            flags.append(f"속도 {mom:.2f}배")
        elif mom >= 1.2:
            flags.append(f"속도 {mom:.2f}배")
    return {"level": level, "flags": flags}
