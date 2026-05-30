import fs from 'fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Places signatures on the PDF according to the coordinates provided.
 * @param {string} pdfPath - The absolute path of the existing PDF file.
 * @param {Array} signatures - The signature coordinates array from GALT.
 * @param {string} signatureName - The name typed by the customer.
 * @param {string} technicianName - The name of the technician/dealer.
 */
export const stampSignaturesOnPdf = async (pdfPath, signatures, signatureName, technicianName) => {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found at path: ${pdfPath}`);
  }

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  console.log(`[PDF Service] Loaded PDF with ${pages.length} pages. Stamping ${signatures.length} fields.`);

  for (const sig of signatures) {
    const { Type, Left, Right, Bottom, Top, Pages } = sig;
    
    // Choose what text to write
    let text = '';
    if (Type === 'CustomerSignature') {
      text = signatureName;
    } else if (Type === 'DealerSignature') {
      text = technicianName || 'Authorized Representative';
    } else if (Type === 'CustomerDate') {
      text = new Date().toLocaleDateString('en-US');
    } else {
      console.log(`[PDF Service] Skipping unknown signature type: ${Type}`);
      continue;
    }

    if (!text) continue;

    // Stamp text on each specified page
    for (const pageObj of Pages || []) {
      const pageNum = pageObj.Page;
      const pageIndex = pageNum - 1; // pdf-lib pages are 0-indexed

      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];

        // Draw elegant cursive font for signatures, standard font for date
        let font;
        let fontSize;
        const boxHeight = Top - Bottom;
        
        if (Type === 'CustomerSignature' || Type === 'DealerSignature') {
          font = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
          fontSize = Math.min(14, boxHeight - 4);
        } else {
          font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          fontSize = Math.min(12, boxHeight - 4);
        }

        // Draw slightly offset from bottom-left to look natural
        const x = Left + 4;
        const y = Bottom + 4;

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font: font,
          color: rgb(0, 0.1, 0.4), // Dark Navy blue elegant ink
        });
      } else {
        console.warn(`[PDF Service] Page number ${pageNum} is out of bounds for PDF.`);
      }
    }
  }

  // Save the modified PDF back
  const modifiedPdfBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, modifiedPdfBytes);
  console.log(`[PDF Service] Successfully stamped signatures on PDF at: ${pdfPath}`);
};
