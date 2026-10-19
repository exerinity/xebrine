const { open, readFile, readdir, realpath, stat } = require("node:fs/promises");
const path = require("node:path");
const { parentPort, workerData } = require("node:worker_threads");
const { default: media_info_factory, isTrackType: is_track_type } = require("mediainfo.js");

const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "mp4", "aac", "flac", "ogg", "oga", "opus", "wav", "webm"]);
const PLAYLIST_EXTENSIONS = new Set(["m3u", "m3u8", "pls"]);
const PARSER_COUNT = 4;
const PROGRESS_INTERVAL_MS = 100;
const wasm_path = require.resolve("mediainfo.js/MediaInfoModule.wasm");

let cancelled = false;
parentPort.on("message", (message) => {
  if (message?.type === "cancel") cancelled = true;
});

function fallback_tags(name) {
  const dot = name.lastIndexOf(".");
  return {
    title: dot > 0 ? name.slice(0, dot) : name,
    artist: "Unknown Artist",
    album: "Unknown Album",
    duration: 0,
    hasTitleTag: false,
    hasArtistTag: false,
    hasAlbumTag: false,
    hasCoverArt: false,
  };
}

function first_nonempty(...values) {
  return values.map((value) => typeof value === "string" ? value.trim() : value).find(Boolean);
}

function parse_year(value) {
  const match = value?.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
  return match ? Number(match[1]) : undefined;
}

function tags_from_media_info(name, general, audio) {
  const fallback = fallback_tags(name);
  const title = first_nonempty(general.Title, general.Track);
  const artist = first_nonempty(general.Performer);
  const album = first_nonempty(general.Album);
  return {
    title: title ?? fallback.title,
    artist: artist ?? fallback.artist,
    album: album ?? fallback.album,
    albumArtist: first_nonempty(general.Album_Performer),
    duration: audio.Duration ?? general.Duration ?? 0,
    trackNo: general.Track_Position,
    year: parse_year(general.Recorded_Date),
    genre: first_nonempty(general.Genre),
    hasTitleTag: title !== undefined,
    hasArtistTag: artist !== undefined,
    hasAlbumTag: album !== undefined,
    hasCoverArt: general.Cover === "Yes",
  };
}

