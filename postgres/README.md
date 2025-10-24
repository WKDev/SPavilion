# 실시간 사람 탐지 히트맵 + 디바이스 사용 통계 설계서

## 1. 사람 탐지 히트맵

### 목표
- 단일 카메라 사람 탐지 결과로 **1시간 단위 히트맵** 생성 및 조회
- 대량 탐지에도 행 폭증 없이 빠른 집계와 조회 성능 확보

---

### 데이터 흐름
1. YOLO 등 객체 탐지기에서 각 프레임의 `[x, y, w, h]` 좌표 생성  
2. 프레임 내부에서 **그리드 단위 binning** (중심점 기준)  
3. 셀별 카운트를 1시간 단위 버킷으로 **UPSERT 누적 저장**  
4. 조회 시 시간 구간(1시간 이상) 합산 → 히트맵 시각화

---

### 파라미터
| 항목 | 예시 | 설명 |
|------|------|------|
| 프레임 해상도 | 1920×1080 | 입력 영상 크기 |
| 셀 크기(px) | 16 | 그리드 해상도 (120×68 그리드) |
| 최소 조회 단위 | 1시간 | 시간 버킷 크기 |

---

### 테이블 설계

```sql
CREATE TABLE heatmap_hour (
  hour_ts TIMESTAMPTZ NOT NULL,  -- 1시간 버킷 시작 (date_trunc('hour', ts))
  gx      INT NOT NULL,          -- grid x index
  gy      INT NOT NULL,          -- grid y index
  hits    BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (hour_ts, gx, gy)
);
CREATE INDEX ON heatmap_hour (hour_ts);
```
 
#### 파티셔닝 권장
```sql
-- 일 단위 파티션
-- CREATE TABLE heatmap_hour_parent (...) PARTITION BY RANGE (hour_ts);
-- CREATE TABLE heatmap_hour_2025_10_23 PARTITION OF heatmap_hour_parent
--   FOR VALUES FROM ('2025-10-23') TO ('2025-10-24');
```

---

### 적재 로직

입력:  
- `ts`: 탐지 시각 (TIMESTAMPTZ)  
- `bboxes`: 탐지 결과 배열 (`[[x,y,w,h], ...]`)  
- `cell`: 셀 크기(px)

```sql
WITH p AS (SELECT :cell::INT AS cell),
boxes AS (
  SELECT (b->>0)::INT x, (b->>1)::INT y, (b->>2)::INT w, (b->>3)::INT h
  FROM jsonb_array_elements(:bboxes) b
),
binned AS (
  SELECT
    date_trunc('hour', :ts) AS hour_ts,
    FLOOR((x + w/2.0)/p.cell)::INT AS gx,
    FLOOR((y + h/2.0)/p.cell)::INT AS gy,
    COUNT(*) AS n
  FROM boxes, p
  GROUP BY 1,2,3
)
INSERT INTO heatmap_hour(hour_ts, gx, gy, hits)
SELECT hour_ts, gx, gy, n
FROM binned
ON CONFLICT (hour_ts, gx, gy)
DO UPDATE SET hits = heatmap_hour.hits + EXCLUDED.hits;
```

> 추적 ID가 있을 경우 `COUNT(DISTINCT track_id)`로 변경해 중복 카운트 방지

---

### 조회 쿼리

#### 단일 시간 히트맵
```sql
SELECT gx, gy, hits
FROM heatmap_hour
WHERE hour_ts = '2025-10-23 10:00+09';
```

#### 여러 시간 누적 히트맵
```sql
SELECT gx, gy, SUM(hits) AS hits
FROM heatmap_hour
WHERE hour_ts >= '2025-10-23 10:00+09'
  AND hour_ts <  '2025-10-23 13:00+09'
GROUP BY gx, gy;
```

---

### API 예시

#### POST /ingest
```json
{
  "ts": "2025-10-23T10:12:34.567+09:00",
  "bboxes": [[100,220,60,140],[420,200,70,160]],
  "cell": 32
}
```

#### GET /heatmap
```bash
/heatmap?from=2025-10-23T10:00:00+09:00&to=2025-10-23T13:00:00+09:00
```

응답:
```json
[
  {"gx":12,"gy":7,"hits":35},
  {"gx":13,"gy":7,"hits":22}
]
```

---

### 운영 가이드
- **보관 주기**: 일 단위 파티션, 30~90일 보존 후 DROP  
- **성능**: 프레임당 활성 셀만 UPSERT → PK 충돌 최소화  
- **해상도 변경**: 다른 셀 크기용 별도 테이블 (`heatmap_hour_16`, `heatmap_hour_64`)  
- **유효성 검사**:  
  - `w>0`, `h>0`, `0 ≤ x < x+w ≤ W`, `0 ≤ y < y+h ≤ H`  
