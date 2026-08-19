# 매출 대시보드 (팀 → 영업단 → 센터)

매일 들어오는 **월 누적** 실적 파일을 쌓아 두고, 스냅샷 간 차분으로 **일간 매출**을 복원해
**팀 → 영업단 → 센터** 3단으로 드릴다운한다. 각 층에서 궤도를 벗어난 조직을 통계로 짚어낸다.

```
팀(수도권마케팅2팀)  →  영업단 7개  →  센터 30개  →  지사 2,026개  →  설계사
                     ↕
              운영 대리점 114개 (조직도를 가로지르는 축)
```

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

# 4. 원본 실적 파일을 ~/Documents/RAW DATA 에 놓고 아래 실행
./refresh.sh
```

## 쓰는 법

```bash
# 1. 새 파일을 ~/Documents/RAW DATA 에 넣고
./refresh.sh

# 2. 대시보드 실행
npm --prefix dashboard run dev   # → http://localhost:3000
```

| 화면 | 경로 |
|---|---|
| 팀 | `/` |
| 영업단 | `/dept/{부서코드}` |
| 센터 | `/center/{지점코드}` |

상단 햄버거를 열면 조직 트리 전체 + 검색으로 어디로든 점프한다.

> **이전 날짜 파일을 지우지 말 것.** 하루치가 사라지면 그날의 일간 실적은 복원되지 않는다.

## 구조

```
etl/
  schema.py    '설계사' 시트 124개 컬럼 · 시상 22개 항목 · 조직 코드
  reader.py    .xlsb / 암호(0000) .xlsx 파싱 + 캐시
  stats.py     중앙값·MAD·로버스트 z·모멘텀·집중도(HHI)
  build.py     차분 · 3단 계층 집계 · 시상 기준선 역산
  cache/       파싱 캐시 (지워도 됨)

dashboard/     Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui + recharts
  data/        index · team · dept/{코드} · center/{코드}   (public/ 밖)
  src/app/     page(팀) · dept/[code] · center/[code]
  src/components/org/     세 층이 공유하는 컴포넌트
  src/components/charts/  차트 키트
  src/components/ui/      shadcn 프리미티브

refresh.sh     ETL 재실행
serve.sh       빌드 + 서버 + 터널 (매니저 원격 접속)
docs/          GitHub Pages 안내 페이지 (데이터 없음)
```

## 필요한 것

- Python 3.9+ / `pyxlsb`, `openpyxl`, `msoffcrypto-tool`
- Node 20+

## 매니저 원격 접속

```bash
./serve.sh              # 고정 주소 (Tailscale Funnel) — 권장
./serve.sh --quick      # 임시 주소 (Cloudflare quick tunnel, 매번 바뀜)
./serve.sh --local      # 터널 없이 사무실 네트워크에서만
./serve.sh --no-build   # 이미 빌드돼 있으면
```

**이 맥이 곧 서버다.** 데이터는 `dashboard/data/` 에만 있고 어디에도 업로드되지 않는다.
터널은 바깥에서 이 맥까지 오는 길만 뚫어줄 뿐이라, Supabase 같은 외부 DB가 필요 없다.

```
매니저 브라우저 → 터널(HTTPS) → 이 맥(next start) → dashboard/data/*.json → 렌더 → 응답
```

- 맥이 꺼지거나 잠들면 접속도 끊긴다. 항상 켜 둘 것
- 터미널 창을 닫으면 서버와 터널이 같이 내려간다
- 주소와 비밀번호는 **따로** 전달할 것

### 고정 주소 (Tailscale Funnel)

`https://<머신이름>.<테일넷>.ts.net` 형태의 **바뀌지 않는 HTTPS 주소**가 나온다.
도메인을 살 필요 없고 무료다. 매니저는 링크만 열면 되고 앱 설치도 필요 없다.

최초 1회만 준비하면 된다.

1. `/Applications/Tailscale.app` 실행 → 시스템 확장 설치 허용(관리자 비밀번호)
2. 로그인 (브라우저)
3. `./serve.sh` 실행. Funnel 이 처음이면 로그에 뜬 링크에서 사용 허용

이후로는 `./serve.sh` 만 돌리면 같은 주소가 계속 쓰인다.

현재 주소: `https://hoonseo-macmini.tailc89dcd.ts.net`
(안내 페이지 <https://hoonseochoi.github.io/erp/> 의 버튼도 여기로 연결된다.
 주소가 바뀌면 `docs/index.html` 의 링크도 같이 고칠 것)

> [!note] 임시 주소가 필요할 때
> `./serve.sh --quick` 은 Cloudflare quick tunnel 로 즉시 띄운다.
> 설치·로그인이 필요 없는 대신 **재실행할 때마다 주소가 바뀐다.**

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

> [!warning] 인터넷에 열어 뒀다면 비밀번호를 늘릴 것
> 4자리 숫자는 경우의 수가 1만개다. 시도 제한(10분 8회)이 있지만 그건 속도를
> 늦출 뿐이고, 주소만 알면 전 세계 누구나 로그인 창까지는 닿는다.
> 설계사 319명의 실명·코드·실적이 뒤에 있다는 걸 감안하면 8자 이상을 권한다.
>
> ```bash
> # dashboard/.env.local 의 APP_PASSWORD 만 고치고 서버 재시작
> ```
> `AUTH_SECRET` 을 따로 지정해 뒀으면 비밀번호를 바꿔도 기존 로그인은 유지된다.

## 저장소에 올리지 않는 것

이 저장소는 **public** 이다. 아래는 전부 로컬에만 둔다.

| 대상 | 이유 |
|---|---|
| `dashboard/data/**.json` | 설계사 실명·사용인코드·개인 실적. `./refresh.sh` 로 재생성됨 |
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
| **달성률** | 누적 실적 ÷ 월 목표. 목표가 등록된 조직만 |
| 페이스 | 달성률 − 영업일 진척률. +면 계획보다 앞선 것 |
| 인당생산성 | 실적 ÷ 재적. **목표가 없어도 규모 보정 비교**가 되는 잣대 |
| z-score | 동료 집단 중앙값 대비 편차 (MAD 기준). −2 이하면 이탈 |
| 모멘텀 | 최근 3일 속도 ÷ 이전 3일 속도. 1 미만이면 감속 |
| 시상금 | 설계사 개인이 받는 돈. **조직 단위로 합산하지 않는다** — 설계사 탭에만 표시 |

목표는 `etl/targets.json` 에서 읽는다 (단위 천원, 월별). **매달 초에 갱신해야 한다.**

`환산P`(프로본부 환산성적)는 현업에서 쓰지 않는 지표라 화면에 띄우지 않는다.
검증용으로 JSON 에만 남아 있다.

단위 환산은 `dashboard/src/lib/format.ts` 한 곳에서만 한다 (`8,309` → `830.9만원`).
