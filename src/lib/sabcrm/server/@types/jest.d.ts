// PORT-NOTE: In Twenty, jest.d.ts augmented @jest/types Config.ConfigGlobals
// with NestJS-specific integration-test globals (APP_PORT, test tokens, TypeORM
// DataSource, NestJS INestApplication). SabNode's test stack uses Jest but
// without NestJS or TypeORM — integration tests talk directly to MongoDB via
// the connectToDatabase helper. The globals below are adapted for the SabNode
// context; adjust as integration-test infrastructure is built out.

import 'jest';

declare module '@jest/types' {
  namespace Config {
    interface ConfigGlobals {
      APP_PORT: number;
      SABCRM_ADMIN_ACCESS_TOKEN: string;
      SABCRM_MEMBER_ACCESS_TOKEN: string;
      SABCRM_GUEST_ACCESS_TOKEN: string;
      SABCRM_API_KEY_ACCESS_TOKEN: string;
      EXPIRED_ACCESS_TOKEN: string;
      INVALID_ACCESS_TOKEN: string;
    }
  }
}

declare global {
  const APP_PORT: number;
  const SABCRM_ADMIN_ACCESS_TOKEN: string;
  const SABCRM_MEMBER_ACCESS_TOKEN: string;
  const SABCRM_GUEST_ACCESS_TOKEN: string;
  const SABCRM_API_KEY_ACCESS_TOKEN: string;
  const EXPIRED_ACCESS_TOKEN: string;
  const INVALID_ACCESS_TOKEN: string;
}

export {};
