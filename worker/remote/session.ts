import { DurableObject } from 'cloudflare:workers';
import {
  asCommand,
  IDLE_NO_COMMAND_MS,
  IDLE_NO_REMOTE_MS,
  KEEPALIVE_PING,
  KEEPALIVE_PONG,
  MAX_CONTROLLERS,
  MAX_PENDING,
  MAX_QUEUE_ENTRIES,
  type ControlInbound,
  type HostInbound,
  type RemotePeer,
  type RemoteQueueEntry,
  type RemoteState
} from '../../utils/remote_protocol';
import { decodePeer } from './device';

const HOST_TAG = 'host';
const CTL_PREFIX = 'ctl:';
const CLOSE_NORMAL = 1000;
const CLOSE_REJECTED = 4001;

interface HostAttachment {
  role: 'host';
  peer: RemotePeer;
}

interface ControlAttachment {
  role: 'control';
  peer: RemotePeer;
  approved: boolean;
}

type Attachment = HostAttachment | ControlAttachment;

export class RemoteSession extends DurableObject<Env> {
  private get directory() {
    return this.env.REMOTE_DIRECTORY.get(this.env.REMOTE_DIRECTORY.idFromName('index'));
  }

  private attachmentOf(ws: WebSocket): Attachment | null {
    const raw = ws.deserializeAttachment();
    return raw && typeof raw === 'object' ? (raw as Attachment) : null;
  }

  private hostSocket(): WebSocket | null {
    return this.ctx.getWebSockets(HOST_TAG)[0] ?? null;
  }

  private controllers(): { ws: WebSocket; attachment: ControlAttachment }[] {
    const found: { ws: WebSocket; attachment: ControlAttachment }[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentOf(ws);
      if (attachment?.role === 'control') found.push({ ws, attachment });
    }
    return found;
  }

  private controlSocket(id: string): WebSocket | null {
    return this.ctx.getWebSockets(CTL_PREFIX + id)[0] ?? null;
  }

  private toHost(message: HostInbound): void {
    this.hostSocket()?.send(JSON.stringify(message));
  }

  private toControl(ws: WebSocket, message: ControlInbound): void {
    ws.send(JSON.stringify(message));
  }

  private broadcast(message: ControlInbound): void {
    const payload = JSON.stringify(message);
    for (const { ws, attachment } of this.controllers()) {
      if (attachment.approved) ws.send(payload);
    }
  }

  private approvedCount(): number {
    return this.controllers().filter(({ attachment }) => attachment.approved).length;
  }

  private async deadline(): Promise<{ at: number; reason: string } | null> {
    if (!this.hostSocket()) return null;
    if (this.approvedCount() === 0) {
      const emptySince = (await this.ctx.storage.get<number>('emptySince')) ?? Date.now();
      return {
        at: emptySince + IDLE_NO_REMOTE_MS,
        reason: 'A remote was not connected for 5 minutes, so the session was closed'
      };
    }
    const lastCommandAt = (await this.ctx.storage.get<number>('lastCommandAt')) ?? Date.now();
    return {
      at: lastCommandAt + IDLE_NO_COMMAND_MS,
      reason: 'No remotes sent any commands for 5 minutes, so the session was closed'
    };
  }

  private async arm(): Promise<void> {
    const next = await this.deadline();
    if (next) await this.ctx.storage.setAlarm(next.at);
  }

  async alarm(): Promise<void> {
    const next = await this.deadline();
    if (!next) return;
    if (Date.now() >= next.at) {
      await this.expire(next.reason);
      return;
    }
    await this.ctx.storage.setAlarm(next.at);
  }

