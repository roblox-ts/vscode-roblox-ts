import EventEmitter = require('node:events');
import * as vscode from 'vscode';

/**
 * A PseudoTerminal that mimics OutputChannel api.
 */
export class VirtualTerminal {
	private terminal!: vscode.Terminal;
	private disposables = new Array<vscode.Disposable>();
	private writer = new vscode.EventEmitter<string>();
	private doClose = new vscode.EventEmitter<void>();

	private _close = new vscode.EventEmitter<void>();
	public onClose = this._close.event;

	constructor(public name: string) {
		// Silently refresh the terminal on kill.
		this.createTerminal(name);
		this.onClose(() => {
			this.createTerminal(name);
		});
	}

	private createTerminal(name: string) {
		if (this.terminal) {
			this.terminal.dispose();
		}
		const pty = {
			onDidWrite: this.writer.event,
			onDidClose: this.doClose.event,
			open: () => { },
			close: () => this._close.fire(),
		};
		this.terminal = vscode.window.createTerminal({
			name,
			pty
		});
	}

	/**
	 * Show the terminal panel and reveal this terminal in the UI.
	 */
	show() {
		this.terminal.show();
	}

	/**
	 * Append the given value to the channel.
	 * @param text The text to be appended
	 */
	append(text: string) {
		this.writer.fire(this.fixLineBreaks(text));
	}

	/**
	 * Append the given value and a line feed character to the channel.
	 * @param text The text to be appended
	 */
	appendLine(text: string) {
		this.writer.fire(this.fixLineBreaks(text) + "\r\n");
	}

	/**
	 * Fix inconsistent line breaks.
	 */
	fixLineBreaks(text: string) {
		return `\r${text.split(/(\r?\n)/g).join("\r")}\r`;
	}

	/**
	 * Dispose this object and free resources.
	 */
	dispose() {
		this.terminal.dispose();
		this.writer.dispose();
		this._close.dispose();
	}
}
