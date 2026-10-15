import type { PathCommand } from 'opentype.js';

interface Point {
  x: number;
  y: number;
}

interface Contour {
  commands: PathCommand[];
  polygon: Point[];
  area: number;
}

const CURVE_FLATTEN_STEPS = 16;

/**
 * Rewrites the contours of an SVG `fill-rule="evenodd"` shape so the
 * nonzero winding rule that OpenType glyphs use produces the same picture.
 *
 * Under nonzero, a nested contour only cuts a hole if it winds against its
 * parent; evenodd ignores direction. Each nested contour is therefore
 * reversed when needed so it winds opposite its immediate parent. Top-level
 * contours keep their direction.
 *
 * Contours that cross each other can't be expressed by flipping direction
 * (evenodd carves their overlap out while nonzero would not), so those are
 * rejected rather than silently drawn wrong.
 */
export function normalizeEvenOddWinding(
  commands: readonly PathCommand[]
): PathCommand[] {
  const contours = splitContours(commands).map(buildContour);
  if (contours.length < 2) {
    return [...commands];
  }

  if (anyContoursCross(contours)) {
    throw new Error(
      'fill-rule="evenodd" artwork has contours that cross each other, which a font cannot reproduce. Expand or unite the shapes (e.g. Pathfinder > Unite/Exclude in your editor) and re-export.'
    );
  }

  const containerIndexes = contours.map((contour, index) =>
    contours
      .map((other, otherIndex) => ({ other, otherIndex }))
      .filter(
        ({ other, otherIndex }) =>
          otherIndex !== index &&
          isPointInside(contour.polygon[0], other.polygon)
      )
      .map(({ otherIndex }) => otherIndex)
  );

  const targetDirection: number[] = new Array<number>(contours.length).fill(0);
  const processingOrder = contours
    .map((_, index) => index)
    .sort((a, b) => containerIndexes[a].length - containerIndexes[b].length);

  for (const index of processingOrder) {
    const containers = containerIndexes[index];
    if (containers.length === 0) {
      targetDirection[index] = Math.sign(contours[index].area);
      continue;
    }
    const parentIndex = containers.reduce((smallest, candidate) =>
      Math.abs(contours[candidate].area) < Math.abs(contours[smallest].area)
        ? candidate
        : smallest
    );
    targetDirection[index] = -targetDirection[parentIndex];
  }

  return contours.flatMap((contour, index) =>
    contour.area !== 0 && Math.sign(contour.area) !== targetDirection[index]
      ? reverseContour(contour.commands)
      : contour.commands
  );
}

function splitContours(commands: readonly PathCommand[]): PathCommand[][] {
  const contours: PathCommand[][] = [];
  let current: PathCommand[] | null = null;
  let lastStart: Point = { x: 0, y: 0 };

  for (const command of commands) {
    if (command.type === 'M') {
      current = [command];
      contours.push(current);
      lastStart = { x: command.x, y: command.y };
    } else if (command.type === 'Z') {
      current?.push(command);
      current = null;
    } else {
      if (current === null) {
        // Drawing after a close continues from the closed subpath's start.
        current = [{ type: 'M', x: lastStart.x, y: lastStart.y }];
        contours.push(current);
      }
      current.push(command);
    }
  }
  return contours;
}

function buildContour(commands: PathCommand[]): Contour {
  const polygon: Point[] = [];
  let current: Point = { x: 0, y: 0 };

  for (const command of commands) {
    if (command.type === 'M' || command.type === 'L') {
      current = { x: command.x, y: command.y };
      polygon.push(current);
    } else if (command.type === 'Q') {
      for (let step = 1; step <= CURVE_FLATTEN_STEPS; step += 1) {
        const t = step / CURVE_FLATTEN_STEPS;
        const u = 1 - t;
        polygon.push({
          x: u * u * current.x + 2 * u * t * command.x1 + t * t * command.x,
          y: u * u * current.y + 2 * u * t * command.y1 + t * t * command.y,
        });
      }
      current = { x: command.x, y: command.y };
    } else if (command.type === 'C') {
      for (let step = 1; step <= CURVE_FLATTEN_STEPS; step += 1) {
        const t = step / CURVE_FLATTEN_STEPS;
        const u = 1 - t;
        polygon.push({
          x:
            u * u * u * current.x +
            3 * u * u * t * command.x1 +
            3 * u * t * t * command.x2 +
            t * t * t * command.x,
          y:
            u * u * u * current.y +
            3 * u * u * t * command.y1 +
            3 * u * t * t * command.y2 +
            t * t * t * command.y,
        });
      }
      current = { x: command.x, y: command.y };
    }
  }

  return { commands, polygon, area: signedArea(polygon) };
}

/** Shoelace area; positive for counter-clockwise (y up). */
function signedArea(polygon: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function isPointInside(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function anyContoursCross(contours: readonly Contour[]): boolean {
  const bounds = contours.map((contour) => boundsOf(contour.polygon));
  for (let i = 0; i < contours.length; i += 1) {
    for (let j = i + 1; j < contours.length; j += 1) {
      if (!boundsOverlap(bounds[i], bounds[j])) {
        continue;
      }
      if (polygonsCross(contours[i].polygon, contours[j].polygon)) {
        return true;
      }
    }
  }
  return false;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boundsOf(polygon: readonly Point[]): Bounds {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return (
    a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY
  );
}

function polygonsCross(a: readonly Point[], b: readonly Point[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j += 1) {
      if (segmentsCross(a1, a2, b[j], b[(j + 1) % b.length])) {
        return true;
      }
    }
  }
  return false;
}

/** True when the two segments properly cross (a shared endpoint doesn't count). */
function segmentsCross(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = orientation(p3, p4, p1);
  const d2 = orientation(p3, p4, p2);
  const d3 = orientation(p1, p2, p3);
  const d4 = orientation(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Returns the same closed contour traced in the opposite direction. */
function reverseContour(commands: readonly PathCommand[]): PathCommand[] {
  const [move, ...rest] = commands.filter((command) => command.type !== 'Z');
  if (move.type !== 'M') {
    return [...commands];
  }
  const segments = rest.filter(
    (command): command is Exclude<PathCommand, { type: 'M' | 'Z' }> =>
      command.type !== 'M'
  );

  const points: Point[] = [{ x: move.x, y: move.y }];
  for (const segment of segments) {
    points.push({ x: segment.x, y: segment.y });
  }
  const last = points[points.length - 1];
  if (last.x !== move.x || last.y !== move.y) {
    // The implicit closing edge becomes an explicit line so it can be reversed.
    segments.push({ type: 'L', x: move.x, y: move.y });
    points.push({ x: move.x, y: move.y });
  }

  const reversed: PathCommand[] = [{ type: 'M', x: move.x, y: move.y }];
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const previous = points[index];
    if (segment.type === 'C') {
      reversed.push({
        type: 'C',
        x1: segment.x2,
        y1: segment.y2,
        x2: segment.x1,
        y2: segment.y1,
        x: previous.x,
        y: previous.y,
      });
    } else if (segment.type === 'Q') {
      reversed.push({
        type: 'Q',
        x1: segment.x1,
        y1: segment.y1,
        x: previous.x,
        y: previous.y,
      });
    } else {
      reversed.push({ type: 'L', x: previous.x, y: previous.y });
    }
  }
  reversed.push({ type: 'Z' });
  return reversed;
}
