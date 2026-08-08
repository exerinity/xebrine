import { DurableObject } from 'cloudflare:workers';
import { PIN_LENGTH, PIN_TTL_MS } from '../../utils/remote_protocol';

interface PinRecord {
  session: string;
  expiresAt: number;
}

const PREFIX = 'pin:';
const MAX_ATTEMPTS = 12;
const SWEEP_LIMIT = 512;

function randomPin(): string {
  const digits = new Uint8Array(PIN_LENGTH);
  crypto.getRandomValues(digits);
  let pin = '';
  for (const byte of digits) pin += String(byte % 10);
  return pin;
}

export class RemoteDirectory extends DurableObject<Env> {
  async claim(session: string): Promise<{ pin: string; expiresAt: number }> {
    await this.sweep();
    const now = Date.now();
    const expiresAt = now + PIN_TTL_MS;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const pin = randomPin();
      const taken = await this.ctx.storage.get<PinRecord>(PREFIX + pin);
      if (taken && taken.expiresAt > now) continue;
      await this.ctx.storage.put(PREFIX + pin, { session, expiresAt });
      return { pin, expiresAt };
    }
    throw new Error('Could not allocate a PIN, try again');
  }

  async lookup(pin: string): Promise<string | null> {
    const record = await this.ctx.storage.get<PinRecord>(PREFIX + pin);
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      await this.ctx.storage.delete(PREFIX + pin);
      return null;
    }
    return record.session;
  }

  async release(pin: string): Promise<void> {
    await this.ctx.storage.delete(PREFIX + pin);
  }

  private async sweep(): Promise<void> {
    const now = Date.now();
    const entries = await this.ctx.storage.list<PinRecord>({ prefix: PREFIX, limit: SWEEP_LIMIT });
    const stale: string[] = [];
    for (const [key, record] of entries) {
      if (record.expiresAt <= now) stale.push(key);
    }
    if (stale.length > 0) await this.ctx.storage.delete(stale);
  }
}
