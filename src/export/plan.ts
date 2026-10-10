import { App, TFile } from 'obsidian';
import type { ChapterKind, ParsedIndex } from '../index-parser';
import { Attachment, countPages } from './pdf';

export interface PlanEntry {
	/** Element id of the rendered content; duplicates share the id of the first occurrence. */
	id: string;
	title: string;
	file: TFile;
	/** False when the file was already rendered earlier: the entry only points to it. */
	render: boolean;
}

export interface PlanChapter {
	id: string;
	title: string;
	number?: string;
	kind: ChapterKind;
	entries: PlanEntry[];
}

export interface ExportPlan {
	chapters: PlanChapter[];
	attachments: Attachment[];
	/** Links that point to missing or unsupported files. */
	unresolved: string[];
}

/** Resolves the index links to vault files; chapters without any valid link are dropped. */
export async function buildPlan(app: App, index: TFile, parsed: ParsedIndex): Promise<ExportPlan> {
	const ids = new Map<string, string>();
	const attachments: Attachment[] = [];
	const unresolved: string[] = [];
	const chapters: PlanChapter[] = [];

	for (const [i, chapter] of parsed.chapters.entries()) {
		const entries: PlanEntry[] = [];
		for (const link of chapter.links) {
			const file = app.metadataCache.getFirstLinkpathDest(link.target, index.path);
			if (!file || file === index || !['md', 'pdf'].includes(file.extension)) {
				unresolved.push(link.target);
				continue;
			}
			const title = link.alias ?? file.basename;
			const existing = ids.get(file.path);
			if (existing) {
				entries.push({ id: existing, title, file, render: false });
				continue;
			}
			const id = `dope-n${ids.size + 1}`;
			if (file.extension === 'pdf') {
				const bytes = new Uint8Array(await app.vault.readBinary(file));
				const pages = await countPages(bytes);
				if (!pages) {
					unresolved.push(link.target);
					continue;
				}
				attachments.push({ id, bytes, pages });
			}
			ids.set(file.path, id);
			entries.push({ id, title, file, render: true });
		}
		if (entries.length > 0) {
			chapters.push({
				id: `dope-c${i + 1}`,
				title: chapter.title,
				number: chapter.number,
				kind: chapter.kind,
				entries,
			});
		}
	}
	return { chapters, attachments, unresolved };
}
