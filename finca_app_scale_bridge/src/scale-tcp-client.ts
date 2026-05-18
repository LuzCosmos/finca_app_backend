import * as net from 'net';
import { ScaleFrameParser } from './scale-frame-parser';
import { ScaleStabilityDetector } from './scale-stability-detector';
import { ScaleBackendPublisher } from './scale-backend-publisher';

export interface ScaleTcpClientOptions {
  host: string;
  port: number;
  connectTimeoutMs: number;
  reconnectBaseMs: number;
  reconnectMaxMs: number;
  parser: ScaleFrameParser;
  stability: ScaleStabilityDetector;
  publisher: ScaleBackendPublisher;
  onLog?: (msg: string) => void;
}

export class ScaleTcpClient {
  private socket: net.Socket | null = null;
  private reconnectAttempt = 0;
  private stopped = false;
  private lastPublishErrorLogMs = 0;

  constructor(private readonly options: ScaleTcpClientOptions) {}

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.socket?.destroy();
    this.socket = null;
  }

  private log(msg: string): void {
    this.options.onLog?.(msg);
  }

  private connect(): void {
    if (this.stopped) return;
    const { host, port, connectTimeoutMs } = this.options;
    const socket = new net.Socket();
    this.socket = socket;
    let connected = false;

    const timeout = setTimeout(() => {
      if (!connected) {
        socket.destroy();
        this.scheduleReconnect();
      }
    }, connectTimeoutMs);

    socket.connect(port, host, () => {
      connected = true;
      clearTimeout(timeout);
      this.reconnectAttempt = 0;
      this.log(`Connected to scale at ${host}:${port}`);
    });

    socket.on('data', (data) => this.handleData(data.toString('utf8')));

    socket.on('error', (err) => {
      this.log(`TCP error: ${err.message}`);
    });

    socket.on('close', () => {
      clearTimeout(timeout);
      this.log('Scale TCP connection closed');
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.reconnectAttempt += 1;
    const delay = Math.min(
      this.options.reconnectBaseMs * 2 ** (this.reconnectAttempt - 1),
      this.options.reconnectMaxMs,
    );
    this.log(`Reconnecting in ${delay}ms`);
    setTimeout(() => this.connect(), delay);
  }

  private async handleData(chunk: string): Promise<void> {
    const frames = this.options.parser.pushChunk(chunk);
    for (const frame of frames) {
      if (frame.weight == null) continue;
      const stability = this.options.stability.add({
        weight: frame.weight,
        unit: frame.unit ?? 'kg',
      });
      try {
        await this.options.publisher.publish({
          rawFrame: frame.rawFrame,
          weight: frame.weight,
          unit: frame.unit,
          isStable: stability.isStable,
          stabilityReason: stability.reason,
        });
      } catch (e) {
        const now = Date.now();
        if (now - this.lastPublishErrorLogMs >= 5000) {
          this.lastPublishErrorLogMs = now;
          this.log(`Publish error: ${(e as Error).message}`);
        }
      }
    }
  }
}
