// PORT-NOTE: Twenty's jest-integration.config.ts configured NestJS/TypeORM
// integration tests (Postgres, global setup/teardown, NestJS app bootstrap).
// SabNode integration tests use Next.js + MongoDB instead. The config below
// retains the structural shape (path mapping, token globals, timeout) while
// dropping NestJS/TypeORM-specific references (dataSource, INestApplication,
// NodeEnvironment). Wire globalSetup/globalTeardown paths when SabNode
// integration-test infrastructure is established.

import { type JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
  prettierPath: null,
  silent: false,
  errorOnDeprecated: true,
  maxConcurrency: 1,
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '\\.integration-spec\\.ts$',
  modulePathIgnorePatterns: ['<rootDir>/dist'],
  // PORT-NOTE: Update these paths when SabNode's integration test helpers exist.
  // globalSetup: '<rootDir>/test/integration/utils/setup-test.ts',
  // globalTeardown: '<rootDir>/test/integration/utils/teardown-test.ts',
  testTimeout: 20000,
  maxWorkers: 1,
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: false,
            decorators: true,
          },
          transform: {
            decoratorMetadata: true,
          },
          baseUrl: '.',
          paths: {
            'src/*': ['./src/*'],
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  fakeTimers: {
    enableGlobally: true,
  },
  globals: {
    APP_PORT: 3000,
    // Populate with real tokens from env or test fixtures:
    SABCRM_ADMIN_ACCESS_TOKEN: process.env.SABCRM_ADMIN_ACCESS_TOKEN ?? '',
    SABCRM_MEMBER_ACCESS_TOKEN: process.env.SABCRM_MEMBER_ACCESS_TOKEN ?? '',
    SABCRM_GUEST_ACCESS_TOKEN: process.env.SABCRM_GUEST_ACCESS_TOKEN ?? '',
    SABCRM_API_KEY_ACCESS_TOKEN: process.env.SABCRM_API_KEY_ACCESS_TOKEN ?? '',
    EXPIRED_ACCESS_TOKEN: process.env.EXPIRED_ACCESS_TOKEN ?? '',
    INVALID_ACCESS_TOKEN: process.env.INVALID_ACCESS_TOKEN ?? '',
  },
};

export default jestConfig;
