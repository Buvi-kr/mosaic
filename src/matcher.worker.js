const { parentPort, workerData } = require('worker_threads');
const convert = require('color-convert').default || require('color-convert');

// 유클리디안 거리 - Lab 색공간 기준
function labDistance(lab1, lab2) {
  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

try {
  const { rawData, info, cols, rows, tileSize, globalTileDB } = workerData;
  const matchedTiles = [];

  // Buffer 객체 복원
  const pixelData = Buffer.from(rawData);

  // 픽셀 데이터 추출 및 targetLab 사전 계산
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const startX = x * tileSize;
      const startY = y * tileSize;

      let rSum = 0, gSum = 0, bSum = 0, pCount = 0;

      // 픽셀 샘플링 (전수 조사)
      for (let py = startY; py < startY + tileSize; py++) {
        for (let px = startX; px < startX + tileSize; px++) {
          if (px >= info.width || py >= info.height) continue;
          const offset = (py * info.width + px) * info.channels;
          rSum += pixelData[offset];
          gSum += pixelData[offset + 1];
          bSum += pixelData[offset + 2];
          pCount++;
        }
      }

      if (pCount === 0) continue;

      const lab = convert.rgb.lab(rSum / pCount, gSum / pCount, bSum / pCount);
      const targetLab = { l: lab[0], a: lab[1], b: lab[2] };

      cells.push({ startX, startY, targetLab });
    }
  }

  // 배열 랜덤 셔플 (특정 영역 편중 방지)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const usedCounts = new Int32Array(globalTileDB.length);
  const placedGrid = new Array(rows).fill(null).map(() => new Array(cols).fill(-1));

  // [GC 최적화] 매 칸마다 배열을 생성하지 않고 미리 한 번만 할당하여 가비지 컬렉션 부하 원천 차단
  const dbSize = globalTileDB.length;
  const candidateIndices = new Int32Array(dbSize);
  const distancesSq = new Float32Array(dbSize);

  // 사용자님의 통찰력("블렌딩을 믿는 렌더링 지향 알고리즘") 전면 수용!
  // 색의 정확도 비중을 확 낮추고, 덜 쓴 타일을 적극 발굴하여 "시각적 중복"을 타파합니다.
  const MAX_USAGE = 4;           // 하드 리밋은 넉넉하게 둡니다 (점수식이 알아서 분산시켜 줌)
  const DISTANCE_WEIGHT = 0.3;   // [핵심] 오차 거리에 0.3을 곱해 색상 비중을 확 낮춤
  const PENALTY_FACTOR = 10.0;   // 한 번 쓸 때마다 오차 거리 33(10.0/0.3)에 맞먹는 강력한 페널티
  const TOP_K = 60;              // 후보군을 무려 60장까지 넉넉히 가져옴 (어느 정도 비슷하면 전부 후보)

  // 랜덤 순서대로 캔버스 모든 칸에 대해 매칭 수행
  for (const cell of cells) {
    const cx = Math.floor(cell.startX / tileSize);
    const cy = Math.floor(cell.startY / tileSize);

    // 1. 5x5 반경(radius=2) 내에 이미 배치된 타일 ID들과 Lab 색상을 모음
    const bannedTiles = new Set();
    const bannedLabs = [];
    for (let ry = Math.max(0, cy - 2); ry <= Math.min(rows - 1, cy + 2); ry++) {
      for (let rx = Math.max(0, cx - 2); rx <= Math.min(cols - 1, cx + 2); rx++) {
        const tId = placedGrid[ry][rx];
        if (tId !== -1) {
          bannedTiles.add(tId);
          bannedLabs.push(globalTileDB[tId].lab);
        }
      }
    }

    // 2. 전체 타일에 대해 대상과의 거리를 제곱으로 계산 (Math.sqrt 제거 및 메모리 재사용)
    const tLab = cell.targetLab;
    for (let i = 0; i < dbSize; i++) {
      const cLab = globalTileDB[i].lab;
      distancesSq[i] = (tLab.l - cLab.l)**2 + (tLab.a - cLab.a)**2 + (tLab.b - cLab.b)**2;
      candidateIndices[i] = i; // 인덱스 초기화
    }

    // 3. 거리순(오름차순) 정렬
    candidateIndices.sort((a, b) => distancesSq[a] - distancesSq[b]);

    const validCandidates = [];
    let fallbackIdx = candidateIndices[0]; // 최악의 경우 대비

    // 4. 정렬된 순서대로 검사 (Early Exit: 60장 찾으면 수천 장 검사 생략)
    for (let j = 0; j < dbSize; j++) {
      const i = candidateIndices[j];

      // 조건 1: 사용 횟수 제한
      if (usedCounts[i] >= MAX_USAGE) continue;

      // 조건 2: 5x5 반경 내 완전 똑같은 타일(ID 동일) 금지
      if (bannedTiles.has(i)) continue;

      // 조건 3: 5x5 반경 내 '시각적으로 비슷한 타일' 싹 다 금지
      const candLab = globalTileDB[i].lab;
      let isVisuallySimilar = false;
      for (let b = 0; b < bannedLabs.length; b++) {
        const bl = bannedLabs[b];
        const dl = candLab.l - bl.l;
        const da = candLab.a - bl.a;
        const db = candLab.b - bl.b;
        if (dl * dl + da * da + db * db < 100) {
          isVisuallySimilar = true;
          break;
        }
      }
      if (isVisuallySimilar) continue;

      // 통과했으면 후보에 추가
      validCandidates.push({ idx: i, dist: Math.sqrt(distancesSq[i]) });

      // 조기 종료 로직
      if (validCandidates.length >= TOP_K) break;
    }

    let bestIdx = -1;

    if (validCandidates.length > 0) {
      // 5. 점수 계산 (거리순으로 뽑힌 Top K 안에서 사용자님 점수식 적용)
      let bestScore = Infinity;
      for (const cand of validCandidates) {
        // [사용자님 공식 완벽 보존]
        const jitter = Math.random() * 5;
        const score = (cand.dist * DISTANCE_WEIGHT) + (usedCounts[cand.idx] * PENALTY_FACTOR) + jitter;

        if (score < bestScore) {
          bestScore = score;
          bestIdx = cand.idx;
        }
      }
    } else {
      bestIdx = fallbackIdx;
    }

    usedCounts[bestIdx]++;
    placedGrid[cy][cx] = bestIdx;
    matchedTiles.push({
      filename: globalTileDB[bestIdx].filename,
      top: cell.startY,
      left: cell.startX
    });
  }

  // 성공적으로 처리된 결과 반환
  parentPort.postMessage({ success: true, matchedTiles, remainingTiles: globalTileDB.length });

} catch (err) {
  parentPort.postMessage({ success: false, error: err.message });
}
