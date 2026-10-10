import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDict, PDFDocument, PDFHexString, PDFName } from 'pdf-lib';
import { finalPageNumbers, finalizePdf, readDestinations } from '../src/export/pdf';

/** Mimics Chromium output: one page per id, plus a `/Dests` dictionary in the catalog. */
async function chromiumLike(ids: string[]): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	const dests = doc.context.obj({});
	for (const id of ids) {
		const page = doc.addPage([595, 842]);
		dests.set(PDFName.of(id), doc.context.obj([page.ref, PDFName.of('XYZ'), 6, 842, 0]));
	}
	doc.catalog.set(PDFName.of('Dests'), doc.context.register(dests));
	return doc.save();
}

async function blankPdf(pages: number): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	for (let i = 0; i < pages; i++) doc.addPage([842, 595]);
	return doc.save();
}

test('readDestinations maps names to page indexes', async () => {
	const dests = await readDestinations(await chromiumLike(['cover', 'toc', 'n1']));
	assert.deepEqual([...dests], [['cover', 0], ['toc', 1], ['n1', 2]]);
});

test('finalPageNumbers shifts pages after attachments', () => {
	const dests = new Map([['a', 0], ['slot', 1], ['b', 2], ['c', 3]]);
	const numbers = finalPageNumbers(dests, [{ id: 'slot', pages: 3 }]);
	assert.deepEqual([...numbers], [['a', 1], ['slot', 2], ['b', 5], ['c', 6]]);
});

test('finalizePdf merges attachments, keeps destinations and adds bookmarks', async () => {
	const bytes = await chromiumLike(['cover', 'slot', 'b']);
	const result = await finalizePdf({
		bytes,
		attachments: [{ id: 'slot', bytes: await blankPdf(3), pages: 3 }],
		outline: [
			{ id: 'slot', title: 'Esercitazione', kind: 'note', children: [] },
			{ id: 'b', title: 'Kernel', number: '1', kind: 'chapter', children: [] },
			{ id: 'missing', title: 'Not printed', kind: 'note', children: [] },
		],
		title: 'Sistemi Operativi',
	});

	const doc = await PDFDocument.load(result);
	assert.equal(doc.getPageCount(), 5);
	assert.equal(doc.getPage(1).getWidth(), 842, 'attachment pages replace the placeholder');
	assert.deepEqual([...(await readDestinations(result))], [['cover', 0], ['slot', 1], ['b', 4]]);

	const outlines = doc.catalog.lookup(PDFName.of('Outlines'), PDFDict);
	const first = outlines.lookup(PDFName.of('First'), PDFDict);
	const second = first.lookup(PDFName.of('Next'), PDFDict);
	assert.equal(first.lookup(PDFName.of('Title'), PDFHexString).decodeText(), 'Esercitazione');
	assert.equal(second.lookup(PDFName.of('Title'), PDFHexString).decodeText(), '1. Kernel');
	assert.equal(second.get(PDFName.of('Next')), undefined, 'entries without destination are dropped');
	assert.equal(doc.getTitle(), 'Sistemi Operativi');
});
