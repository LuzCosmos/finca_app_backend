import * as dotenv from 'dotenv';
import { ScaleFrameParser } from './scale-frame-parser';
import { ScaleStabilityDetector } from './scale-stability-detector';
import { ScaleBackendPublisher } from './scale-backend-publisher';
import { ScaleTcpClient } from './scale-tcp-client';

dotenv.config();

function envNumber(key: string, fallback: number): number {
  const v = process.env[key];
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const host = process.env.SCALE_HOST ?? '127.0.0.1';
const port = envNumber('SCALE_PORT', 10001);
const backendBaseUrl =
  process.env.BACKEND_BASE_URL ?? 'http://localhost:23000/api/v1';
const authToken = process.env.BRIDGE_AUTH_TOKEN ?? '';
const deviceId = process.env.BRIDGE_DEVICE_ID ?? 'default-scale';
const scaleId = process.env.BRIDGE_DEVICE_ID ?? deviceId;

if (!authToken) {
  console.error('BRIDGE_AUTH_TOKEN is required');
  process.exit(1);
}

const publisher = new ScaleBackendPublisher(
  backendBaseUrl,
  authToken,
  deviceId,
  scaleId,
);

async function verifyBackendReachable(): Promise<void> {
  const base = backendBaseUrl.replace(/\/$/, '');
  const healthUrl = base.endsWith('/api/v1')
    ? `${base}/health`
    : `${base}/api/v1/health`;
  try {
    const res = await fetch(healthUrl, { method: 'GET' });
    if (res.ok) {
      console.log(`[scale-bridge] Backend reachable at ${healthUrl}`);
      return;
    }
    console.warn(
      `[scale-bridge] Backend responded ${res.status} at ${healthUrl} — check BACKEND_BASE_URL`,
    );
  } catch (e) {
    const msg = (e as Error).message;
    console.error(
      `[scale-bridge] Cannot reach backend at ${healthUrl}: ${msg}. ` +
        'Start finca_app_backend on the host and set BACKEND_BASE_URL ' +
        '(e.g. http://host.docker.internal:23000/api/v1 from Docker).',
    );
  }
}

const client = new ScaleTcpClient({
  host,
  port,
  connectTimeoutMs: envNumber('SCALE_CONNECT_TIMEOUT_MS', 5000),
  reconnectBaseMs: envNumber('SCALE_RECONNECT_BASE_MS', 1000),
  reconnectMaxMs: envNumber('SCALE_RECONNECT_MAX_MS', 30000),
  parser: new ScaleFrameParser(),
  stability: new ScaleStabilityDetector({
    tolerancePercent: envNumber('SCALE_READING_TOLERANCE_PERCENT', 0.5),
    consecutiveReadings: envNumber('SCALE_STABLE_CONSECUTIVE_READINGS', 3),
    zeroThresholdKg: envNumber('SCALE_ZERO_THRESHOLD_KG', 0.1),
  }),
  publisher,
  onLog: (msg) => console.log(`[scale-bridge] ${msg}`),
});

void verifyBackendReachable().then(() => client.start());

process.on('SIGINT', () => {
  client.stop();
  process.exit(0);
});
