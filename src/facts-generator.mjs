import path from "path";
import { promises as fs } from "fs";
import { sha256File } from "./utils/hash.mjs";
import { toPosixPath } from "./utils/fs.mjs";
import {
  collectAllResources,
  inferTargetScopeFromSchema,
  inferScopeFromExpression,
  isArmExpressionString,
  isModuleDeploymentResource,
  normalizeArmType,
} from "./utils/arm.mjs";

const CATEGORY_BY_PROVIDER = new Map([
  ["microsoft.network", "networking"],
  ["microsoft.compute", "compute"],
  ["microsoft.containerservice", "compute"],
  ["microsoft.containerregistry", "compute"],
  ["microsoft.web", "compute"],
  ["microsoft.storage", "data"],
  ["microsoft.sql", "data"],
  ["microsoft.documentdb", "data"],
  ["microsoft.dbformysql", "data"],
  ["microsoft.dbforpostgresql", "data"],
  ["microsoft.keyvault", "security"],
  ["microsoft.authorization", "security"],
  ["microsoft.eventhub", "messaging"],
  ["microsoft.servicebus", "messaging"],
  ["microsoft.apimanagement", "integration"],
  ["microsoft.cognitiveservices", "ai"],
  ["microsoft.machinelearningservices", "ai"],
]);

export async function generateFacts({
  filePath,
  client,
  rootDir,
  componentIdFrom,
  generatedAt,
  generatorName,
  compilerVersion,
}) {
  const [compileResult, metadata, graph] = await Promise.all([
    client.compile(filePath),
    client.getMetadata(filePath),
    client.getDeploymentGraph(filePath),
  ]);

  if (!compileResult?.success || !compileResult?.contents) {
    const diagnostics = compileResult?.diagnostics ?? [];
    const diagnosticSummary = diagnostics.map((d) => `${d.code}: ${d.message}`).join(" | ");
    throw new Error(`Bicep compilation failed for ${filePath}. ${diagnosticSummary}`.trim());
  }

  const template = JSON.parse(compileResult.contents);
  const targetScope = inferTargetScopeFromSchema(template.$schema);

  const parameterMetadata = new Map(
    (metadata?.parameters ?? []).map((param) => [param.name, param])
  );
  const outputMetadata = new Map(
    (metadata?.outputs ?? []).map((output) => [output.name, output])
  );

  const resourceTypes = collectResourceTypes(graph);
  const componentId = resolveComponentId(componentIdFrom, filePath, resourceTypes);

  const parameters = buildParameters(template, parameterMetadata);
  const outputs = buildOutputs(template, outputMetadata);
  const moduleResult = buildModules(template, graph);
  const capabilities = buildCapabilities(resourceTypes);

  const relativePath = toPosixPath(path.relative(rootDir, filePath));
  const hash = await sha256File(filePath);

  const metaNotes = [];
  if (moduleResult.omittedModules.length > 0) {
    metaNotes.push(
      `Omitted ${moduleResult.omittedModules.length} module(s) without resolvable path.`
    );
  }

  const resolvedGeneratedAt = generatedAt ?? (await getFileMtimeIso(filePath));

  return {
    schemaVersion: "facts.v1",
    componentId,
    source: {
      path: relativePath,
      hash,
      compilerVersion,
    },
    scopes: {
      allowed: [targetScope],
      default: targetScope,
    },
    parameters,
    outputs,
    modules: moduleResult.modules.length ? moduleResult.modules : undefined,
    capabilities,
    meta: {
      generatedAt: resolvedGeneratedAt,
      generator: generatorName,
      notes: metaNotes.length ? metaNotes : undefined,
    },
  };
}

async function getFileMtimeIso(filePath) {
  const stats = await fs.stat(filePath);
  return new Date(stats.mtimeMs).toISOString();
}

function collectResourceTypes(graph) {
  const types = new Set();
  for (const node of graph?.nodes ?? []) {
    if (!node?.type || node.type === "<module>") {
      continue;
    }
    types.add(node.type);
  }

  return Array.from(types).sort();
}

function resolveComponentId(componentIdFrom, filePath, resourceTypes) {
  if (componentIdFrom === "file") {
    return path.basename(filePath, ".bicep");
  }

  if (resourceTypes.length > 0) {
    const mainType = resourceTypes[0];
    const lastSegment = mainType.split("/").pop() || mainType;
    return lastSegment.toLowerCase();
  }

  return path.basename(filePath, ".bicep");
}

