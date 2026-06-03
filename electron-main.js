const path = require("path");
const { app, BrowserWindow, shell } = require("electron");
const { resolveDefaultDumpDir, startServer } = require("./server");

let serverHandle = null;
let mainWindow = null;
const APP_ICON = path.join(__dirname, "assets", "nyx-icon.ico");

function dumpDirArg() {
  const appPath = path.resolve(app.getAppPath());
  return process.argv
    .slice(1)
    .filter((arg) => !arg.startsWith("-"))
    .find((arg) => path.resolve(arg) !== appPath);
}

async function ensureServer() {
  if (serverHandle) return serverHandle;

  const arg = dumpDirArg();
  serverHandle = await startServer({
    port: 0,
    defaultDumpDir: resolveDefaultDumpDir(arg ? [process.argv[0], arg] : process.argv),
    log: false
  });
  return serverHandle;
}

async function createWindow() {
  const server = await ensureServer();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: "Nyx",
    icon: APP_ICON,
    backgroundColor: "#030305",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(server.url);
}

app.setName("Nyx");
app.setAppUserModelId("com.nyx.viewer");

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  serverHandle?.server.close();
});
