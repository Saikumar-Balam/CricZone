export default class MatchRepository
{
    async findAll()
    {
        throw new Error("findAll() must be implemented")
    }
    async findById(matchId)
    {
        throw new Error("findById() must be implemented")
    }
}

// DIP — service depends on abstraction.
// OCP — we can add another repository implementation later.
// LSP — implementations should be substitutable.
// Repository Pattern — persistence details are isolated from business logic.