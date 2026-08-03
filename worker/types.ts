export interface ScrobbleItem {
  artist: string;
  track: string;
  album?: string;
  albumArtist?: string;
  duration?: number;
  trackNumber?: number;
  timestamp: number;
}

export class LastfmError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number
  ) {
    super(message);
    this.name = 'LastfmError';
  }
}
