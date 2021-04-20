import * as vscode from 'vscode';

/**
 * A PseudoTerminal that mimics OutputChannel api.
 */
export class VirtualTerminal {
	private terminal?: vscode.Terminal;
	private writer = new TrackedEventEmitter<string>();
	private doClose = new vscode.EventEmitter<void>();

	private _close = new vscode.EventEmitter<void>();
	public onClose = this._close.event;

	constructor(public name: string) {
		this.onClose(() => {
			this.terminal = undefined;
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
		this.writer.isConnected = false;
		this.terminal = vscode.window.createTerminal({
			name,
			pty
		});
	}

	/**
	 * Show the terminal panel and reveal this terminal in the UI.
	 */
	show() {
		if (!this.terminal) {
			this.createTerminal(this.name);
		}
		this.terminal!.show();
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
		return `${text.split(/(\r?\n)/g).join("\r")}`;
	}

	/**
	 * Dispose this object and free resources.
	 */
	dispose() {
		this.terminal?.dispose();
		this.writer.dispose();
		this._close.dispose();
	}
}

/**
 * An EventEmitter that will keep track of values sent prior to a connection.
 */
class TrackedEventEmitter<T> extends vscode.EventEmitter<T> {
	private values = new Array<T>();
	public isConnected = false;

	constructor() {
		super();
		const originalEvent = this.event;
		Object.defineProperty(this, 'event', {
			value: (listener: any, thisArgs?: any, disposables?: any) => {
				const disposable = originalEvent(listener, thisArgs, disposables);
				this.isConnected = true;
				this.values.forEach(v => this.fire(v));
				this.values = [];
				return disposable;
			}
		});
	}

	fire(data: T) {
		if (this.isConnected) {
			super.fire(data);
		} else {
			this.values.push(data);
		}
	}

	dispose() {
		super.dispose();
		this.values = undefined!;
	}
}
