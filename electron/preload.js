const { contextBridge: context_bridge, ipcRenderer: ipc_renderer } = require("electron");

const control_channel = "xebrine:control";

context_bridge.exposeInMainWorld("xebrineShell", {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },

  pickDirectory: () => ipc_renderer.invoke("xebrine:pick-directory"),
  listDirectory: (folder_id, relative_path) =>
    ipc_renderer.invoke("xebrine:list-directory", folder_id, relative_path),
  readFile: (folder_id, relative_path) =>
    ipc_renderer.invoke("xebrine:read-file", folder_id, relative_path),
  hasDirectory: (folder_id) => ipc_renderer.invoke("xebrine:has-directory", folder_id),
  forgetDirectory: (folder_id) => ipc_renderer.invoke("xebrine:forget-directory", folder_id),

  updateState: (state) => ipc_renderer.send("xebrine:state", state),
  setArtwork: (track_id, data_url) => ipc_renderer.send("xebrine:artwork", track_id, data_url),

  onControl: (callback) => {
    ipc_renderer.on(control_channel, (_event, control, payload) => callback(control, payload));
  },

  offControl: () => {
    ipc_renderer.removeAllListeners(control_channel);
  },
});
