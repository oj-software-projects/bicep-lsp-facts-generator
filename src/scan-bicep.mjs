import { promises as fs } from "fs";
import path from "path";

const DEFAULT_IGNORED_DIRS = new Set([".git", "node_modules"]);

export async function scanBicepFiles(rootDir, { excludeDirs = [], excludePaths = [] } = {}) {
  const ignored = new Set([...DEFAULT_IGNORED_DIRS, ...excludeDirs]);
  const results = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (ignored.has(entry.name) || isExcludedPath(nextPath, excludePaths)) {
          continue;
        }
        await walk(nextPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".bicep")) {
        if (!isExcludedPath(nextPath, excludePaths)) {
          results.push(nextPath);
        }
      }
    }
  }

  await walk(rootDir);
  return results.sort();
}

function isExcludedPath(candidatePath, excludePaths) {
  if (!excludePaths.length) {
    return false;
  }

  const normalizedCandidate = normalizePathForCompare(candidatePath);
  return excludePaths.some((excluded) => isPathWithin(normalizePathForCompare(excluded), normalizedCandidate));
}

function normalizePathForCompare(filePath) {
  const resolved = path.resolve(filePath);
  if (process.platform === "win32") {
    return resolved.toLowerCase();
  }
  return resolved;
}

function isPathWithin(parentPath, childPath) {
  const rel = path.relative(parentPath, childPath);
  if (!rel || rel === "") {
    return true;
  }
  if (path.isAbsolute(rel)) {
    return false;
  }
  return !(rel === ".." || rel.startsWith(`..${path.sep}`));
}
