export type OutlineKind = 'section' | 'part' | 'chapter' | 'note';

/** One entry of the table of contents and of the PDF bookmarks. */
export interface OutlineNode {
	/** Element id in the rendered document (also the PDF named destination). */
	id: string;
	title: string;
	number?: string;
	kind: OutlineKind;
	children: OutlineNode[];
}
