import parseSvgPath from 'parse-svg-path';
import arcToBezier from 'svg-arc-to-cubic-bezier';
import type { Path } from 'opentype.js';

/** Maps a single SVG-space coordinate to the target coordinate space. */
export type PointTransform = (x: number, y: number) => { x: number; y: number };

const CURVE_COMMAND_LETTERS = new Set(['C', 'S']);
const QUADRATIC_COMMAND_LETTERS = new Set(['Q', 'T']);

/**
 * Appends the outline described by an SVG `<path>` `d` attribute onto an
 * opentype.js {@link Path}, translating every coordinate through
 * `transform`. Handles absolute and relative commands, the `S`/`T` smooth
 * shorthands, and elliptical arcs (`A`), which opentype.js paths cannot
 * represent directly and so are converted to cubic Bézier segments.
 */
export function appendSvgPathData(
  path: Path,
  d: string,
  transform: PointTransform
): void {
  const commands = parseSvgPath(d);

  let currentX = 0;
  let currentY = 0;
  let subpathStartX = 0;
  let subpathStartY = 0;
  let previousCommandLetter: string | null = null;
  let previousControlX = 0;
  let previousControlY = 0;

  for (const [rawLetter, ...args] of commands) {
    const commandLetter = rawLetter.toUpperCase();
    const isRelative = rawLetter !== commandLetter;
    const originX = isRelative ? currentX : 0;
    const originY = isRelative ? currentY : 0;

    switch (commandLetter) {
      case 'M': {
        currentX = originX + args[0];
        currentY = originY + args[1];
        subpathStartX = currentX;
        subpathStartY = currentY;
        const p = transform(currentX, currentY);
        path.moveTo(p.x, p.y);
        break;
      }

      case 'L': {
        currentX = originX + args[0];
        currentY = originY + args[1];
        const p = transform(currentX, currentY);
        path.lineTo(p.x, p.y);
        break;
      }

      case 'H': {
        currentX = isRelative ? currentX + args[0] : args[0];
        const p = transform(currentX, currentY);
        path.lineTo(p.x, p.y);
        break;
      }

      case 'V': {
        currentY = isRelative ? currentY + args[0] : args[0];
        const p = transform(currentX, currentY);
        path.lineTo(p.x, p.y);
        break;
      }

      case 'C': {
        const control1X = originX + args[0];
        const control1Y = originY + args[1];
        const control2X = originX + args[2];
        const control2Y = originY + args[3];
        const endX = originX + args[4];
        const endY = originY + args[5];
        emitCurve(
          path,
          transform,
          control1X,
          control1Y,
          control2X,
          control2Y,
          endX,
          endY
        );
        previousControlX = control2X;
        previousControlY = control2Y;
        currentX = endX;
        currentY = endY;
        break;
      }

      case 'S': {
        const control2X = originX + args[0];
        const control2Y = originY + args[1];
        const endX = originX + args[2];
        const endY = originY + args[3];
        const reflected = reflectControlPoint(
          previousCommandLetter,
          CURVE_COMMAND_LETTERS,
          currentX,
          currentY,
          previousControlX,
          previousControlY
        );
        emitCurve(
          path,
          transform,
          reflected.x,
          reflected.y,
          control2X,
          control2Y,
          endX,
          endY
        );
        previousControlX = control2X;
        previousControlY = control2Y;
        currentX = endX;
        currentY = endY;
        break;
      }

      case 'Q': {
        const controlX = originX + args[0];
        const controlY = originY + args[1];
        const endX = originX + args[2];
        const endY = originY + args[3];
        emitQuad(path, transform, controlX, controlY, endX, endY);
        previousControlX = controlX;
        previousControlY = controlY;
        currentX = endX;
        currentY = endY;
        break;
      }

      case 'T': {
        const endX = originX + args[0];
        const endY = originY + args[1];
        const reflected = reflectControlPoint(
          previousCommandLetter,
          QUADRATIC_COMMAND_LETTERS,
          currentX,
          currentY,
          previousControlX,
          previousControlY
        );
        emitQuad(path, transform, reflected.x, reflected.y, endX, endY);
        previousControlX = reflected.x;
        previousControlY = reflected.y;
        currentX = endX;
        currentY = endY;
        break;
      }

      case 'A': {
        const [rx, ry, xAxisRotation, largeArcFlag, sweepFlag] = args;
        const endX = originX + args[5];
        const endY = originY + args[6];
        const curves = arcToBezier({
          px: currentX,
          py: currentY,
          cx: endX,
          cy: endY,
          rx,
          ry,
          xAxisRotation,
          largeArcFlag,
          sweepFlag,
        });
        for (const curve of curves) {
          emitCurve(
            path,
            transform,
            curve.x1,
            curve.y1,
            curve.x2,
            curve.y2,
            curve.x,
            curve.y
          );
        }
        currentX = endX;
        currentY = endY;
        break;
      }

      case 'Z': {
        currentX = subpathStartX;
        currentY = subpathStartY;
        path.close();
        break;
      }

      default:
        throw new Error(`Unsupported SVG path command: "${rawLetter}"`);
    }

    previousCommandLetter = commandLetter;
  }
}

function emitCurve(
  path: Path,
  transform: PointTransform,
  control1X: number,
  control1Y: number,
  control2X: number,
  control2Y: number,
  endX: number,
  endY: number
): void {
  const c1 = transform(control1X, control1Y);
  const c2 = transform(control2X, control2Y);
  const end = transform(endX, endY);
  path.curveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
}

function emitQuad(
  path: Path,
  transform: PointTransform,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number
): void {
  const control = transform(controlX, controlY);
  const end = transform(endX, endY);
  path.quadTo(control.x, control.y, end.x, end.y);
}

/**
 * SVG's `S`/`T` shorthand commands reflect the previous curve's final
 * control point through the current point, but only when the previous
 * command was itself a curve of the same family; otherwise the "control
 * point" is the current point itself (a zero-length reflection).
 */
function reflectControlPoint(
  previousCommandLetter: string | null,
  sameFamily: ReadonlySet<string>,
  currentX: number,
  currentY: number,
  previousControlX: number,
  previousControlY: number
): { x: number; y: number } {
  if (previousCommandLetter && sameFamily.has(previousCommandLetter)) {
    return {
      x: 2 * currentX - previousControlX,
      y: 2 * currentY - previousControlY,
    };
  }
  return { x: currentX, y: currentY };
}