function is_inside_root(file_path) {
  const relative = path.relative(workerData.root, file_path);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function safe_path(segments) {
  const resolved = await realpath(path.join(workerData.root, ...segments));
  if (!is_inside_root(resolved)) throw new Error("Path outside selected folder");
  return resolved;
}

function audio_file(name) {
  return AUDIO_EXTENSIONS.has(name.split(".").pop()?.toLowerCase());
}

function playlist_file(name) {
  return PLAYLIST_EXTENSIONS.has(name.split(".").pop()?.toLowerCase());
}

function playlist_name(file_name) {
  const dot = file_name.lastIndexOf(".");
  return (dot > 0 ? file_name.slice(0, dot) : file_name).trim() || "Untitled playlist";
}

function decode_path(value) {
  const trimmed = value.trim().replace(/^file:\/\//i, "");
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function normalize_segments(segments) {
  const result = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") result.pop();
    else result.push(segment);
  }
  return result;
}

function playlist_entries(file_name, content) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (file_name.toLowerCase().endsWith(".pls")) {
    return lines
      .map((line) => {
        const match = /^File(\d+)\s*=\s*(.*)$/i.exec(line);
        return match ? { index: Number(match[1]), value: match[2].trim() } : null;
      })
      .filter((entry) => entry?.value)
      .sort((a, b) => a.index - b.index)
      .map((entry) => entry.value);
  }
  return lines.map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
}

function resolve_track_id(entry, playlist_path, tracks_by_path, tracks_by_name) {
  if (/^(?:https?|rtsp):\/\//i.test(entry)) return null;
  let file_path = decode_path(entry).replace(/\\/g, "/");
  file_path = file_path.replace(/^\/[a-z]:\//i, "").replace(/^[a-z]:\//i, "").replace(/^\/+/, "");
  const raw_segments = file_path.split("/");
  const relative = normalize_segments([...playlist_path.slice(0, -1), ...raw_segments]);
  const direct = tracks_by_path.get(relative.join("/").toLowerCase());
  if (direct) return direct.id;

  const normalized = normalize_segments(raw_segments).join("/").toLowerCase();
  const exact = tracks_by_path.get(normalized);
  if (exact) return exact.id;

  const normalized_segments = normalized.split("/");
  for (let index = 1; index < normalized_segments.length - 1; index++) {
    const suffix = tracks_by_path.get(normalized_segments.slice(index).join("/"));
    if (suffix) return suffix.id;
  }

  const file_name = raw_segments.at(-1)?.toLowerCase();
  return file_name ? tracks_by_name.get(file_name)?.id ?? null : null;
}

function parse_playlist(library_folder_id, segments, file_name, content, tracks) {
  const tracks_by_path = new Map(tracks.map((track) => [track.relPath.join("/").toLowerCase(), track]));
  const tracks_by_name = new Map();
  for (const track of tracks) {
    const key = track.fileName.toLowerCase();
    tracks_by_name.set(key, tracks_by_name.has(key) ? null : track);
  }
  const track_ids = [];
  for (const entry of playlist_entries(file_name, content)) {
    const id = resolve_track_id(entry, segments, tracks_by_path, tracks_by_name);
    if (id) track_ids.push(id);
  }
  return {
    id: `${library_folder_id}:${segments.join("/")}`,
    folderId: library_folder_id,
    relPath: segments,
    fileName: file_name,
    name: playlist_name(file_name),
    trackIds: track_ids,
  };
}

function ignored_format(name) {
  return workerData.rules.formats.includes(name.split(".").pop()?.toLowerCase());
}

function ignored_size(size) {
  const max = workerData.rules.maxSizeBytes;
  return max !== null && size > max;
}

function hidden_by_rules(track) {
  const rules = workerData.rules;
  return Boolean(
    (rules.missingCover && !track.hasCoverArt) ||
    (rules.missingAlbum && !track.hasAlbumTag) ||
    (rules.missingArtist && !track.hasArtistTag) ||
    (rules.missingTitle && !track.hasTitleTag) ||
    (rules.missingAllTags && !track.hasTitleTag && !track.hasArtistTag && !track.hasAlbumTag) ||
    ignored_format(track.fileName) ||
    ignored_size(track.sizeBytes)
  );
}

async function parse_tags(parser, file_path, name, size) {
  const handle = await open(file_path, "r");
  try {
    const result = await parser.analyzeData(size, async (length, offset) => {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      return buffer.subarray(0, bytesRead);
    });
    const tracks = result.media?.track ?? [];
    const general = tracks.find((track) => is_track_type(track, "General"));
    const audio = tracks.find((track) => is_track_type(track, "Audio"));
    if (!general || !audio) throw new Error("No readable audio stream");
    return { tags: tags_from_media_info(name, general, audio) };
  } catch {
    return { tags: fallback_tags(name), warning: "unreadable" };
  } finally {
    await handle.close();
  }
}

async function scan() {
  const { libraryFolderId, folderName, mode, existingTracks } = workerData;
  const existing_by_id = new Map(existingTracks.map((track) => [track.id, track]));
  const skipped = [];
  const sources = [];
  const playlist_sources = [];
  const directories = [[]];
  const ordered_tracks = [];
  const changed_tracks = [];
  let complete = true;
  let done = 0;
  let excluded = 0;
  let hidden = 0;
  let audio_seconds = 0;
  let current_file_path = "";
  let discovering = true;
  let last_progress_at = 0;

  function report_progress(force = false) {
    const now = performance.now();
    if (!force && now - last_progress_at < PROGRESS_INTERVAL_MS) return;
    last_progress_at = now;
    parentPort.postMessage({
      type: "progress",
      progress: {
        currentFilePath: current_file_path,
        done,
        total: sources.length + playlist_sources.length,
        omitted: excluded + hidden,
        audioSeconds: audio_seconds,
        discovering,
      },
    });
  }

  function record_track(track, order, changed) {
    ordered_tracks.push({ track, order });
    if (changed) changed_tracks.push(track);
    if (hidden_by_rules(track)) hidden++;
    if (Number.isFinite(track.duration)) audio_seconds += track.duration;
  }

  while (directories.length && !cancelled) {
    const batch = directories.splice(0, 6);
    const listed = await Promise.all(batch.map(async (segments) => {
      try {
        const directory = await safe_path(segments);
        return { segments, entries: await readdir(directory, { withFileTypes: true }) };
      } catch {
        complete = false;
        skipped.push({ path: [folderName, ...segments].join("/"), reason: "folder could not be listed" });
        return null;
      }
    }));
    for (const item of listed) {
      if (!item) continue;
      for (const entry of item.entries) {
        if (cancelled) break;
        const segments = [...item.segments, entry.name];
        if (entry.isDirectory()) directories.push(segments);
        else if (entry.isFile() && audio_file(entry.name)) {
          const id = `${libraryFolderId}:${segments.join("/")}`;
          if (mode === "new" && existing_by_id.has(id)) continue;
          if (ignored_format(entry.name)) {
            excluded++;
            continue;
          }
          sources.push({ id, segments, name: entry.name });
        } else if (entry.isFile() && playlist_file(entry.name)) {
          playlist_sources.push({ segments, name: entry.name });
        }
      }
    }
    report_progress();
  }

  discovering = false;
  report_progress(true);

  let next_source = 0;
  async function process_sources() {
    let parser;
    while (!cancelled && next_source < sources.length) {
      const order = next_source++;
      const source = sources[order];
      const existing = existing_by_id.get(source.id);
      const display_path = [folderName, ...source.segments].join("/");
      current_file_path = display_path;
      try {
        const file_path = await safe_path(source.segments);
        const info = await stat(file_path);
        if (!info.isFile()) throw new Error("not a file");
        if (ignored_size(info.size)) {
          excluded++;
        } else {
          const modified = Math.trunc(info.mtimeMs);
          if (
            mode === "full" && existing?.lastModified !== undefined &&
            existing.lastModified === modified && existing.sizeBytes === info.size
          ) {
            record_track(existing, order, false);
          } else {
            parser ??= await media_info_factory({
              format: "object",
              coverData: false,
              full: false,
              locateFile: () => wasm_path,
            });
            const parsed = await parse_tags(parser, file_path, source.name, info.size);
            const track = {
              id: source.id,
              folderId: libraryFolderId,
              relPath: source.segments,
              fileName: source.name,
              sizeBytes: info.size,
              lastModified: parsed.warning ? undefined : modified,
              ...parsed.tags,
            };
            if (parsed.warning) skipped.push({ path: display_path, reason: "unreadable or corrupt" });
            record_track(track, order, true);
          }
        }
      } catch {
        skipped.push({ path: display_path, reason: "could not be read" });
        if (mode === "full" && existing) record_track(existing, order, false);
      }
      done++;
      report_progress();
    }
  }

  if (!cancelled && sources.length) {
    await Promise.all(Array.from({ length: Math.min(PARSER_COUNT, sources.length) }, process_sources));
  }
  ordered_tracks.sort((a, b) => a.order - b.order);
  const tracks = ordered_tracks.map(({ track }) => track);
  const playlist_tracks = mode === "new" ? [...existingTracks, ...tracks] : tracks;
  const playlists = [];
  for (const source of playlist_sources) {
    if (cancelled) break;
    const display_path = [folderName, ...source.segments].join("/");
    current_file_path = display_path;
    try {
      const file_path = await safe_path(source.segments);
      const content = await readFile(file_path, "utf8");
      playlists.push(parse_playlist(libraryFolderId, source.segments, source.name, content, playlist_tracks));
    } catch {
      skipped.push({ path: display_path, reason: "playlist could not be read" });
    }
    done++;
    report_progress();
  }
  report_progress(true);
  const returned_ids = new Set(tracks.map((track) => track.id));
  const finished = complete && !cancelled;
  return {
    tracks,
    playlists,
    changedTracks: changed_tracks,
    removedTrackIds: mode === "full" && finished
      ? existingTracks.filter((track) => !returned_ids.has(track.id)).map((track) => track.id)
      : [],
    skipped,
    excluded,
    aborted: cancelled,
    complete: finished,
  };
}

scan().then(
  (result) => parentPort.postMessage({ type: "result", result }),
  (error) => parentPort.postMessage({ type: "error", error: error?.message ?? String(error) })
);
