import { App, Component, Notice, TFile, finishRenderMath } from 'obsidian';
import { parseIndex } from '../index-parser';
import type { DopeSettings } from '../settings';
import { buildDocument, buildOutline, fillTocPages, renderSteps, rewriteInternalLinks } from './document';
import { openFile, printToPdf, writeFile } from './electron';
import { countGuardedDiagrams } from './mermaid';
import { finalPageNumbers, finalizePdf, readDestinations } from './pdf';
import { buildPlan } from './plan';
import type { ExportProgress } from './progress';
import { ExportTheme, pageColors, withTheme } from './theme';
import { waitForRender } from './wait';

export interface ExportOptions {
	outPath: string;
	theme: ExportTheme;
}

let running = false;

export function isExportRunning(): boolean {
	return running;
}

/**
 * Removes the containers of exports that did not finish (e.g. plugin reloaded
 * mid-export): Obsidian prints every `body > .print`, so they would end up in
 * the next PDF too.
 */
export function removePrintContainers(): void {
	document.body.querySelectorAll(':scope > .dope-print').forEach((el) => el.remove());
	document.body.removeClass('dope-printing');
}

export async function exportIndex(
	app: App,
	settings: DopeSettings,
	index: TFile,
	options: ExportOptions,
	progress: ExportProgress,
): Promise<void> {
	if (running) {
		new Notice('Un export è già in corso.');
		return;
	}
	running = true;
	const component = new Component();
	component.load();
	removePrintContainers();
	// Must be attached to the main document: Excalidraw only converts connected embeds,
	// and Obsidian's print stylesheet shows only `body > .print`.
	const root = document.body.createDiv({ cls: ['print', 'dope-print'] });
	// Hides `.print` containers of other plugins while printing (see styles.css).
	document.body.addClass('dope-printing');

	try {
		const parsed = parseIndex(await app.vault.cachedRead(index));
		const plan = await buildPlan(app, index, parsed);
		const outline = buildOutline(parsed, plan);

		progress.enter('render', renderSteps(parsed, plan));
		await buildDocument(
			{
				app,
				component,
				index,
				parsed,
				plan,
				noteOnNewPage: settings.noteOnNewPage,
				onRendered: () => progress.step(),
			},
			root,
			outline,
		);
		progress.enter('settle');
		await waitForRender(root);
		await finishRenderMath();
		rewriteInternalLinks(app, root, plan);
		const guardedDiagrams = countGuardedDiagrams(root);

		// First pass finds the page of every chapter/note, second pass prints the TOC with page numbers.
		progress.enter('print1');
		const print = { pageSize: settings.pageSize, scale: settings.scale / 100 };
		const { bytes, colors } = await withTheme(app, options.theme, async () => {
			const draft = await printToPdf(print);
			progress.enter('print2');
			fillTocPages(root, finalPageNumbers(await readDestinations(draft), plan.attachments));
			return { bytes: await printToPdf(print), colors: pageColors() };
		});

		progress.enter('save');
		const pdf = await finalizePdf({ bytes, attachments: plan.attachments, outline, title: index.basename, colors });
		await writeFile(options.outPath, pdf);
		progress.enter('done');

		if (plan.unresolved.length > 0) console.warn('DOPE: link non trovati o non supportati', plan.unresolved);
		const notes = [
			plan.unresolved.length > 0 ? `${plan.unresolved.length} link ignorati, vedi console` : '',
			guardedDiagrams > 0 ? `${guardedDiagrams} diagrammi Mermaid stampati come codice: non sono abilitati nel vault` : '',
		].filter(Boolean);
		new Notice(`PDF salvato in ${options.outPath}${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`);
		// Not awaited: on Linux the opener can wait until the viewer is closed.
		if (settings.openAfterExport) {
			openFile(options.outPath).catch((error) => console.error('DOPE: cannot open the PDF', error));
		}
	} catch (error) {
		console.error('DOPE: export failed', error);
		new Notice(`Esportazione PDF fallita: ${error instanceof Error ? error.message : String(error)}`);
	} finally {
		root.remove();
		document.body.removeClass('dope-printing');
		component.unload();
		running = false;
	}
}
