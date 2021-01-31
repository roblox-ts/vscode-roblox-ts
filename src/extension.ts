import * as vscode from 'vscode';

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
