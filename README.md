# 멀티콥터 비행시간 추정기

React와 Recharts로 만든 드론 비행시간 계산 웹앱입니다.

## 실행

Windows에 Node.js LTS를 설치한 뒤 아래 명령을 실행합니다.

```powershell
npm install
npm run dev
```

## 빌드

```powershell
npm run build
```

빌드 결과는 `dist/` 폴더에 생성됩니다.

## GitHub Pages 배포

1. GitHub에서 새 저장소를 만듭니다.
2. 이 폴더에서 원격 저장소를 연결합니다.

```powershell
git remote add origin https://github.com/사용자명/저장소명.git
git add .
git commit -m "Create drone flight time calculator"
git push -u origin master
```

3. GitHub 저장소의 `Settings > Pages`에서 `GitHub Actions`를 선택합니다.
4. 이후 `master` 브랜치에 push할 때마다 자동 배포됩니다.
