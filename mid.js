// mid.js：读数按来源名升序排序，取排序后中间值（偶数个取较小的）
export function sortOf(rows) {
  return rows.slice().sort(function (a, b) {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    return 0;
  });
}

export function midOf(values) {
  const sorted = values.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.floor((sorted.length - 1) / 2)];
}
