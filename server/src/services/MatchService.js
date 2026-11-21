
import MatchNotFoundError from "../errors/MatchNotFoundError.js";
import { CacheKeys } from "../cache/CacheKeys.js";
import { CacheTTL } from "../cache/CacheTTL.js";

export default class MatchService {
  constructor(matchRepository, cache, invalidationRepository = null) {
    this.MatchRepository = matchRepository;
    this.cache = cache;
    this.invalidationRepository = invalidationRepository;
  }

  async getMatches() {
    return this.MatchRepository.findAll();
  }

  async getMatchById(matchId) {
    const cacheKey = CacheKeys.matchById(matchId);

    // Fail closed if the outbox check fails.
    // Do not serve Redis data when consistency is unknown.
    const hasPending = async () => {
      if (!this.invalidationRepository) {
        return false;
      }

      return this.invalidationRepository
        .hasPendingInvalidation(matchId);
    };

    const pendingBeforeRead = await hasPending();

    if (!pendingBeforeRead) {
      const cachedMatch = await this.cache.get(cacheKey);

      // Recheck before serving a cached value.
      if (cachedMatch && !(await hasPending())) {
        return cachedMatch;
      }
    }

    // PostgreSQL remains the authoritative source.
    const match = await this.MatchRepository.findById(matchId);

    if (!match) {
      throw new MatchNotFoundError(matchId);
    }

    // Never repopulate the cache while a known
    // invalidation is still pending.
    if (!(await hasPending())) {
      await this.cache.set(cacheKey, match, CacheTTL.MATCH);
    }

    return match;
  }
}

//     SRP

// MatchService handles Match use cases/business logic, not SQL or HTTP.

// DIP

// The service depends on an abstraction/contract:

// MatchRepository

// rather than:

// PostgresMatchRepository

// Dependency Injection

// Repository is supplied through the constructor.

// LSP

// We can substitute another repository implementation that satisfies the contract.

// Service Layer Pattern
// Cache-Aside Pattern 

// Application use cases are centralized in the service layer.