/**
 * PDF post-processing on the Chromium output. Pure module (pdf-lib only).
 *
 * Chromium writes a `/Dests` dictionary in the catalog with one named
 * destination for every element targeted by an `href="#id"` link, so element
 * ids are used to find on which page each chapter/note landed.
 */
import {
	PDFArray,
	PDFDict,
	PDFDocument,
	PDFHexString,
	PDFName,
	PDFNumber,
	PDFPage,
	PDFRef,
	StandardFonts,
	fill,
	popGraphicsState,
	pushGraphicsState,
	rectangle,
	rgb,
	setFillingRgbColor,
} from 'pdf-lib';
import type { OutlineNode, PageColors, Rgb } from '../types';

/** A linked PDF that replaces the single placeholder page with the same id. */
export interface Attachment {
	id: string;
	bytes: Uint8Array;
	pages: number;
}

function destsDict(doc: PDFDocument): PDFDict | undefined {
	return doc.catalog.lookupMaybe(PDFName.of('Dests'), PDFDict);
}

function nameOf(key: PDFName): string {
	return key.decodeText();
}

/** Maps each named destination to its 0-based page index. */
export async function readDestinations(bytes: Uint8Array): Promise<Map<string, number>> {
	const doc = await PDFDocument.load(bytes);
	return destinationPages(doc);
}

function destinationPages(doc: PDFDocument): Map<string, number> {
	const pageIndex = new Map(doc.getPages().map((page, i) => [page.ref.toString(), i]));
	const result = new Map<string, number>();
	const dests = destsDict(doc);
	if (!dests) return result;
	for (const [key, value] of dests.entries()) {
		const dest = doc.context.lookupMaybe(value, PDFArray);
		const index = pageIndex.get(dest?.get(0)?.toString() ?? '');
		if (index !== undefined) result.set(nameOf(key), index);
	}
	return result;
}

export async function countPages(bytes: Uint8Array): Promise<number | null> {
	try {
		const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
		return doc.getPageCount();
	} catch {
		return null;
	}
}

/**
 * 1-based page numbers of the final document, accounting for the pages that
 * attachments will add in place of their placeholder page.
 */
export function finalPageNumbers(
	dests: Map<string, number>,
	attachments: Pick<Attachment, 'id' | 'pages'>[],
): Map<string, number> {
	const shifts = attachments
		.map((a) => ({ page: dests.get(a.id), extra: a.pages - 1 }))
		.filter((s): s is { page: number; extra: number } => s.page !== undefined);
	const numbers = new Map<string, number>();
	for (const [id, page] of dests) {
		const shift = shifts.filter((s) => s.page < page).reduce((sum, s) => sum + s.extra, 0);
		numbers.set(id, page + shift + 1);
	}
	return numbers;
}

/** Replaces placeholder pages with the attachment pages; returns the inserted pages' refs. */
async function insertAttachments(doc: PDFDocument, attachments: Attachment[]): Promise<Set<string>> {
	const inserted = new Set<string>();
	const dests = destsDict(doc);
	const positions = destinationPages(doc);
	const ordered = attachments
		.map((attachment) => ({ attachment, page: positions.get(attachment.id) }))
		.filter((a): a is { attachment: Attachment; page: number } => a.page !== undefined)
		.sort((a, b) => b.page - a.page);

	for (const { attachment, page } of ordered) {
		const source = await PDFDocument.load(attachment.bytes, { ignoreEncryption: true });
		const copied = await doc.copyPages(source, source.getPageIndices());
		if (copied.length === 0) continue;
		doc.removePage(page);
		copied.forEach((p, i) => {
			doc.insertPage(page + i, p);
			inserted.add(p.ref.toString());
		});
		const first = copied[0];
		if (dests && first) {
			const { height } = first.getSize();
			dests.set(
				PDFName.of(attachment.id),
				doc.context.obj([first.ref, PDFName.of('XYZ'), 0, height, 0]),
			);
		}
	}
	return inserted;
}

