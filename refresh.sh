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
if [ "$#" -eq 0 ]; then
  shopt -s nullglob nocaseglob
  moved=0
  for f in "$DOWNLOADS"/*"설계사시상 진척현황"*.xlsb "$DOWNLOADS"/*"설계사시상 진척현황"*.xlsx \
           "$DOWNLOADS"/*"설계사 인별실적시트"*.xlsb "$DOWNLOADS"/*"설계사 인별실적시트"*.xlsx; do
    base="$(basename "$f")"
    [[ "$base" == ~\$* ]] && continue
    dest="$RAW/$base"
    if [ ! -e "$dest" ]; then
      mv "$f" "$dest"
      echo "  → Downloads 에서 옮김: $base"
      moved=$((moved + 1))
    fi
  done
  shopt -u nullglob nocaseglob
  [ "$moved" -eq 0 ] && echo "  (Downloads 에 새 파일 없음)"
  echo
fi

python3 etl/build.py --src "$SRC"

echo
echo "대시보드 실행:  npm --prefix dashboard run dev   →  http://localhost:3000"
