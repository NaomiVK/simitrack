import {
  Controller,
  Post,
  Get,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ContentSimilarityService } from '../services/content-similarity.service';
import {
  AnalyzeUrlsRequest,
  ContentSimilarityResult,
  ApiResponse,
} from '@simitrack/shared-types';

@Controller('content-similarity')
export class ContentSimilarityController {
  constructor(
    private readonly contentSimilarityService: ContentSimilarityService
  ) {}

  @Post('analyze')
  async analyzeUrls(
    @Body() body: AnalyzeUrlsRequest
  ): Promise<ApiResponse<ContentSimilarityResult>> {
    if (!body.urls || !Array.isArray(body.urls) || body.urls.length < 2) {
      throw new HttpException(
        'At least 2 URLs are required',
        HttpStatus.BAD_REQUEST
      );
    }

    if (body.urls.length > 50) {
      throw new HttpException(
        'Maximum 50 URLs per request',
        HttpStatus.BAD_REQUEST
      );
    }

    const validUrls = body.urls.filter((url) => url.startsWith('http'));
    if (validUrls.length < 2) {
      throw new HttpException(
        'At least 2 valid URLs (starting with http) are required',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const result = await this.contentSimilarityService.analyzeUrls(validUrls);
      return { success: true, data: result };
    } catch (error) {
      throw new HttpException(
        `Analysis failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('status')
  async getStatus(): Promise<
    ApiResponse<{ ready: boolean; message: string }>
  > {
    return {
      success: true,
      data: {
        ready: true,
        message: 'Content similarity service is ready',
      },
    };
  }
}
