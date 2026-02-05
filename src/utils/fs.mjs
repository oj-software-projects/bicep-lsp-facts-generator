import { promises as fs } from "fs";
import path from "path";

export function toPosixPath(filePath) {
  return filePath.split(path.sep).join(path.posix.sep);
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readFileUtf8(filePath) {
  return fs.readFile(filePath, "utf8");
}

export async function writeFileUtf8(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}
