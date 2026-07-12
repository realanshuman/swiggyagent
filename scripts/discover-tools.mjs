/**
 * Phase-0 discovery: connects to the real Swiggy MCP servers, runs the
 * MCP-standard OAuth flow in your browser (localhost redirect — pre-approved
 * by Swiggy), then dumps each server's tools/list to docs/tool-schemas/.
 *
 * Run on your own machine with normal internet access:
 *   npm run discover-tools
 *
 * Then reconcile src/lib/gateway/mcp.ts DEFAULT_TOOL_MAP with the dumped
 * schemas (or set SWIGGY_TOOLMAP_JSON).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SERVERS = {
  food: process.env.SWIGGY_FOOD_URL ?? "https://mcp.swiggy.com/food",
  im: process.env.SWIGGY_IM_URL ?? "https://mcp.swiggy.com/im",
  dineout: process.env.SWIGGY_DINEOUT_URL ?? "https://mcp.swiggy.com/dineout",
};
const CALLBACK_PORT = 8765;
const TOKENS_FILE = ".swiggy_tokens.json";

/** Minimal OAuthClientProvider backed by a local JSON file. */
function makeProvider(serverKey) {
  let stash = {};
  const load = async () => {
    try {
      stash = JSON.parse(await readFile(TOKENS_FILE, "utf8"));
    } catch {
      stash = {};
    }
  };
  const save = async () => writeFile(TOKENS_FILE, JSON.stringify(stash, null, 2));
  return {
    get redirectUrl() {
      return `http://localhost:${CALLBACK_PORT}/callback`;
    },
    get clientMetadata() {
      return {
        client_name: "swiggyagent-discovery",
        redirect_uris: [`http://localhost:${CALLBACK_PORT}/callback`],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      };
    },
    async clientInformation() {
      await load();
      return stash[`${serverKey}:client`];
    },
    async saveClientInformation(info) {
      await load();
      stash[`${serverKey}:client`] = info;
      await save();
    },
    async tokens() {
      await load();
      return stash[`${serverKey}:tokens`];
    },
    async saveTokens(tokens) {
      await load();
      stash[`${serverKey}:tokens`] = tokens;
      await save();
    },
    async redirectToAuthorization(url) {
      console.log(`\nOpen this URL to log in to Swiggy (${serverKey}):\n\n  ${url}\n`);
      const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      exec(`${opener} "${url}"`);
    },
    async saveCodeVerifier(v) {
      await load();
      stash[`${serverKey}:verifier`] = v;
      await save();
    },
    async codeVerifier() {
      await load();
      return stash[`${serverKey}:verifier`];
    },
  };
}

function waitForCallback() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h2>SwiggyAgent: login received — you can close this tab.</h2>");
      server.close();
      code ? resolve(code) : reject(new Error(url.searchParams.get("error") ?? "no code"));
    });
    server.listen(CALLBACK_PORT);
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth callback timed out after 5 minutes"));
    }, 300_000).unref();
  });
}

async function discover(serverKey, url) {
  const provider = makeProvider(serverKey);
  const connect = async () => {
    const transport = new StreamableHTTPClientTransport(new URL(url), { authProvider: provider });
    const client = new Client({ name: "swiggyagent-discovery", version: "0.1.0" });
    try {
      await client.connect(transport);
    } catch (err) {
      if (err instanceof UnauthorizedError || String(err).includes("Unauthorized")) {
        const code = await waitForCallback();
        await transport.finishAuth(code);
        const retry = new StreamableHTTPClientTransport(new URL(url), { authProvider: provider });
        const retryClient = new Client({ name: "swiggyagent-discovery", version: "0.1.0" });
        await retryClient.connect(retry);
        return retryClient;
      }
      throw err;
    }
    return client;
  };

  const client = await connect();
  const { tools } = await client.listTools();
  await mkdir("docs/tool-schemas", { recursive: true });
  const out = path.join("docs/tool-schemas", `${serverKey}.json`);
  await writeFile(out, JSON.stringify(tools, null, 2));
  console.log(`\n${serverKey}: ${tools.length} tools → ${out}`);
  for (const t of tools) console.log(`  - ${t.name}: ${(t.description ?? "").slice(0, 90)}`);
  await client.close();
}

for (const [key, url] of Object.entries(SERVERS)) {
  try {
    await discover(key, url);
  } catch (err) {
    console.error(`${key}: FAILED — ${err.message ?? err}`);
  }
}
