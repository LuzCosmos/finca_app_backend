"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const scale_frame_parser_1 = require("./scale-frame-parser");
const scale_stability_detector_1 = require("./scale-stability-detector");
const scale_backend_publisher_1 = require("./scale-backend-publisher");
const scale_tcp_client_1 = require("./scale-tcp-client");
dotenv.config();
function envNumber(key, fallback) {
    const v = process.env[key];
    if (v == null || v === '')
        return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
const host = process.env.SCALE_HOST ?? '127.0.0.1';
const port = envNumber('SCALE_PORT', 10001);
const backendBaseUrl = process.env.BACKEND_BASE_URL ?? 'http://localhost:23000/api/v1';
const authToken = process.env.BRIDGE_AUTH_TOKEN ?? '';
const deviceId = process.env.BRIDGE_DEVICE_ID ?? 'default-scale';
const scaleId = process.env.BRIDGE_DEVICE_ID ?? deviceId;
if (!authToken) {
    console.error('BRIDGE_AUTH_TOKEN is required');
    process.exit(1);
}
const publisher = new scale_backend_publisher_1.ScaleBackendPublisher(backendBaseUrl, authToken, deviceId, scaleId);
async function verifyBackendReachable() {
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
        console.warn(`[scale-bridge] Backend responded ${res.status} at ${healthUrl} — check BACKEND_BASE_URL`);
    }
    catch (e) {
        const msg = e.message;
        console.error(`[scale-bridge] Cannot reach backend at ${healthUrl}: ${msg}. ` +
            'Start finca_app_backend on the host and set BACKEND_BASE_URL ' +
            '(e.g. http://host.docker.internal:23000/api/v1 from Docker).');
    }
}
const client = new scale_tcp_client_1.ScaleTcpClient({
    host,
    port,
    connectTimeoutMs: envNumber('SCALE_CONNECT_TIMEOUT_MS', 5000),
    reconnectBaseMs: envNumber('SCALE_RECONNECT_BASE_MS', 1000),
    reconnectMaxMs: envNumber('SCALE_RECONNECT_MAX_MS', 30000),
    parser: new scale_frame_parser_1.ScaleFrameParser(),
    stability: new scale_stability_detector_1.ScaleStabilityDetector({
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
