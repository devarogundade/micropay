import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AdminApiKeyGuard } from '../auth/admin-api-key.guard';
import {
  AgentStatus,
  WithdrawalStatus,
} from '../../common/types/enums';
import { AgentsService } from './agents.service';

class SetAgentStatusDto {
  @IsIn([AgentStatus.published, AgentStatus.paused, AgentStatus.draft])
  status!: AgentStatus | string;
}

class SetWithdrawalStatusDto {
  @IsOptional()
  @IsString()
  txId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

@Controller('api/v1/admin')
@UseGuards(AdminApiKeyGuard)
export class AgentsAdminController {
  constructor(private readonly agents: AgentsService) {}

  @Get('agents')
  async listAgents(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.agents.adminListAgents({
      q,
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Post('agents/:id/status')
  async setAgentStatus(
    @Param('id') id: string,
    @Body() body: SetAgentStatusDto,
  ) {
    return this.agents.adminSetStatus(id, body.status as AgentStatus);
  }

  @Get('withdrawals')
  async listWithdrawals(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.agents.adminListWithdrawals({
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    return {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Post('withdrawals/:id/approve')
  async approveWithdrawal(@Param('id') id: string) {
    return this.agents.adminSetWithdrawalStatus(
      id,
      WithdrawalStatus.approved,
    );
  }

  @Post('withdrawals/:id/paid')
  async markWithdrawalPaid(
    @Param('id') id: string,
    @Body() body: SetWithdrawalStatusDto,
  ) {
    return this.agents.adminSetWithdrawalStatus(
      id,
      WithdrawalStatus.paid,
      { txId: body.txId, note: body.note },
    );
  }

  @Post('withdrawals/:id/reject')
  async rejectWithdrawal(
    @Param('id') id: string,
    @Body() body: SetWithdrawalStatusDto,
  ) {
    return this.agents.adminSetWithdrawalStatus(
      id,
      WithdrawalStatus.rejected,
      { note: body.note },
    );
  }
}