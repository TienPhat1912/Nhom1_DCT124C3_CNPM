import { createAudioCoordinator } from "./audioCoordinator.ts";
/** One coordinator per JS runtime; never carries patient or position data. */
export const deviceAudio = createAudioCoordinator();
