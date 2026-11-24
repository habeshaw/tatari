import { jsPDF } from 'jspdf';

export function downloadResumeAsPdf(fileName: string, title: string, bodyText: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(16, 36, 59);
  const titleLines = doc.splitTextToSize(title || 'TATARI Resume Export', maxWidth) as string[];
  let cursorY = 54;
  for (const line of titleLines) {
    doc.text(line, margin, cursorY);
    cursorY += 18;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  const paragraphs = String(bodyText || '').split('\n');
  for (const rawLine of paragraphs) {
    const wrapped = doc.splitTextToSize(rawLine || ' ', maxWidth) as string[];
    for (const line of wrapped) {
      if (cursorY > pageHeight - 54) {
        doc.addPage();
        cursorY = 52;
      }
      doc.text(line, margin, cursorY);
      cursorY += 14;
    }
  }

  const safeName = fileName.replace(/[^a-z0-9._-]/gi, '_');
  doc.save(safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`);
}
