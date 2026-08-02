import type { AuthenticatedUser } from '../common/types/authenticated-user';

declare global {
  namespace Express {
    /**
     * Passport writes the authenticated principal to `req.user`; widening the
     * shared `Express.User` interface keeps it strongly typed everywhere without
     * casts. Declaration merging requires an interface, so the empty body is
     * intentional rather than a type alias.
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthenticatedUser {}

    interface Request {
      /** Correlation id assigned by RequestIdMiddleware. */
      requestId: string;
      /** High-resolution start time used for the `tookMs` response meta. */
      startedAt: number;
      /** Set by CacheInterceptor when the payload came from Redis. */
      cacheHit?: boolean;
      /** Age of the cached payload in seconds, when served from cache. */
      cacheAge?: number;
    }
  }
}

export {};
