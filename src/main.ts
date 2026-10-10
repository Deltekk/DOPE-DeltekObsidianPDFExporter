import { Plugin } from 'obsidian';
import { registerCommands } from './commands';
import { removePrintContainers } from './export/exporter';
import { DEFAULT_SETTINGS, DopeSettings, DopeSettingTab } from './settings';

export default class DopePlugin extends Plugin {
	settings!: DopeSettings;

	async onload() {
		await this.loadSettings();
		registerCommands(this);
		this.addSettingTab(new DopeSettingTab(this.app, this));
	}

	onunload() {
		removePrintContainers();
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
