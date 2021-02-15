import * as vscode from 'vscode';

export function showErrorMessage(message: string) {
	vscode.window.showErrorMessage(message);
}
