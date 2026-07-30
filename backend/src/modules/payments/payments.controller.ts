import { Controller, Get } from '@nestjs/common';
import { ok } from '../../common/dto/api-response.dto';
import { PaymentsService } from './payments.service';

@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('config')
  getPublicConfig() {
    return ok({
      network: this.payments.getNetwork(),
      facilitatorUrl: this.payments.getFacilitatorUrl(),
      usdcAsa: this.payments.getUsdcAsa(),
      challengeTag: this.payments.getChallengeTag(),
    });
  }
}
