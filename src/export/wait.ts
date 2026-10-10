/**
 * Waits until plugins that render after `MarkdownRenderer.render` resolves
 * (Dataview, TikZJax, ...) are done: the DOM has been quiet for `quietMs`
 * and all images are loaded. Gives up after `timeoutMs`.
 */
export async function waitForRender(el: HTMLElement, quietMs = 800, timeoutMs = 30_000): Promise<void> {
	let lastChange = Date.now();
	const observer = new MutationObserver(() => (lastChange = Date.now()));
	observer.observe(el, { childList: true, subtree: true });
	const deadline = Date.now() + timeoutMs;
	try {
		while (Date.now() < deadline) {
			await sleep(200);
			const images = Array.from(el.querySelectorAll('img'));
			images.forEach((img) => (img.loading = 'eager'));
			if (Date.now() - lastChange >= quietMs && images.every((img) => img.complete)) break;
		}
		await el.doc.fonts.ready;
	} finally {
		observer.disconnect();
	}
}
