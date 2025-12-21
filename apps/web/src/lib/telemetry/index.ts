/**
 * Web Vitals Telemetry Module
 *
 * Re-exports all Web Vitals telemetry functionality.
 */

export { initWebVitalsReporting, isReportingActive } from "./webVitals";
export type { WebVitalsOptions } from "./webVitals";
export { getWebVitalsConfig, shouldReportVitals } from "./config";
export type { WebVitalsConfig } from "./config";
export { sendMetric, flushMetrics } from "./transport";
export type { WebVitalMetric, WebVitalsBatch, MetricName, MetricRating } from "./types";
