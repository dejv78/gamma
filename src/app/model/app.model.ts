import {PointData, Transform} from "pixi.js";
import Color from "colorjs.io";

export type OpMode = 'image-based' | 'pigment-based' | 'freestyle';

export type ImageData = {
  width: number;
  height: number;
  data?: Uint8ClampedArray;
}

export class Ab {

  public static fromColor(c: Color): Ab {
    return new Ab(c.a, c.b);
  }

  constructor(public a: number, public b: number, public l?: number) {}

  public transform(t: Transform) {
    const transformed: PointData = t.matrix.apply({x: this.a, y: this.b});
    return new Ab(transformed.x, transformed.y);
  }
}
