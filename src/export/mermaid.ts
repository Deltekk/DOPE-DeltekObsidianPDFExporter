/**
 * Since Obsidian 1.14, Mermaid diagrams render only in vaults the user trusts
 * (Settings → Editor → "Show Mermaid diagrams in notes"); otherwise each
 * diagram shows a prompt with its source code.
 */
import { App, requireApiVersion } from 'obsidian';

/** Same localStorage key used by Obsidian's own toggle. */
const TRUST_KEY = 'mermaid-vault-trust';

export function isMermaidGuarded(app: App): boolean {
	return requireApiVersion('1.14.0') && app.loadLocalStorage(TRUST_KEY) !== true;
}

/** Same effect as enabling the setting in Obsidian; only on an explicit user action. */
export function allowMermaid(app: App): void {
	app.saveLocalStorage(TRUST_KEY, true);
	app.workspace.trigger('post-processor-change');
}

/** Diagrams that were printed as source code because Mermaid is not allowed. */
export function countGuardedDiagrams(root: HTMLElement): number {
	return root.querySelectorAll('.mermaid-guard-header').length;
}
