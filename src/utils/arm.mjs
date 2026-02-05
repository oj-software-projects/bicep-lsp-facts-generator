export function inferTargetScopeFromSchema(schemaUrl) {
  if (typeof schemaUrl !== "string") {
    return "resourceGroup";
  }

  const normalized = schemaUrl.toLowerCase();
  if (normalized.includes("subscriptiondeploymenttemplate")) {
    return "subscription";
  }
  if (normalized.includes("managementgroupdeploymenttemplate")) {
    return "managementGroup";
  }
  if (normalized.includes("tenantdeploymenttemplate")) {
    return "tenant";
  }

  return "resourceGroup";
}

export function collectAllResources(template) {
  const collected = [];
  const walk = (resources) => {
    if (!Array.isArray(resources)) {
      return;
    }

    for (const resource of resources) {
      collected.push(resource);
      if (Array.isArray(resource?.resources)) {
        walk(resource.resources);
      }
    }
  };

  walk(template?.resources);
  return collected;
}

export function isModuleDeploymentResource(resource) {
  const type = resource?.type;
  if (typeof type !== "string") {
    return false;
  }

  return type.toLowerCase() === "microsoft.resources/deployments";
}

export function isArmExpressionString(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  return trimmed.startsWith("[") && trimmed.endsWith("]");
}

export function normalizeArmType(typeValue) {
  if (typeof typeValue !== "string") {
    return "object";
  }

  const lowered = typeValue.toLowerCase();
  if (lowered === "securestring") {
    return "string";
  }
  if (lowered === "secureobject") {
    return "object";
  }

  if (["string", "int", "bool", "array", "object"].includes(lowered)) {
    return lowered;
  }

  return "object";
}

export function inferScopeFromExpression(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("subscription()")) {
    return "subscription";
  }
  if (normalized.includes("resourcegroup()")) {
    return "resourceGroup";
  }
  if (normalized.includes("managementgroup()")) {
    return "managementGroup";
  }
  if (normalized.includes("tenant()")) {
    return "tenant";
  }

  return undefined;
}
