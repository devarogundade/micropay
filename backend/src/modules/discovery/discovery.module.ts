import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { SiteMetaController } from './site-meta.controller';

@Module({ controllers: [DiscoveryController, SiteMetaController] })
export class DiscoveryModule {}
