import { readFileSync } from "fs";
import { dirname } from "path";
import ts = require("typescript");

export function getCompilerOptionsAtFile(fileName: string): [string, ts.CompilerOptions] | undefined {
	const result = getTsConfigPathAtFile(fileName);
	if (!result) return undefined;

	const parsed = ts.parseConfigFileTextToJson(result, readFileSync(result).toString());
	const compilerOptions = (parsed.config.compilerOptions as ts.CompilerOptions);
	return [result, compilerOptions];
}

export function getTsConfigPathAtFile(fileName: string) {
	return ts.findConfigFile(dirname(fileName), ts.sys.fileExists);;
}

export function getPackageJsonAtFile(fileName: string) {
	return ts.findConfigFile(dirname(fileName), ts.sys.fileExists, "package.json");
}
