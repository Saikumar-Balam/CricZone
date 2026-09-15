export default class SeriesController
{
    constructor(seriesService)
    {
        this.seriesService = seriesService
        this.getSeries = this.getSeries.bind(this)
        this.getSeriesById = this.getSeriesById.bind(this)
        this.getMatchesBySeriesId = this.getMatchesBySeriesId.bind(this)
    }

    async getSeries(req, res, next)
    {
        try{
            const {seriesId} = req.params 
            const series = await this.seriesService.getSeries(seriesId)
            return res.status(200).json({
                success: true,
                data: series
            })
        }
        catch(error)
        {
            next(error)
        }
    }

    async getSeriesById(req, res, next)
    {
        try{
            const {seriesId} = req.params
            const series = await this.seriesService.getSeriesById(seriesId)
            return res.status(200).json({
                success: true,
                data: series
            })
        }
        catch(error)
        {
            next(error)
        }
    }

    async getMatchesBySeriesId(req, res, next)
    {
        try{
            const {seriesId} = req.params 
            const matches = await this.seriesService.getMatchesBySeriesId(seriesId)
            return res.status(200).json({
                success: true, 
                data: matches
            })
        }
        catch(error)
        {
            next(error)
        }
    }

}
// Principles used: SRP, constructor DI, separation of concerns, testability.