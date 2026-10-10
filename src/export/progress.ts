/**
 * Export progress and remaining-time estimate. Pure module.
 *
 * Phase durations are estimated from what has been measured so far: rendering
 * from the notes already rendered, the first print from the rendering time
 * (they are similar with light themes), the second print and the save from the
 * first print. Heavy themes print slower, and the estimate adapts after the
 * first print.
 */

export type Stage = 'prepare' | 'render' | 'settle' | 'print1' | 'print2' | 'save' | 'done';

const ORDER: Stage[] = ['prepare', 'render', 'settle', 'print1', 'print2', 'save'];

const LABELS: Record<Stage, string> = {
	prepare: 'Preparazione…',
	render: 'Rendering delle note…',
	settle: 'Attesa dei plugin…',
	print1: 'Impaginazione (1/2)…',
	print2: 'Impaginazione (2/2)…',
	save: 'Salvataggio…',
	done: 'Completato',
};

/** Measured ratios: waiting for plugins ≈ 1 s, saving ≈ 30% of a print pass. */
const SETTLE_MS = 1000;
const SAVE_RATIO = 0.3;

export interface ProgressSnapshot {
	/** 0 – 1, never decreasing. */
	fraction: number;
	label: string;
	/** Null until there is enough data for an estimate. */
	remainingMs: number | null;
}

export class ExportProgress {
	private stage: Stage = 'prepare';
	private readonly start: number;
	private stageStart: number;
	private readonly measured: Partial<Record<Stage, number>> = {};
	private steps = 1;
	private rendered = 0;
	private lastFraction = 0;

	constructor(private readonly now: () => number = Date.now) {
		this.start = this.stageStart = now();
	}

	enter(stage: Stage, steps?: number): void {
		const t = this.now();
		this.measured[this.stage] = t - this.stageStart;
		this.stage = stage;
		this.stageStart = t;
		if (steps !== undefined) this.steps = Math.max(1, steps);
	}

	/** One rendering step done (see `renderSteps`). */
	step(): void {
		this.rendered++;
	}

	snapshot(): ProgressSnapshot {
		if (this.stage === 'done') return { fraction: 1, label: LABELS.done, remainingMs: 0 };
		const remainingMs = this.remaining();
		const elapsed = this.now() - this.start;
		const fraction =
			remainingMs === null || elapsed + remainingMs === 0
				? ORDER.indexOf(this.stage) / ORDER.length
				: elapsed / (elapsed + remainingMs);
		this.lastFraction = Math.min(0.99, Math.max(this.lastFraction, fraction));
		return { fraction: this.lastFraction, label: LABELS[this.stage], remainingMs };
	}

	private renderEstimate(): number | null {
		if (this.measured.render !== undefined) return this.measured.render;
		if (this.stage !== 'render' || this.rendered === 0) return null;
		return ((this.now() - this.stageStart) / this.rendered) * this.steps;
	}

	private estimate(stage: Stage): number | null {
		const measured = this.measured[stage];
		if (measured !== undefined) return measured;
		const render = this.renderEstimate();
		// While the first print runs, its elapsed time is a lower bound for both prints.
		const printing = this.stage === 'print1' ? this.now() - this.stageStart : 0;
		const print = this.measured.print1 ?? (render === null ? null : Math.max(render, printing));
		switch (stage) {
			case 'prepare':
				return 0;
			case 'render':
				return render;
			case 'print1':
				return print;
			case 'settle':
				return SETTLE_MS;
			case 'print2':
				return print;
			case 'save':
				return print === null ? null : print * SAVE_RATIO;
			default:
				return 0;
		}
	}

	private remaining(): number | null {
		const inStage = this.now() - this.stageStart;
		let total = 0;
		for (const stage of ORDER.slice(ORDER.indexOf(this.stage))) {
			const estimate = this.estimate(stage);
			if (estimate === null) return null;
			total += stage === this.stage ? Math.max(0, estimate - inStage) : estimate;
		}
		return total;
	}
}
