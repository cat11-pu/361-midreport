// mid.js：读数排好序与取中间值
export function sortOf(rows) {
  return rows.slice().sort(function (left, right) {
    if (left[0] < right[0]) return -1;
    if (left[0] > right[0]) return 1;
    return 0;
  });
}

export function midOf(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort(function (left, right) { return left - right; });
  return sorted[Math.floor((sorted.length - 1) / 2)];
}
