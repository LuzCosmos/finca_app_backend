"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScaleBackendPublisher = void 0;
class ScaleBackendPublisher {
    constructor(baseUrl, authToken, deviceId, scaleId) {
        this.baseUrl = baseUrl;
        this.authToken = authToken;
        this.deviceId = deviceId;
        this.scaleId = scaleId;
        this.sequence = 0;
    }
    async publish(reading) {
        this.sequence += 1;
        const url = `${this.baseUrl.replace(/\/$/, '')}/hardware/scales/${encodeURIComponent(this.scaleId)}/readings`;
        const body = {
            deviceId: this.deviceId,
            rawFrame: reading.rawFrame,
            weight: reading.weight,
            unit: reading.unit,
            isStable: reading.isStable,
            stabilityReason: reading.stabilityReason,
            observedAt: reading.observedAt ?? new Date().toISOString(),
            sequence: this.sequence,
        };
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Scale-Bridge-Token': this.authToken,
                },
                body: JSON.stringify(body),
            });
            if (!res.ok && res.status !== 204) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status} ${url}: ${text}`);
            }
        }
        catch (err) {
            const e = err;
            const causeMsg = e.cause?.message ? ` (${e.cause.message})` : '';
            if (e.message.startsWith('HTTP '))
                throw e;
            throw new Error(`fetch failed → ${url}${causeMsg}`);
        }
    }
}
exports.ScaleBackendPublisher = ScaleBackendPublisher;
