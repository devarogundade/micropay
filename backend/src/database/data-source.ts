import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities';
import { AddImageJobResult1722600000000 } from './migrations/1722600000000-AddImageJobResult';
import { AddDailyCredits1722700000000 } from './migrations/1722700000000-AddDailyCredits';

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL is required to run database migrations');
}

const databaseSsl =
  process.env.DATABASE_SSL === undefined
    ? !url.includes('localhost') && !url.includes('127.0.0.1')
    : process.env.DATABASE_SSL === 'true';

export default new DataSource({
  type: 'postgres',
  url,
  entities: ALL_ENTITIES,
  migrations: [AddImageJobResult1722600000000, AddDailyCredits1722700000000],
  synchronize: false,
  ssl: databaseSsl ? { rejectUnauthorized: false } : false,
});
