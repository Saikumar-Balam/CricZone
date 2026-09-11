import HttpMetricsMiddleware from "../middleware/HttpMetricsMiddleware.js";
import PrometheusMetrics from "../observability/metrics/PrometheusMetrics.js";

export const metrics = new PrometheusMetrics()
export const httpMetricsMiddleware = new HttpMetricsMiddleware(metrics)