  private async expire(reason: string): Promise<void> {
    const host = this.hostSocket();
    for (const { ws } of this.controllers()) {
      this.toControl(ws, { t: 'ended', reason });
      ws.serializeAttachment(null);
      ws.close(CLOSE_NORMAL, 'idle');
    }
    if (host) {
      host.send(JSON.stringify({ t: 'expired', reason } satisfies HostInbound));
      host.serializeAttachment(null);
      host.close(CLOSE_NORMAL, 'idle');
    }
    const pin = await this.ctx.storage.get<string>('pin');
    if (pin) await this.directory.release(pin);
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }
    const url = new URL(request.url);
    if (url.pathname === '/host') return this.acceptHost(request);
    if (url.pathname === '/join') return this.acceptControl(request);
    return new Response('Not found', { status: 404 });
  }

  private async acceptHost(request: Request): Promise<Response> {
    if (this.hostSocket()) {
      return new Response('This session already has a host', { status: 409 });
    }

    const peer = decodePeer(request, 'host');
    const { pin, expiresAt } = await this.directory.claim(this.ctx.id.toString());
    await this.ctx.storage.put({ pin, expiresAt, hostPeer: peer, emptySince: Date.now() });

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [HOST_TAG]);
    pair[1].serializeAttachment({ role: 'host', peer } satisfies HostAttachment);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(KEEPALIVE_PING, KEEPALIVE_PONG)
    );
    pair[1].send(JSON.stringify({ t: 'ready', pin, expiresAt, peer } satisfies HostInbound));
    await this.arm();

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private async acceptControl(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const reject = (message: string): Response => {
      pair[1].accept();
      pair[1].send(JSON.stringify({ t: 'error', message } satisfies ControlInbound));
      pair[1].close(CLOSE_REJECTED, 'rejected');
      return new Response(null, { status: 101, webSocket: pair[0] });
    };

    if (!this.hostSocket()) return reject('That session is no longer available');

    const existing = this.controllers();
    if (existing.length >= MAX_CONTROLLERS) {
      return reject('This session already has the maximum number of remotes');
    }
    if (existing.filter(({ attachment }) => !attachment.approved).length >= MAX_PENDING) {
      return reject('Too many remotes are already waiting to be approved');
    }

    const peer = decodePeer(request, crypto.randomUUID());
    this.ctx.acceptWebSocket(pair[1], [CTL_PREFIX + peer.id]);
    pair[1].serializeAttachment({ role: 'control', peer, approved: false } satisfies ControlAttachment);
    this.toControl(pair[1], { t: 'pending' });
    this.toHost({ t: 'request', peer });

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string' || message === KEEPALIVE_PING) return;
    const attachment = this.attachmentOf(ws);
    if (!attachment) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;

    if (attachment.role === 'host') await this.onHostMessage(parsed as Record<string, unknown>);
    else await this.onControlMessage(attachment, parsed as Record<string, unknown>);
  }

  private async onHostMessage(msg: Record<string, unknown>): Promise<void> {
    switch (msg.t) {
      case 'approve': {
        const target = typeof msg.id === 'string' ? this.controlSocket(msg.id) : null;
        const attachment = target && (this.attachmentOf(target) as ControlAttachment | null);
        if (!target || !attachment || attachment.approved) return;
        target.serializeAttachment({ ...attachment, approved: true } satisfies ControlAttachment);
        const hostPeer = await this.ctx.storage.get<RemotePeer>('hostPeer');
        if (hostPeer) this.toControl(target, { t: 'approved', host: hostPeer });
        this.toHost({ t: 'joined', peer: attachment.peer });
        await this.ctx.storage.put({ emptySince: 0, lastCommandAt: Date.now() });
        await this.arm();
        return;
      }

      case 'deny':
      case 'kick': {
        const target = typeof msg.id === 'string' ? this.controlSocket(msg.id) : null;
        const attachment = target && (this.attachmentOf(target) as ControlAttachment | null);
        if (!target || !attachment) return;
        if (msg.t === 'deny' && !attachment.approved) this.toControl(target, { t: 'denied' });
        else this.toControl(target, { t: 'ended', reason: 'The host disconnected this remote' });
        target.serializeAttachment(null);
        target.close(CLOSE_NORMAL, 'closed by host');
        return;
      }

      case 'regen': {
        const previous = await this.ctx.storage.get<string>('pin');
        const { pin, expiresAt } = await this.directory.claim(this.ctx.id.toString());
        if (previous) await this.directory.release(previous);
        await this.ctx.storage.put({ pin, expiresAt });
        this.toHost({ t: 'pin', pin, expiresAt });
        return;
      }

      case 'state': {
        const state = asState(msg.state);
        if (state) this.broadcast({ t: 'state', state });
        return;
      }

      case 'queue': {
        const items = asQueue(msg.items);
        if (items) this.broadcast({ t: 'queue', items });
        return;
      }
    }
  }

  private async onControlMessage(
    attachment: ControlAttachment,
    msg: Record<string, unknown>
  ): Promise<void> {
    if (msg.t !== 'cmd' || !attachment.approved) return;
    const cmd = asCommand(msg.cmd);
    if (!cmd) return;
    this.toHost({ t: 'command', id: attachment.peer.id, cmd });
    await this.ctx.storage.put('lastCommandAt', Date.now());
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.onSocketGone(ws);
    try {
      ws.close(CLOSE_NORMAL, 'closed');
    } catch {
      null;
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.onSocketGone(ws);
  }

  private async onSocketGone(ws: WebSocket): Promise<void> {
    const attachment = this.attachmentOf(ws);
    ws.serializeAttachment(null);
    if (!attachment) return;

    if (attachment.role === 'control') {
      this.toHost(
        attachment.approved ? { t: 'left', id: attachment.peer.id } : { t: 'withdrawn', id: attachment.peer.id }
      );
      if (this.hostSocket() && this.approvedCount() === 0) {
        await this.ctx.storage.put('emptySince', Date.now());
        await this.arm();
      }
      return;
    }

    const pin = await this.ctx.storage.get<string>('pin');
    if (pin) await this.directory.release(pin);
    for (const { ws: control } of this.controllers()) {
      this.toControl(control, { t: 'ended', reason: 'The playing device disconnected' });
      control.serializeAttachment(null);
      control.close(CLOSE_NORMAL, 'host gone');
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 300) : '';
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asState(raw: unknown): RemoteState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const repeat = s.repeatMode;
  return {
    hasTrack: s.hasTrack === true,
    title: text(s.title),
    artist: text(s.artist),
    album: text(s.album),
    currentTime: num(s.currentTime),
    duration: num(s.duration),
    isPlaying: s.isPlaying === true,
    volume: num(s.volume),
    maxVolume: num(s.maxVolume) || 1,
    shuffled: s.shuffled === true,
    repeatMode: repeat === 'all' || repeat === 'one' ? repeat : 'off',
    position: Number.isInteger(s.position) ? (s.position as number) : -1
  };
}

function asQueue(raw: unknown): RemoteQueueEntry[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.slice(0, MAX_QUEUE_ENTRIES).map((entry) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    return {
      key: text(e.key),
      title: text(e.title),
      artist: text(e.artist),
      duration: num(e.duration)
    };
  });
}
