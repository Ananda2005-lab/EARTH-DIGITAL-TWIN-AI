export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Consecutive failures required to trip the breaker. */
  failureThreshold: number;
  /** How long the breaker stays open before allowing a probe, in ms. */
  resetMs: number;
  /** Successful probes needed in half-open state to close again. */
  successThreshold?: number;
  /** Injectable clock, for deterministic tests. */
  now?: () => number;
}

export interface CircuitSnapshot {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt: number | null;
  lastFailureReason: string | null;
}

/**
 * Per-provider circuit breaker.
 *
 * Closed → (N consecutive failures) → Open → (after resetMs) → Half-open →
 * (success) → Closed, or (failure) → Open again. While open, callers skip the
 * network entirely, which is what keeps a dead upstream from consuming the
 * request budget of every other provider.
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private halfOpenSuccesses = 0;
  private openedAt: number | null = null;
  private lastFailureReason: string | null = null;

  private readonly failureThreshold: number;
  private readonly resetMs: number;
  private readonly successThreshold: number;
  private readonly now: () => number;

  constructor(
    readonly name: string,
    options: CircuitBreakerOptions,
  ) {
    this.failureThreshold = Math.max(1, options.failureThreshold);
    this.resetMs = Math.max(1, options.resetMs);
    this.successThreshold = Math.max(1, options.successThreshold ?? 1);
    this.now = options.now ?? (() => Date.now());
  }

  /** Current state, transitioning open → half-open once the cooldown elapsed. */
  get currentState(): CircuitState {
    if (this.state === 'open' && this.openedAt !== null && this.now() - this.openedAt >= this.resetMs) {
      this.state = 'half_open';
      this.halfOpenSuccesses = 0;
    }
    return this.state;
  }

  /** False when the breaker is open and the cooldown has not expired yet. */
  canRequest(): boolean {
    return this.currentState !== 'open';
  }

  recordSuccess(): void {
    if (this.currentState === 'half_open') {
      this.halfOpenSuccesses += 1;
      if (this.halfOpenSuccesses < this.successThreshold) return;
    }
    this.state = 'closed';
    this.failures = 0;
    this.halfOpenSuccesses = 0;
    this.openedAt = null;
    this.lastFailureReason = null;
  }

  recordFailure(reason?: string): void {
    this.lastFailureReason = reason ?? null;
    if (this.currentState === 'half_open') {
      this.trip();
      return;
    }
    this.failures += 1;
    if (this.failures >= this.failureThreshold) this.trip();
  }

  /** Milliseconds until the breaker will allow another probe. */
  retryAfterMs(): number {
    if (this.currentState !== 'open' || this.openedAt === null) return 0;
    return Math.max(0, this.resetMs - (this.now() - this.openedAt));
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.halfOpenSuccesses = 0;
    this.openedAt = null;
    this.lastFailureReason = null;
  }

  snapshot(): CircuitSnapshot {
    return {
      name: this.name,
      state: this.currentState,
      failures: this.failures,
      successes: this.halfOpenSuccesses,
      openedAt: this.openedAt,
      lastFailureReason: this.lastFailureReason,
    };
  }

  private trip(): void {
    this.state = 'open';
    this.openedAt = this.now();
    this.halfOpenSuccesses = 0;
    this.failures = Math.max(this.failures, this.failureThreshold);
  }
}
