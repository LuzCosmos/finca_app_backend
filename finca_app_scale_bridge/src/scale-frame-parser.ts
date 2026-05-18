export interface ParsedFrame {
  weight: number | null;
  unit: string | null;
  rawFrame: string;
}

/**
 * Configurable parser: expects lines like "  350.25 kg" or "350.25".
 * Adjust when real 920i ASCII samples are available.
 */
export class ScaleFrameParser {
  private buffer = '';

  pushChunk(chunk: string): ParsedFrame[] {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';
    return lines.map((line) => this.parseLine(line)).filter((p) => p.rawFrame.length > 0);
  }

  parseLine(line: string): ParsedFrame {
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
