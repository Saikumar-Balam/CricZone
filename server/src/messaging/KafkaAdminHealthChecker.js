import KafkaHealthChecker from "./contracts/KafkaHealthChecker.js";

export default class KafkaAdminHealthChecker extends KafkaHealthChecker{
    constructor(kafkaAdmin)
    {
        super()
        this.kafkaAdmin = kafkaAdmin
    }

    async check()
    {
        try {
            const cluster = await this.kafkaAdmin.describeCluster()
            const brokers = cluster?.brokers ?? []
            if(brokers.length === 0)
            {
                return {
                    healthy: false,
                    error: new Error("Kafka cluster has no available brokers")
                }
            }
            return {
                healthy: true
            }
        }
        catch(error)
        {
            return {
                healthy: false,
                error
            }
        }
    }
}