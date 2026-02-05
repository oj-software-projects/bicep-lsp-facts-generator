export function stableStringify(value, indent = 2) {
  return JSON.stringify(stableClone(value), null, indent);
}

function stableClone(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableClone(item));
  }

  if (value && typeof value === "object") {
    const sorted = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      const nextValue = value[key];
      if (nextValue === undefined) {
        continue;
      }
      sorted[key] = stableClone(nextValue);
    }
    return sorted;
  }

  return value;
}
