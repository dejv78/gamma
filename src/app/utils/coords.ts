import {PointData} from "pixi.js";
import {Ab} from "../model/app.model";

export type DenormalizeCoordsFunction = (ab: readonly Ab[]) => PointData[];

/**
 * Denormalizes the OKLab coordinate to pixel space.
 *
 * @param ab OKLab coordinate
 * @param center Center coordinate of the color wheel (in denormalized space)
 * @param dia Diameter of the color wheel (in denormalized space) NOTE: Use negative value to flip vertical axis
 * @param maxAB Maximum value of the ab coordinate in OKLab space - typically 0.25
 */
export function denormalize(ab: number, center: number, dia: number, maxAB: number): number {
  return center + dia * (ab / maxAB);
}


export function normalizeDistance(c1: number, c2: number, dia: number, maxAB: number): number {
  return ((c2 - c1) / dia) * maxAB;
}

