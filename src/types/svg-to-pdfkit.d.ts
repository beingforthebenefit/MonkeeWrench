declare module 'svg-to-pdfkit' {
  /** Draws an SVG string into a pdfkit document. */
  export default function SVGtoPDF(
    doc: PDFKit.PDFDocument,
    svg: string,
    x?: number,
    y?: number,
    options?: {
      width?: number
      height?: number
      preserveAspectRatio?: string
      assumePt?: boolean
    },
  ): void
}
