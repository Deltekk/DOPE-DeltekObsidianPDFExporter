import { App, Component, Notice, TFile, finishRenderMath } from 'obsidian';
import { parseIndex } from '../index-parser';
import type { DopeSettings } from '../settings';
import { buildDocument, buildOutline, fillTocPages, rewriteInternalLinks } from './document';
import { askSavePath, openFile, printToPdf, writeFile } from './electron';
import { finalPageNumbers, finalizePdf, readDestinations } from './pdf';
import { buildPlan } from './plan';
import { waitForRender } from './wait';

let running = false;

export async function exportIndex(app: App, settings: DopeSettings, index: TFile): Promise<void> {
	if (running) {
		new Notice('Un export è già in corso.');
		return;
	}
	const outPath = await askSavePath(`${index.basename}.pdf`);
	if (!outPath) return;

	running = true;
	const notice = new Notice('Preparazione del PDF…', 0);
	const component = new Component();
	component.load();
	// Must be attached to the main document: Excalidraw only converts connected embeds,
	// and Obsidian's print stylesheet shows only `body > .print`.
	const root = document.body.createDiv({ cls: ['print', 'dope-print'] });

	try {
		const parsed = parseIndex(await app.vault.cachedRead(index));
		const plan = await buildPlan(app, index, parsed);
		const outline = buildOutline(parsed, plan);

		notice.setMessage('Rendering delle note…');
		await buildDocument({ app, component, index, parsed, plan, noteOnNewPage: settings.noteOnNewPage }, root, outline);
		await waitForRender(root);
		await finishRenderMath();
		rewriteInternalLinks(app, root, plan);

		// First pass finds the page of every chapter/note, second pass prints the TOC with page numbers.
		notice.setMessage('Impaginazione…');
		const print = { pageSize: settings.pageSize, scale: settings.scale / 100 };
		const draft = await printToPdf(print);
		fillTocPages(root, finalPageNumbers(await readDestinations(draft), plan.attachments));
		const pdf = await finalizePdf({
			bytes: await printToPdf(print),
			attachments: plan.attachments,
			outline,
			title: index.basename,
		});
		await writeFile(outPath, pdf);

		if (plan.unresolved.length > 0) console.warn('DOPE: link non trovati o non supportati', plan.unresolved);
		const missing = plan.unresolved.length > 0 ? ` (${plan.unresolved.length} link ignorati, vedi console)` : '';
		new Notice(`PDF salvato in ${outPath}${missing}`);
		if (settings.openAfterExport) await openFile(outPath);
	} catch (error) {
		console.error('DOPE: export failed', error);
		new Notice(`Esportazione PDF fallita: ${error instanceof Error ? error.message : String(error)}`);
	} finally {
		notice.hide();
		root.remove();
		component.unload();
		running = false;
	}
}
