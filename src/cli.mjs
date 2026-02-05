import { execFile } from "child_process";
import { readFile } from "fs/promises";
import path from "path";
import { promisify } from "util";
import { BicepJsonRpcClient } from "./bicep-lsp-client.mjs";
import { generateFacts } from "./facts-generator.mjs";
import { scanBicepFiles } from "./scan-bicep.mjs";
import { createSchemaValidator } from "./schema-validator.mjs";
import { writeFileUtf8 } from "./utils/fs.mjs";
import { stableStringify } from "./utils/json.mjs";

const execFileAsync = promisify(execFile);

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.showHelp) {
    printUsage();
    return;
  }

  if (options.showVersion) {
    const pkg = await loadPackageJson();
    console.log(`${pkg.name}@${pkg.version}`);
    return;
  }

  await ensureBicepAvailable(options.bicepPath);

  const rootDir = path.resolve(options.inputDir);
  const outDir = options.outputDir ? path.resolve(options.outputDir) : null;
  const excludePaths = outDir ? [outDir] : [];
  const files = await scanBicepFiles(rootDir, { excludePaths });

  if (files.length === 0) {
    console.log("No .bicep files found.");
    return;
  }

  const pkg = await loadPackageJson();
  const generatorName = `${pkg.name}@${pkg.version}`;
  const schemaPath = path.resolve("facts.v1.schema.json");
  const validate = await createSchemaValidator(schemaPath);
  const client = new BicepJsonRpcClient({ bicepPath: options.bicepPath });

  try {
    const compilerVersion = await client.version();
    for (const filePath of files) {
      const facts = await generateFacts({
        filePath,
        client,
        rootDir,
        componentIdFrom: options.componentIdFrom,
        generatedAt: options.generatedAt,
        generatorName,
        compilerVersion,
      });

      validate(facts);
      const outputPath = resolveOutputPath(filePath, rootDir, outDir);
      const serialized = `${stableStringify(facts, 2)}\n`;
      await writeFileUtf8(outputPath, serialized);
      console.log(`Wrote ${outputPath}`);
    }
  } finally {
    await client.stop();
  }
}

function parseArgs(argv) {
  const options = {
    inputDir: ".",
    outputDir: null,
    componentIdFrom: "resource",
    generatedAt: null,
    bicepPath: "bicep",
    showHelp: false,
    showVersion: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--in":
        options.inputDir = argv[++index];
        break;
      case "--out":
        options.outputDir = argv[++index];
        break;
      case "--component-id-from":
        options.componentIdFrom = argv[++index];
        break;
      case "--generated-at":
        options.generatedAt = argv[++index];
        break;
      case "--bicep-path":
        options.bicepPath = argv[++index];
        break;
      case "-h":
      case "--help":
        options.showHelp = true;
        break;
      case "--version":
        options.showVersion = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.inputDir) {
    throw new Error("--in is required");
  }

  if (!options.componentIdFrom || !["resource", "file"].includes(options.componentIdFrom)) {
    throw new Error("--component-id-from must be 'resource' or 'file'");
  }

  if (options.generatedAt) {
    const parsed = new Date(options.generatedAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("--generated-at must be a valid ISO date-time string");
    }
  }

  return options;
}

function resolveOutputPath(filePath, rootDir, outDir) {
  if (!outDir) {
    return path.join(path.dirname(filePath), `${path.basename(filePath, ".bicep")}.facts.json`);
  }

  const relativePath = path.relative(rootDir, filePath);
  if (path.isAbsolute(relativePath)) {
    return path.join(outDir, `${path.basename(filePath, ".bicep")}.facts.json`);
  }
  const baseName = path.basename(relativePath, ".bicep");
  const folder = path.dirname(relativePath);
  return path.join(outDir, folder, `${baseName}.facts.json`);
}

async function ensureBicepAvailable(bicepPath) {
  try {
    await execFileAsync(bicepPath, ["--version"], { encoding: "utf8", shell: false });
  } catch (error) {
    console.error("Bicep CLI not found or failed to run.");
    console.error("Install options:");
    console.error("  - Azure CLI: az bicep install");
    console.error("  - Standalone Bicep CLI: https://learn.microsoft.com/azure/azure-resource-manager/bicep/install");
    throw error;
  }
}

async function loadPackageJson() {
  const packageUrl = new URL("../package.json", import.meta.url);
  const content = await readFile(packageUrl, "utf8");
  return JSON.parse(content);
}

function printUsage() {
  console.log(`Usage:
  node src/cli.mjs --in <dir> [--out <dir>] [--component-id-from resource|file] [--generated-at <iso>] [--bicep-path <path>]
`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
