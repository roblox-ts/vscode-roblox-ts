import * as path from "path";

export function convertToOutput(srcDir: string, outDir: string, basePath: string, fileName: string) {
	srcDir = path.join(path.normalize(basePath), path.normalize(srcDir));
	outDir = path.join(path.normalize(basePath), path.normalize(outDir));

	const relativePath = path.relative(path.normalize(srcDir), path.normalize(fileName));
	const parsedPath = path.parse(relativePath);

	let isTs = false;
	let isDeclaration = false;
	const segments = parsedPath.name.split(".");
	if (parsedPath.ext === ".ts") {
		isTs = true;
	}
	if (segments[segments.length - 1] === "d" && isTs) {
		segments.pop();
		isDeclaration = true;
	}

	const segmentedPath = segments.join(".");
	const baseName = isTs && segmentedPath === "index" ? "init" : segmentedPath;
	return path.join(outDir, path.join(parsedPath.dir, isTs ? baseName + ".lua" : baseName + parsedPath.ext));
}
