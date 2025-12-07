declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[]
    filename?: string
    image?: { type?: string; quality?: number }
    html2canvas?: { scale?: number; useCORS?: boolean; [key: string]: any }
    jsPDF?: { unit?: string; format?: string; orientation?: string; [key: string]: any }
    pagebreak?: { mode?: string | string[]; before?: string[]; after?: string[]; avoid?: string[] }
  }

  interface Html2Pdf {
    set(options: Html2PdfOptions): Html2Pdf
    from(element: HTMLElement | string): Html2Pdf
    save(): Promise<void>
    output(type: string, options?: any): Promise<any>
    then(callback: (pdf: any) => void): Html2Pdf
  }

  function html2pdf(): Html2Pdf
  export default html2pdf
}

