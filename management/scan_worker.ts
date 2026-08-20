import { fallbackTags, readTrackTags } from './metadata';

interface ParseRequest {
  id: number;
  file: File;
  name: string;
}

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const { id, file, name } = e.data;
  const post = (msg: object) => (self as unknown as Worker).postMessage(msg);
  try {
    post({ id, tags: await readTrackTags(file) });
  } catch {
    post({ id, tags: fallbackTags(name), warning: 'unreadable' });
  }
};
