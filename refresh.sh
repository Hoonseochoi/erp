#!/usr/bin/env bash
# 새 파일이 Downloads 에 들어왔을 때 실행. RAW DATA 로 옮기기만 한다.
# (예전 로컬 Next.js 대시보드는 2026-09-30 에 없앴다 — 대시보드는 hoonstartup.pages.dev 하나만 쓴다.
#  빌드·배포는 prizedashboard/web/ga7-dashboard/prepare.py → github/ga7-sales-dashboard 에서 한다.)
#
#   ./refresh.sh
#
# 옮기는 것
#   * 일별 인별실적: 앞 6자리가 기준일(YYMMDD_ 또는 마감본 YYMMDD(9월최종)_)이고 이름에 '인별실적'·'설계사시상 진척현황'·'설계사 인별실적시트'
#   * GA 설계일보·GA매니저일보(설계 트렌드용)·GA 지사일보(지사 경영용) — 이름으로만 판단
#   * 어센틱 M/S 파일(어센틱금융_손보사실적_지점별_*) → 이 폴더(매출분석, ms.py 가 읽는 곳)
#   * 어센틱 팀 분류(삼성화재_보험사사원코드정보_*) → RAW DATA/어센틱팀 (authentic.py)
#
# 셸 glob 을 쓰지 않는 이유: 한글 파일명이 자모 분해형(NFD)으로 내려오는 경우가 있어
# 소스에 적은 NFC 리터럴과 바이트가 달라 **조용히 안 맞는다**(2026-09-11 하루치 누락 사고).
set -euo pipefail

python3 - "$HOME/Downloads" "/Users/hoons/Documents/RAW DATA" "/Users/hoons/Documents/매출분석" <<'PYEOF'
import re, shutil, sys, unicodedata
from pathlib import Path

nfc = lambda s: unicodedata.normalize("NFC", s)
SNAPSHOT_PATTERNS = ("설계사시상 진척현황", "설계사 인별실적시트", "인별실적")
src, raw = Path(sys.argv[1]), Path(sys.argv[2])
moved = 0
for p in sorted(src.iterdir()) if src.is_dir() else []:
    if p.suffix.lower() not in (".xlsb", ".xlsx") or p.name.startswith("~$"):
        continue
    name = nfc(p.name)
    design = (nfc("GA매니저일보") in name and p.suffix.lower() == ".xlsb") or nfc("설계일보") in name \
        or nfc("지사일보") in name
    # 일별 스냅샷은 앞 6자리가 기준일인 파일만 — '2608월최종(0901)_인별실적.xlsx' 같은 정리본은 건드리지 않는다.
    daily = re.match(r"\d{6}(\([^)]*최종[^)]*\))?_?\D", name) and any(nfc(n) in name for n in SNAPSHOT_PATTERNS)
    # 어센틱 팀 분류(보험사사원코드정보) → RAW DATA/어센틱팀 · 어센틱 M/S 원본 → 매출분석 폴더(ms.py 가 읽는 곳)
    team = nfc("보험사사원코드정보") in name
    ms = nfc("어센틱금융_손보사실적") in name
    if not (design or daily or team or ms):
        continue
    dest = (raw / nfc("어센틱팀") / p.name) if team else (Path(sys.argv[3]) / p.name) if ms else (raw / p.name)
    dest.parent.mkdir(exist_ok=True)
    if dest.exists():
        continue
    shutil.move(str(p), str(dest))
    print(f"  → Downloads 에서 옮김: {p.name}")
    moved += 1
print("  (Downloads 에 새 파일 없음)" if not moved else f"  {moved}개 옮김")
PYEOF
