/** Thin wrapper over the Electron and Node APIs Obsidian exposes on desktop. */

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
		showOpenDialog(options: Record<string, unknown>): Promise<{ canceled: boolean; filePaths: string[] }>;
	};
	shell: { openPath(path: string): Promise<string> };
	nativeTheme: { themeSource: string };
	app: { getPath(name: string): string };
}

interface NodeFs {
	existsSync(path: string): boolean;
	statSync(path: string): { isDirectory(): boolean };
	promises: { writeFile(path: string, data: Uint8Array): Promise<void> };
}

type NodeRequire = (id: string) => unknown;

function nodeRequire(): NodeRequire {
	return (window as unknown as { require: NodeRequire }).require;
}

function remote(): Remote {
	const electron = nodeRequire()('electron') as { remote?: Remote };
	return electron.remote ?? (nodeRequire()('@electron/remote') as Remote);
}

function fs(): NodeFs {
	return nodeRequire()('fs') as NodeFs;
}

export async function chooseFolder(defaultPath: string): Promise<string | null> {
	const result = await remote().dialog.showOpenDialog({
		defaultPath,
		properties: ['openDirectory', 'createDirectory'],
	});
	return result.canceled ? null : (result.filePaths[0] ?? null);
}

export function documentsFolder(): string {
	return remote().app.getPath('documents');
}

export function joinPath(folder: string, name: string): string {
	return (nodeRequire()('path') as { join(...parts: string[]): string }).join(folder, name);
}

export function isDirectory(path: string): boolean {
	try {
		return fs().statSync(path).isDirectory();
	} catch {
		return false;
	}
}

export function fileExists(path: string): boolean {
	return fs().existsSync(path);
}

/** Forces the OS theme seen by Obsidian; returns a function that restores it. */
export function setNativeTheme(mode: 'light' | 'dark'): () => void {
	const nativeTheme = remote().nativeTheme;
	const previous = nativeTheme.themeSource;
	nativeTheme.themeSource = mode;
	return () => {
		nativeTheme.themeSource = previous;
	};
}

/** Prints the main window. Obsidian's print stylesheet only shows `body > .print`. */
export async function printToPdf(options: PrintOptions): Promise<Uint8Array> {
	const data = await remote().getCurrentWebContents().printToPDF({
		pageSize: options.pageSize,
		scale: options.scale,
		printBackground: true,
		margins: { top: 0.6, bottom: 0.7, left: 0.6, right: 0.6 },
	});
	return new Uint8Array(data);
}

export async function writeFile(path: string, data: Uint8Array): Promise<void> {
	await fs().promises.writeFile(path, data);
}

export async function openFile(path: string): Promise<void> {
	await remote().shell.openPath(path);
}
