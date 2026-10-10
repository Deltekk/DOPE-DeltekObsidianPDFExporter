import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExportProgress } from '../src/export/progress';

test('remaining time is unknown until a note is rendered', () => {
	let now = 0;
	const progress = new ExportProgress(() => now);
	progress.enter('render', 10);
	now = 500;
	assert.equal(progress.snapshot().remainingMs, null);
});

test('estimate extrapolates rendering, then adapts to the measured first print', () => {
	let now = 0;
	const progress = new ExportProgress(() => now);
	progress.enter('render', 10);
	now = 1000;
	progress.step();
	progress.step();
	// render 5 s (4 s left) + settle 1 s + two prints ≈ render + save 30% of a print
	assert.equal(progress.snapshot().remainingMs, 4000 + 1000 + 5000 + 5000 + 1500);

	now = 5000;
	progress.enter('settle');
	now = 6000;
	progress.enter('print1');
	now = 15_999;
	const beforeSecondPrint = progress.snapshot();
	assert.equal(beforeSecondPrint.label, 'Impaginazione (1/2)…');
	// The first print already lasts longer than estimated: the second print is assumed as long.
	assert.equal(beforeSecondPrint.remainingMs, 9999 + 9999 * 0.3);

	now = 16_000;
	progress.enter('print2');
	// The first print took 10 s: second print 10 s + save 3 s.
	const during = progress.snapshot();
	assert.equal(during.remainingMs, 13_000);
	assert.ok(during.fraction >= beforeSecondPrint.fraction, 'fraction never decreases');

	progress.enter('done');
	assert.deepEqual(progress.snapshot(), { fraction: 1, label: 'Completato', remainingMs: 0 });
});
