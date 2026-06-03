const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const DEFAULT_PORT = Number(process.env.PORT || 5177);
const FALLBACK_DUMP_DIR = "C:/Dumper-7/5.5.4-1627709-Hemingway/Dumpspace";
const ROOT = __dirname;
const DATA_FILES = [
  "ClassesInfo.json",
  "StructsInfo.json",
  "EnumsInfo.json",
  "FunctionsInfo.json",
  "OffsetsInfo.json"
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function resolveDefaultDumpDir(argv = process.argv) {
  return argv[2] || process.env.DUMPER7_DUMP_DIR || FALLBACK_DUMP_DIR;
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

async function readDump(dir) {
  const normalizedDir = path.resolve(dir);
  const entries = {};
  for (const fileName of DATA_FILES) {
    const filePath = path.join(normalizedDir, fileName);
    const raw = await fs.readFile(filePath, "utf8");
    entries[fileName] = JSON.parse(raw);
  }
  return {
    dir: normalizedDir,
    files: entries,
    loadedAt: new Date().toISOString()
  };
}

function createRequestHandler({ root = ROOT, defaultDumpDir = resolveDefaultDumpDir() } = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedDefaultDumpDir = path.resolve(defaultDumpDir);

  async function serveStatic(reqPath, res) {
    const clean = reqPath === "/" ? "/index.html" : reqPath;
    const target = path.resolve(resolvedRoot, "." + clean);
    if (!target.startsWith(resolvedRoot)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    try {
      const data = await fs.readFile(target);
      res.writeHead(200, {
        "content-type": MIME[path.extname(target)] || "application/octet-stream"
      });
      res.end(data);
    } catch (error) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  }

  return async function handleRequest(req, res) {
    const parsed = new URL(req.url || "/", "http://localhost");

    if (parsed.pathname === "/api/dump") {
      try {
        const requestedDir = parsed.searchParams.get("dir") || resolvedDefaultDumpDir;
        const dump = await readDump(requestedDir);
        sendJson(res, 200, dump);
      } catch (error) {
        sendJson(res, 500, {
          error: "Unable to load Dumper7 JSON files",
          detail: error.message,
          dir: parsed.searchParams.get("dir") || resolvedDefaultDumpDir
        });
      }
      return;
    }

    if (parsed.pathname === "/api/config") {
      sendJson(res, 200, {
        defaultDumpDir: resolvedDefaultDumpDir,
        files: DATA_FILES
      });
      return;
    }

    await serveStatic(parsed.pathname || "/", res);
  };
}

function createServer(options) {
  return http.createServer(createRequestHandler(options));
}

function startServer({
  port = DEFAULT_PORT,
  defaultDumpDir = resolveDefaultDumpDir(),
  root = ROOT,
  log = true
} = {}) {
  const server = createServer({ defaultDumpDir, root });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      const appUrl = `http://localhost:${actualPort}`;
      const resolvedDefaultDumpDir = path.resolve(defaultDumpDir);

      if (log) {
        console.log(`Nyx running at ${appUrl}`);
        console.log(`Default dump directory: ${resolvedDefaultDumpDir}`);
      }

      resolve({
        server,
        port: actualPort,
        url: appUrl,
        defaultDumpDir: resolvedDefaultDumpDir
      });
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  DATA_FILES,
  createRequestHandler,
  createServer,
  readDump,
  resolveDefaultDumpDir,
  startServer
};
