/**
 * k-d tree 순수 JS 구현 (3차원 Lab 색공간 전용)
 * 
 * 빌드 시: KDTree.build(tileDB) → 직렬화 가능한 객체
 * 매칭 시: KDTree.kNearest(tree, targetLab, k) → k개 최근접 후보
 * 
 * 워커에서 사용하므로 외부 의존성 없이 순수 JS로 구현.
 * tileDB 엔트리: { id, filename, lab: { l, a, b } }
 */

class KDTree {
  /**
   * tileDB 배열로부터 k-d tree를 빌드
   * @param {Array} tiles - [{ id, filename, lab: { l, a, b } }, ...]
   * @returns {Object} 직렬화 가능한 트리 노드 객체
   */
  static build(tiles) {
    if (!tiles || tiles.length === 0) return null;

    // 인덱스 배열로 작업 (복사 최소화)
    const indices = tiles.map((_, i) => i);
    const dimensions = ['l', 'a', 'b'];

    function buildRecursive(idxArr, depth) {
      if (idxArr.length === 0) return null;
      if (idxArr.length === 1) {
        const t = tiles[idxArr[0]];
        return { idx: idxArr[0], point: [t.lab.l, t.lab.a, t.lab.b], left: null, right: null };
      }

      const axis = depth % 3;
      const dimKey = dimensions[axis];

      // 중앙값 기준 분할
      idxArr.sort((a, b) => tiles[a].lab[dimKey] - tiles[b].lab[dimKey]);
      const mid = Math.floor(idxArr.length / 2);

      const t = tiles[idxArr[mid]];
      return {
        idx: idxArr[mid],
        point: [t.lab.l, t.lab.a, t.lab.b],
        axis,
        left: buildRecursive(idxArr.slice(0, mid), depth + 1),
        right: buildRecursive(idxArr.slice(mid + 1), depth + 1),
      };
    }

    return buildRecursive(indices, 0);
  }

  /**
   * k개 최근접 이웃 검색
   * @param {Object} tree - build()로 생성된 트리
   * @param {Array} target - [l, a, b]
   * @param {number} k - 반환할 후보 수
   * @returns {Array} [{ idx, distSq }, ...] 거리 제곱 오름차순 정렬
   */
  static kNearest(tree, target, k) {
    // max-heap (가장 먼 후보를 빠르게 제거하기 위함)
    const heap = [];

    function heapPush(item) {
      heap.push(item);
      // sift up
      let i = heap.length - 1;
      while (i > 0) {
        const parent = Math.floor((i - 1) / 2);
        if (heap[parent].distSq >= item.distSq) break;
        [heap[i], heap[parent]] = [heap[parent], heap[i]];
        i = parent;
      }
    }

    function heapPop() {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        // sift down
        let i = 0;
        while (true) {
          let largest = i;
          const l = 2 * i + 1, r = 2 * i + 2;
          if (l < heap.length && heap[l].distSq > heap[largest].distSq) largest = l;
          if (r < heap.length && heap[r].distSq > heap[largest].distSq) largest = r;
          if (largest === i) break;
          [heap[i], heap[largest]] = [heap[largest], heap[i]];
          i = largest;
        }
      }
      return top;
    }

    function distSq(a, b) {
      return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    }

    function search(node) {
      if (!node) return;

      const d = distSq(target, node.point);

      if (heap.length < k) {
        heapPush({ idx: node.idx, distSq: d });
      } else if (d < heap[0].distSq) {
        heapPop();
        heapPush({ idx: node.idx, distSq: d });
      }

      // 어느 쪽 자식을 먼저 탐색할지 결정
      const axis = node.axis !== undefined ? node.axis : 0;
      const diff = target[axis] - node.point[axis];
      const first = diff <= 0 ? node.left : node.right;
      const second = diff <= 0 ? node.right : node.left;

      search(first);

      // 반대편 서브트리도 탐색해야 하는지 확인
      if (heap.length < k || diff * diff < heap[0].distSq) {
        search(second);
      }
    }

    search(tree);

    // 결과를 거리 오름차순 정렬
    return heap.sort((a, b) => a.distSq - b.distSq);
  }
}

module.exports = KDTree;
