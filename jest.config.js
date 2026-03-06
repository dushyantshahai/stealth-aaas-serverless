module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lambda'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        types: ['jest', 'node']
      }
    }
  },
  collectCoverageFrom: [
    'lambda/**/*.ts',
    '!lambda/**/*.test.ts',
    '!lambda/**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000,
  moduleNameMapper: {
    '^/opt/nodejs/(.*)$': '<rootDir>/lambda/layers/common/nodejs/$1'
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/cdk/'
  ]
};
