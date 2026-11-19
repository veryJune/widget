# MoodGrid

이미지·메모·링크를 모아 배치하는 개인용 무드보드. (현재 v2.6 · 단일 HTML · 데이터는 이 브라우저(IndexedDB)에만 저장)

## 구조
| 파일 | 설명 |
|---|---|
| `index.html` | 앱 전체 (HTML · CSS · JS) |
| `tailwind.css` | 빌드된 Tailwind (직접 수정하지 않음) |
| `tailwind.config.js`, `tailwind.src.css` | Tailwind 빌드 설정 |
| `vendor/` | 내장 라이브러리 (dexie · lucide · Sortable · html2canvas), 버전은 `vendor/VERSIONS.txt` |
| `vercel.json`, `robots.txt` | 보안 헤더 · 검색 노출 차단 |

## Tailwind 다시 만들기 (index.html 에서 클래스를 바꾼 뒤)
```bash
npx tailwindcss@3.4.17 -c tailwind.config.js -i tailwind.src.css -o tailwind.css --minify
```

## 배포
- Vercel 프로젝트 `moodgrid` (팀 v-june), Root Directory `MoodGrid`, main 에 푸시하면 프로덕션 배포.
- 다른 브랜치에 푸시하면 미리보기 배포가 생성됨.

## 로드맵
1. (완료) P0 핫픽스 · 정적 배포
2. React + TS + Vite 로 재작성, StealBook 의 Supabase 프로젝트 재사용 (프로젝트 저장·불러오기·삭제, 개인 로그인)
3. 상태 표시 · 단축키 / 박스 선택·섹션 간 이동 / 정렬·간격 / 라이트박스 개선

> 현재 버전의 .json 저장·불러오기는 클라우드 저장이 붙을 때까지 백업용으로 쓰세요.
