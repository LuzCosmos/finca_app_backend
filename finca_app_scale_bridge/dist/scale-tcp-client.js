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
exports.ScaleTcpClient = void 0;
const net = __importStar(require("net"));
class ScaleTcpClient {
    constructor(options) {
        this.options = options;
        this.socket = null;
        this.reconnectAttempt = 0;
        this.stopped = false;
        this.lastPublishErrorLogMs = 0;
    }
    start() {
        this.stopped = false;
        this.connect();
    }
    stop() {
        this.stopped = true;
        this.socket?.destroy();
        this.socket = null;
    }
    log(msg) {
        this.options.onLog?.(msg);
    }
    connect() {
        if (this.stopped)
            return;
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
    scheduleReconnect() {
        if (this.stopped)
            return;
        this.reconnectAttempt += 1;
        const delay = Math.min(this.options.reconnectBaseMs * 2 ** (this.reconnectAttempt - 1), this.options.reconnectMaxMs);
        this.log(`Reconnecting in ${delay}ms`);
        setTimeout(() => this.connect(), delay);
    }
    async handleData(chunk) {
        const frames = this.options.parser.pushChunk(chunk);
        for (const frame of frames) {
            if (frame.weight == null)
                continue;
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
            }
            catch (e) {
                const now = Date.now();
                if (now - this.lastPublishErrorLogMs >= 5000) {
                    this.lastPublishErrorLogMs = now;
                    this.log(`Publish error: ${e.message}`);
                }
            }
        }
    }
}
exports.ScaleTcpClient = ScaleTcpClient;
