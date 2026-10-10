/**
 * Applies the export theme (community theme + light/dark mode) to the app
 * while printing, without touching the user's appearance settings.
 */
import { App } from 'obsidian';
import type { PageColors, Rgb } from '../types';
import { setNativeTheme } from './electron';

export type ThemeMode = 'light' | 'dark';

export interface ExportTheme {
	/** Community theme folder name; '' is Obsidian's default theme. */
	name: string;
	mode: ThemeMode;
}

/** Undocumented, but stable for years and used by many theme plugins. */
interface CustomCss {
	theme?: string;
	styleEl?: HTMLStyleElement;
}

function customCss(app: App): CustomCss | undefined {
	return (app as unknown as { customCss?: CustomCss }).customCss;
}

export function currentThemeName(app: App): string {
	return customCss(app)?.theme ?? '';
}

export async function listThemes(app: App): Promise<string[]> {
	const dir = `${app.vault.configDir}/themes`;
	if (!(await app.vault.adapter.exists(dir))) return [];
	const { folders } = await app.vault.adapter.list(dir);
	const names = folders.map((folder) => folder.split('/').pop() ?? folder);
	const valid = await Promise.all(names.map((name) => app.vault.adapter.exists(`${dir}/${name}/theme.css`)));
	return names.filter((_, i) => valid[i]).sort((a, b) => a.localeCompare(b));
}

/** Runs `fn` with the export theme applied, then restores the user's theme. */
export async function withTheme<T>(app: App, theme: ExportTheme, fn: () => Promise<T>): Promise<T> {
	const restore = await applyTheme(app, theme);
	try {
		return await fn();
	} finally {
		restore();
	}
}

async function applyTheme(app: App, theme: ExportTheme): Promise<() => void> {
	const styleEl = customCss(app)?.styleEl;
	const previousCss = styleEl?.textContent ?? null;
	if (styleEl && theme.name !== currentThemeName(app)) {
		styleEl.textContent = theme.name
			? await app.vault.adapter.read(`${app.vault.configDir}/themes/${theme.name}/theme.css`)
			: '';
	}

	// With the "system" appearance setting Obsidian follows the OS theme, also when
	// printing starts, so the OS theme is forced too.
	const body = document.body;
	const previousMode: ThemeMode = body.hasClass('theme-dark') ? 'dark' : 'light';
	const restoreNative = setNativeTheme(theme.mode);
	setMode(theme.mode);

	return () => {
		restoreNative();
		setMode(previousMode);
		if (styleEl && previousCss !== null) styleEl.textContent = previousCss;
	};
}

function setMode(mode: ThemeMode): void {
	document.body.removeClass('theme-light', 'theme-dark');
	document.body.addClass(`theme-${mode}`);
}

export function pageColors(): PageColors {
	const probe = document.body.createDiv('dope-color-probe');
	const style = getComputedStyle(probe);
	const background = parseColor(style.backgroundColor) ?? [1, 1, 1];
	const foreground = parseColor(style.color) ?? [0.4, 0.4, 0.4];
	probe.remove();
	return { background, foreground };
}

function parseColor(css: string): Rgb | null {
	const match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(css);
	if (!match || match[4] === '0') return null;
	return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
}
