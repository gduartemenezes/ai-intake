import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  /** Liveness: the process is up. Never touches dependencies. */
  @Get('live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * Readiness: the process can serve traffic. Returns 503 when the database
   * is unreachable, so an orchestrator stops routing to it.
   */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.database.isHealthy('database')]);
  }
}
