module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  collectCoverageFrom: [
    '../utils/pdf-text-extractor.ts',
    '../toc-extractor.ts',
    '../text-chunker.ts',
    '../pdf-processor.ts'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: [],
  moduleNameMapper: {
    '^/opt/nodejs/(.*)$': '<rootDir>/../layers/common/nodejs/$1'
  }
};
