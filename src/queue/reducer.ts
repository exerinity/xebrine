import type { QueueItem, TrackMeta } from '../types';

export interface QueueState {
  items: QueueItem[];
  position: number;
  shuffled: boolean;
  original: QueueItem[] | null;
}

export const initialQueue: QueueState = {
  items: [],
  position: -1,
  shuffled: false,
  original: null
};

export function makeItems(tracks: TrackMeta[]): QueueItem[] {
  return tracks.map((track) => ({ key: crypto.randomUUID(), track }));
}

export type QueueAction =
  | { type: 'SET'; items: QueueItem[]; position: number }
  | { type: 'ENQUEUE_NEXT'; items: QueueItem[] }
  | { type: 'ENQUEUE_END'; items: QueueItem[] }
  | { type: 'REMOVE'; index: number }
  | { type: 'MOVE'; from: number; to: number }
  | { type: 'JUMP'; index: number }
  | { type: 'ADVANCE'; delta: number }
  | { type: 'APPLY_SHUFFLE'; upcoming: QueueItem[] }
  | { type: 'UNSHUFFLE' }
  | { type: 'KEEP_CURRENT' }
  | { type: 'CLEAR' };

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'SET':
      return { items: action.items, position: action.position, shuffled: false, original: null };

    case 'ENQUEUE_NEXT': {
      const at = Math.min(state.position + 1, state.items.length);
      const items = [...state.items.slice(0, at), ...action.items, ...state.items.slice(at)];
      return { ...state, items, position: state.position < 0 ? 0 : state.position };
    }

    case 'ENQUEUE_END':
      return {
        ...state,
        items: [...state.items, ...action.items],
        position: state.position < 0 ? 0 : state.position,
        original: state.original ? [...state.original, ...action.items] : null
      };

    case 'REMOVE': {
      const items = state.items.filter((_, i) => i !== action.index);
      let position = state.position;
      if (action.index < position) position--;
      if (position >= items.length) position = items.length - 1;
      return { ...state, items, position };
    }

    case 'MOVE': {
      const { from, to } = action;
      if (from === to || from < 0 || from >= state.items.length) return state;
      const items = [...state.items];
      const [moved] = items.splice(from, 1);
      items.splice(Math.min(to, items.length), 0, moved);
      let position = state.position;
      if (from === position) {
        position = to;
      } else {
        if (from < position) position--;
        if (to <= position) position++;
      }
      return { ...state, items, position };
    }

    case 'JUMP':
      if (action.index < 0 || action.index >= state.items.length) return state;
      return { ...state, position: action.index };

    case 'ADVANCE': {
      const position = state.position + action.delta;
      if (position < 0 || position >= state.items.length) return state;
      return { ...state, position };
    }

    case 'APPLY_SHUFFLE':
      return {
        ...state,
        items: [...state.items.slice(0, state.position + 1), ...action.upcoming],
        shuffled: true,
        original: state.original ?? state.items
      };

    case 'UNSHUFFLE': {
      if (!state.original) return { ...state, shuffled: false, original: null };
      const upcomingKeys = new Set(state.items.slice(state.position + 1).map((i) => i.key));
      const restored = state.original.filter((i) => upcomingKeys.has(i.key));
      const restoredKeys = new Set(restored.map((i) => i.key));
      const extras = state.items
        .slice(state.position + 1)
        .filter((i) => !restoredKeys.has(i.key));
      return {
        ...state,
        items: [...state.items.slice(0, state.position + 1), ...restored, ...extras],
        shuffled: false,
        original: null
      };
    }

    case 'KEEP_CURRENT': {
      const current = state.items[state.position];
      if (!current) return initialQueue;
      return { items: [current], position: 0, shuffled: false, original: null };
    }

    case 'CLEAR':
      return initialQueue;
  }
}
