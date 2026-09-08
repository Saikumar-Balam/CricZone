export default class NewsController
{
    constructor(newsService)
    {
        this.newsService = newsService
        this.getNews = this.getNews.bind(this)
        this.getNewsById = this.getNewsById.bind(this)
        this.getNewsByPlayerId = this.getNewsByPlayerId.bind(this)
        this.getNewsByTeamId = this.getNewsByTeamId.bind(this)
        this.getNewsBySeriesId = this.getNewsBySeriesId.bind(this)
        this.getNewsByMatchId = this.getNewsByMatchId.bind(this)
    }

    async getNews(req, res, next)
    {
        try{
            const news = await this.newsService.getNews()
            return res.status(200).json({
                success: true,
                data: news
            })
        }
        catch(error)
        {
            next(error)
        }
    }

    async getNewsById(req, res, next)
    {
        try{
        const {newsId} = req.params
        const news = await this.newsService.getNewsById(newsId)
        return res.status(200).json({
            success: true,
            data: news
        })
    }
    catch(error)
    {
        next(error)
    }
}

async getNewsByPlayerId(req, res, next)
{
    try{
    const {playerId} = req.params
    const news = await this.newsService.getNewsByPlayerId(playerId)
    return res.status(200).json({
        success: true,
        data: news
    })
    }
    catch(error)
    {
        next(error)
    }
}

async getNewsByTeamId(req, res, next)
{
    try{
        const {teamId} = req.params
        const news = await this.newsService.getNewsByTeamId(teamId)
        return res.status(200).json({
            success: true, data: news 
        })
    }
    catch(error)
    {
        next(error)
    }
}

async getNewsBySeriesId(req, res, next)
{
    try{
    const {seriesId} = req.params
    const news = await this.newsService.getNewsBySeriesId(seriesId)
    return res.status(200).json({
        success: true,
        data: news
    })
    }
    catch(error)
    {
        next(error)
    }

}

async getNewsByMatchId(req, res, next)
{
    try{
        const {matchId} = req.params
        const news = await this.newsService.getNewsByMatchId(matchId)
        return res.status(200).json({
            success: true,
            data: news 
        })
    }
    catch(error)
    {
        next(error)
    }

}
}

// LLD principles: SRP, constructor DI, separation of concerns, testability.