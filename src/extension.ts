import * as vscode from 'vscode';

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

	console.log('roblox-ts extensions has loaded');
}

export function configurePlugin(api: any) {
	const boundary = vscode.workspace.getConfiguration("roblox-ts.boundary");
	const paths = vscode.workspace.getConfiguration("roblox-ts.boundary.paths");

	// Updates the settings that the language service plugin uses.
	api.configurePlugin("roblox-ts-extensions", {
		mode: boundary.get("mode"),
		useRojo: boundary.get("useRojo"),
		server: paths.get("serverPaths"),
		client: paths.get("clientPaths")
	});
}

// this method is called when your extension is deactivated
export function deactivate() {}
