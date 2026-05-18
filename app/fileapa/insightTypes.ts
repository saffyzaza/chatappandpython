export type InsightChartDatum = {
  label: string
  value: number
}

export type InsightChart = {
  title: string
  chartType: 'bar' | 'line' | 'pie'
  insight: string
  data: InsightChartDatum[]
}

export type FileInsightResult = {
  fileId: string
  fileName: string
  abstract: string
  summary: string[]
  charts: InsightChart[]
  sourceExcerpt: string
}