import { QuartzTransformerPlugin, QuartzEmitterPlugin, QuartzConfig } from '@quartz-community/types';
import { QuartzExerciserOptions, ExerciseFenceConfig, ExerciseManifest } from './types.js';
export { ExerciseAnnotation, ExerciseFilePolicies, ExerciseHighlight, ExerciseHighlightRange, ExerciseLayout, ExerciseOutputAssociation, ExerciseOutputExample, ExerciseViewerFile, ExerciseViewerPayload, OutputType, ResolvedOutputAssociation, ResolvedOutputExample } from './types.js';

declare const transformer: QuartzTransformerPlugin<Partial<QuartzExerciserOptions>>;

declare const emitter: QuartzEmitterPlugin<Partial<QuartzExerciserOptions>>;

/** Apply exercise exclusions before Quartz performs its initial content glob. */
declare const applyExerciseIgnorePatterns: (config: QuartzConfig | undefined, contentDirectory?: string) => Promise<void>;

declare const EXERCISE_ROOT: "assets/exercises";
declare const MANIFEST_FILE = ".exercise.yml";
declare const DEFAULT_PREVIEW_LIMIT_BYTES: number;
declare const parseExerciseManifest: (source: string) => ExerciseManifest;
declare const parseExerciseFence: (source: string) => ExerciseFenceConfig | null;
declare const parsePreviewLimit: (rootIndexSource: string, fallback: number) => number;

export { DEFAULT_PREVIEW_LIMIT_BYTES, EXERCISE_ROOT, ExerciseFenceConfig, ExerciseManifest, MANIFEST_FILE, QuartzExerciserOptions, applyExerciseIgnorePatterns, emitter, parseExerciseFence, parseExerciseManifest, parsePreviewLimit, transformer };
