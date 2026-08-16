# 경인.GA7센터 매출 대시보드

매일 들어오는 **월 누적** 실적 파일을 쌓아 두고, 스냅샷 간 차분으로 **일간 매출**을 복원해
지사 / 설계사 / 시상 / 조직 4개 축으로 분석한다.

제작 배경·판단 근거·분석 결과는 Obsidian 에 정리돼 있다:
`~/Documents/Obsidian Vault/매출 DASHBOARD/`

## 처음 받았다면

원본 실적 파일과 목표는 **저장소에 없다**(개인정보·대외비). 아래 둘을 채워야 돈다.

```bash
# 1. 목표 파일 만들기
cp etl/targets.example.json etl/targets.json   # 실제 목표를 채워 넣는다 (단위: 천원)

# 2. 접속 비밀번호 설정
cp dashboard/.env.example dashboard/.env.local # APP_PASSWORD 를 채운다
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # AUTH_SECRET 에 붙여넣기

# 3. 의존성
python3 -m pip install pyxlsb openpyxl msoffcrypto-tool
npm --prefix dashboard install

# 4. 원본 실적 파일을 ~/Documents/private 에 놓고 아래 실행
./refresh.sh
```

## 쓰는 법

```bash
# 1. 새 파일을 ~/Documents/private 에 넣고
./refresh.sh

# 2. 대시보드 실행
npm --prefix dashboard run dev   # → http://localhost:3000
```

다른 지점으로 보려면:

```bash
python3 etl/build.py --focus "경인.GA2센터"
```

> **이전 날짜 파일을 지우지 말 것.** 하루치가 사라지면 그날의 일간 실적은 복원되지 않는다.

## 구조

```
etl/
  schema.py    '설계사' 시트 124개 컬럼 · 시상 22개 항목 정의
  reader.py    .xlsb / 암호(0000) .xlsx 파싱 + 캐시
  build.py     차분 · 집계 · 시상 기준선 역산 → JSON 3종
  cache/       파싱 캐시 (지워도 됨)

dashboard/     Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui + recharts
  public/data/ meta.json · center.json · benchmark.json  (build.py 산출물)
  src/components/ui/         shadcn 프리미티브
  src/components/charts/     차트 키트
  src/components/dashboard/  화면별 섹션

refresh.sh     ETL 재실행
```

## 필요한 것

- Python 3.9+ / `pyxlsb`, `openpyxl`, `msoffcrypto-tool`
- Node 20+

## 접속 보호

데이터는 전부 로컬에만 있고, 대시보드는 비밀번호 게이트 뒤에 있다.

```
비로그인 요청  →  /login 으로 307
세션 쿠키      →  httpOnly + HMAC 서명 (위조·만료 토큰 거부), 유효기간 12시간
시도 제한      →  10분에 8회, 초과 시 잠금
데이터 파일    →  public/ 밖(dashboard/data/)이라 URL 로 직접 접근 불가
```

- 비밀번호는 `dashboard/.env.local` 의 `APP_PASSWORD` 에만 있다. **코드에 없다.**
- `AUTH_SECRET` 을 비워 두면 비밀번호에서 유도한다. 직접 넣으면 비밀번호를 바꿔도
  기존 세션이 유지된다.
- **HTTPS 로 외부에 열 때는 `SECURE_COOKIE=1`** 로 켠다.
  (로컬 http 에서 켜면 쿠키가 저장되지 않아 로그인이 무한 반복된다.)

같은 네트워크의 다른 기기에서 볼 때:

```bash
npm --prefix dashboard run dev -- -H 0.0.0.0
```

> 4자리 숫자는 경우의 수가 1만개다. 시도 제한이 있긴 하지만, 인터넷에 직접
> 노출할 거라면 더 긴 비밀번호를 쓰는 편이 안전하다. `.env.local` 만 고치면 된다.

## 저장소에 올리지 않는 것

이 저장소는 **public** 이다. 아래는 전부 로컬에만 둔다.

| 대상 | 이유 |
|---|---|
| `dashboard/data/*.json` | 설계사 실명·사용인코드·개인 실적. `./refresh.sh` 로 재생성됨 |
| `etl/cache/` | 본부 전체 11,865명 파싱 캐시 (수십 MB) |
| `etl/targets.json` | 지점별 목표. 대외비 → `targets.example.json` 참고 |
| `dashboard/.env.local` | 접속 비밀번호·서명 키 → `.env.example` 참고 |
| `*.xlsb`, `*.xlsx` | 원본 실적 파일 |

원본·목표·비밀번호만 로컬에 있으면 나머지는 전부 명령 한 줄로 복원된다.

## 지표 요약

| 지표 | 뜻 |
|---|---|
| **실적** | 원본 `인실적` 컬럼. 월 누적. **매출의 유일한 기준.** 원본 단위 천원 → 화면은 만원 |
| 일간 실적 | `누적(D) − 누적(D−1)`. 파일이 빠진 날은 구간으로 합산 |
| 가동 | 당월 실적 > 0 인 설계사 |
| 가동률 | 가동 인원 ÷ 재적 설계사수('지사' 시트) |
| 월말 예상 | 영업일(월~금) 기준 run-rate × 총 영업일 |
| **달성률** | 누적 실적 ÷ 월 목표. **지점 비교의 유일한 잣대** (목표가 지점마다 3~4배 다름) |
| 페이스 | 달성률 − 영업일 진척률. +면 계획보다 앞선 것 |
| 시상금 | 설계사 개인이 받는 돈. **조직 단위로 합산하지 않는다** — 설계사 탭에만 표시 |

목표는 `etl/targets.json` 에서 읽는다 (단위 천원, 월별). **매달 초에 갱신해야 한다.**

`환산P`(프로본부 환산성적)는 현업에서 쓰지 않는 지표라 화면에 띄우지 않는다.
검증용으로 JSON 에만 남아 있다.

단위 환산은 `dashboard/src/lib/format.ts` 한 곳에서만 한다 (`8,309` → `830.9만원`).
