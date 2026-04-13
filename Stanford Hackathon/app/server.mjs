import { createReadStream, existsSync, readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, "dist");
const ENV_FILES = [".env.local", ".env"];
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

loadEnvFiles();

class HttpError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function loadEnvFiles() {
  for (const fileName of ENV_FILES) {
    const fullPath = path.join(__dirname, fileName);
    if (!existsSync(fullPath)) {
      continue;
    }

    const contents = readFileSync(fullPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }

      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

function getArgValue(flagName) {
  const flagIndex = process.argv.indexOf(flagName);
  if (flagIndex === -1 || flagIndex === process.argv.length - 1) {
    return undefined;
  }

  return process.argv[flagIndex + 1];
}

function getPort() {
  const cliPort = getArgValue("--port");
  const envPort = process.env.PORT || process.env.API_PORT;
  return Number.parseInt(cliPort || envPort || "5050", 10);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function collectRequestBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new HttpError(413, "Request body exceeds 1 MB."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new HttpError(400, "Request body must be valid JSON."));
      }
    });

    request.on("error", reject);
  });
}

function buildShareSchema(terms, pool) {
  const properties = {};

  for (const termKey of terms) {
    properties[termKey] = {
      type: "integer",
      minimum: 0,
      maximum: Math.max(0, Number(pool?.[termKey] ?? 0)),
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    required: terms,
    properties,
  };
}

function buildNegotiationSchema(terms, pool) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["action", "message", "offer"],
    properties: {
      action: {
        type: "string",
        enum: ["propose", "accept", "reject"],
      },
      message: {
        type: "string",
        minLength: 1,
        maxLength: 300,
      },
      offer: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: ["my_share", "their_share"],
            properties: {
              my_share: buildShareSchema(terms, pool),
              their_share: buildShareSchema(terms, pool),
            },
          },
        ],
      },
    },
  };
}

function normalizeNegotiationResponse(payload, pool, terms) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const action = ["propose", "accept", "reject"].includes(payload.action) ? payload.action : "reject";
  const message = typeof payload.message === "string" && payload.message.trim()
    ? payload.message.trim().slice(0, 300)
    : "I need a moment to revise this.";

  if (action !== "propose") {
    return { action, message, offer: null };
  }

  const offer = {
    my_share: {},
    their_share: {},
  };

  for (const termKey of terms) {
    offer.my_share[termKey] = Number.parseInt(payload.offer?.my_share?.[termKey] ?? -1, 10);
    offer.their_share[termKey] = Number.parseInt(payload.offer?.their_share?.[termKey] ?? -1, 10);

    if (
      offer.my_share[termKey] < 0 ||
      offer.their_share[termKey] < 0 ||
      offer.my_share[termKey] + offer.their_share[termKey] !== pool[termKey]
    ) {
      return {
        action: "reject",
        message: "I need to revise the allocation before I can respond.",
        offer: null,
      };
    }
  }

  return { action, message, offer };
}

function extractStructuredOutput(data) {
  if (data?.output_parsed && typeof data.output_parsed === "object") {
    return data.output_parsed;
  }

  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    try {
      return JSON.parse(data.output_text);
    } catch {
      // Fall through to alternate shapes.
    }
  }

  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.parsed && typeof content.parsed === "object") {
        return content.parsed;
      }

      if (content?.json && typeof content.json === "object") {
        return content.json;
      }

      if (typeof content?.text === "string" && content.text.trim()) {
        try {
          return JSON.parse(content.text);
        } catch {
          // Continue searching.
        }
      }
    }
  }

  return null;
}

async function requestNegotiationDecision({ systemPrompt, userMessage, pool, terms }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      503,
      "OpenAI is not configured. Add OPENAI_API_KEY to .env.local or your shell environment.",
    );
  }

  if (!Array.isArray(terms) || !terms.length || typeof pool !== "object" || !pool) {
    throw new HttpError(400, "terms and pool are required to evaluate a negotiation turn.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions: systemPrompt,
      input: userMessage,
      max_output_tokens: 400,
      text: {
        format: {
          type: "json_schema",
          name: "negotiation_response",
          schema: buildNegotiationSchema(terms, pool),
          strict: true,
        },
      },
    }),
  });

  const requestId = response.headers.get("x-request-id");
  const rawResponse = await response.text();
  let data = null;

  if (rawResponse) {
    try {
      data = JSON.parse(rawResponse);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new HttpError(
      response.status,
      data?.error?.message || rawResponse || `OpenAI request failed with status ${response.status}.`,
      requestId ? { requestId } : undefined,
    );
  }

  const parsed = extractStructuredOutput(data);
  const normalized = normalizeNegotiationResponse(parsed, pool, terms);

  if (!normalized) {
    throw new HttpError(
      502,
      "OpenAI returned an unexpected negotiation payload.",
      requestId ? { requestId } : undefined,
    );
  }

  return normalized;
}

function getStaticFilePath(requestPath) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const resolvedPath = path.normalize(path.join(DIST_DIR, normalizedPath));
  if (!resolvedPath.startsWith(DIST_DIR)) {
    return null;
  }

  return resolvedPath;
}

async function serveStaticAsset(requestPath, response) {
  if (!existsSync(DIST_DIR)) {
    sendJson(response, 404, { error: "Build output not found. Run npm run build first." });
    return;
  }

  const targetPath = getStaticFilePath(requestPath);
  if (!targetPath) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  let filePath = targetPath;
  try {
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    filePath = path.join(DIST_DIR, "index.html");
  }

  const extension = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[extension] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": mimeType });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      keyConfigured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/negotiate") {
    try {
      const body = await collectRequestBody(request);
      const decision = await requestNegotiationDecision(body);
      sendJson(response, 200, decision);
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      const details = error instanceof HttpError ? error.details : undefined;
      sendJson(response, statusCode, { error: message, details });
    }
    return;
  }

  if (request.method === "GET") {
    await serveStaticAsset(url.pathname, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
});

const port = getPort();
server.listen(port, () => {
  console.log(`Negotiation API listening on http://localhost:${port}`);
});
