# Bicep LSP Facts Generator

Generate `*.facts.json` files from Bicep templates using the official Bicep CLI JSON-RPC interface. Outputs strictly validate against `facts.v1.schema.json` and capture interface-level semantics only.

## Prerequisites

- Node.js 18+ (ESM)
- Bicep CLI (`bicep`) installed and on PATH

Install Bicep via Azure CLI:

```
az bicep install
```

Or standalone:

```
https://learn.microsoft.com/azure/azure-resource-manager/bicep/install
```

## Install

```
npm install
```

## Usage

```
node src/cli.mjs --in ./bicep --out ./facts
```

Optional flags:

- `--component-id-from resource|file` (default: `resource`)
- `--generated-at <iso>` to override the default (the source file's mtime)
- `--bicep-path <path>` to use a non-default Bicep CLI path

## Sample output

```
{
  "schemaVersion": "facts.v1",
  "componentId": "virtualnetworks",
  "source_path": "bicep/vnet/vnet.bicep",
  "source_hash": "<sha256>",
  "source_compilerVersion": "0.40.2",
  "scopes_allowed": ["resourceGroup"],
  "scopes_default": "resourceGroup",
  "parametersJson": [],
  "outputsJson": [],
  "capabilities_category": "networking",
  "capabilities_features": ["Microsoft.Network/virtualNetworks"],
  "meta_generatedAt": "2026-02-05T00:00:00.000Z",
  "meta_generator": "bicep-lsp-facts-generator@0.1.0",
  "content": "virtualnetworks networking microsoft.network/virtualnetworks resourcegroup"
}
```

## Notes

- The generator uses the Bicep CLI JSON-RPC interface (`bicep jsonrpc`).
- Outputs are schema-validated and serialized with stable key ordering.
- `content` is a deterministic, tokenized search field derived from selected facts fields.
- By default, `generatedAt` uses the source file's mtime for reproducible output; use `--generated-at` to override.
