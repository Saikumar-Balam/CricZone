import helmet from "helmet"

export default class SecurityHeadersMiddleware {
    constructor(options = {})
    {
        this.middleware = helmet(options)
    }
    handle = (req, res, next) => {
        return this.middleware(req, res, next)
    }
}