import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractLinks, parseIndex } from '../src/index-parser';

// Same structure as example/🐧 Sistemi Operativi/🐧 Sistemi Operativi.md
const INDEX = `---
banner: "![[Banner.png]]"
tags:
  - 📑Materia
banner_y: 0.5
---
<mark style="background: #BBFABBA6;">Ricevimento</mark>:
- Previo appuntamento mail.

<mark style="background: #FFB86CA6;">Materiale:</mark>:
- Slide sul portale

<mark style="background: #FF5582A6;">Programma del corso</mark>:

Capitolo 1, **"Operating Systems"**:
- [[Storia dei sistemi operativi]], [[Kernel]]
- [[SO - Architettura Monolitica|Architettura Monolitica]]

Capitolo 7-8, **"Memoria virtuale"**:
- [[Paging]].

<mark style="background: #FFF3A3A6;">Esercitazioni</mark>:

Processi:
- [[SO - Processi - Esercizio 1]]
- [[SO - Processi - Esercizio 2]]

Memoria:
- [[SO - Esercitazione Memoria.pdf]]

Thread:
- [[SO - Esercitazione del 26.05.14]] #todo non fatto


[[Domande Sistemi Operativi]]

<mark style="background: #FFF3A3A6;">Appunti basati su</mark>:
- Slide

<mark style="background: #FFB8EBA6;">Informazioni</mark>:

💳 CFU:: 9
- [x] 📌 Caratterizzante

---

# Citazioni

> [!Quote]
> "DIPENDE"
`;

test('program chapters keep number, title, links and aliases', () => {
	const { chapters } = parseIndex(INDEX);
	const program = chapters.filter((c) => c.kind === 'program');
	assert.deepEqual(program, [
		{
			title: 'Operating Systems',
			number: '1',
			kind: 'program',
			links: [
				{ target: 'Storia dei sistemi operativi' },
				{ target: 'Kernel' },
				{ target: 'SO - Architettura Monolitica', alias: 'Architettura Monolitica' },
			],
		},
		{ title: 'Memoria virtuale', number: '7-8', kind: 'program', links: [{ target: 'Paging' }] },
	]);
});

test('loose links become appendices placed before the exercises', () => {
	const { chapters } = parseIndex(INDEX);
	assert.deepEqual(
		chapters.map((c) => `${c.kind}:${c.title}`),
		[
			'program:Operating Systems',
			'program:Memoria virtuale',
			'appendix:Domande Sistemi Operativi',
			'exercise:Processi',
			'exercise:Memoria',
			'exercise:Thread',
		],
	);
	assert.deepEqual(chapters[4]?.links, [{ target: 'SO - Esercitazione Memoria.pdf' }]);
});

test('info keeps only informative sections, quotes are separate', () => {
	const { info, quotes } = parseIndex(INDEX);
	assert.match(info, /Ricevimento/);
	assert.match(info, /Appunti basati su/);
	assert.match(info, /CFU:: 9/);
	assert.doesNotMatch(info, /Programma del corso|Esercitazioni|Capitolo|banner/);
	assert.ok(!info.trimEnd().endsWith('---'), 'trailing separator removed');
	assert.equal(quotes?.title, 'Citazioni');
	assert.equal(quotes?.markdown, '> [!Quote]\n> "DIPENDE"');
});

test('extractLinks skips embeds and strips subpaths', () => {
	assert.deepEqual(extractLinks('- ![[img.png]] [[Note#Heading|Alias]] [[Other#^block]]'), [
		{ target: 'Note', alias: 'Alias' },
		{ target: 'Other' },
	]);
});

const EXAMPLE = 'example/🐧 Sistemi Operativi/🐧 Sistemi Operativi.md';

test('real Sistemi Operativi index', { skip: !existsSync(EXAMPLE) }, () => {
	const { chapters, quotes } = parseIndex(readFileSync(EXAMPLE, 'utf8'));
	const byKind = (kind: string) => chapters.filter((c) => c.kind === kind);
	// "Capitolo 7-8" is a single chapter.
	assert.equal(byKind('program').length, 13);
	assert.deepEqual(
		{ ...byKind('program')[12], links: undefined },
		{ title: 'Scripting Linux', number: '14', kind: 'program', links: undefined },
	);
	assert.deepEqual(byKind('appendix').map((c) => c.title), ['Domande Sistemi Operativi']);
	assert.deepEqual(
		byKind('exercise').map((c) => c.title),
		['Processi', 'Memoria', 'Thread', 'Regex', 'Awk', 'Scripting'],
	);
	assert.equal(quotes?.markdown.match(/\[!quote\]/gi)?.length, 20);
});
