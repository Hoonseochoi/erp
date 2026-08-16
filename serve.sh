#!/usr/bin/env bash
#
# 매니저 원격 접속용 실행 스크립트.
#
#   ./serve.sh                고정 주소 (Tailscale Funnel) — 권장
#   ./serve.sh --quick        임시 주소 (Cloudflare quick tunnel, 매번 바뀜)
#   ./serve.sh --local        터널 없이 사무실 같은 네트워크에서만
#   ./serve.sh --no-build     이미 빌드돼 있으면 빌드 건너뛰기
#
# 이 맥이 곧 서버다. 데이터는 dashboard/data/ 에만 있고 어디에도 업로드되지 않는다.
# 터널은 바깥에서 이 맥까지 오는 길만 뚫어줄 뿐이다.
#
# 종료: Ctrl+C  (서버와 터널이 함께 내려간다)
set -uo pipefail
cd "$(dirname "$0")"

MODE="funnel"
DO_BUILD=1
for arg in "$@"; do
  case "$arg" in
    --quick)    MODE="quick" ;;
    --local)    MODE="local" ;;
    --no-build) DO_BUILD=0 ;;
    *) echo "알 수 없는 옵션: $arg"; exit 1 ;;
  esac
done

PORT="${PORT:-3000}"

# Tailscale CLI. 심볼릭 링크로 부르면 번들 식별에 실패하므로 실제 경로를 쓴다.
TS=""
for c in /Applications/Tailscale.app/Contents/MacOS/Tailscale \
         /usr/local/bin/tailscale /opt/homebrew/bin/tailscale; do
  [ -x "$c" ] && TS="$c" && break
done

# ── 사전 점검 ────────────────────────────────────────────────────────
if [ ! -f dashboard/.env.local ]; then
  echo "✗ dashboard/.env.local 이 없습니다. .env.example 을 복사해 채우세요."
  exit 1
fi
if ! grep -q '^APP_PASSWORD=.\+' dashboard/.env.local; then
  echo "✗ APP_PASSWORD 가 비어 있습니다. 비밀번호 없이는 아무도 못 들어옵니다."
  exit 1
fi
if [ ! -f dashboard/data/center.json ]; then
  echo "✗ 데이터가 없습니다. 먼저 ./refresh.sh 를 실행하세요."
  exit 1
fi
if [ "$MODE" != "local" ] && ! grep -q '^SECURE_COOKIE=1' dashboard/.env.local; then
  echo "⚠ 터널은 HTTPS 인데 SECURE_COOKIE=1 이 아닙니다."
  echo "  dashboard/.env.local 을 확인하세요."
fi

if [ "$MODE" = "funnel" ]; then
  if [ -z "$TS" ]; then
    echo "✗ Tailscale 이 설치돼 있지 않습니다."
    echo "  /Applications/Tailscale.app 을 실행해 로그인한 뒤 다시 시도하세요."
    echo "  임시 주소로 지금 띄우려면:  ./serve.sh --quick"
    exit 1
  fi
  if ! "$TS" status >/dev/null 2>&1; then
    echo "✗ Tailscale 이 로그인되지 않았습니다."
    echo "  Tailscale 앱을 열어 로그인한 뒤 다시 시도하세요."
    echo "  임시 주소로 지금 띄우려면:  ./serve.sh --quick"
    exit 1
  fi
fi

# ── 정리 ─────────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  echo
  echo "내리는 중..."
  if [ "$MODE" = "funnel" ] && [ -n "$TS" ]; then
    "$TS" funnel --https=443 off >/dev/null 2>&1
  fi
  for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null; done
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM

# ── 빌드 ─────────────────────────────────────────────────────────────
if [ "$DO_BUILD" -eq 1 ]; then
  echo "▸ 프로덕션 빌드"
  npm --prefix dashboard run build || { echo "✗ 빌드 실패"; exit 1; }
fi

# ── 서버 ─────────────────────────────────────────────────────────────
# dev 서버가 아니라 next start. 여러 명이 붙는 용도로는 이쪽이 맞다.
echo "▸ 서버 시작 (포트 $PORT)"
npm --prefix dashboard run start -- -p "$PORT" >/tmp/erp-server.log 2>&1 &
PIDS+=($!)

for i in $(seq 1 40); do
  curl -sf -o /dev/null "http://localhost:$PORT/login" && break
  sleep 0.5
  if [ "$i" -eq 40 ]; then
    echo "✗ 서버가 뜨지 않았습니다. /tmp/erp-server.log 확인"
    cleanup
  fi
done
echo "  ✓ http://localhost:$PORT"

banner() {
  echo
  echo "════════════════════════════════════════════════════════════"
  echo "  매니저에게 보낼 주소"
  echo
  echo "      $1"
  echo
  echo "  비밀번호는 따로(문자·구두로) 전달하세요. 링크와 같이 보내지 말 것."
  echo "════════════════════════════════════════════════════════════"
}

case "$MODE" in
  local)
    IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
    [ -n "$IP" ] && echo "  ✓ 같은 네트워크에서:  http://$IP:$PORT"
    echo
    echo "Ctrl+C 로 종료."
    wait
    ;;

  funnel)
    # 고정 주소. 맥을 껐다 켜도 같은 https://<머신>.<테일넷>.ts.net 을 쓴다.
    echo "▸ Tailscale Funnel 연결"
    if ! "$TS" funnel --bg "$PORT" >/tmp/erp-funnel.log 2>&1; then
      echo "✗ Funnel 을 켜지 못했습니다:"
      sed 's/^/    /' /tmp/erp-funnel.log
      echo
      echo "  처음이라면 로그에 뜬 링크에서 Funnel 사용을 허용해야 합니다."
      echo "  임시 주소로 지금 띄우려면:  ./serve.sh --quick"
      cleanup
    fi
    URL=$("$TS" funnel status 2>/dev/null | grep -oE 'https://[a-z0-9.-]+\.ts\.net[^ ]*' | head -1)
    [ -z "$URL" ] && URL=$(grep -oE 'https://[a-z0-9.-]+\.ts\.net[^ ]*' /tmp/erp-funnel.log | head -1)
    if [ -n "$URL" ]; then banner "$URL"; else
      echo "✗ 주소를 못 읽었습니다. '$TS funnel status' 로 확인하세요."
    fi
    echo
    echo "이 창을 닫으면 접속이 끊깁니다. Ctrl+C 로 종료."
    wait
    ;;

  quick)
    # 임시 주소. 재실행할 때마다 바뀌므로 매번 새 링크를 보내야 한다.
    echo "▸ Cloudflare 임시 터널 연결"
    cloudflared tunnel --url "http://localhost:$PORT" --no-autoupdate >/tmp/erp-tunnel.log 2>&1 &
    PIDS+=($!)
    URL=""
    for i in $(seq 1 60); do
      URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/erp-tunnel.log 2>/dev/null | head -1)
      [ -n "$URL" ] && break
      sleep 1
    done
    if [ -n "$URL" ]; then
      banner "$URL"
      echo "  ⚠ 임시 주소입니다. 다시 실행하면 주소가 바뀝니다."
    else
      echo "✗ 터널 주소를 못 읽었습니다. /tmp/erp-tunnel.log 확인"
    fi
    echo
    echo "이 창을 닫으면 접속이 끊깁니다. Ctrl+C 로 종료."
    wait
    ;;
esac
