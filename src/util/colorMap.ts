import * as chroma from 'chroma-js';
import * as vscode from 'vscode';

export enum ColorType {
	fromRGB = 'fromRGB',
	fromHSV = 'fromHSV',
	new = 'new'
}

type ExcludeSelfDoubleRecord<K extends string, V> = { [I in K]: Record<Exclude<K, I>, V> };
export type ColorArray = [number, number, number];

function clearNaN(value: Readonly<ColorArray>) {
	return value.map(value => value !== value ? 0 : value) as ColorArray;
}

function normalizeHsv(value: Readonly<ColorArray>): ColorArray {
	return [value[0] / 360, value[1], value[2]];
}

function denormalizeHsv(value: Readonly<ColorArray>): ColorArray {
	return [value[0] * 360, value[1], value[2]];
}

export function roundColor(value: Readonly<ColorArray>) {
	const precision = 10**vscode.workspace.getConfiguration("roblox-ts.colorPicker").get('precision', 2);
	return value.map(value => Math.round(value * precision) / precision) as ColorArray;
}

/**
 * From a color to another color
 */
export const colorTo: ExcludeSelfDoubleRecord<ColorType, (a: number, b: number, c: number) => ColorArray> = {
	new: {
		fromHSV: (...color) => {
			return normalizeHsv(clearNaN(chroma(color.map(color => color * 255), 'rgb').hsv()));
		},
		fromRGB: (...color) => {
			return color.map(color => Math.round(color * 255)) as ColorArray;
		}
	},
	fromHSV: {
		fromRGB: (...color) => {
			return chroma(denormalizeHsv(color), 'hsv').rgb(false);
		},
		new: (...color) => {
			return chroma(denormalizeHsv(color), 'hsv').rgb(false).map(color => color / 255) as ColorArray;
		}
	},
	fromRGB: {
		fromHSV: (...color) => {
			return normalizeHsv(clearNaN(chroma(color, 'rgb').hsv()));
		},
		new: (...color) => {
			return color.map(color => color / 255) as ColorArray;
		}
	}
};