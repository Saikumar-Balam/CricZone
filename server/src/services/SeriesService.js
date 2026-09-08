import SeriesNotFoundError from "../errors/SeriesNotFoundError.js"

export default class SeriesService
{
    constructor(seriesRepository)
    {
        this.seriesRepository = seriesRepository
    }

    async getSeries()
    {
        return await this.seriesRepository.findAll()
    }

    async getSeriesById(seriesId)
    {
        const series = await this.seriesRepository.findById(seriesId)
        if(!series)
        {
            throw new SeriesNotFoundError(seriesId)
        }
        return series
    }

    async getMatchesBySeriesId(seriesId)
    {
        await this.ensureSeriesIdExists(seriesId)
        return this.seriesRepository.findMatchesBySeriesId(seriesId)
    }

    async ensureSeriesIdExists(seriesId)
    {
        const series = await this.seriesRepository.findById(seriesId)
        if(!series)
        {
            throw new SeriesNotFoundError(seriesId)
        }
        return series
    }
}

// LLD principles here: Service Layer Pattern, SRP, constructor DI, DIP, 
// OCP/LSP support.