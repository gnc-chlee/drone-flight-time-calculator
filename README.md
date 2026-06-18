# Multicopter Flight Time Calculator

멀티콥터 드론의 기체 중량, 배터리, 모터/프로펠러, ESC, 임무장비 조건을 바탕으로 호버링 비행시간을 추정하는 React 웹앱입니다.

사이트: https://gnc-chlee.github.io/drone-flight-time-calculator/

## 주요 기능

- 기체 중량, 로터 수, 배터리 용량, 페이로드 기반 비행시간 추정
- T-MOTOR 멀티콥터용 모터/프로펠러 추력표 프리셋
- 제조사 추력표 기반 throttle, current, power 선형 보간
- ESC 무게 및 전류 여유율 계산
- 태양전지 발전 옵션 반영
- 임무장비별 무게/소비전력 추가 및 누적 비교
- 페이로드 증가에 따른 비행시간 곡선 시각화

## 계산 방식

이 앱은 두 가지 관점의 추정값을 함께 제공합니다.

1. **운동량 이론 기반 추정**
   - 총 이륙중량, 로터 면적, 공기 밀도, Figure of Merit를 이용해 호버 전력을 계산합니다.

2. **제조사 추력표 기반 추정**
   - 선택한 모터/프로펠러/전압 조합의 추력표에서 요구 로터당 추력에 해당하는 전류와 전력을 선형 보간합니다.
   - 실제 부품 선정 검토에는 이 값이 더 유용합니다.

## 로컬 실행

Node.js LTS 설치 후 프로젝트 폴더에서 실행합니다.

```powershell
npm install
npm run dev
```

기본 개발 서버 주소:

```text
http://localhost:5173/
```

## 빌드

```powershell
npm run build
```

빌드 결과는 `dist/` 폴더에 생성됩니다.

## 배포

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드하고 GitHub Pages에 배포합니다.

```powershell
git add .
git commit -m "Update flight calculator"
git push
```

## 데이터

모터/프로펠러 프리셋 데이터는 아래 파일에서 관리합니다.

```text
src/data/tmotorMultirotorMotors.js
```

현재는 T-MOTOR 공식 제품 페이지의 테스트 데이터를 기반으로 일부 조합만 포함되어 있습니다. 추후 SunnySky, KDE, DJI 등 다른 제조사 데이터와 실제 비행 로그 기반 보정값을 추가할 예정입니다.

## 라이선스

MIT License
