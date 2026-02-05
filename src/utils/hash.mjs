import { createHash } from "crypto";
import { promises as fs } from "fs";

export async function sha256File(filePath) {
  const data = await fs.readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}
