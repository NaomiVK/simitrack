import { Injectable, Logger } from '@nestjs/common';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

interface Secrets {
  OPENAI_API_KEY: string;
  GEMINI_API_KEY: string;
}

@Injectable()
export class AwsConfigService {
  private readonly logger = new Logger(AwsConfigService.name);
  private secrets: Secrets | null = null;
  private secretsClient: SecretsManagerClient;

  constructor() {
    this.secretsClient = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-2',
    });
  }

  async getSecrets(): Promise<Secrets> {
    if (this.secrets) {
      return this.secrets;
    }

    // In development, use environment variables
    if (process.env.NODE_ENV === 'development' || process.env.OPENAI_API_KEY) {
      this.secrets = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      };
      return this.secrets;
    }

    // In production, fetch from AWS Secrets Manager
    try {
      const secretName = process.env.SECRET_NAME || 'prod/cra-scam/api-keys';
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.secretsClient.send(command);

      if (response.SecretString) {
        const parsed = JSON.parse(response.SecretString);
        this.secrets = {
          OPENAI_API_KEY: parsed.OPENAI_API_KEY || '',
          GEMINI_API_KEY: parsed.GEMINI_API_KEY || '',
        };
        this.logger.log('Secrets loaded from AWS Secrets Manager');
      }
    } catch (error) {
      this.logger.error(`Failed to load secrets: ${error.message}`);
      throw error;
    }

    return this.secrets!;
  }
}
