import * as vscode from 'vscode';
import * as path from "path";
import { existsSync } from 'fs';
import { getCompilerOptionsAtFile } from './util/compilerOptions';
import { convertToOutput } from './util/convertToOutput';
import { isPathInSrc } from './util/isPathInSrc';
import { showErrorMessage } from './util/showMessage';

export async function activate(context: vscode.ExtensionContext) {
	// Retrieve a reference to vscode's typescript extension.
	const extension = vscode.extensions.getExtension("vscode.typescript-language-features");
	if (!extension) {
		return console.log("extension failed");
	}

	// Wait for extension to be activated, if not already active.
	await extension.activate();
	if (!extension.exports || !extension.exports.getAPI) {
		return console.log("extension exports failed");
	}

	// Get the language server's API for configuring plugins.
	const api = extension.exports.getAPI(0);
	if (!api) {
		return console.log("extension api failed");
	}
	configurePlugin(api);

	// Reconfigure the plugin when vscode settings change.
	vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration("roblox-ts")) {
			configurePlugin(api);
		}
	}, undefined, context.subscriptions);

	// Enable roblox-ts.openOutput whenever in source directory.
	vscode.window.onDidChangeActiveTextEditor((e) => {
		if (e) {
			vscode.commands.executeCommand('setContext', 'roblox-ts:inSrcDir', isPathInSrc(e.document.fileName));
		}
	}, undefined, context.subscriptions);

	// Find and open output file.
	const openOutput = () => {
		var currentFile = vscode.window.activeTextEditor?.document.fileName;
		if (!currentFile) return showErrorMessage("No file selected");

		const result = getCompilerOptionsAtFile(currentFile);
		if (!result) return showErrorMessage("tsconfig not found");

		const [tsconfigPath, compilerOptions] = result;
		if (!compilerOptions) return showErrorMessage("compilerOptions not found");
		if (!compilerOptions.rootDir || !compilerOptions.outDir) return showErrorMessage("rootDir or outDir not specified");

		if (!isPathInSrc(currentFile, result)) return showErrorMessage("File not in srcDir");

		const outputPath = convertToOutput(compilerOptions.rootDir, compilerOptions.outDir, path.dirname(tsconfigPath), currentFile);
		if (!existsSync(outputPath)) return showErrorMessage("Output file could not be found");

		vscode.workspace.openTextDocument(vscode.Uri.file(outputPath))
			.then(document => vscode.window.showTextDocument(document));
	};

	// Register commands.
	context.subscriptions.push(vscode.commands.registerCommand("roblox-ts.openOutput", openOutput));
	vscode.commands.executeCommand('setContext', 'roblox-ts:inSrcDir', vscode.window.activeTextEditor?.document.uri.fsPath ?? false);

	console.log('roblox-ts extensions has loaded');
}

export function configurePlugin(api: any) {
	const editor = vscode.workspace.getConfiguration("roblox-ts.editor");
	const boundary = vscode.workspace.getConfiguration("roblox-ts.boundary");
	const paths = vscode.workspace.getConfiguration("roblox-ts.boundary.paths");

	// Updates the settings that the language service plugin uses.
	api.configurePlugin("roblox-ts-extensions", {
		mode: boundary.get("mode"),
		useRojo: boundary.get("useRojo"),
		server: paths.get("serverPaths"),
		client: paths.get("clientPaths"),
		hideDeprecated: editor.get("hideDeprecated")
	});
}

// this method is called when your extension is deactivated
export function deactivate() {}
