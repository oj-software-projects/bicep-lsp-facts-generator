import { spawn } from "child_process";
import { randomBytes } from "crypto";
import os from "os";
import path from "path";
import { createClientPipeTransport, createMessageConnection, RequestType } from "vscode-jsonrpc/node.js";

const versionRequestType = new RequestType("bicep/version");
const compileRequestType = new RequestType("bicep/compile");
const getMetadataRequestType = new RequestType("bicep/getMetadata");
const getDeploymentGraphRequestType = new RequestType("bicep/getDeploymentGraph");

function generatePipeInfo() {
  const suffix = randomBytes(21).toString("hex");
  if (process.platform === "win32") {
    const pipeName = `bicep-${suffix}-sock`;
    return {
      pipeName,
      pipePath: `\\\\.\\pipe\\${pipeName}`,
    };
  }

  const pipePath = path.join(os.tmpdir(), `bicep-${suffix}.sock`);
  return {
    pipeName: pipePath,
    pipePath,
  };
}

export class BicepJsonRpcClient {
  constructor({ bicepPath = "bicep" } = {}) {
    this.bicepPath = bicepPath;
    this.connection = null;
    this.child = null;
    this.stderr = "";
    this.exitCode = null;
  }

  async start() {
    if (this.connection) {
      return;
    }

    const { pipeName, pipePath } = generatePipeInfo();
    const transport = await createClientPipeTransport(pipePath, "utf-8");
    const child = spawn(this.bicepPath, ["jsonrpc", "--pipe", pipeName], {
      stdio: ["ignore", "ignore", "pipe"],
    });

    child.stderr.on("data", (chunk) => {
      this.stderr += chunk.toString();
    });

    child.on("exit", (code) => {
      this.exitCode = code;
    });

    const [reader, writer] = await withTimeout(
      transport.onConnected(),
      10000,
      "Timed out waiting for Bicep JSON-RPC connection."
    );
    const connection = createMessageConnection(reader, writer);
    connection.listen();

    this.child = child;
    this.connection = connection;
  }

  async stop() {
    if (!this.connection) {
      return;
    }

    try {
      await this.connection.end();
    } finally {
      this.child?.kill();
      this.child = null;
      this.connection = null;
    }
  }

  async version() {
    await this.start();
    const response = await this.connection.sendRequest(versionRequestType, {});
    return response?.version;
  }

  async compile(filePath) {
    await this.start();
    return this.connection.sendRequest(compileRequestType, { path: filePath });
  }

  async getMetadata(filePath) {
    await this.start();
    return this.connection.sendRequest(getMetadataRequestType, { path: filePath });
  }

  async getDeploymentGraph(filePath) {
    await this.start();
    return this.connection.sendRequest(getDeploymentGraphRequestType, { path: filePath });
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}
