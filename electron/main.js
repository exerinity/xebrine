const {
  app,
  BrowserWindow: browser_window,
  dialog,
  Menu: menu,
  ipcMain: ipc_main,
  session,
  shell,
} = require("electron");
const { randomUUID: random_uuid } = require("node:crypto");
const {
  existsSync: exists_sync,
  readFileSync: read_file_sync,
  renameSync: rename_sync,
  writeFileSync: write_file_sync,
} = require("node:fs");
const {
  access,
  readFile: read_file,
  readdir,
  realpath,
  stat,
} = require("node:fs/promises");
const path = require("node:path");
const { Worker: node_worker } = require("node:worker_threads");
const { xebrine_mpris } = require("./mpris");

const app_name = "Xebrine";
const app_id = "com.exerinity.xebrine";
const start_url = new URL(process.env.XEBRINE_URL || "https://xebrine.com/");
start_url.searchParams.set("electron", "true");
const icon_path = resolve_icon();

const allowed_permissions = new Set([
  "fileSystem",
  "notifications",
  "media",
  "clipboard-sanitized-write",
  "fullscreen",
]);

if (process.platform === "linux") {
  app.commandLine.appendSwitch("disable-features", "MediaSessionService,HardwareMediaKeyHandling");
}

app.setName(app_name);
app.setAppUserModelId(app_id);
if (process.platform === "linux") {
  app.setDesktopName("xebrine.desktop");
}

let main_window;
let mpris_service;
let folder_registry_path;
const folder_registry = new Map();
const active_scans = new Map();

function resolve_icon() {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(__dirname, "build/icon.ico"),
          path.join(__dirname, "build/icon.png"),
          path.join(__dirname, "../public/i/xebrine/icon/xebrine_512_transparent.png"),
        ]
      : [
          path.join(process.resourcesPath, "xebrine_512_transparent.png"),
          path.join(__dirname, "../public/i/xebrine/icon/xebrine_512_transparent.png"),
          path.join(__dirname, "build/icon.png"),
        ];

  for (const candidate of candidates) if (exists_sync(candidate)) return candidate;
  return undefined;
}

function is_internal(url) {
  try {
    return new URL(url).origin === start_url.origin;
  } catch {
    return false;
  }
}

function is_internal_sender(event) {
  const sender_url = event.senderFrame?.url || event.sender.getURL();
  return Boolean(
    main_window &&
    event.sender === main_window.webContents &&
    event.senderFrame === event.sender.mainFrame &&
    is_internal(sender_url)
  );
}

function assert_internal_sender(event) {
  if (!is_internal_sender(event)) {
    throw new Error("Filesystem access is not allowed for this page");
  }
}

function valid_scan_request(request) {
  if (!request || typeof request !== "object") return false;
  const { requestId, folderId, libraryFolderId, folderName, mode, rules, existingTracks } = request;
  return (
    typeof requestId === "string" && requestId.length > 0 && requestId.length <= 100 &&
    typeof folderId === "string" && folder_registry.has(folderId) &&
    typeof libraryFolderId === "string" && libraryFolderId.length <= 100 &&
    typeof folderName === "string" && folderName.length <= 500 &&
    (mode === "full" || mode === "new") &&
    rules && typeof rules === "object" &&
    Array.isArray(rules.formats) && rules.formats.every((value) => typeof value === "string") &&
    (rules.maxSizeBytes === null || (typeof rules.maxSizeBytes === "number" && Number.isFinite(rules.maxSizeBytes))) &&
    Array.isArray(existingTracks) && existingTracks.length <= 1_000_000 &&
    existingTracks.every((track) => track && typeof track.id === "string" && track.folderId === libraryFolderId)
  );
}

function load_folder_registry() {
  folder_registry_path = path.join(app.getPath("userData"), "library-folders.json");
  try {
    const stored = JSON.parse(read_file_sync(folder_registry_path, "utf8"));
    for (const [id, root] of Object.entries(stored)) {
      if (typeof id === "string" && typeof root === "string" && path.isAbsolute(root)) {
        folder_registry.set(id, root);
      }
    }
  } catch {}
}

function save_folder_registry() {
  const temporary_path = `${folder_registry_path}.tmp`;
  write_file_sync(temporary_path, JSON.stringify(Object.fromEntries(folder_registry)), {
    encoding: "utf8",
    mode: 0o600,
  });
  rename_sync(temporary_path, folder_registry_path);
}

function valid_path_segments(segments) {
  return (
    Array.isArray(segments) &&
    segments.length <= 100 &&
    segments.every(
      (segment) =>
        typeof segment === "string" &&
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !segment.includes("/") &&
        !segment.includes("\\")
    )
  );
}

async function resolve_folder_entry(folder_id, segments = []) {
  if (typeof folder_id !== "string" || !valid_path_segments(segments)) {
    throw new Error("Invalid folder path");
  }
  const root = folder_registry.get(folder_id);
  if (!root) throw new Error("Folder access is no longer available...?");

  const [resolved_root, resolved_entry] = await Promise.all([
    realpath(root),
    realpath(path.join(root, ...segments)),
  ]);
  if (resolved_root !== root) throw new Error("Folder access is no longer available...?");
  const relative = path.relative(resolved_root, resolved_entry);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Folder path is outside the selected directory!");
  }
  return resolved_entry;
}

