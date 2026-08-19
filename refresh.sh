#!/usr/bin/env bash
# 새 실적 파일이 들어왔을 때 실행. 원본 폴더를 다시 훑어 대시보드 JSON 을 갱신한다.
#
#   ./refresh.sh                 # 기본 경로(/Users/hoons/Documents/RAW DATA)
#   ./refresh.sh ~/Downloads     # 다른 폴더에서 읽기
#
# 대시보드가 떠 있으면 새로고침만 하면 반영된다(force-dynamic).
set -euo pipefail
cd "$(dirname "$0")"

SRC="${1:-/Users/hoons/Documents/RAW DATA}"
python3 etl/build.py --src "$SRC"

echo
echo "대시보드 실행:  npm --prefix dashboard run dev   →  http://localhost:3000"
