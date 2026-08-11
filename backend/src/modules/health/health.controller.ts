import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { ok } from '../../common/dto/api-response.dto';

@Controller()
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @SkipTransform()
  @Get('health')
  health() {
    return {
      status: 'ok',
      network: this.config.get('network'),
      x402Network: this.config.get('x402.network'),
      zgNetwork: this.config.get('zgRouter.network'),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('docs')
  root() {
    return ok({
      name: 'micropay-backend',
      docs: '/api/v1',
      health: '/health',
      realtime: '/realtime',
    });
  }
}
