/** Thin wrapper over the Electron APIs Obsidian exposes on desktop. */

export interface PrintOptions {
	pageSize: string;
	/** 0.1 – 2 */
	scale: number;
}

interface Remote {
	getCurrentWebContents(): {
		printToPDF(options: Record<string, unknown>): Promise<Uint8Array>;
	};
	dialog: {
		showSaveDialog(options: Record<string, unknown>): Promise<{ canceled: boolean; filePath?: string }>;
	};
	shell: { openPath(path: string): Promise<string> };
	nativeTheme: { themeSource: string };
}

type NodeRequire = (id: string) => unknown;

function nodeRequire(): NodeRequire {
	return (window as unknown as { require: NodeRequire }).require;
}

function remote(): Remote {
	const electron = nodeRequire()('electron') as { remote?: Remote };
	return electron.remote ?? (nodeRequire()('@electron/remote') as Remote);
}

export async function askSavePath(defaultName: string): Promise<string | null> {
	const result = await remote().dialog.showSaveDialog({
		defaultPath: defaultName,
		filters: [{ name: 'PDF', extensions: ['pdf'] }],
		properties: ['showOverwriteConfirmation'],
	});
	return result.canceled || !result.filePath ? null : result.filePath;
}

/**
 * Prints the main window. Obsidian's print stylesheet only shows `body > .print`,
 * so the app itself is hidden. The light theme is applied only while printing,
 * so dark-theme colors do not end up on paper. With the "system" theme setting,
 * Obsidian re-applies the OS theme when printing starts, so the OS theme is
 * forced to light as well.
 */
export async function printToPdf(options: PrintOptions): Promise<Uint8Array> {
	const body = document.body;
	const dark = body.hasClass('theme-dark');
	const nativeTheme = remote().nativeTheme;
	const themeSource = nativeTheme.themeSource;
	nativeTheme.themeSource = 'light';
	if (dark) body.removeClass('theme-dark');
	body.addClass('theme-light');
	try {
		const data = await remote().getCurrentWebContents().printToPDF({
			pageSize: options.pageSize,
			scale: options.scale,
			printBackground: true,
			margins: { top: 0.6, bottom: 0.7, left: 0.6, right: 0.6 },
		});
		return new Uint8Array(data);
	} finally {
		nativeTheme.themeSource = themeSource;
		if (dark) {
			body.removeClass('theme-light');
			body.addClass('theme-dark');
		}
	}
}

export async function writeFile(path: string, data: Uint8Array): Promise<void> {
	const fs = nodeRequire()('fs') as { promises: { writeFile(p: string, d: Uint8Array): Promise<void> } };
	await fs.promises.writeFile(path, data);
}

export async function openFile(path: string): Promise<void> {
	await remote().shell.openPath(path);
}
