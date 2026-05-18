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
const net = __importStar(require("net"));
const port = Number(process.env.SIMULATOR_PORT ?? 10001);
const stableWeight = Number(process.env.SIM_STABLE_WEIGHT ?? 412.5);
let tick = 0;
const server = net.createServer((socket) => {
    console.log(`[simulator] client connected`);
    const interval = setInterval(() => {
        tick += 1;
        const noise = (tick % 8 < 3) ? (Math.random() - 0.5) * 4 : 0;
        const w = (stableWeight + noise).toFixed(2);
        socket.write(`${w} kg\r\n`);
    }, 500);
    socket.on('close', () => {
        clearInterval(interval);
        console.log('[simulator] client disconnected');
    });
});
server.listen(port, '0.0.0.0', () => {
    console.log(`[simulator] TCP scale listening on ${port}`);
});