ipc_main.handle("xebrine:pick-directory", async (event) => {
  assert_internal_sender(event);
  const result = await dialog.showOpenDialog(main_window, {
    title: "Choose a music folder",
    buttonLabel: "Choose folder",
    properties: ["openDirectory"],
  });
  const { canceled, filePaths: file_paths } = result;
  if (canceled || file_paths.length === 0) return null;

  const root = await realpath(file_paths[0]);
  const info = await stat(root);
  if (!info.isDirectory()) throw new Error("The selected path is not a directory!");
  const id = random_uuid();
  folder_registry.set(id, root);
  try {
    save_folder_registry();
  } catch (error) {
    folder_registry.delete(id);
    throw error;
  }
  return { id, name: path.basename(root) || root };
});

ipc_main.handle("xebrine:list-directory", async (event, folder_id, segments) => {
  assert_internal_sender(event);
  const directory = await resolve_folder_entry(folder_id, segments);
  const entries = await readdir(directory, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isFile() || entry.isDirectory())
      .map(async (entry) => ({
        name: entry.name,
        kind: entry.isDirectory() ? "directory" : "file",
        size: entry.isFile() ? (await stat(path.join(directory, entry.name))).size : 0,
      }))
  );
});

ipc_main.handle("xebrine:read-file", async (event, folder_id, segments) => {
  assert_internal_sender(event);
  const file_path = await resolve_folder_entry(folder_id, segments);
  const info = await stat(file_path);
  if (!info.isFile()) throw new Error("The requested path is not a file!");
  const bytes = await read_file(file_path);
  return {
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    lastModified: Math.trunc(info.mtimeMs),
  };
});

ipc_main.handle("xebrine:has-directory", async (event, folder_id) => {
  assert_internal_sender(event);
  try {
    const root = await resolve_folder_entry(folder_id);
    await access(root);
    return (await stat(root)).isDirectory();
  } catch {
    return false;
  }
});

ipc_main.handle("xebrine:forget-directory", (event, folder_id) => {
  assert_internal_sender(event);
  if (typeof folder_id !== "string" || !folder_registry.delete(folder_id)) return;
  save_folder_registry();
});

ipc_main.handle("xebrine:scan-folder", async (event, request) => {
  assert_internal_sender(event);
  if (!valid_scan_request(request)) throw new Error("Invalid scan request");
  if (active_scans.has(request.requestId)) throw new Error("Scan already started");
  if ([...active_scans.values()].some((scan) => scan.sender === event.sender)) {
    throw new Error("A scan is already running");
  }

  const root = await resolve_folder_entry(request.folderId);
  const worker = new node_worker(path.join(__dirname, "scan_worker.js"), {
    workerData: { ...request, root },
  });
  active_scans.set(request.requestId, { worker, sender: event.sender });

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      active_scans.delete(request.requestId);
      void worker.terminate();
      callback();
    };
    worker.on("message", (message) => {
      if (message?.type === "progress") {
        if (!event.sender.isDestroyed()) {
          event.sender.send("xebrine:scan-progress", request.requestId, message.progress);
        }
      } else if (message?.type === "result") {
        finish(() => resolve(message.result));
      } else if (message?.type === "error") {
        finish(() => reject(new Error(message.error)));
      }
    });
    worker.on("error", (error) => finish(() => reject(error)));
    worker.on("exit", (code) => finish(() => reject(new Error(`Scanner exited (${code})`))));
  });
});

ipc_main.handle("xebrine:cancel-scan", (event, request_id) => {
  assert_internal_sender(event);
  const scan = active_scans.get(request_id);
  if (scan?.sender === event.sender) scan.worker.postMessage({ type: "cancel" });
});

function create_window() {
  main_window = new browser_window({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: app_name,
    icon: icon_path,
    autoHideMenuBar: true,
    backgroundColor: "#030003",
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  main_window.webContents.on("will-prevent-unload", (event) => event.preventDefault());

  main_window.webContents.setWindowOpenHandler(({ url }) => {
    if (is_internal(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          backgroundColor: "#0f1115",
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  main_window.webContents.on("will-navigate", (event, url) => {
    if (is_internal(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  main_window.loadURL(start_url.toString());
  create_menu();

  main_window.webContents.once("did-finish-load", () => {
    mpris_service = new xebrine_mpris(main_window);
    mpris_service.initialize();
  });

  main_window.on("closed", () => {
    for (const [id, scan] of active_scans) {
      if (scan.sender === main_window.webContents) {
        void scan.worker.terminate();
        active_scans.delete(id);
      }
    }
    mpris_service?.destroy();
    mpris_service = null;
    main_window = null;
  });
}

ipc_main.on("xebrine:state", (event, state) => {
  if (!is_internal_sender(event)) return;
  mpris_service?.update_state(state);
});

ipc_main.on("xebrine:artwork", (event, track_id, data_url) => {
  if (!is_internal_sender(event)) return;
  mpris_service?.set_artwork(track_id, data_url);
});

function create_menu() {
  const template = [
    {
      label: "File",
      submenu: [{ role: "quit", label: `Exit ${app_name}` }],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];

  menu.setApplicationMenu(menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  load_folder_registry();
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(allowed_permissions.has(permission));
  });
  ses.setPermissionCheckHandler((_contents, permission) => allowed_permissions.has(permission));

  create_window();
  app.on("activate", () => {
    if (browser_window.getAllWindows().length === 0) create_window();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
