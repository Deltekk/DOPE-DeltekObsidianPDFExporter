import { Editor, Notice, TFile } from 'obsidian';
import { INDEX_TEMPLATE } from './index-template';
import type DopePlugin from './main';
import { ExportModal } from './ui/export-modal';

export function registerCommands(plugin: DopePlugin): void {
	const { app } = plugin;
	const openExport = (file: TFile) => new ExportModal(app, plugin, file).open();

	plugin.addCommand({
		id: 'export-index-to-pdf',
		name: 'Esporta index in PDF',
		checkCallback: (checking) => {
			const file = app.workspace.getActiveFile();
			if (file?.extension !== 'md') return false;
			if (!checking) openExport(file);
			return true;
		},
	});

	plugin.addCommand({
		id: 'initialize-index',
		name: 'Inizializza index materia',
		editorCallback: (editor) => initializeIndex(editor),
	});

	plugin.registerEvent(
		app.workspace.on('file-menu', (menu, file) => {
			if (!(file instanceof TFile) || file.extension !== 'md') return;
			menu.addItem((item) =>
				item
					.setTitle('Esporta libro in PDF')
					.setIcon('book-open')
					.onClick(() => openExport(file)),
			);
		}),
	);
}

/** Writes the index sections in the current note, only if it is empty. */
function initializeIndex(editor: Editor): void {
	if (editor.getValue().trim() !== '') {
		new Notice('La nota non è vuota: l\'index si può inizializzare solo in una nota vuota.');
		return;
	}
	editor.setValue(INDEX_TEMPLATE);
	// Cursor on the first "Ricevimento" item.
	editor.setCursor({ line: INDEX_TEMPLATE.split('\n').findIndex((line) => line.startsWith('- ')), ch: 2 });
}
