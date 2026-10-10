/**
 * Parses a subject "index" note (see `example/🐧 Sistemi Operativi`) into the
 * structure of the book. Pure module: no Obsidian imports, so it can be tested in Node.
 *
 * Index layout:
 * - sections start with `<mark ...>Label</mark>:` lines (or markdown headings);
 * - "Programma del corso" holds chapters: a label line ending with `:`
 *   (e.g. `Capitolo 1, **"Operating Systems"**:`) followed by list items with links;
 * - "Esercitazioni"/"Esercizi" hold exercise groups with the same shape;
 * - a link on its own line, outside any list, is a standalone appendix chapter;
 * - "# Citazioni" holds the quotes, printed at the end;
 * - every other section is informative and goes in the presentation page.
 */

export type ChapterKind = 'program' | 'appendix' | 'exercise';

export interface IndexLink {
	/** Link path without subpath, e.g. `Kernel` or `Esercitazione.pdf`. */
	target: string;
	alias?: string;
}

export interface IndexChapter {
	title: string;
	/** Chapter number from `Capitolo N`, e.g. `1` or `7-8`. */
	number?: string;
	kind: ChapterKind;
	links: IndexLink[];
}

export interface ParsedIndex {
	/** Markdown of the informative sections, in their original order. */
	info: string;
	/** In book order: program chapters, appendices, exercises. */
	chapters: IndexChapter[];
	quotes?: { title: string; markdown: string };
}

type SectionKind = 'info' | 'program' | 'exercise' | 'quotes';

const MARK_RE = /^\s*<mark\b[^>]*>(.*?)<\/mark>/i;
const HEADING_RE = /^#{1,6}\s+(.+?)\s*$/;
const LIST_RE = /^\s*(?:[-*+]|\d+[.)])\s+/;
const LINK_RE = /(!?)\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g;
const CHAPTER_RE = /^capitolo\s+([\w.\-–]+)\s*[,:.\-–]?\s*(.*)$/i;

function classify(label: string): SectionKind {
	if (/programma/i.test(label)) return 'program';
	if (/esercitazion|eserciz/i.test(label)) return 'exercise';
	if (/citazion/i.test(label)) return 'quotes';
	return 'info';
}

/** Strips html tags, bold/italic markers, quotes and the trailing colon. */
export function cleanLabel(text: string): string {
	return text
		.replace(/<[^>]+>/g, '')
		.replace(/\*+|__|["“”]/g, '')
		.replace(/:+\s*$/, '')
		.trim();
}

function parseChapterLabel(line: string): { title: string; number?: string } {
	const text = cleanLabel(line);
	const match = CHAPTER_RE.exec(text);
	const title = match?.[2]?.trim();
	if (!match || !title) return { title: text };
	return { number: match[1], title };
}

export function linkBasename(target: string): string {
	return (target.split('/').pop() ?? target).replace(/\.md$/i, '');
}

export function extractLinks(line: string): IndexLink[] {
	const links: IndexLink[] = [];
	for (const match of line.matchAll(LINK_RE)) {
		const [, embed, rawTarget = '', alias] = match;
		const target = rawTarget.split('#')[0]?.trim() ?? '';
		if (embed || !target) continue;
		links.push(alias?.trim() ? { target, alias: alias.trim() } : { target });
	}
	return links;
}

function stripFrontmatter(markdown: string): string {
	const match = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(markdown);
	return match ? markdown.slice(match[0].length) : markdown;
}

/** Drops separators and blank lines at the end of the info markdown. */
function trimInfo(lines: string[]): string {
	while (lines.length > 0 && /^\s*(-{3,}|\*{3,})?\s*$/.test(lines[lines.length - 1] ?? '')) {
		lines.pop();
	}
	return lines.join('\n');
}

export function parseIndex(markdown: string): ParsedIndex {
	const info: string[] = [];
	const program: IndexChapter[] = [];
	const appendix: IndexChapter[] = [];
	const exercises: IndexChapter[] = [];
	let quotes: ParsedIndex['quotes'];

	let section: SectionKind = 'info';
	let sectionLabel = '';
	let current: IndexChapter | null = null;

	for (const line of stripFrontmatter(markdown).split(/\r?\n/)) {
		const header = MARK_RE.exec(line) ?? HEADING_RE.exec(line);
		if (header) {
			sectionLabel = cleanLabel(header[1] ?? '');
			section = classify(sectionLabel);
			current = null;
			if (section === 'quotes') quotes = { title: sectionLabel, markdown: '' };
			if (section === 'info') info.push(line);
			continue;
		}

		if (section === 'info') {
			info.push(line);
			continue;
		}
		if (section === 'quotes') {
			if (quotes) quotes.markdown += line + '\n';
			continue;
		}

		const kind: ChapterKind = section === 'program' ? 'program' : 'exercise';
		const target = kind === 'program' ? program : exercises;
		const links = extractLinks(line);

		if (LIST_RE.test(line)) {
			if (links.length === 0) continue;
			if (!current) {
				current = { title: sectionLabel, kind, links: [] };
				target.push(current);
			}
			current.links.push(...links);
		} else if (links.length > 0) {
			for (const link of links) {
				appendix.push({
					title: link.alias ?? linkBasename(link.target),
					kind: 'appendix',
					links: [link],
				});
			}
			current = null;
		} else if (line.trim().endsWith(':')) {
			current = { ...parseChapterLabel(line), kind, links: [] };
			target.push(current);
		}
	}

	if (quotes) quotes.markdown = quotes.markdown.trim();

	return {
		info: trimInfo(info),
		chapters: [...program, ...appendix, ...exercises],
		quotes,
	};
}
