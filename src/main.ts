import { Plugin, TFile } from 'obsidian';
import { exportIndex } from './export/exporter';
import { DEFAULT_SETTINGS, DopeSettings, DopeSettingTab } from './settings';

export default class DopePlugin extends Plugin {
	settings!: DopeSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'export-index-to-pdf',
			name: 'Esporta index in PDF',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (file?.extension !== 'md') return false;
				if (!checking) void this.export(file);
				return true;
			},
		});

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (!(file instanceof TFile) || file.extension !== 'md') return;
				menu.addItem((item) =>
					item
						.setTitle('Esporta libro in PDF')
						.setIcon('book-open')
						.onClick(() => void this.export(file)),
				);
			}),
		);

		this.addSettingTab(new DopeSettingTab(this.app, this));
	}

	export(file: TFile): Promise<void> {
		return exportIndex(this.app, this.settings, file);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<DopeSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
