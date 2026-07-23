import { fallbackTags, readTrackTags } from './metadata';

interface ParseRequest {
  id: number;
  handle: FileSystemFileHandle;
}

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const { id, handle } = e.data;
  const post = (msg: object) => (self as unknown as Worker).postMessage(msg);
  try {
    const file = await handle.getFile();
    post({ id, tags: await readTrackTags(file) });
  } catch {
    post({ id, tags: fallbackTags(handle.name), warning: 'unreadable' });
  }
};