- **시간 동기화**: 서버 NTP 적용, TIMESTAMPTZ 사용

---

### React 히트맵 렌더링
- REST 응답 `(gx, gy, hits)` → 캔버스 heatmap grid로 변환  
- `hits` 값을 정규화 후 색상 맵핑 (IQR 기반 클리핑)  
- 슬라이더로 시간대 이동 (1시간 스텝)

---

### 장애 및 관리
- 피크 시 카운트 클리핑으로 색상 왜곡 방지  
- 원시 데이터 재집계 가능: 동일 로직으로 재계산 후 UPSERT

---

---

## 1-1. Raw Bounding Box 데이터 저장 (디버깅용)

### 목적
- 원시 바운딩 박스 데이터를 저장하여 디버깅 및 재집계 가능하도록 함
- 히트맵 집계 전 원본 데이터 보관

---

### 테이블 설계

```sql
CREATE TABLE bbox_history (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  bboxes      JSONB NOT NULL,  -- [[x,y,w,h], ...] 형식
  frame_count INT,             -- 프레임 번호 (선택)
  camera_id   TEXT             -- 카메라 식별자 (향후 확장)
);
CREATE INDEX ON bbox_history (ts);
CREATE INDEX ON bbox_history USING GIN (bboxes);
```

---

### 적재 API 예시

#### POST /api/bbox_history
```json
{
  "ts": "2025-10-23T10:12:34.567+09:00",
  "bboxes": [[100,220,60,140],[420,200,70,160]],
  "frame_count": 12345
}
```

---

### 주의사항
- 고빈도 적재 시 디스크 용량 주의 (파티셔닝 권장)
- 디버깅 후 일정 기간 지난 데이터 삭제 권장 (예: 7일 보관)
- 히트맵 재집계가 필요한 경우 이 테이블 기반으로 재계산 가능

---

## 2. 디바이스 사용 통계

### 목적
- `device_usage` 테이블에 기록된 장비 이벤트를 이용해
  시간별 히스토그램(장비별 사용량)을 조회
- 히트맵과 동일한 시간축(1시간 버킷) 기반

---

### 테이블 설계

```sql
CREATE TYPE device_kind AS ENUM (
  'heat','fan','btsp',
  'light-red','light-green','light-blue','light-white',
  'display'
);

CREATE TABLE device_usage (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_type device_kind NOT NULL,
  action      TEXT,   -- 예: 'on','off','toggle','set'
  value       REAL
);
CREATE INDEX ON device_usage (device_type, ts);
CREATE INDEX ON device_usage (ts);
```

---

### 시간별 히스토그램 조회
```sql
-- 특정 일자의 시간당 이벤트 수
SELECT
  date_trunc('hour', ts) AS hour_bucket,
  device_type,
  COUNT(*) AS events
FROM device_usage
WHERE ts >= '2025-10-23 00:00+09'
  AND ts <  '2025-10-24 00:00+09'
GROUP BY 1,2
ORDER BY 1,2;
```

최근 24시간 조회:
```sql
SELECT date_trunc('hour', ts) AS hour_bucket, device_type, COUNT(*)
FROM device_usage
WHERE ts >= now() - interval '24 hours'
GROUP BY 1,2
ORDER BY 1,2;
```

---

### 고빈도 로그 대응 (사전집계 테이블)
```sql
CREATE TABLE device_usage_hour (
  hour_ts     TIMESTAMPTZ NOT NULL,
  device_type device_kind NOT NULL,
  events      BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (hour_ts, device_type)
);

INSERT INTO device_usage_hour(hour_ts, device_type, events)
SELECT date_trunc('hour', :ts), :device_type, 1
ON CONFLICT (hour_ts, device_type)
DO UPDATE SET events = device_usage_hour.events + 1;
```

조회:
```sql
SELECT *
FROM device_usage_hour
WHERE hour_ts >= '2025-10-23 00:00+09'
  AND hour_ts <  '2025-10-24 00:00+09'
ORDER BY hour_ts, device_type;
```

---

### 성능 요약
- `device_type` 카디널리티(8종) 낮아 히스토그램 계산 비용 미미  
- 초당 수천 이벤트도 인덱스 집계로 충분히 처리 가능  
- 초고빈도 환경은 1시간 버킷 사전집계(UPSERT) 사용  
- 일 단위 파티셔닝으로 보관/삭제 단순화 가능

---

**결론**  
- `heatmap_hour`와 `device_usage_hour` 두 테이블로  
  영상 기반 공간적 통계와 장비 기반 시간적 통계를  
  일관된 1시간 버킷 구조로 관리 가능.
