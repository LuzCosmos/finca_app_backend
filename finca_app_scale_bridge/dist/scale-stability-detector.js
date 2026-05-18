"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScaleStabilityDetector = void 0;
class ScaleStabilityDetector {
    constructor(config) {
        this.config = config;
        this.recent = [];
    }
    reset() {
        this.recent.length = 0;
    }
    add(sample) {
        if (sample.weight <= this.config.zeroThresholdKg) {
            this.recent.length = 0;
            return { isStable: false, reason: 'below_zero_threshold' };
        }
        if (this.recent.length > 0 && this.recent[0].unit !== sample.unit) {
            this.recent.length = 0;
            return { isStable: false, reason: 'unit_mismatch' };
        }
        this.recent.unshift(sample);
        if (this.recent.length > this.config.consecutiveReadings) {
            this.recent.length = this.config.consecutiveReadings;
        }
        if (this.recent.length < this.config.consecutiveReadings) {
            return { isStable: false, reason: 'insufficient_readings' };
        }
        const weights = this.recent.map((r) => r.weight);
        const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
        const tolerance = avg * (this.config.tolerancePercent / 100);
        const stable = weights.every((w) => Math.abs(w - avg) <= tolerance);
        return stable
            ? { isStable: true }
            : { isStable: false, reason: 'variation_exceeds_tolerance' };
    }
}
exports.ScaleStabilityDetector = ScaleStabilityDetector;
