// Common types used across the application

export interface Point {
	x: number;
	y: number;
}

export interface Coordinates {
	X: number;
	Y: number;
	Z: number;
}

export interface StatPoint {
	Name: string;
	Value: number;
}

export interface StringDesc {
	Name: string;
	Description: string;
}

export interface ApiError {
	message: string;
	code?: string;
}