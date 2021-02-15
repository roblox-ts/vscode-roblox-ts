import * as path from "path";
import ts = require("typescript");
import { getCompilerOptionsAtFile } from "./compilerOptions";

export function isPathInSrc(fileName: string, compilerOptionsResult?: [string, ts.CompilerOptions]) {
	const result = compilerOptionsResult ?? getCompilerOptionsAtFile(fileName);
	if (result) {
		const [tsconfigPath, compilerOptions] = result;
		if (compilerOptions.rootDir) {
			const srcRelative = path.join(path.dirname(tsconfigPath), compilerOptions.rootDir);
			const isInSrc = !path.relative(srcRelative, fileName).startsWith('.');
			return isInSrc;
		}
	}
}
