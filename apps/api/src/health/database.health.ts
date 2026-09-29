import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import { DB, Database } from '../db/db.module';

/**
 * Checks the database the way the application uses it: a real query over a
 * pooled connection. A TCP-level check would pass while Postgres is still
 * replaying WAL and refusing queries.
 */
@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const startedAt = performance.now();

    try {
      await this.db.execute(sql`select 1`);
      return indicator.up({
        responseTimeMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }
}