function buildParameters(template, metadata) {
  const parameters = template?.parameters ?? {};
  const results = [];

  for (const [name, definition] of Object.entries(parameters)) {
    const armType = normalizeArmType(definition?.type);
    const sensitive = typeof definition?.type === "string" && definition.type.toLowerCase().startsWith("secure");
    const defaultValue = definition?.defaultValue;
    const hasDefault = Object.prototype.hasOwnProperty.call(definition ?? {}, "defaultValue");
    const defaultIsExpression = isArmExpressionString(defaultValue);
    const defaultKind = hasDefault ? (defaultIsExpression ? "expression" : "literal") : "none";
    const description = metadata.get(name)?.description ?? definition?.metadata?.description;

    const constraints = buildConstraints(definition);

    results.push({
      name,
      type: armType,
      required: !hasDefault,
      defaultKind,
      default: defaultKind === "literal" ? defaultValue : undefined,
      defaultExpression: defaultKind === "expression" ? defaultValue : undefined,
      constraints: constraints ?? undefined,
      description: description ?? undefined,
      sensitive: sensitive || undefined,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function buildConstraints(definition) {
  if (!definition || typeof definition !== "object") {
    return null;
  }

  const constraints = {};
  if (Array.isArray(definition.allowedValues)) {
    constraints.allowed = definition.allowedValues;
  }
  if (definition.minValue !== undefined) {
    constraints.minValue = definition.minValue;
  }
  if (definition.maxValue !== undefined) {
    constraints.maxValue = definition.maxValue;
  }
  if (definition.minLength !== undefined) {
    constraints.minLength = definition.minLength;
  }
  if (definition.maxLength !== undefined) {
    constraints.maxLength = definition.maxLength;
  }
  if (definition.pattern !== undefined) {
    constraints.pattern = definition.pattern;
  }

  return Object.keys(constraints).length > 0 ? constraints : null;
}

function buildOutputs(template, metadata) {
  const outputs = template?.outputs ?? {};
  const results = [];

  for (const [name, definition] of Object.entries(outputs)) {
    const armType = normalizeArmType(definition?.type);
    const description = metadata.get(name)?.description ?? definition?.metadata?.description;

    results.push({
      name,
      type: armType,
      description: description ?? undefined,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function buildModules(template, graph) {
  const allResources = collectAllResources(template);
  const moduleResources = allResources.filter(isModuleDeploymentResource);
  const moduleResourceByName = new Map();

  for (const resource of moduleResources) {
    if (typeof resource?.name === "string") {
      moduleResourceByName.set(resource.name, resource);
    }
  }

  const modules = [];
  const omittedModules = [];

  for (const node of graph?.nodes ?? []) {
    if (node?.type !== "<module>") {
      continue;
    }

    const resource = moduleResourceByName.get(node.name);
    const pathValue =
      node.relativePath ??
      (typeof resource?.properties?.templateLink?.uri === "string"
        ? resource.properties.templateLink.uri
        : undefined);

    if (!pathValue) {
      omittedModules.push(node.name);
      continue;
    }

    const conditionKind = resource?.copy
      ? "foreach"
      : resource?.condition
        ? "conditional"
        : "always";

    const scope = inferModuleScope(resource);

    modules.push({
      name: node.name,
      path: pathValue,
      scope: scope ?? undefined,
      condition: {
        kind: conditionKind,
      },
    });
  }

  return {
    modules: modules.sort((a, b) => a.name.localeCompare(b.name)),
    omittedModules,
  };
}

function inferModuleScope(resource) {
  if (!resource || typeof resource !== "object") {
    return undefined;
  }

  if (resource.scope) {
    const inferred = inferScopeFromExpression(resource.scope);
    if (inferred) {
      return inferred;
    }
  }

  if (resource.subscriptionId) {
    return "subscription";
  }
  if (resource.resourceGroup) {
    return "resourceGroup";
  }

  return undefined;
}

function buildCapabilities(resourceTypes) {
  if (resourceTypes.length === 0) {
    return { category: "unknown" };
  }

  const categoryCounts = new Map();
  for (const type of resourceTypes) {
    const provider = type.split("/")[0]?.toLowerCase() ?? "";
    const category = CATEGORY_BY_PROVIDER.get(provider) ?? "unknown";
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  const sortedCategories = Array.from(categoryCounts.entries()).sort((a, b) => {
    if (a[1] !== b[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });

  const category = sortedCategories[0]?.[0] ?? "unknown";
  return {
    category,
    features: resourceTypes.length ? resourceTypes : undefined,
  };
}
