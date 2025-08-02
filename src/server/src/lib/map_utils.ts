import type {Coords} from "$save-edit/models/Coords";

const transl_x = 123888
const transl_y = 158000
const dist = 11585.23750;
const realMapCoords = {
    minX: -999940,
    minY: -738920,
    maxX: 447900,
    maxY: 708920
}
const scale = 459
const scale_custom = 112.060;
export interface Point{
    x: number,
    y: number
}

export function normalizeToTopLeft(coord: Point): Point {
    const width = realMapCoords.maxX - realMapCoords.minX;
    const height = realMapCoords.maxY - realMapCoords.minY;

    const centerX = (realMapCoords.minX + realMapCoords.maxX) / 2;
    const centerY = (realMapCoords.minY + realMapCoords.maxY) / 2;

    // Translate so that the center becomes (0, 0)
    const translatedX = coord.x - centerX;
    const translatedY = coord.y - centerY;

    // Normalize into [0, 1] space
    const normalizedX = (translatedX + width / 2) / width;
    const normalizedY = (translatedY + height / 2) / height; // Y-flip for top-left origin
    //swap


    return { x: normalizedY , y: 1- normalizedX };
}

export function sav_to_front(pt:Point): Point {
    const newX =pt.x + transl_x
    const newY =pt.y - transl_y
    const scaledX = Math.round(newY / scale_custom);
    const scaledY = Math.round(newX / scale_custom);
    const x_norm = (scaledX + 8192) / 16384;
    const y_norm = (scaledY + 8192) / 16384;
    return { x: x_norm * 8192, y: (1-y_norm) * 8192 };
}
export function sav_to_map(pt:Point) : Point {
    const newX =pt.x + transl_x
    const newY =pt.y - transl_y
    return {x : Math.round(newY / scale), y : Math.round(newX / scale)};
}

export function map_to_sav(pt: Point) : Point {

    const newX = pt.x * scale;
    const newY = pt.y * scale;

    return {x: newY - transl_x, y: newX + transl_y};
}