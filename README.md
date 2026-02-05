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
  "source": {
    "path": "bicep/vnet/vnet.bicep",
    "hash": "<sha256>",
    "compilerVersion": "0.29.1"
  },
  "scopes": {
    "allowed": ["resourceGroup"],
    "default": "resourceGroup"
  },
  "parameters": [],
  "outputs": [],
  "capabilities": {
    "category": "networking",
    "features": ["Microsoft.Network/virtualNetworks"]
  },
  "meta": {
    "generatedAt": "2026-02-05T00:00:00.000Z",
    "generator": "bicep-lsp-facts-generator@0.1.0"
  }
}
```

## Notes

- The generator uses the Bicep CLI JSON-RPC interface (`bicep jsonrpc`).
- Outputs are schema-validated and serialized with stable key ordering.
- By default, `generatedAt` uses the source file's mtime for reproducible output; use `--generated-at` to override.
