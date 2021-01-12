// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    const extension = vscode.extensions.getExtension("vscode.typescript-language-features");
    if (!extension) {
        return console.log("extension failed");
    }

    await extension.activate();
    if (!extension.exports || !extension.exports.getAPI) {
        return console.log("extension exports failed");
	}

	const api = extension.exports.getAPI(0);
    if (!api) {
        return console.log("extension api failed");
	}
	configurePlugin(api);

	vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("roblox-ts")) {
            configurePlugin(api);
        }
	}, undefined, context.subscriptions);

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('roblox-ts extensions has loaded');
}

export function configurePlugin(api: any) {
	const boundary = vscode.workspace.getConfiguration("roblox-ts.boundary");
	const paths = vscode.workspace.getConfiguration("roblox-ts.boundary.paths");
	api.configurePlugin("roblox-ts-extensions", {
		mode: boundary.get<string>("mode"),
		useRojo: boundary.get<boolean>("useRojo"),
		server: paths.get<string[]>("serverPaths"),
		client: paths.get<string[]>("clientPaths")
	});
}

// this method is called when your extension is deactivated
export function deactivate() {}
