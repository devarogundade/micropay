import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { StorageService } from './storage.service';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDF_TEXT = 50_000;

@Injectable()
export class PdfExtractionService {
  constructor(private readonly storage: StorageService) {}

  async extractFromKey(key: string, maxChars = MAX_PDF_TEXT) {
    const buffer = await this.storage.getObjectBuffer(key, MAX_PDF_BYTES);
    if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new BadRequestException('Uploaded file is not a valid PDF');
    }
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = (result.text || '').trim();
      const limit = Math.min(Math.max(maxChars, 1), MAX_PDF_TEXT);
      return {
        text: text.slice(0, limit),
        pages: result.pages?.length ?? 0,
        truncated: text.length > limit,
      };
    } finally {
      await parser.destroy();
    }
  }
}
