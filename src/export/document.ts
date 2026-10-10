/**
 * Builds the printable book inside a `.print` container: cover, presentation,
 * table of contents, chapters, exercises and quotes. Notes are rendered by
 * Obsidian itself, so plugins (Excalidraw, Mermaid, MathJax, Dataview, ...)
 * post-process them as in reading view.
 */
import { App, Component, MarkdownRenderer, TFile, getFrontMatterInfo } from 'obsidian';
import type { ParsedIndex } from '../index-parser';
import type { OutlineNode } from '../types';
import type { ExportPlan, PlanEntry } from './plan';

const INFO_ID = 'dope-info';
const TOC_ID = 'dope-toc';
const PART_ID = 'dope-exercises';
const QUOTES_ID = 'dope-quotes';

export interface BuildContext {
	app: App;
	component: Component;
	index: TFile;
	parsed: ParsedIndex;
	plan: ExportPlan;
	noteOnNewPage: boolean;
}

/** Table of contents / bookmarks tree, in the same order as the rendered document. */
export function buildOutline(parsed: ParsedIndex, plan: ExportPlan): OutlineNode[] {
	const nodes: OutlineNode[] = [];
	if (parsed.info.trim()) nodes.push({ id: INFO_ID, title: 'Presentazione', kind: 'section', children: [] });
	nodes.push({ id: TOC_ID, title: 'Indice', kind: 'section', children: [] });

	let part: OutlineNode | null = null;
	for (const chapter of plan.chapters) {
		const notes: OutlineNode[] = chapter.entries.map((e) => ({
			id: e.id,
			title: e.title,
			kind: 'note',
			children: [],
		}));
		const first = chapter.entries[0];
		const node: OutlineNode =
			chapter.kind === 'appendix' && first
				? { id: first.id, title: chapter.title, kind: 'chapter', children: [] }
				: { id: chapter.id, title: chapter.title, number: chapter.number, kind: 'chapter', children: notes };
		if (chapter.kind !== 'exercise') {
			nodes.push(node);
			continue;
		}
		if (!part) {
			part = { id: PART_ID, title: 'Esercitazioni', kind: 'part', children: [] };
			nodes.push(part);
		}
		part.children.push(node);
	}

	if (parsed.quotes?.markdown) {
		nodes.push({ id: QUOTES_ID, title: parsed.quotes.title, kind: 'chapter', children: [] });
	}
	return nodes;
}

export async function buildDocument(ctx: BuildContext, root: HTMLElement, outline: OutlineNode[]): Promise<void> {
	const doc = root.createDiv({ cls: ['markdown-preview-view', 'markdown-rendered', 'dope-doc'] });
	doc.toggleClass('dope-note-break', ctx.noteOnNewPage);

	const cover = doc.createEl('section', { cls: 'dope-cover' });
	renderBanner(ctx.app, cover, ctx.index);
	cover.createEl('h1', { cls: 'dope-cover-title', text: ctx.index.basename });

	if (ctx.parsed.info.trim()) {
		const info = sourceSection(doc, INFO_ID, 'dope-section', ctx.index);
		info.createEl('h1', { cls: 'dope-section-title', text: 'Presentazione' });
		await render(ctx, ctx.parsed.info, info.createDiv(), ctx.index.path);
	}

	renderToc(doc, outline);

	let partRendered = false;
	for (const chapter of ctx.plan.chapters) {
		if (chapter.kind === 'exercise' && !partRendered) {
			partRendered = true;
			doc.createEl('section', { cls: 'dope-part', attr: { id: PART_ID } }).createEl('h1', {
				cls: 'dope-part-title',
				text: 'Esercitazioni',
			});
		}
		if (chapter.kind === 'appendix') {
			for (const entry of chapter.entries) await renderEntry(ctx, doc, entry, 'dope-appendix');
			continue;
		}
		const section = doc.createEl('section', { cls: 'dope-chapter', attr: { id: chapter.id } });
		const header = section.createDiv('dope-chapter-header');
		if (chapter.number) header.createDiv({ cls: 'dope-chapter-number', text: `Capitolo ${chapter.number}` });
		header.createEl('h1', { cls: 'dope-chapter-title', text: chapter.title });
		for (const entry of chapter.entries) await renderEntry(ctx, section, entry);
	}

	const quotes = ctx.parsed.quotes;
	if (quotes?.markdown) {
		const section = sourceSection(doc, QUOTES_ID, 'dope-chapter', ctx.index);
		section.createDiv('dope-chapter-header').createEl('h1', { cls: 'dope-chapter-title', text: quotes.title });
		await render(ctx, quotes.markdown, section.createDiv(), ctx.index.path);
	}

	// Chromium only emits a PDF named destination for ids that some link points to.
	const anchors = doc.createDiv('dope-anchors');
	const link = (nodes: OutlineNode[]): void =>
		nodes.forEach((node) => {
			anchors.createEl('a', { href: `#${node.id}` });
			link(node.children);
		});
	link(outline);
}

