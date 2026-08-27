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
	[ColorType.fromHSV]: /(Color3\s*\.fromHSV)(\s*\(\s*)(\d*(?:\.\d*)?)(\s*,\s*)(\d*(?:\.\d*)?)(\s*,\s*)(\d*(?:\.\d*)?)(\s*\))/,
	[ColorType.fromHex]: /(Color3\s*\.fromHex)(\s*\(\s*["'])(#?[0-9a-fA-F]{3}|#?[0-9a-fA-F]{6})(["']\s*\))/
};

const matchPrefix: Record<ColorType, string> = {
	[ColorType.new]: 'new Color3',
	[ColorType.fromRGB]: 'Color3.fromRGB',
	[ColorType.fromHSV]: 'Color3.fromHSV',
	[ColorType.fromHex]: 'Color3.fromHex',
};

function isHexType(matchType: ColorType): matchType is ColorType.fromHex {
	return matchType === ColorType.fromHex;
}

function extractValue(matchType: ColorType, match: RegExpMatchArray): [string] | ColorArray {
	if (isHexType(matchType)) {
		return [match[3]];
	}

	return [Number(match[3]), Number(match[5]), Number(match[7])];
}

function formatNumber(matchType: ColorType, ...args: [string] | ColorArray): vscode.Color {
	if (matchType === ColorType.new) {
		const [red, green, blue] = args as ColorArray;
		return {
			alpha: 1,
			red,
			green,
			blue
		};
	}

	if (isHexType(matchType)) {
		const [red, green, blue] = colorTo.fromHex.new((args as [string])[0]);
		return {
			alpha: 1,
			red,
			green,
			blue
		};
	}

	const [red, green, blue] = colorTo[matchType][ColorType.new](...(args as ColorArray));

	return {
		alpha: 1,
		red,
		green,
		blue
	};
}

function replaceMatch(
	regexMatch: RegExpMatchArray,
	sourceType: ColorType,
	targetType: ColorType,
	prefix: string,
	value: [string] | ColorArray
) {
	if (isHexType(targetType)) {
		return `${prefix}("${value[0]}")`;
	}

	const [a, b, c] = value as ColorArray;

	// The source regex match has no numeric separators to reuse when it matched a
	// hex call, so fall back to a plain comma-separated argument list.
	if (isHexType(sourceType)) {
		return `${prefix}(${a}, ${b}, ${c})`;
	}

	return `${prefix}${regexMatch[2]}${a}${regexMatch[4]}${b}${regexMatch[6]}${c}${regexMatch[8]}`;
}

function getRotatedColorType(sourceType: ColorType) {
	const defaultColorType = vscode.workspace.getConfiguration("roblox-ts.colorPicker").get("defaultOption", ColorType.fromRGB);

	// Hex colors always round-trip back to Color3.fromHex(...) rather than being
	// normalized to the configured default, since hex has no lossless numeric default.
	const startType = sourceType === ColorType.fromHex ? ColorType.fromHex : defaultColorType;

	const rotatingArray = Object.values(ColorType);
	const location = rotatingArray.findIndex(value => value === startType);

	rotatingArray.unshift(...rotatingArray.splice(location, rotatingArray.length));
	return rotatingArray;
}

export function makeColorProvider() {
	const provider: vscode.DocumentColorProvider = {
		provideColorPresentations: (color, context, token) => {
			const text = context.document.getText(context.range);

			const sourceType = Object.values(ColorType).find(match => text.includes(match));
			if (!sourceType) throw new Error('Color type specified was not found!');

			const regexMatch = text.match(matchColors[sourceType])!;

			const matches: vscode.ProviderResult<Array<vscode.ColorPresentation>> = getRotatedColorType(sourceType).map((targetType): vscode.ColorPresentation => {
				if (isHexType(targetType)) {
					const hex = colorTo.new.fromHex(color.red, color.green, color.blue);
					return {
						label: replaceMatch(regexMatch, sourceType, targetType, matchPrefix[targetType], [hex])
					};
				}

				const colorMatch = targetType === ColorType.new
					? [color.red, color.green, color.blue] as const
					: colorTo[ColorType.new][targetType](...roundColor([color.red, color.green, color.blue]));

				return {
					label: replaceMatch(regexMatch, sourceType, targetType, matchPrefix[targetType], roundColor(colorMatch as ColorArray))
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
						color: formatNumber(matchType as ColorType, ...extractValue(matchType as ColorType, match)),
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
