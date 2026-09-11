#!/usr/bin/env bash
# 새 실적 파일이 들어왔을 때 실행. Downloads 에 떨어진 새 스냅샷을
# RAW DATA 로 옮겨온 뒤, 원본 폴더를 다시 훑어 대시보드 JSON 을 갱신한다.
#
#   ./refresh.sh                 # 기본 (Downloads → RAW DATA 자동 이동 + 빌드)
#   ./refresh.sh ~/Downloads     # 다른 폴더에서 빌드만 (자동 이동 없이)
#
# 대시보드가 떠 있으면 새로고침만 하면 반영된다(force-dynamic).
set -euo pipefail
cd "$(dirname "$0")"

RAW="/Users/hoons/Documents/RAW DATA"
DOWNLOADS="$HOME/Downloads"
SRC="${1:-$RAW}"

# 인자 없이 실행했을 때만 Downloads 를 훑는다.
#
# 셸 glob 을 쓰지 않는 이유: 한글 파일명이 자모 분해형(NFD)으로 내려오는 경우가 있어
# 소스에 적은 NFC 리터럴과 바이트가 달라 **조용히 안 맞는다**. 2026-09-11 에 실제로
# 이 때문에 하루치가 누락됐다(오류도 안 났다). 그래서 파일명을 NFC 로 정규화해
# 비교하는 파이썬에 맡긴다 — 인식 규칙은 etl/reader.py 의 SNAPSHOT_PATTERNS 하나로 둔다.
if [ "$#" -eq 0 ]; then
  python3 - "$DOWNLOADS" "$RAW" <<'PYEOF'
import re, shutil, sys, unicodedata
from pathlib import Path
sys.path.insert(0, "etl")   # refresh.sh 가 프로젝트 루트로 cd 한 뒤 실행된다
from reader import SNAPSHOT_PATTERNS

nfc = lambda s: unicodedata.normalize("NFC", s)
src, raw = Path(sys.argv[1]), Path(sys.argv[2])
needles = [nfc(x) for x in SNAPSHOT_PATTERNS]
moved = 0
if src.is_dir():
    for p in sorted(src.iterdir()):
        if p.suffix.lower() not in (".xlsb", ".xlsx") or p.name.startswith("~$"):
            continue
        name = nfc(p.name)
        # 일별 스냅샷만 옮긴다. 앞 6자리가 기준일(YYMMDD)인 파일이 아니면 건드리지 않는다 —
        # '2608월최종(0901)_인별실적.xlsx' 같은 마감본·정리본이 딸려 들어오면 안 된다.
        if not re.match(r"\d{6}_", name):
            continue
        if not any(n in name for n in needles):
            continue
        dest = raw / p.name
        if dest.exists():
            continue
        shutil.move(str(p), str(dest))
        print(f"  → Downloads 에서 옮김: {p.name}")
        moved += 1
print("  (Downloads 에 새 파일 없음)" if not moved else f"  {moved}개 옮김")
PYEOF
  echo
fi

python3 etl/build.py --src "$SRC"

echo
echo "대시보드 실행:  npm --prefix dashboard run dev   →  http://localhost:3000"
