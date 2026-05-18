export interface ScaleReadingPayload {
  deviceId: string;
  rawFrame?: string;
  weight: number | null;
  unit: string | null;
  isStable: boolean;
  stabilityReason?: string;
  observedAt: string;
  sequence: number;
}

export class ScaleBackendPublisher {
  private sequence = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly authToken: string,
    private readonly deviceId: string,
    private readonly scaleId: string,
  ) {}

  async publish(
    reading: Omit<
      ScaleReadingPayload,
      'deviceId' | 'sequence' | 'observedAt'
    > & { observedAt?: string },
  ): Promise<void> {
    this.sequence += 1;
    const url = `${this.baseUrl.replace(/\/$/, '')}/hardware/scales/${encodeURIComponent(this.scaleId)}/readings`;
    const body: ScaleReadingPayload = {
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
    } catch (err) {
      const e = err as Error & { cause?: Error };
      const causeMsg = e.cause?.message ? ` (${e.cause.message})` : '';
      if (e.message.startsWith('HTTP ')) throw e;
      throw new Error(`fetch failed → ${url}${causeMsg}`);
    }
  }
}
