import * as childProcess from 'child_process';
import * as fs from 'fs';
import { existsSync } from 'fs';
import * as path from "path";
import * as treeKill from 'tree-kill';
import * as vscode from 'vscode';
import { makeColorProvider } from './colorizePrint';
import { getCompilerOptionsAtFile } from './util/compilerOptions';
import { isPathInSrc } from './util/isPathInSrc';
import { PathTranslator } from './util/PathTranslator';
import { showErrorMessage } from './util/showMessage';
import { VirtualTerminal } from './VirtualTerminal';

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
			updateStatusButtonVisibility();
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

		const basePath = path.dirname(tsconfigPath);
		const pathTranslator = new PathTranslator(
			path.join(basePath, compilerOptions.rootDir),
			path.join(basePath, compilerOptions.outDir),
			undefined,
			true
		);
		const outputPath = pathTranslator.getOutputPath(currentFile);
		if (!existsSync(outputPath)) return showErrorMessage("Output file could not be found");

		const openToSide = vscode.workspace.getConfiguration('roblox-ts').get<boolean>("openOutputToSide", true);
		const viewColumn = openToSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active;
		vscode.workspace.openTextDocument(vscode.Uri.file(outputPath))
			.then(document => vscode.window.showTextDocument(document, viewColumn));
	};

	const outputChannel = new VirtualTerminal("roblox-ts");

	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		500
	);

	const statusBarDefaultState = () => {
		statusBarItem.text = "$(debug-start) roblox-ts";
		statusBarItem.command = "roblox-ts.start";
	};

	const updateStatusButtonVisibility = () => {
		if (vscode.workspace.getConfiguration('roblox-ts.command.status').get('show', true)) {
			statusBarItem.show();
		} else {
			statusBarItem.hide();
		}
	};

	let compilerProcess: childProcess.ChildProcessWithoutNullStreams;
	let compilerPendingExit = false;
	const startCompiler = async() => {
		statusBarItem.text = "$(debug-stop) roblox-ts";
		statusBarItem.command = "roblox-ts.stop";

		if (!vscode.workspace.workspaceFolders) return showErrorMessage("Not in a workspace");

		outputChannel.show();
		outputChannel.appendLine("Starting compiler..");

		const commandConfiguration = vscode.workspace.getConfiguration("roblox-ts.command");
		const parameters = commandConfiguration.get<Array<string>>("parameters", ["-w"]);
		const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		const options = {
			cwd: workspacePath.toString(),
			shell: true
		};

		const development = commandConfiguration.get("development", false);
		const compilerCommand = development ? "rbxtsc-dev" : "rbxtsc";

		// Detect if there is a local install
		const localInstall = path.join(workspacePath, "node_modules", ".bin", "rbxtsc");

		vscode.commands.executeCommand('setContext', 'roblox-ts:compilerActive', true);
		if (!development && fs.existsSync(localInstall)) {
			outputChannel.appendLine("Detected local install, using local install instead of global");
			compilerProcess = childProcess.spawn(localInstall, parameters, options);
		} else {
			compilerProcess = childProcess.spawn(compilerCommand, parameters, options);
		}

		compilerProcess.on("error", error => {
			const errorMessage = `Error while starting compiler: ${error.message}`;
			showErrorMessage(errorMessage);
			outputChannel.appendLine(errorMessage);
		});

		compilerProcess.stdout.on("data", chunk => outputChannel.append(chunk.toString()));

		compilerProcess.on("exit", exitCode => {
			vscode.commands.executeCommand('setContext', 'roblox-ts:compilerActive', false);

			if (exitCode && !compilerPendingExit) {
				vscode.window.showErrorMessage("Compiler did not exit successfully.", "Show Output").then(choice => {
					if (!choice) return;

					outputChannel.show();
				});
			}

			compilerPendingExit = false;

			outputChannel.appendLine(`Compiler exited with code ${exitCode ?? 0}`);
			statusBarDefaultState();
		});
	};

	const stopCompiler = async() => {
		outputChannel.appendLine("Stopping compiler..");
		compilerPendingExit = true;

		treeKill(compilerProcess.pid);
	};

	outputChannel.onClose(() => {
		if (statusBarItem.command === "roblox-ts.stop") {
			stopCompiler();
		}
	});

	// Register commands.
	context.subscriptions.push(vscode.commands.registerCommand("roblox-ts.openOutput", openOutput));
	context.subscriptions.push(vscode.commands.registerCommand("roblox-ts.start", startCompiler));
	context.subscriptions.push(vscode.commands.registerCommand("roblox-ts.stop", stopCompiler));

	context.subscriptions.push(statusBarItem);
	context.subscriptions.push(outputChannel);

	const colorConfiguration = vscode.workspace.getConfiguration("roblox-ts.colorPicker");
	if (colorConfiguration.get("enabled", true)) {
		makeColorProvider().forEach(provider => context.subscriptions.push(provider));
	}

	statusBarDefaultState();
	updateStatusButtonVisibility();

	vscode.commands.executeCommand('setContext', 'roblox-ts:inSrcDir', vscode.window.activeTextEditor?.document.uri.fsPath ?? false);
	vscode.commands.executeCommand('setContext', 'roblox-ts:compilerActive', false);

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