function sourceSection(parent: HTMLElement, id: string, cls: string, file: TFile): HTMLElement {
	return parent.createEl('section', { cls, attr: { id, 'data-dope-source': file.path } });
}

async function render(ctx: BuildContext, markdown: string, el: HTMLElement, sourcePath: string): Promise<void> {
	await MarkdownRenderer.render(ctx.app, markdown, el, sourcePath, ctx.component);
}

async function renderEntry(ctx: BuildContext, parent: HTMLElement, entry: PlanEntry, cls?: string): Promise<void> {
	if (!entry.render) return;
	if (entry.file.extension === 'pdf') {
		// Single placeholder page, replaced by the PDF pages after printing.
		parent.createDiv({ cls: 'dope-pdf-slot', text: entry.title, attr: { id: entry.id } });
		return;
	}
	const article = sourceSection(parent, entry.id, 'dope-note', entry.file);
	if (cls) article.addClass(cls);
	const content = await ctx.app.vault.cachedRead(entry.file);
	const body = content.slice(getFrontMatterInfo(content).contentStart);
	renderBanner(ctx.app, article, entry.file);
	if (!/^\s*#\s/.test(body)) article.createEl('h1', { text: entry.title });
	await render(ctx, body, article.createDiv(), entry.file.path);
}

function renderToc(doc: HTMLElement, outline: OutlineNode[]): void {
	const nav = doc.createEl('nav', { cls: 'dope-toc', attr: { id: TOC_ID } });
	nav.createEl('h1', { cls: 'dope-section-title', text: 'Indice' });
	const add = (node: OutlineNode, depth: number): void => {
		const row = nav.createEl('a', {
			cls: ['dope-toc-row', `dope-toc-${node.kind}`, `dope-toc-depth-${depth}`],
			href: `#${node.id}`,
		});
		// Empty number column too, so chapter titles stay aligned.
		if (node.kind === 'chapter' || node.kind === 'section') {
			row.createSpan({ cls: 'dope-toc-num', text: node.number ?? '' });
		}
		row.createSpan({ cls: 'dope-toc-title', text: node.title });
		row.createSpan('dope-toc-dots');
		row.createSpan({ cls: 'dope-toc-page', attr: { 'data-dope-target': node.id } });
		node.children.forEach((child) => add(child, depth + 1));
	};
	outline.filter((node) => node.id !== TOC_ID).forEach((node) => add(node, 0));
}

export function fillTocPages(root: HTMLElement, numbers: Map<string, number>): void {
	root.querySelectorAll<HTMLElement>('.dope-toc-page').forEach((el) => {
		el.setText(String(numbers.get(el.dataset.dopeTarget ?? '') ?? ''));
	});
}

/** Points links to exported notes at their place in the PDF; other internal links become plain text. */
export function rewriteInternalLinks(app: App, root: HTMLElement, plan: ExportPlan): void {
	const ids = new Map(plan.chapters.flatMap((c) => c.entries).map((e) => [e.file.path, e.id]));
	root.querySelectorAll<HTMLAnchorElement>('a.internal-link').forEach((a) => {
		const source = a.closest<HTMLElement>('[data-dope-source]')?.dataset.dopeSource ?? '';
		const path = (a.dataset.href ?? a.getAttribute('href') ?? '').split('#')[0] ?? '';
		const file = path ? app.metadataCache.getFirstLinkpathDest(path, source) : app.vault.getFileByPath(source);
		const id = file ? ids.get(file.path) : undefined;
		if (id) a.setAttr('href', `#${id}`);
		else a.removeAttribute('href');
	});
}

/** Banner from the frontmatter used by the Banners plugin (`banner`, `banner_x`, `banner_y`). */
function renderBanner(app: App, parent: HTMLElement, file: TFile): void {
	const fm = app.metadataCache.getFileCache(file)?.frontmatter;
	const src = bannerSource(app, fm?.banner, file.path);
	if (!src) return;
	const img = parent.createDiv('dope-banner').createEl('img', { attr: { src } });
	img.setCssStyles({ objectPosition: `${percent(fm?.banner_x)} ${percent(fm?.banner_y)}` });
}

function bannerSource(app: App, value: unknown, sourcePath: string): string | null {
	if (typeof value !== 'string' || !value.trim()) return null;
	const text = value.trim();
	if (/^https?:\/\//i.test(text)) return text;
	const link = /\[\[([^\]|#]+)/.exec(text)?.[1] ?? text;
	const file = app.metadataCache.getFirstLinkpathDest(link.trim(), sourcePath);
	return file ? app.vault.getResourcePath(file) : null;
}

function percent(value: unknown): string {
	const n = typeof value === 'number' ? value : parseFloat(String(value));
	return Number.isFinite(n) ? `${n * 100}%` : '50%';
}
