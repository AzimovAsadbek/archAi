import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { type AuthenticatedUser } from '../common/types/request.types';
import { PDF_EXPORT_THROTTLE } from './pdf.constants';
import { type PdfExportQuery, pdfExportQuerySchema } from './pdf.schema';
import { PDF_LOCALES } from './pdf-strings';
import { PdfService } from './pdf.service';

/**
 * `filename` for user agents that only read the ASCII parameter, plus the
 * RFC 5987 `filename*` that carries the real project name.
 */
function contentDisposition(asciiName: string, utf8Name: string): string {
  const encoded = encodeURIComponent(utf8Name).replace(/['()*]/g, (char) => {
    return `%${char.charCodeAt(0).toString(16).toUpperCase()}`;
  });
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
}

@ApiTags('pdf')
@ApiCookieAuth()
@Controller('projects/:id/export')
export class PdfController {
  constructor(private readonly pdf: PdfService) {}

  @Throttle(PDF_EXPORT_THROTTLE)
  @Get('pdf')
  @ApiProduces('application/pdf')
  @ApiQuery({ name: 'locale', enum: PDF_LOCALES, required: false })
  @ApiOkResponse({
    description: 'The generated report',
    content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({
    summary: 'Project report as a PDF',
    description:
      'Streams an A4 report — configuration summary, floor plans drawn from the stored ' +
      'geometry and the STANDARD estimate. `locale` selects the document language ' +
      '(uz | ru | en, uz by default); an unknown value is 400 VALIDATION_ERROR. 409 ' +
      'PROJECT_NOT_CONFIGURED when land, house or rooms are missing. Generation is ' +
      'deterministic: an unchanged project always exports the identical file.',
  })
  async exportPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(pdfExportQuerySchema)) query: PdfExportQuery,
  ): Promise<StreamableFile> {
    const { buffer, filename, utf8Filename } = await this.pdf.export(user.id, id, query.locale);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: contentDisposition(filename, utf8Filename),
      length: buffer.length,
    });
  }
}
