# Motor Preset CSV Guide

모터/프로펠러 추력표 데이터는 CSV 파일로 관리합니다.

기본 데이터 파일:

```text
public/data/motor-presets.csv
```

복사용 템플릿:

```text
public/data/custom-motor-template.csv
```

## 작성 규칙

CSV 한 줄은 추력표의 한 행입니다. 같은 모터/프로펠러 조합은 같은 `id`를 사용하고, throttle별 데이터를 여러 줄로 추가합니다.

```csv
id,maker,motor,kv,cells,voltage,prop,prop_inch,motor_weight_g,prop_weight_g,max_current_a,throttle,current_a,power_w,thrust_g,rpm,source_url,note
my-motor-4s-9450,MY-MAKER,2212,920,4,14.8,9450,9.4,57,13,20,50,2.7,40,350,4786,https://example.com,hover test
my-motor-4s-9450,MY-MAKER,2212,920,4,14.8,9450,9.4,57,13,20,100,11.5,170,990,9838,https://example.com,max throttle
```

## 컬럼 설명

| 컬럼 | 단위 | 설명 |
| --- | --- | --- |
| `id` | - | 같은 모터/프롭 조합을 묶는 고유 ID |
| `maker` | - | 제조사명 |
| `motor` | - | 모터 모델명 |
| `kv` | KV | 모터 KV |
| `cells` | S | 배터리 셀 수 |
| `voltage` | V | 테스트 전압 |
| `prop` | - | 프로펠러 이름 또는 규격 |
| `prop_inch` | inch | 프로펠러 직경 |
| `motor_weight_g` | g | 모터 1개 무게 |
| `prop_weight_g` | g | 프로펠러 1개 무게. 모르면 `0` |
| `max_current_a` | A | 모터 또는 권장 ESC 기준 최대 전류 |
| `throttle` | % | 테스트 throttle |
| `current_a` | A | 모터 1개 전류 |
| `power_w` | W | 모터 1개 전력 |
| `thrust_g` | g | 모터 1개 추력 |
| `rpm` | RPM | 회전수. 모르면 `0` |
| `source_url` | - | 제조사 페이지 또는 데이터 출처 |
| `note` | - | 메모 |

## 데이터 추가 방법

1. `public/data/custom-motor-template.csv`를 참고합니다.
2. `public/data/motor-presets.csv` 맨 아래에 새 행들을 붙여 넣습니다.
3. 같은 조합의 여러 throttle 행은 반드시 같은 `id`를 사용합니다.
4. 저장 후 로컬에서 확인합니다.

```powershell
npm run dev
```

5. GitHub에 올리면 사이트에 반영됩니다.

```powershell
git add public/data/motor-presets.csv
git commit -m "Add motor preset data"
git push
```

## 주의사항

- 숫자에는 단위를 붙이지 마세요. 예: `22.2V`가 아니라 `22.2`
- 엑셀에서 편집할 수 있지만 저장 형식은 CSV UTF-8을 권장합니다.
- 쉼표가 들어가는 메모는 큰따옴표로 감싸세요.
- `thrust_g` 값은 같은 `id` 안에서 여러 지점이 있을수록 보간 정확도가 좋아집니다.
