import {Ab} from "../color-wheel/pigments";

// First, you have to find the center of the shape defined by your points, since the rotation will be defined with respect to this point.
//Then you have to calculate the angle the points have with respect to the center and the x axis. To calculate the angle, you can use Math.atan2(y - center.y, x - center.x).
//Then you order the points by angle using Array.sort

const points: Ab[] = [];

// Get the center (mean value) using reduce
const center = points.reduce((acc, { a, b }) => {
  acc.x += a / points.length;
  acc.y += b / points.length;
  return acc;
}, { x: 0, y: 0 });

// Add an angle property to each point using tan(angle) = y/x
const angles = points.map(({ a, b }) => {
  return { a, b, angle: Math.atan2(b - center.y, a - center.x) * 180 / Math.PI };
});

// Sort your points by angle
const pointsSorted = angles.sort((a, b) => a.angle - b.angle);
