import { ScaleFrameParser } from './scale-frame-parser';

describe('ScaleFrameParser', () => {
  it('parses a complete line with unit', () => {
    const p = new ScaleFrameParser();
    const frames = p.pushChunk('412.50 kg\r\n');
    expect(frames).toHaveLength(1);
    expect(frames[0].weight).toBe(412.5);
    expect(frames[0].unit).toBe('kg');
    expect(frames[0].rawFrame).toBe('412.50 kg');
  });

  it('buffers partial chunks until newline', () => {
    const p = new ScaleFrameParser();
    expect(p.pushChunk('350.')).toHaveLength(0);
    const frames = p.pushChunk('25 kg\r\n');
    expect(frames).toHaveLength(1);
    expect(frames[0].weight).toBe(350.25);
  });

  it('parses multiple lines in one chunk', () => {
    const p = new ScaleFrameParser();
    const frames = p.pushChunk('100 kg\n200 kg\r\n');
    expect(frames).toHaveLength(2);
    expect(frames[0].weight).toBe(100);
    expect(frames[1].weight).toBe(200);
  });

  it('returns null weight for invalid lines', () => {
    const p = new ScaleFrameParser();
    const line = p.parseLine('??? motion');
    expect(line.weight).toBeNull();
    expect(line.rawFrame).toBe('??? motion');
  });

  it('ignores empty lines', () => {
    const p = new ScaleFrameParser();
    const frames = p.pushChunk('\r\n\r\n350 kg\r\n');
    expect(frames).toHaveLength(1);
    expect(frames[0].weight).toBe(350);
  });

  it('parses weight without explicit unit as kg', () => {
    const p = new ScaleFrameParser();
    const line = p.parseLine('  385.20  ');
    expect(line.weight).toBe(385.2);
    expect(line.unit).toBe('kg');
  });

  it('parses lb unit from line', () => {
    const p = new ScaleFrameParser();
    const line = p.parseLine('850.00 lb');
    expect(line.weight).toBe(850);
    expect(line.unit).toBe('lb');
  });
});
