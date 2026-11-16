const { app } = require("electron");
const { createHash: create_hash } = require("node:crypto");
const {
  mkdirSync: mkdir_sync,
  rmSync: rm_sync,
  writeFileSync: write_file_sync,
} = require("node:fs");
const path = require("node:path");
const { pathToFileURL: path_to_file_url } = require("node:url");

const control_channel = "xebrine:control";
const mpris_name = "xebrine";
const media_id = "com.exerinity.xebrine";
const micros = 1e6;
const max_art_bytes = 8 * 1024 * 1024;

const art_extensions = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

const statuses = {
  playing: "Playing",
  paused: "Paused",
  stopped: "Stopped",
};

class xebrine_mpris {
  constructor(window) {
    this.window = window;
    this.player = null;
    this.state = null;
    this.art_dir = path.join(app.getPath("userData"), "mpris-art");
    this.art_url = null;
    this.track_id = null;
    this.track_counter = 0;
    this.metadata_json = null;
  }

  initialize() {
    if (process.platform !== "linux") return;

    let player_class;
    try {
      player_class = require("mpris-service");
    } catch {
      return;
    }

    try {
      this.player = new player_class({
        name: mpris_name,
        identity: media_id,
        desktopEntry: "xebrine",
        supportedInterfaces: ["player"],
      });
      this.guard_bus();
    } catch {
      this.player = null;
      return;
    }

    this.reset_art_cache();

    this.player.canRaise = true;
    this.player.canQuit = true;
    this.player.canControl = true;
    this.player.canSeek = true;
    this.player.canPlay = true;
    this.player.canPause = true;
    this.player.rate = 1;
    this.player.minimumRate = 1;
    this.player.maximumRate = 1;
    this.player.playbackStatus = "Stopped";
    this.player.getPosition = () =>
      Math.round(Math.max(0, this.state?.currentSeconds ?? 0) * micros);

    this.bind_events();
  }

  bind_events() {
    this.player.on("error", (error) => {
      console.warn("mpris:", error?.message ?? error);
    });
    this.player.on("play", () => this.send("play"));
    this.player.on("pause", () => this.send("pause"));
    this.player.on("playpause", () => this.send("playpause"));
    this.player.on("stop", () => this.send("stop"));
    this.player.on("next", () => this.send("next"));
    this.player.on("previous", () => this.send("previous"));
    this.player.on("volume", (value) => this.send("volume", value));
    this.player.on("shuffle", (value) => this.send("shuffle", Boolean(value)));
    this.player.on("loopStatus", (value) => this.send("loop", value));
    this.player.on("position", (event) => this.seek_to((event?.position ?? 0) / micros));
    this.player.on("seek", (offset) => {
      this.seek_to((this.state?.currentSeconds ?? 0) + (offset ?? 0) / micros);
    });
    this.player.on("raise", () => {
      if (!this.window || this.window.isDestroyed()) return;
      if (this.window.isMinimized()) this.window.restore();
      this.window.show();
      this.window.focus();
    });
    this.player.on("quit", () => app.quit());
  }

  guard_bus() {
    const bus = this.player?._bus;
    if (!bus || bus.__xebrine_guarded) return;
    bus.__xebrine_guarded = true;
    const send = bus.send.bind(bus);
    bus.send = (message) => {
      const connection = bus._connection;
      const stream = bus._connection?.stream;
      if (connection?.state === "connected" && stream && !stream.writable) {
        console.warn("mpris: D-Bus stream closed");
        return;
      }
      try {
        return send(message);
      } catch (error) {
        console.warn("mpris:", error?.message ?? error);
      }
    };
  }

  send(control, payload) {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.webContents.send(control_channel, control, payload);
  }

  seek_to(seconds) {
    const duration = this.state?.durationSeconds || 0;
    const target = Math.min(Math.max(seconds, 0), duration || seconds);
    this.send("seek", target);
    try {
      this.player?.seeked(Math.round(target * micros));
    } catch {}
  }

  update_state(state) {
    if (!state) return;
    this.state = state;
    if (!this.player) return;

    if (state.trackId !== this.track_id) {
      this.track_id = state.trackId ?? null;
      this.track_counter += 1;
      this.art_url = null;
    }

    this.assign("playbackStatus", statuses[state.status] ?? "Stopped");
    this.assign("shuffle", Boolean(state.shuffle));
    this.assign("loopStatus", state.loop ?? "None");
    this.assign("volume", Math.round(Math.max(0, state.volume ?? 1) * 1000) / 1000);
    this.assign("canGoNext", Boolean(state.canGoNext));
    this.assign("canGoPrevious", Boolean(state.canGoPrevious));
    this.assign("canPlay", Boolean(state.trackId));
    this.assign("canPause", Boolean(state.trackId));
    this.assign("canSeek", Boolean(state.trackId) && state.durationSeconds > 0);

    this.apply_metadata();
  }

  assign(key, value) {
    if (!this.player || this.player[key] === value) return;
    try {
      this.player[key] = value;
    } catch (error) {
      console.warn("mpris:", error?.message ?? error);
    }
  }

  apply_metadata() {
    if (!this.player) return;
    const state = this.state;

    const metadata = {};
    if (state?.trackId) {
      metadata["mpris:trackid"] = this.player.objectPath(`track/${this.track_counter}`);
      metadata["mpris:length"] = Math.round(Math.max(0, state.durationSeconds || 0) * micros);
      metadata["xesam:title"] = state.title || "Unknown track";
      metadata["xesam:artist"] = [state.artist || "Unknown artist"];
      metadata["xesam:album"] = state.album || "Unknown album";
      if (this.art_url) metadata["mpris:artUrl"] = this.art_url;
    }

    const json = JSON.stringify(metadata);
    if (json === this.metadata_json) return;
    this.metadata_json = json;
    try {
      this.player.metadata = metadata;
    } catch (error) {
      console.warn("mpris:", error?.message ?? error);
    }
  }

  set_artwork(track_id, data_url) {
    if (!this.player) return;
    if (track_id !== this.track_id) return;

    this.art_url = data_url ? this.write_art(data_url) : null;
    this.apply_metadata();
  }

  write_art(data_url) {
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(data_url);
    if (!match) return null;

    const [, mime, payload] = match;
    if (payload.length > max_art_bytes) return null;

    try {
      const bytes = Buffer.from(payload, "base64");
      const extension = art_extensions[mime.toLowerCase()] ?? "img";
      const name = `${create_hash("sha1").update(bytes).digest("hex")}.${extension}`;
      const file = path.join(this.art_dir, name);
      write_file_sync(file, bytes);
      return path_to_file_url(file).href;
    } catch {
      return null;
    }
  }

  reset_art_cache() {
    try {
      rm_sync(this.art_dir, { recursive: true, force: true });
      mkdir_sync(this.art_dir, { recursive: true });
    } catch {}
  }

  destroy() {
    try {
      this.player?.removeAllListeners();
      const bus = this.player?.bus ?? this.player?._bus;
      bus?.disconnect?.();
    } catch {}
    this.player = null;
    this.window = null;
    this.state = null;
  }
}

module.exports = { xebrine_mpris };
