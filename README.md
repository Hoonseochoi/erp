# 매출분석 (파일 받는 곳)

대시보드는 **https://hoonstartup.pages.dev** 하나만 쓴다 (소스: `~/Documents/prizedashboard/github/ga7-sales-dashboard`).
예전 로컬 Next.js 대시보드(`dashboard/`, `etl/` 등)는 2026-09-30 에 없앴다 — git 이력에 남아 있다.

이 폴더에 남은 것
- `refresh.sh` — Downloads 의 새 인별실적·GA 설계일보를 `RAW DATA` 로 옮긴다.
- `어센틱금융_손보사실적_지점별_*.xlsx` — 대리점 M/S 원본. `prizedashboard/web/ga7-dashboard/ms.py` 가 이 폴더를 읽는다.
- `KakaoTalk_Photo_*.png` — 중겸 손보 실적 표 원본 이미지(ms_jungyeom.json 으로 옮겨 적은 것).
- `exports/` — 지난 분석 보고서.

매일 업데이트
```
./refresh.sh
cd ~/Documents/prizedashboard
.venv/bin/python web/ga7-dashboard/prepare.py
.venv/bin/python web/ga7-dashboard/prepare.py --center 안양성남.GA1센터
.venv/bin/python web/ga7-dashboard/design.py     # 설계일보를 받은 날만
.venv/bin/python web/ga7-dashboard/ms.py         # M/S 파일을 받은 날만
.venv/bin/python web/ga7-dashboard/branch.py     # GA 지사일보를 받은 날만
cd github/ga7-sales-dashboard && GA7_SITES_PATH=../../artifacts/ga7-dashboard/sites.local.json npm run build && npm run deploy
```
