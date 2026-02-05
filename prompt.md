You are an expert Node.js engineer with deep knowledge of Azure Bicep, 
the Bicep CLI, and the Bicep Language Server (JSON-RPC).

TASK
----
Build a Node.js CLI application that scans a directory for Bicep files
and generates a corresponding facts.json file for each Bicep template.

The generated facts.json files must strictly conform to the provided
facts.v1.schema.json and must represent ONLY the interface-level semantics
of the Bicep template (no implementation details).

IMPORTANT CONSTRAINTS
---------------------
- DO NOT parse Bicep via regex or text heuristics.
- You MUST use the official Bicep compiler / language server semantics.
- Use the Bicep CLI JSON-RPC / Language Server protocol.
- The output must be deterministic and reproducible.
- No hallucinated fields or inferred logic.

INPUT
-----
- The working directory contains:
  - one or more *.bicep files (possibly in subfolders)
  - a file called facts.v1.schema.json
- The tool is executed from the repository root.

OUTPUT
------
For each <name>.bicep file:
- Generate <name>.facts.json
- Place it next to the Bicep file OR in a configurable output folder
- Each facts.json must validate against facts.v1.schema.json

FACTS CONTENT REQUIREMENTS
--------------------------
Extract and populate the following sections from Bicep using compiler/LSP data:

1. componentId
   - Derived from the main resource type or file name (configurable)

2. source
   - path to bicep file
   - content hash (sha256)
   - bicep compiler / LSP version

3. scopes
   - targetScope from Bicep (resourceGroup, subscription, etc.)

4. parameters
   - name
   - type
   - required vs optional
   - defaultKind: none | literal | expression
   - default or defaultExpression
   - decorators:
     - description
     - allowed
     - minValue / maxValue / length constraints

5. outputs
   - name
   - type
   - description

6. modules (interface only)
   - module name
   - referenced bicep file path
   - scope (if explicitly set)
   - condition kind:
     - always
     - conditional
     - foreach
   - NO parameter expressions

7. capabilities
   - high-level category (e.g. networking, compute)
   - features inferred ONLY from resource types (no guessing)

8. meta
   - generatedAt
   - generator name/version

TOOLING REQUIREMENTS
--------------------
Before processing, the app must:

1. Check if the Bicep CLI is installed
   - `bicep --version`
2. If missing:
   - Print a clear error
   - Provide installation instructions for:
     - Azure CLI (`az bicep install`)
     - Standalone Bicep CLI
3. Verify that JSON-RPC / language server mode is available

ARCHITECTURE
------------
- Node.js (ESM)
- Use child_process to communicate with Bicep CLI JSON-RPC
- Clean separation of:
  - filesystem scanning
  - bicep analysis
  - facts mapping
  - schema validation
- Validate output JSON against facts.v1.schema.json

DELIVERABLES
------------
Generate:
- package.json
- src/
  - cli.mjs
  - scan-bicep.mjs
  - bicep-lsp-client.mjs
  - facts-generator.mjs
  - schema-validator.mjs
  - utils/
- Clear README.md with:
  - prerequisites
  - install steps
  - usage example
  - sample output

USAGE EXAMPLE
-------------
node cli.mjs --in ./bicep --out ./facts

NON-GOALS
---------
- Do NOT generate Terraform
- Do NOT interpret naming logic
- Do NOT evaluate expressions
- Do NOT merge multiple templates
- Do NOT embed domain knowledge

This tool is a FACT EXTRACTOR, not an IaC generator.

Make the implementation production-grade, explicit, and readable.
