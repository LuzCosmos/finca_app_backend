"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScaleFrameParser = void 0;
/**
 * Configurable parser: expects lines like "  350.25 kg" or "350.25".
 * Adjust when real 920i ASCII samples are available.
 */
class ScaleFrameParser {
    constructor() {
        this.buffer = '';
    }
    pushChunk(chunk) {
        this.buffer += chunk;
        const lines = this.buffer.split(/\r?\n/);
        this.buffer = lines.pop() ?? '';
        return lines.map((line) => this.parseLine(line)).filter((p) => p.rawFrame.length > 0);
    }
    parseLine(line) {
        const rawFrame = line.trim();
        if (!rawFrame) {
            return { weight: null, unit: null, rawFrame: '' };
        }
        const match = rawFrame.match(/(-?\d+(?:\.\d+)?)\s*(kg|lb)?/i);
        if (!match) {
            return { weight: null, unit: null, rawFrame };
        }
        const weight = parseFloat(match[1]);
        const unit = match[2]?.toLowerCase() ?? 'kg';
        return {
            weight: Number.isFinite(weight) ? weight : null,
            unit,
            rawFrame,
        };
    }
}
exports.ScaleFrameParser = ScaleFrameParser;
