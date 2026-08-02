import { Controller, Get } from '@nestjs/common';
import { ToolScope } from '../../common/types/enums';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { ToolsRegistryService } from './tools-registry.service';

@Controller('api/v1/tools')
export class ToolsController {
  constructor(private readonly registry: ToolsRegistryService) {}

  @SkipTransform()
  @Get('capabilities')
  async capabilities() {
    const tools = await this.registry.getEnabledTools(ToolScope.chat);
    return {
      enabled: this.registry.toolsGloballyEnabled(),
      maxRounds: this.registry.maxRounds(),
      tools: tools.map((tool) => ({
        name: String(tool.name),
        description: tool.description,
        execution: tool.execution,
      })),
    };
  }
}
