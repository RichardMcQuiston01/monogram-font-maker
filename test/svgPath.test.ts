import { describe, expect, it } from 'vitest';
import { Path } from 'opentype.js';
import { appendSvgPathData } from '../src/core/svgPath.js';

const identity = (x: number, y: number) => ({ x, y });

describe('appendSvgPathData', () => {
  it('converts a simple absolute M/L/Z triangle', () => {
    const path = new Path();
    appendSvgPathData(path, 'M0,0 L10,0 L10,10 Z', identity);

    expect(path.commands).toEqual([
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: 10, y: 0 },
      { type: 'L', x: 10, y: 10 },
      { type: 'Z' },
    ]);
  });

  it('resolves relative commands against the current point', () => {
    const path = new Path();
    appendSvgPathData(path, 'm10,10 l5,0 l0,5 z', identity);

    expect(path.commands).toEqual([
      { type: 'M', x: 10, y: 10 },
      { type: 'L', x: 15, y: 10 },
      { type: 'L', x: 15, y: 15 },
      { type: 'Z' },
    ]);
  });

  it('resolves H and V shorthands, absolute and relative', () => {
    const path = new Path();
    appendSvgPathData(path, 'M0,0 H10 v5 h-4 V1', identity);

    expect(path.commands).toEqual([
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: 10, y: 0 },
      { type: 'L', x: 10, y: 5 },
      { type: 'L', x: 6, y: 5 },
      { type: 'L', x: 6, y: 1 },
    ]);
  });

  it('applies the supplied coordinate transform to every point', () => {
    const path = new Path();
    const flipAndScale = (x: number, y: number) => ({ x: x * 2, y: -y });
    appendSvgPathData(path, 'M1,1 L2,2', flipAndScale);

    expect(path.commands).toEqual([
      { type: 'M', x: 2, y: -1 },
      { type: 'L', x: 4, y: -2 },
    ]);
  });

  it('passes cubic curves through directly', () => {
    const path = new Path();
    appendSvgPathData(path, 'M0,0 C1,1 2,1 3,0', identity);

    expect(path.commands).toEqual([
      { type: 'M', x: 0, y: 0 },
      { type: 'C', x1: 1, y1: 1, x2: 2, y2: 1, x: 3, y: 0 },
    ]);
  });

  it('reflects the S control point off the preceding C command', () => {
    const path = new Path();
    appendSvgPathData(path, 'M0,0 C1,1 2,1 3,0 S5,1 6,0', identity);

    const [, , smooth] = path.commands as Array<{
      type: string;
      x1?: number;
      y1?: number;
    }>;
    // reflection of (2,1) through the current point (3,0) is (4,-1)
    expect(smooth).toEqual({
      type: 'C',
      x1: 4,
      y1: -1,
      x2: 5,
      y2: 1,
      x: 6,
      y: 0,
    });
  });

  it('treats a standalone S (no preceding curve) as a zero-length control point', () => {
    const path = new Path();
    appendSvgPathData(path, 'M0,0 S5,1 6,0', identity);

    expect(path.commands[1]).toEqual({
      type: 'C',
      x1: 0,
      y1: 0,
      x2: 5,
      y2: 1,
      x: 6,
      y: 0,
    });
  });

  it('reflects the T control point off the preceding Q command', () => {
    const path = new Path();
    appendSvgPathData(path, 'M0,0 Q2,2 4,0 T8,0', identity);

    expect(path.commands[2]).toEqual({
      type: 'Q',
      x1: 6,
      y1: -2,
      x: 8,
      y: 0,
    });
  });

  it('converts an elliptical arc into one or more cubic curves ending at the arc endpoint', () => {
    const path = new Path();
    appendSvgPathData(path, 'M0,0 A5,5 0 0,1 10,0', identity);

    const commands = path.commands as Array<{
      type: string;
      x?: number;
      y?: number;
    }>;
    expect(commands[0]).toEqual({ type: 'M', x: 0, y: 0 });
    expect(commands.length).toBeGreaterThan(1);
    for (const command of commands.slice(1)) {
      expect(command.type).toBe('C');
    }
    const lastCommand = commands[commands.length - 1];
    expect(lastCommand.x).toBeCloseTo(10);
    expect(lastCommand.y).toBeCloseTo(0);
  });

  it('propagates a parse error for malformed path data', () => {
    const path = new Path();
    expect(() => appendSvgPathData(path, 'M0,0 L10', identity)).toThrow(
      /malformed path data/i
    );
  });
});
