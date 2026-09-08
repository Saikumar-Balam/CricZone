import MatchNotFoundError from "../errors/MatchNotFoundError.js";
import { CacheKeys } from "../cache/CacheKeys.js";
import { CacheTTL } from "../cache/CacheTTL.js";

export default class MatchService {
    constructor(MatchRepository, cache)
    {
        this.MatchRepository = MatchRepository
        this.cache = cache
    }
    async getMatches()
    {
        return await this.MatchRepository.findAll()
    }
    async getMatchById(matchId)
    {
        const cacheKey = CacheKeys.matchById(matchId)
        const cachedMatch = await this.cache.get(cacheKey)
        if(cachedMatch)
        {
             console.log(`CACHE HIT: ${cacheKey}`);
            return cachedMatch
        }
        console.log(`CACHE MISS: ${cacheKey}`);

        const match = await this.MatchRepository.findById(matchId);
        if(!match)
        {
            throw new MatchNotFoundError(matchId)
        }
        await this.cache.set(cacheKey,match, CacheTTL.MATCH)
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