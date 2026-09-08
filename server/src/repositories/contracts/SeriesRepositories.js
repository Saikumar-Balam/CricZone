export default class SeriesRepository
{
    async findAll()
    {
        throw new Error("findAll() must be implemented")
    }

    async findById(seriesId)
    {
        throw new Error("findById() must be implemented")
    }

    async findMatchesBySeriesId(seriesId)
    {
        throw new Error("findMatchesBySeriesId() must be Impleemented")
    }
}
// LLD principles used here are Repository Pattern, DIP, LSP, ISP, and OCP support.