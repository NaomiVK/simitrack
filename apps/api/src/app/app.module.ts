import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ContentSimilarityController } from '../controllers/content-similarity.controller';
import { ContentSimilarityService } from '../services/content-similarity.service';
import { EmbeddingService } from '../services/embedding.service';
import { AwsConfigService } from '../services/aws-config.service';

@Module({
  imports: [],
  controllers: [AppController, ContentSimilarityController],
  providers: [
    AppService,
    ContentSimilarityService,
    EmbeddingService,
    AwsConfigService,
  ],
})
export class AppModule {}
