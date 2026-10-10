import { App, PluginSettingTab, Setting } from 'obsidian';
import type DopePlugin from './main';

export interface DopeSettings {
	pageSize: string;
	/** Print scale in percent. */
	scale: number;
	noteOnNewPage: boolean;
	openAfterExport: boolean;
}

export const DEFAULT_SETTINGS: DopeSettings = {
	pageSize: 'A4',
	scale: 70,
	noteOnNewPage: true,
	openAfterExport: true,
};

const PAGE_SIZES = ['A3', 'A4', 'A5', 'Letter', 'Legal'];

export class DopeSettingTab extends PluginSettingTab {
	plugin: DopePlugin;

	constructor(app: App, plugin: DopePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const settings = this.plugin.settings;
		containerEl.empty();

		new Setting(containerEl).setName('Formato pagina').addDropdown((dropdown) =>
			dropdown
				.addOptions(Object.fromEntries(PAGE_SIZES.map((size) => [size, size])))
				.setValue(settings.pageSize)
				.onChange(async (value) => {
					settings.pageSize = value;
					await this.plugin.saveSettings();
				}),
		);

		new Setting(containerEl)
			.setName('Scala di stampa')
			.setDesc('Percentuale di ridimensionamento del contenuto.')
			.addSlider((slider) =>
				slider
					.setLimits(30, 150, 5)
					.setValue(settings.scale)
					.setDynamicTooltip()
					.onChange(async (value) => {
						settings.scale = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Ogni nota su una nuova pagina')
			.setDesc('Se disattivato, le note di uno stesso capitolo proseguono una dopo l\'altra.')
			.addToggle((toggle) =>
				toggle.setValue(settings.noteOnNewPage).onChange(async (value) => {
					settings.noteOnNewPage = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName('Apri il PDF dopo l\'export').addToggle((toggle) =>
			toggle.setValue(settings.openAfterExport).onChange(async (value) => {
				settings.openAfterExport = value;
				await this.plugin.saveSettings();
			}),
		);
	}
}
