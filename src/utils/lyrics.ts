import type { LyricLine, Lyrics } from '../types';

function sortLines(lines: LyricLine[]): LyricLine[] {
  return lines.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

export function parseLrc(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  let offsetMs = 0;
  for (const raw of text.split(/\r?\n/)) {
    const offsetMatch = raw.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]/i);
    if (offsetMatch) {
      offsetMs = parseInt(offsetMatch[1], 10);
      continue;
    }
    const timeRe = /\[(\d+):(\d{1,2}(?:\.\d{1,3})?)\]/g;
    const times: number[] = [];
    let m: RegExpExecArray | null;
    let lastIndex = 0;
    while ((m = timeRe.exec(raw))) {
      times.push(parseInt(m[1], 10) * 60 + parseFloat(m[2]));
      lastIndex = timeRe.lastIndex;
    }
    if (times.length === 0) continue;
    const content = raw
      .slice(lastIndex)
      .replace(/<\d+:\d+(?:\.\d+)?>/g, '')
      .trim();
    for (const t of times) {
      lines.push({ time: Math.max(0, t - offsetMs / 1000), text: content });
    }
  }
  return sortLines(lines);
}

export function parseSrt(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const blocks = text.replace(/^﻿/, '').split(/\r?\n\s*\r?\n/);
  for (const block of blocks) {
    const rows = block.split(/\r?\n/).filter((r) => r.trim().length > 0);
    const timeIdx = rows.findIndex((r) => r.includes('-->'));
    if (timeIdx === -1) continue;
    const m = rows[timeIdx].match(/(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/);
    if (!m) continue;
    const time = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, '0') / 1000;
    const content = rows
      .slice(timeIdx + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (content) lines.push({ time, text: content });
  }
  return sortLines(lines);
}

export function parseVtt(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const body = text.replace(/^﻿/, '');
  const blocks = body.split(/\r?\n\s*\r?\n/);
  for (const block of blocks) {
    const rows = block.split(/\r?\n/).filter((r) => r.trim().length > 0);
    if (rows.length === 0) continue;
    const first = rows[0].trim();
    if (/^(WEBVTT|NOTE|STYLE|REGION)/.test(first)) continue;
    const timeIdx = rows.findIndex((r) => r.includes('-->'));
    if (timeIdx === -1) continue;
    const m = rows[timeIdx].match(/(?:(\d+):)?(\d{1,2}):(\d{2})\.(\d{3})/);
    if (!m) continue;
    const time = (m[1] ? +m[1] * 3600 : 0) + +m[2] * 60 + +m[3] + +m[4] / 1000;
    const content = rows
      .slice(timeIdx + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (content) lines.push({ time, text: content });
  }
  return sortLines(lines);
}

export function toLrc(lines: LyricLine[]): string {
  return lines
    .filter((l) => l.time !== null)
    .map((l) => {
      const t = l.time as number;
      const m = Math.floor(t / 60);
      const s = (t % 60).toFixed(2).padStart(5, '0');
      return `[${String(m).padStart(2, '0')}:${s}]${l.text}`;
    })
    .join('\n');
}

type LyricFormat = 'lrc' | 'srt' | 'vtt' | 'plain';

function detectFormat(fileName: string, text: string): LyricFormat {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'lrc' || ext === 'srt' || ext === 'vtt') return ext;
  if (/^﻿?WEBVTT/.test(text)) return 'vtt';
  if (text.includes('-->')) return 'srt';
  if (/\[\d+:\d{1,2}(?:\.\d{1,3})?\]/.test(text)) return 'lrc';
  return 'plain';
}

export function parseLyricsFile(fileName: string, text: string): Lyrics | null {
  const format = detectFormat(fileName, text);
  let lines: LyricLine[];
  switch (format) {
    case 'lrc':
      lines = parseLrc(text);
      break;
    case 'srt':
      lines = parseSrt(text);
      break;
    case 'vtt':
      lines = parseVtt(text);
      break;
    case 'plain':
      lines = text
        .split(/\r?\n/)
        .map((t) => ({ time: null, text: t.trim() }))
        .filter((l) => l.text.length > 0);
      break;
  }
  if (lines.length === 0) return null;
  const synced = lines.every((l) => l.time !== null);
  return { synced, source: 'file', lines };
}
