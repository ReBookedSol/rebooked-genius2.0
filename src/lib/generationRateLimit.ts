/**
 * Client-side generation rate limiter & protective measures.
 *
 * Strategy:
 * - In-memory: track active generation types per session
 * - localStorage: persist cooldown timestamps across refreshes
 * - Prevents multiple simultaneous generations of the same type
 * - Enforces per-type cooldowns (free users: longer, paid: shorter)
 */

type GenerationType = 'lesson' | 'flashcard' | 'quiz' | 'exam' | 'graph';

interface ActiveGeneration {
  type: GenerationType;
  startedAt: number;
  documentId?: string;
}

// In-memory tracking of active generations this session
const activeGenerations = new Map<GenerationType, ActiveGeneration>();

// Max duration before we consider a generation "stuck" and allow a new one
const MAX_GENERATION_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Cooldown between generations of the same type (per user tier)
const COOLDOWNS_MS: Record<GenerationType, { free: number; paid: number }> = {
  lesson:    { free: 30_000, paid: 5_000  }, // free: 30s, paid: 5s
  flashcard: { free: 20_000, paid: 3_000  },
  quiz:      { free: 20_000, paid: 3_000  },
  exam:      { free: 30_000, paid: 5_000  },
  graph:     { free: 30_000, paid: 10_000 },
};

function getCooldownKey(type: GenerationType): string {
  return `rebooked_gen_cooldown_${type}`;
}

/**
 * Check if a generation of the given type can proceed.
 * Returns { allowed: true } if OK, or { allowed: false, reason, waitMs } if blocked.
 */
export function canStartGeneration(
  type: GenerationType,
  isPaidUser: boolean,
  documentId?: string
): { allowed: boolean; reason?: string; waitMs?: number } {

  // 1. Check if same type is already actively generating
  const active = activeGenerations.get(type);
  if (active) {
    const elapsed = Date.now() - active.startedAt;
    if (elapsed < MAX_GENERATION_DURATION_MS) {
      const remainingMs = MAX_GENERATION_DURATION_MS - elapsed;
      return {
        allowed: false,
        reason: `A ${type} generation is already in progress. Please wait for it to finish.`,
        waitMs: remainingMs,
      };
    }
    // Generation is stuck — clear it and allow
    activeGenerations.delete(type);
  }

  // 2. Check cooldown (stored in localStorage)
  const cooldownKey = getCooldownKey(type);
  try {
    const lastFinishedAt = parseInt(localStorage.getItem(cooldownKey) || '0', 10);
    if (lastFinishedAt > 0) {
      const cooldownMs = isPaidUser ? COOLDOWNS_MS[type].paid : COOLDOWNS_MS[type].free;
      const elapsed = Date.now() - lastFinishedAt;
      if (elapsed < cooldownMs) {
        const waitMs = cooldownMs - elapsed;
        return {
          allowed: false,
          reason: `Please wait ${Math.ceil(waitMs / 1000)}s before generating again.`,
          waitMs,
        };
      }
    }
  } catch {
    // localStorage might be blocked in some browsers/contexts — just allow it
  }

  return { allowed: true };
}

/**
 * Register the start of a generation. Call this BEFORE starting generation.
 */
export function registerGenerationStart(type: GenerationType, documentId?: string): void {
  activeGenerations.set(type, {
    type,
    startedAt: Date.now(),
    documentId,
  });
}

/**
 * Register the end of a generation. Call this in the finally block after generation.
 * Records the cooldown timestamp.
 */
export function registerGenerationEnd(type: GenerationType): void {
  activeGenerations.delete(type);
  try {
    localStorage.setItem(getCooldownKey(type), Date.now().toString());
  } catch {
    // ignore localStorage errors
  }
}

/**
 * Force-clear a stuck generation (e.g. after page visibility change or cancel).
 */
export function clearGeneration(type: GenerationType): void {
  activeGenerations.delete(type);
}

/**
 * Get a human-readable description of currently active generations (for debugging).
 */
export function getActiveGenerations(): ActiveGeneration[] {
  return Array.from(activeGenerations.values());
}