/** Adds bookmarks pointing at the named destinations; top-level items open, children collapsed. */
function addOutline(doc: PDFDocument, nodes: OutlineNode[]): void {
	const known = new Set(destsDict(doc)?.keys().map(nameOf));
	const prune = (list: OutlineNode[]): OutlineNode[] =>
		list.filter((n) => known.has(n.id)).map((n) => ({ ...n, children: prune(n.children) }));
	const tree = prune(nodes);
	if (tree.length === 0) return;

	const { context } = doc;
	const rootRef = context.nextRef();

	const build = (list: OutlineNode[], parent: PDFRef): { first: PDFRef; last: PDFRef } => {
		const refs = list.map(() => context.nextRef());
		list.forEach((node, i) => {
			const dict = context.obj({});
			const title = node.number ? `${node.number}. ${node.title}` : node.title;
			dict.set(PDFName.of('Title'), PDFHexString.fromText(title));
			dict.set(PDFName.of('Parent'), parent);
			dict.set(PDFName.of('Dest'), PDFName.of(node.id));
			const prev = refs[i - 1];
			const next = refs[i + 1];
			if (prev) dict.set(PDFName.of('Prev'), prev);
			if (next) dict.set(PDFName.of('Next'), next);
			const ref = refs[i];
			if (!ref) return;
			if (node.children.length > 0) {
				const { first, last } = build(node.children, ref);
				dict.set(PDFName.of('First'), first);
				dict.set(PDFName.of('Last'), last);
				dict.set(PDFName.of('Count'), PDFNumber.of(-node.children.length));
			}
			context.assign(ref, dict);
		});
		return { first: refs[0] as PDFRef, last: refs[refs.length - 1] as PDFRef };
	};

	const { first, last } = build(tree, rootRef);
	context.assign(
		rootRef,
		context.obj({ Type: 'Outlines', First: first, Last: last, Count: tree.length }),
	);
	doc.catalog.set(PDFName.of('Outlines'), rootRef);
	doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}

/**
 * Chromium paints the page background only inside the margins: fill the whole
 * page with the theme background, underneath the existing content.
 */
function paintBackground(doc: PDFDocument, page: PDFPage, [r, g, b]: Rgb): void {
	const { width, height } = page.getSize();
	const stream = doc.context.contentStream([
		pushGraphicsState(),
		setFillingRgbColor(r, g, b),
		rectangle(0, 0, width, height),
		fill(),
		popGraphicsState(),
	]);
	const ref = doc.context.register(stream);
	const key = PDFName.of('Contents');
	const contents = page.node.Contents();
	if (contents instanceof PDFArray) contents.insert(0, ref);
	else if (contents) page.node.set(key, doc.context.obj([ref, page.node.get(key)]));
	else page.node.set(key, ref);
}

/** Paints backgrounds and page numbers, skipping the merged attachment pages; no number on the cover. */
async function decoratePages(doc: PDFDocument, skip: Set<string>, colors: PageColors): Promise<void> {
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const size = 9;
	const color = rgb(...colors.foreground);
	doc.getPages().forEach((page, i) => {
		if (skip.has(page.ref.toString())) return;
		paintBackground(doc, page, colors.background);
		if (i === 0) return;
		const text = String(i + 1);
		const width = font.widthOfTextAtSize(text, size);
		page.drawText(text, { x: (page.getWidth() - width) / 2, y: 20, size, font, color });
	});
}

const DEFAULT_COLORS: PageColors = { background: [1, 1, 1], foreground: [0.4, 0.4, 0.4] };

export async function finalizePdf(options: {
	bytes: Uint8Array;
	attachments: Attachment[];
	outline: OutlineNode[];
	title: string;
	colors?: PageColors;
}): Promise<Uint8Array> {
	const doc = await PDFDocument.load(options.bytes);
	const inserted = await insertAttachments(doc, options.attachments);
	addOutline(doc, options.outline);
	await decoratePages(doc, inserted, options.colors ?? DEFAULT_COLORS);
	doc.setTitle(options.title, { showInWindowTitleBar: true });
	doc.setCreator('DOPE - Deltek Obsidian PDF Exporter');
	return doc.save();
}
