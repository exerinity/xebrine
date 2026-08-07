/**
 * @typedef {Object} ScrobbleItem
 * @property {string} artist
 * @property {string} track
 * @property {string} [album]
 * @property {string} [albumArtist]
 * @property {number} [duration]
 * @property {number} [trackNumber]
 * @property {number} timestamp
 */

export class LastfmError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'LastfmError';
  }
}
