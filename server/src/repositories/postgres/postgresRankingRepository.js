import RankingRepository from "../contracts/RankingRepository.js";


export default class postresRankingRepository extends RankingRepository
{
    constructor(databaseClient)
    {
        super()
        this.databaseClient = databaseClient
    }

    async findAll()
    {
        const query = `
        select 
        r.id,
        r.player_id,
        r.team_id,
        r.format,
        r.category,
        r.position,
        r.rating,
        r.updated_at
        
        from rankings r
        order by r.format, r.category, r.position asc;
        `

        const result = await this.databaseClient.query(query)
        return result.rows
    }

    async findById(rankingId)
    {
        const query = `
        select
        r.id,
        r.player_id,
        r.team_id,
        r.format,
        r.category,
        r.position,
        r.rating,
        r.updated_at
        
        from rankings r
        
        where r.id = $1;
        `
        const result = await this.databaseClient.query(query, [rankingId])
        return result.rows[0] ?? null
    }

    async findPlayerRankings()
    {
        const query = `
        select
        r.id,
        r.player_id,
        p.name as player_name,
        p.country as player_country,

        r.format,
        r.category,
        r.position,
        r.rating,
        r.updated_at

        from rankings r
        
        join players p
        on r.player_id = p.id
        
        where r.player_id is not null
        
        order by 
        r.format,
        r.category,
        r.position asc;
        `
        const result = await this.databaseClient.query(query)
        return result.rows
    }

    async findTeamRankings()
    {
        const query = `
        select
        r.id,
        r.team_id,
        t.name as team_name,
        t.short_name as team_short_name,
        t.country as team_country,

        r.format,
        r.category,
        r.position,
        r.rating,
        r.updated_at

        from rankings r
        
        join teams t
        on r.team_id = t.id
        
        where r.team_id is not null
        
        order by
        r.format,
        r.category,
        r.position asc;
        `
        const result = await this.databaseClient.query(query)
        return result.rows
    }
}
// This applies Repository Pattern, SRP, constructor DI, DIP support, and LSP.