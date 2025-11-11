import { PathTranslator } from '@roblox-ts/path-translator';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import { existsSync } from 'fs';
import * as path from "path";
import * as treeKill from 'tree-kill';
import * as vscode from 'vscode';
import { makeColorProvider } from './colorizePrint';
import { getCompilerOptionsAtFile, getPackageJsonAtFile, getTsConfigPathAtFile } from './util/compilerOptions';
import { isPathInSrc } from './util/isPathInSrc';
import { showErrorMessage } from './util/showMessage';
import { VirtualTerminal } from './VirtualTerminal';
import type ts = require('typescript');

interface ProjectCompilation {
	terminal: VirtualTerminal;
	status:
		| { type: "success", since: number, timeout: number }
		| { type: "compiling" }
		| { type: "error", count: number, since: number, timeout: number };
	cancel?: () => void;
}

function stripColors(input: string) {
	return input.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

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

	const createPathTranslator = (basePath: string, compilerOptions: ts.CompilerOptions, luau: boolean) => {
		if (!compilerOptions.rootDir || !compilerOptions.outDir) {
			return showErrorMessage("rootDir or outDir not specified");
		}

		return new PathTranslator(
			path.join(basePath, compilerOptions.rootDir),
			path.join(basePath, compilerOptions.outDir),
			undefined,
			true,
			luau
		);
	};

	const getOutputPath = (basePath: string, compilerOptions: ts.CompilerOptions, file: string) => {
		const luauPathTranslator = createPathTranslator(basePath, compilerOptions, true);
		if (!luauPathTranslator) {
			return;
		}

		const luauPath = luauPathTranslator.getOutputPath(file);
		if (existsSync(luauPath)) {
			return luauPath;
		}

		const luaPathTranslator = createPathTranslator(basePath, compilerOptions, false);
		if (!luaPathTranslator) {
			return;
		}

		const luaPath = luaPathTranslator.getOutputPath(file);
		if (existsSync(luaPath)) {
			return luaPath;
		}
	};

	// Find and open output file.
	const openOutput = () => {
		var currentFile = vscode.window.activeTextEditor?.document.fileName;
		if (!currentFile) return showErrorMessage("No file selected");

		const result = getCompilerOptionsAtFile(currentFile);
		if (!result) return showErrorMessage("tsconfig not found");

		const [tsconfigPath, compilerOptions] = result;
		if (!compilerOptions) return showErrorMessage("compilerOptions not found");

		if (!isPathInSrc(currentFile, result)) return showErrorMessage("File not in srcDir");

		const basePath = path.dirname(tsconfigPath);
		const outputPath = getOutputPath(basePath, compilerOptions, currentFile);
		if (outputPath === undefined) return showErrorMessage("Output file could not be found");

		const openToSide = vscode.workspace.getConfiguration('roblox-ts').get<boolean>("openOutputToSide", true);
		const viewColumn = openToSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active;
		vscode.workspace.openTextDocument(vscode.Uri.file(outputPath))
			.then(document => vscode.window.showTextDocument(document, viewColumn));
	};

	const compilations = new Map<string, ProjectCompilation>();

	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		500
	);

	const updateStatusBarState = () => {
		var currentFile = vscode.window.activeTextEditor?.document.fileName;
		if (!currentFile) return;

		const projectPath = getProjectPath(currentFile);
		if (!projectPath) return;

		const compilation = compilations.get(projectPath);
		if (compilation && compilation.cancel) {
			statusBarItem.command = "roblox-ts.stop";

			switch (compilation.status.type) {
				case "compiling": {
					statusBarItem.text = "$(loading~spin) roblox-ts";
					statusBarItem.color = undefined;
					break;
				}

				case "error": {
					if (compilation.status.timeout !== -1 && Date.now() - compilation.status.since >= compilation.status.timeout) {
						statusBarItem.text = "$(debug-stop) roblox-ts";
						statusBarItem.color = undefined;
					} else {
						statusBarItem.text = `${compilation.status.count} $(error) roblox-ts`;
						if (vscode.workspace.getConfiguration("roblox-ts.command.status").get("errorMessageColor", false)) {
							statusBarItem.color = new vscode.ThemeColor("errorForeground");
						} else {
							statusBarItem.color = undefined;
						}
					}
					break;
				}

				case "success": {
					if (compilation.status.timeout !== -1 && Date.now() - compilation.status.since >= compilation.status.timeout) {
						statusBarItem.text = "$(debug-stop) roblox-ts";
					} else {
						statusBarItem.text = "$(check) roblox-ts";
					}
					statusBarItem.color = undefined;
					break;
				}
			}
		} else {
			statusBarItem.text = "$(debug-start) roblox-ts";
			statusBarItem.command = "roblox-ts.start";
			statusBarItem.color = undefined;
		}

		vscode.commands.executeCommand('setContext', 'roblox-ts:compilerActive', compilation?.cancel !== undefined);
	};

	const updateStatusButtonVisibility = () => {
		if (vscode.workspace.getConfiguration('roblox-ts.command.status').get('show', true)) {
			statusBarItem.show();
		} else {
			statusBarItem.hide();
		}
	};

	const startCompiler = async() => {
		var currentFile = vscode.window.activeTextEditor?.document.fileName;
		if (!currentFile) return showErrorMessage("No file selected");

		const packagePath = getPackageJsonAtFile(currentFile);
		if (!packagePath) return showErrorMessage("package.json not found");

		const projectPath = getProjectPath(currentFile);
		if (!projectPath) return showErrorMessage("tsconfig not found");

		const packageJson = JSON.parse(fs.readFileSync(packagePath, { encoding: "ascii" }));
		const modulesPath = path.dirname(packagePath);

		let compilation = compilations.get(projectPath);
		if (compilation) {
			compilation.status = { type: "compiling" };
		} else {
			compilation = {
				terminal: new VirtualTerminal(`roblox-ts (${packageJson.name})`),
				status: { type: "compiling" },
			};

			compilation.terminal.onClose(() => {
				if (statusBarItem.command === "roblox-ts.stop") {
					compilation!.cancel?.();
					compilation!.terminal.dispose();
					compilations.delete(projectPath);
				}
			});

			compilations.set(projectPath, compilation);
		}

		compilation.terminal.show();
		compilation.terminal.appendLine("Starting compiler..");

		const commandConfiguration = vscode.workspace.getConfiguration("roblox-ts.command");
		const parameters = commandConfiguration.get<Array<string>>("parameters", ["-w"]);
		const options = {
			cwd: projectPath.toString(),
			shell: true
		};

		const development = commandConfiguration.get("development", false);
		const compilerCommand = development ? "rbxtsc-dev" : "rbxtsc";

		let compilerProcess: childProcess.ChildProcessWithoutNullStreams;
		let compilerPendingExit = false;
		let compilerIsRunning = true;

		// Detect if there is a local install
		const localInstall = path.join(modulesPath, "node_modules", ".bin", "rbxtsc");
		const useScripts = commandConfiguration.get<boolean>("npm.useNpmScripts");
		const watchScript = commandConfiguration.get<string>("npm.watchScript") ?? "watch";
		const watchScriptArgs = commandConfiguration.get<string[]>("npm.watchScriptArgs") ?? [];

		if (!development && useScripts && hasScript(packageJson, watchScript)) {
			compilation.terminal.appendLine("roblox-ts has started, using watch script");
			compilerProcess = childProcess.spawn("npm", ["run", watchScript, ...watchScriptArgs], options);
		}  else if (!development && fs.existsSync(localInstall)) {
			compilation.terminal.appendLine("roblox-ts has started, using local roblox-ts install");
			compilerProcess = childProcess.spawn(`"${localInstall.replaceAll(/"/g, '\\"')}"`, parameters, options);
		} else {
			compilation.terminal.appendLine("roblox-ts has started, using global roblox-ts install");
			compilerProcess = childProcess.spawn(compilerCommand, parameters, options);
		}

		compilerProcess.on("error", error => {
			const errorMessage = `Error while starting compiler: ${error.message}`;
			showErrorMessage(errorMessage);
			compilation.terminal.appendLine(errorMessage);
			compilation.cancel?.();
		});

		compilerProcess.stdout.on("data", chunk => {
			const uncoloredChunk = stripColors(chunk.toString());
			if (uncoloredChunk.match(/\[[^\]]+] Starting compilation in watch mode\.\.\./) || uncoloredChunk.match(/\[[^\]]+] File change detected. Starting incremental compilation\.\.\./)) {
				compilation.status = { type: "compiling" };
				updateStatusBarState();
			} else {
				const finished = uncoloredChunk.match(/\[[^\]]+] Found (\d+) errors?\. Watching for file changes./);
				if (finished) {
					const errors = +finished[1];
					if (errors > 0) {
						const timeout = vscode.workspace.getConfiguration("roblox-ts.command.status").get("errorMessageDuration", 2000);

						compilation.status = {
							type: "error",
							since: Date.now(),
							count: errors,
							timeout,
						};
						setTimeout(updateStatusBarState, timeout);
					} else {
						const timeout = vscode.workspace.getConfiguration("roblox-ts.command.status").get("successMessageDuration", 2000);

						compilation.status = {
							type: "success",
							since: Date.now(),
							timeout,
						};
						setTimeout(updateStatusBarState, timeout);
					}
					updateStatusBarState();
				}
			}

			compilation.terminal.append(chunk.toString());
		});
		compilerProcess.stderr.on("data", chunk => compilation.terminal.append(chunk.toString()));

		compilerProcess.on("exit", exitCode => {
			if (exitCode && !compilerPendingExit) {
				vscode.window.showErrorMessage("Compiler did not exit successfully.", "Show Output").then(choice => {
					if (!choice) return;

					compilation.terminal.show();
				});
			}

			compilation.terminal.appendLine(`Compiler exited with code ${exitCode ?? 0}`);
			compilation.cancel?.();
			updateStatusBarState();
			compilerIsRunning = false;
		});

		if (compilation.cancel) {
			compilation.cancel();
		}

		compilation.cancel = () => {
			compilation.cancel = undefined;
			if (compilerIsRunning) {
				compilerPendingExit = true;
				treeKill(compilerProcess.pid);
			}
			updateStatusBarState();
		};

		updateStatusBarState();
	};

	const stopCompiler = async () => {
		var currentFile = vscode.window.activeTextEditor?.document.fileName;
		if (!currentFile) return showErrorMessage("No file selected");

		const projectPath = getProjectPath(currentFile);
		if (!projectPath) return showErrorMessage("No project found");

		const compilation = compilations.get(projectPath);
		if (!compilation || !compilation.cancel) return showErrorMessage("This project is not compiling");

		compilation.terminal.appendLine("Stopping compiler..");
		compilation.cancel();
	};

	// Register commands.
	context.subscriptions.push(vscode.commands.registerCommand("roblox-ts.openOutput", openOutput));
	context.subscriptions.push(vscode.commands.registerCommand("roblox-ts.start", startCompiler));
	context.subscriptions.push(vscode.commands.registerCommand("roblox-ts.stop", stopCompiler));
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => updateStatusBarState()));

	context.subscriptions.push(statusBarItem);
	context.subscriptions.push({
		dispose: () => {
			for (const [_, compilation] of compilations) {
				compilation.terminal.dispose();
				compilation.cancel?.();
			}
		}
	});

	const colorConfiguration = vscode.workspace.getConfiguration("roblox-ts.colorPicker");
	if (colorConfiguration.get("enabled", true)) {
		makeColorProvider().forEach(provider => context.subscriptions.push(provider));
	}

	updateStatusBarState();
	updateStatusButtonVisibility();

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
		diagnosticsMode: boundary.get("diagnosticsMode"),
		server: paths.get("serverPaths"),
		client: paths.get("clientPaths"),
		hideDeprecated: editor.get("hideDeprecated")
	});
}

// this method is called when your extension is deactivated
export function deactivate() {}

function getProjectPath(file: string) {
	const tsconfigPath = getTsConfigPathAtFile(file);
	if (!tsconfigPath) return;

	return path.dirname(tsconfigPath);
}

function hasScript(json: any, script: string) {
	return json.scripts?.[script] !== undefined;
}
