import { fallbackTags, MAX_PARSE_FILE_SIZE, readTrackTags } from './metadata';

interface ParseRequest {
  id: number;
  handle: FileSystemFileHandle;
}

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const { id, handle } = e.data;
  const post = (msg: object) => (self as unknown as Worker).postMessage(msg);
  try {
    const file = await handle.getFile();
    if (file.size > MAX_PARSE_FILE_SIZE) {
      post({
        id,
        tags: fallbackTags(handle.name),
        warning: 'oversized',
        sizeMB: Math.round(file.size / 1024 / 1024)
      });
      return;
    }
    post({ id, tags: await readTrackTags(file) });
  } catch {
    post({ id, tags: fallbackTags(handle.name), warning: 'unreadable' });
  }
};
