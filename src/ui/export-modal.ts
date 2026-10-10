import { App, Modal, Notice, ProgressBarComponent, Setting, TFile, TextComponent } from 'obsidian';
import { chooseFolder, documentsFolder, fileExists, isDirectory, joinPath } from '../export/electron';
import { exportIndex, isExportRunning } from '../export/exporter';
import { allowMermaid, isMermaidGuarded } from '../export/mermaid';
import { ExportProgress } from '../export/progress';
import { ThemeMode, currentThemeName, listThemes } from '../export/theme';
import type DopePlugin from '../main';

/** Export options (theme, folder, file name), then progress with percentage and remaining time. */
export class ExportModal extends Modal {
	private theme: string;
	private mode: ThemeMode;
	private folder: string;
	private name: string;
	private timer: number | null = null;

	constructor(
		app: App,
		private plugin: DopePlugin,
		private index: TFile,
	) {
		super(app);
		const settings = plugin.settings;
		this.theme = settings.theme ?? currentThemeName(app);
		this.mode = settings.mode;
		this.folder = settings.folder || documentsFolder();
		this.name = index.basename;
	}

	async onOpen(): Promise<void> {
		this.setTitle('Esporta in PDF');
		this.renderOptions(await listThemes(this.app));
	}

	onClose(): void {
		if (this.timer !== null) window.clearInterval(this.timer);
		this.contentEl.empty();
	}

	private outPath(): string {
		const name = this.name.trim();
		return joinPath(this.folder, /\.pdf$/i.test(name) ? name : `${name}.pdf`);
	}

	private validate(): string | null {
		if (!this.name.trim()) return 'Inserisci un nome per il file.';
		if (/[\\/]/.test(this.name)) return 'Il nome non può contenere / o \\.';
		if (!isDirectory(this.folder)) return 'La cartella non esiste.';
		return null;
	}

	private renderOptions(themes: string[]): void {
		const { contentEl } = this;
		contentEl.empty();
		if (!themes.includes(this.theme)) this.theme = '';

		new Setting(contentEl).setName('Tema').addDropdown((dropdown) => {
			dropdown.addOption('', 'Predefinito di Obsidian');
			for (const theme of themes) dropdown.addOption(theme, theme);
			dropdown.setValue(this.theme).onChange((value) => (this.theme = value));
		});

		new Setting(contentEl).setName('Modalità').addDropdown((dropdown) =>
			dropdown
				.addOptions({ light: 'Chiara', dark: 'Scura' })
				.setValue(this.mode)
				.onChange((value) => (this.mode = value as ThemeMode)),
		);

		let folderText: TextComponent | null = null;
		new Setting(contentEl)
			.setName('Cartella')
			.addText((text) => {
				folderText = text;
				text.setValue(this.folder).onChange((value) => {
					this.folder = value;
					updateStatus();
				});
			})
			.addButton((button) =>
				button.setButtonText('Sfoglia').onClick(() => {
					void chooseFolder(this.folder).then((folder) => {
						if (!folder) return;
						this.folder = folder;
						folderText?.setValue(folder);
						updateStatus();
					});
				}),
			);

		new Setting(contentEl).setName('Nome file').addText((text) =>
			text.setValue(this.name).onChange((value) => {
				this.name = value;
				updateStatus();
			}),
		);

		if (isMermaidGuarded(this.app)) {
			const mermaid = new Setting(contentEl)
				.setName('Diagrammi Mermaid')
				.setDesc(
					'Non sono abilitati in questo vault: nel PDF verrà stampato il loro codice. ' +
						'Abilitali solo se ritieni attendibili i contenuti del vault.',
				);
			mermaid.addButton((button) =>
				button.setButtonText('Abilita').onClick(() => {
					allowMermaid(this.app);
					mermaid.setDesc('Abilitati in questo vault.');
					button.setDisabled(true);
				}),
			);
		}

		const status = contentEl.createDiv('dope-export-status');
		const updateStatus = (): void => {
			const error = this.validate();
			status.toggleClass('mod-warning', error !== null);
			status.setText(error ?? (fileExists(this.outPath()) ? 'Il file esiste già e verrà sovrascritto.' : ''));
		};
		updateStatus();

		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText('Esporta')
				.setCta()
				.onClick(() => void this.start()),
		);
	}

	private async start(): Promise<void> {
		const error = this.validate();
		if (error) {
			new Notice(error);
			return;
		}
		if (isExportRunning()) {
			new Notice('Un export è già in corso.');
			return;
		}
		const settings = this.plugin.settings;
		Object.assign(settings, { theme: this.theme, mode: this.mode, folder: this.folder });
		await this.plugin.saveSettings();

		const options = { outPath: this.outPath(), theme: { name: this.theme, mode: this.mode } };
		const progress = new ExportProgress();
		this.renderProgress(progress);
		await exportIndex(this.app, settings, this.index, options, progress);
		this.close();
	}

	private renderProgress(progress: ExportProgress): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle(`Esportazione di ${this.index.basename}`);
		const phaseEl = contentEl.createDiv('dope-progress-phase');
		const bar = new ProgressBarComponent(contentEl);
		const info = contentEl.createDiv('dope-progress-info');
		const percentEl = info.createSpan();
		const etaEl = info.createSpan();

		const update = (): void => {
			const { fraction, label, remainingMs } = progress.snapshot();
			const percent = Math.round(fraction * 100);
			phaseEl.setText(label);
			bar.setValue(percent);
			percentEl.setText(`${percent}%`);
			etaEl.setText(remainingMs === null ? 'Stima del tempo…' : `${formatTime(remainingMs)} rimanenti`);
		};
		update();
		this.timer = window.setInterval(update, 500);
	}
}

function formatTime(ms: number): string {
	const seconds = Math.ceil(ms / 1000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
