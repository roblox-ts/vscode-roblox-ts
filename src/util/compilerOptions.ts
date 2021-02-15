import { readFileSync } from "fs";
import { dirname } from "path";
import ts = require("typescript");

export function getCompilerOptionsAtFile(fileName: string): [string, ts.CompilerOptions] | undefined {
	const result = ts.findConfigFile(dirname(fileName), ts.sys.fileExists);
	if (!result) return undefined;

	const parsed = ts.parseConfigFileTextToJson(result, readFileSync(result).toString());
	const compilerOptions = (parsed.config.compilerOptions as ts.CompilerOptions);
	return [result, compilerOptions];
}
