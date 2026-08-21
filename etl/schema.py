"""'설계사' 시트 컬럼 정의.

원본 파일(.xlsb / 암호화 .xlsx)의 '설계사' 시트는
  row 2 (0-based) A열 = 기준일 (엑셀 시리얼 또는 datetime)
  row 5~7        = 3단 병합 헤더 (대분류 / 중분류 / 소분류)
  row 8~         = 설계사 1인 1행
구조이며, 컬럼 인덱스는 26.8월 기준 고정이다.
헤더 텍스트로 재검증하므로 원본 레이아웃이 바뀌면 ingest 시 경고가 뜬다.
"""

# --- 조직/인적 정보 ---------------------------------------------------------
COL = {
    "manager": 0,        # 매니저 (담당 지점 직원)
    "hq": 1,             # 본부명   (예: 수도권마케팅2팀)
    "hq_code": 2,
    "dept": 3,           # 부서     (예: 경인컨설팅영업단)
    "dept_code": 4,
    "center": 5,         # 지점명   (예: 경인.GA7센터)  ← 조직 분석의 기본 단위
    "center_code": 6,
    "center_head": 7,    # 센터장
    "dept_order": 8,
    "agency": 9,         # 소속대리점명 (GA 법인)
    "agency_code": 10,
    "branch": 11,        # 지사명  (GA 법인의 지사/지점) ← 영업 관리 단위
    "branch_code": 12,
    "person": 13,        # 사용인명 (설계사)
    "person_code": 14,
    "cadr": 15,
    # --- 실적 -------------------------------------------------------------
    "conv_p": 16,        # 환산P  : 프로본부 환산성적. 월 누적, 매출 대용 지표
    "cred_month": 17,    # 인실적 : 시상 인정실적. 월 누적
    "cred_w1": 18,
    "cred_w2": 19,
    "cred_w3": 20,
    "cred_w4": 21,
    "cred_w5": 22,
}

WEEK_COLS = [COL["cred_w1"], COL["cred_w2"], COL["cred_w3"], COL["cred_w4"], COL["cred_w5"]]

# 헤더 검증용: (컬럼 인덱스, row7 에 있어야 할 텍스트)
HEADER_CHECK = [
    (1, "본부명(ZDEP3TT)"),
    (3, "부서"),
    (5, "지점명"),
    (11, "지사명"),
    (13, "사용인명"),
    (14, "사용인코드"),
    (16, "환산P"),
]

# --- 시상 항목 ---------------------------------------------------------------
# 매달 항목이 바뀐다(8월 중에도 2주차 항목이 빠지고 3주차가 앞당겨졌다).
# 하드코딩하면 컬럼이 밀려 엉뚱한 이름으로 읽히므로 헤더에서 직접 뽑는다.
#
# 구조: row5 에 항목명(병합), row6 에 [운영 | ...실적 | 計] 이 반복된다.
AWARD_SCAN = (23, 94)          # 시상 블록 범위 (프레스티지클럽 직전까지)


def parse_awards(rows):
    """헤더에서 시상 항목 정의를 읽어낸다.

    반환: [{"key","label","flag","perf":[col...],"money","window"}]
    window 은 '8.18~23일' 같은 원본 표기 그대로.
    """
    r5, r6, r7 = rows[5], rows[6], rows[7]
    out, name, cur = [], None, None
    for c in range(*AWARD_SCAN):
        v5 = r5.get(c)
        if v5 is not None:
            name = v5.strip() if isinstance(v5, str) and v5.strip() else None
            cur = None
        if name is None:
            continue
        sub = str(r6.get(c) or "").strip()
        if sub == "운영":
            cur = {"key": name, "label": name, "flag": c,
                   "perf": [], "money": None, "window": None}
            out.append(cur)
        elif cur is None:
            continue
        elif "실적" in sub:
            cur["perf"].append(c)
            w = r7.get(c)
            if cur["window"] is None and isinstance(w, str) and "~" in w:
                cur["window"] = w.strip()
        elif sub in ("計", "계"):
            cur["money"] = c
    return [g for g in out if g["money"] is not None and g["perf"]]


PRESTIGE = {"flag": 94, "m7": 95, "m8": 96, "m9": 97, "grade": 98}
PREMIER = {"target": 99, "m7": 100, "m8": 101, "m9": 102, "m10": 103, "m11": 104,
           "award": 105, "badge": 106}

# --- '지사' 시트 (xlsb 에만 존재) -------------------------------------------
# 지사별 재적 설계사수 → 가동률 분모
# '설계사' 시트에서 조직 코드도 뽑는다 — URL slug 와 조인 키로 쓴다.
ORG_CODE = {"hq": 2, "dept": 4, "center": 6}

BRANCH_COL = {
    "hq": 1, "hq_code": 2, "dept": 3, "dept_code": 4,
    "center": 5, "center_code": 6, "center_head": 7,
    "agency": 8, "agency_code": 9, "branch": 10, "branch_code": 11,
    "dept_order": 12, "headcount": 13, "wt_operating": 14,
}
BRANCH_DATA_START = 4

# 지사 시트 15~18열 = 월드투어 등급별 '달성 설계사수', 19~22열 = 지사 자체 달성 구간
WORLD_TOUR_TIERS = [
    ("shizuoka", "시즈오카", 15, 19),
    ("miyako", "미야코지마", 16, 20),
    ("poland", "폴란드", 17, 21),
    ("usa_west", "미국서부", 18, 22),
]
