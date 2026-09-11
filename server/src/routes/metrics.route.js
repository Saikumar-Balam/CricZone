import express from "express"
import { metrics } from "../containers/metrics.container.js"

const router = express.Router()

router.get("/", async(req, res, next) => {
    try{
        res.set("Content-Type", metrics.getContentType())

        res.send(await metrics.getMetrics())
    }
    catch(error)
    {
        next(error)
    }
})
export default router