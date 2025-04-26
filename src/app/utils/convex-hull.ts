import {Container, FillInput, Graphics, PointData, StrokeInput} from "pixi.js";
import {DenormalizeCoordsFunction} from "./coords";
import {Ab} from "../model/app.model";

export function drawConvexHull(vertices: Readonly<Array<Ab>>, denormalizeFunction: DenormalizeCoordsFunction, stage: Container<any>, g?: Graphics, stroke?: StrokeInput, fill?: FillInput): Graphics | undefined {
  if (vertices.length > 2) {
    const coords: PointData[] = denormalizeFunction(vertices);
    const polygon: Graphics = g ?? new Graphics();

    polygon.beginPath();
    polygon.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
      polygon.lineTo(coords[i].x, coords[i].y);
    }
    polygon.closePath();

    if (!g) {
      if (!!stroke) {
        polygon.stroke(stroke);
      }
      if (!!fill) {
        polygon.fill(fill);
      }
      stage.addChild(polygon);
    }
    return polygon;
  }
  return undefined;
}

// Returns a new array of points representing the convex hull of
// the given set of points. The convex hull excludes collinear points.
// This algorithm runs in O(n log n) time.
export function makeHull<P extends Ab>(points: Readonly<Array<P>>): Array<P> {
  let newPoints: Array<P> = points.slice();
  newPoints.sort(POINT_COMPARATOR);
  return makeHullPresorted(newPoints);
}


// Returns the convex hull, assuming that each points[i] <= points[i + 1]. Runs in O(n) time.
export function makeHullPresorted<P extends Ab>(points: Readonly<Array<P>>): Array<P> {
  if (points.length <= 1)
    return points.slice();

  // Andrew's monotone chain algorithm. Positive y coordinates correspond to "up"
  // as per the mathematical convention, instead of "down" as per the computer
  // graphics convention. This doesn't affect the correctness of the result.

  let upperHull: Array<P> = [];
  for (let i = 0; i < points.length; i++) {
    const p: P = points[i];
    while (upperHull.length >= 2) {
      const q: P = upperHull[upperHull.length - 1];
      const r: P = upperHull[upperHull.length - 2];
      if ((q.a - r.a) * (p.b - r.b) >= (q.b - r.b) * (p.a - r.a))
        upperHull.pop();
      else
        break;
    }
    upperHull.push(p);
  }
  upperHull.pop();

  let lowerHull: Array<P> = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p: P = points[i];
    while (lowerHull.length >= 2) {
      const q: P = lowerHull[lowerHull.length - 1];
      const r: P = lowerHull[lowerHull.length - 2];
      if ((q.a - r.a) * (p.b - r.b) >= (q.b - r.b) * (p.a - r.a))
        lowerHull.pop();
      else
        break;
    }
    lowerHull.push(p);
  }
  lowerHull.pop();

  if (upperHull.length == 1 && lowerHull.length == 1 && upperHull[0].a == lowerHull[0].a && upperHull[0].b == lowerHull[0].b)
    return upperHull;
  else
    return upperHull.concat(lowerHull);
}


function POINT_COMPARATOR(a: Ab, b: Ab): number {
  if (a.a < b.a)
    return -1;
  else if (a.a > b.a)
    return +1;
  else if (a.b < b.b)
    return -1;
  else if (a.b > b.b)
    return +1;
  else
    return 0;
}
