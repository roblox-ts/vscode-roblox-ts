import * as vscode from 'vscode';
import { ColorArray, colorTo, ColorType, roundColor } from './util/colorMap';

/**
 * Matching:
 * ```
 * new Color3( 0.1, 0.2, 0.3 );
 * ----------  ---  ---  ---
 *           --   --   --   --
 * 1         2 3  4 5  6 7  8
 * ```
 */
const matchColors: Record<ColorType, RegExp> = {
	[ColorType.new]: /(new\s+Color3)(\(\s*)(\d*(?:\.\d*)?)(\s*,\s*)(\d*(?:\.\d*)?)(\s*,\s*)(\d*(?:\.\d*)?)(\s*\))/,
	[ColorType.fromRGB]: /(Color3\s*\.fromRGB)(\s*\(\s*)(\d*(?:\.\d*)?)(\s*,\s*)(\d*(?:\.\d*)?)(\s*,\s*)(\d*(?:\.\d*)?)(\s*\))/,
	[ColorType.fromHSV]: /(Color3\s*\.fromHSV)(\s*\(\s*)(\d*(?:\.\d*)?)(\s*,\s*)(\d*(?:\.\d*)?)(\s*,\s*)(\d*(?:\.\d*)?)(\s*\))/
};

const matchPrefix: Record<ColorType, string> = {
	[ColorType.new]: 'new Color3',
	[ColorType.fromRGB]: 'Color3.fromRGB',
	[ColorType.fromHSV]: 'Color3.fromHSV',
};

function formatNumber(match: ColorType, a: number, b: number, c: number): vscode.Color {
	if (match === ColorType.new) {
		return {
			alpha: 1,
			red: a,
			green: b,
			blue: c
		};
	}

	const [red, green, blue] = colorTo[match][ColorType.new](a, b, c);

	return {
		alpha: 1,
		red,
		green,
		blue
	};
}

function replaceMatch(match: RegExpMatchArray, group: string, a: number | string, b: number | string, c: number | string) {
	return `${group}${match[2]}${a}${match[4]}${b}${match[6]}${c}${match[8]}`;
}

function extractTriColor(match: RegExpMatchArray): ColorArray {
	return [Number(match[3]), Number(match[5]), Number(match[7])];
}

function getRotatedColorType() {
	const defaultColorType = vscode.workspace.getConfiguration("roblox-ts.colorPicker").get("defaultOption", ColorType.fromRGB);

	const rotatingArray = Object.values(ColorType);
	const location = rotatingArray.findIndex(value => value === defaultColorType);

	rotatingArray.unshift(...rotatingArray.splice(location, rotatingArray.length));
	return rotatingArray;
}

export function makeColorProvider() {
	const provider: vscode.DocumentColorProvider = {
		provideColorPresentations: (color, context, token) => {
			const text = context.document.getText(context.range);

			const match = Object.values(ColorType).find(match => text.includes(match));
			if (!match) throw new Error('Color type specified was not found!');

			const regexMatch = text.match(matchColors[match])!;

			const matches: vscode.ProviderResult<Array<vscode.ColorPresentation>> = getRotatedColorType().map((matchType): vscode.ColorPresentation => {
				const colorMatch = matchType === ColorType.new
					? [color.red, color.green, color.blue] as const
					: colorTo[ColorType.new][matchType](...roundColor([color.red, color.green, color.blue]));

				return {
					label: replaceMatch(regexMatch, matchPrefix[matchType],...roundColor(colorMatch))
				};
			});

			return matches;
		},

		provideDocumentColors: (document, token) => {
			const source = document.getText();
			const result: vscode.ProviderResult<vscode.ColorInformation[]> = [];

			for (const [matchType, matchRegex] of Object.entries(matchColors)) {
				for (const match of source.matchAll(new RegExp(matchRegex, 'g'))) {
					result.push({
						color: formatNumber(matchType as ColorType, ...extractTriColor(match)),
						range: new vscode.Range(
							document.positionAt(match.index!),
							document.positionAt(match.index! + match[0].length)
						)
					});
				}
			}

			return result;
		}
	};

	return [
		vscode.languages.registerColorProvider('typescript', provider),
		vscode.languages.registerColorProvider('typescriptreact', provider)
	];
}
