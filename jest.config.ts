export default {
  clearMocks: true,
  coverageDirectory: '../coverage',
  coverageProvider: 'v8',
  rootDir: 'src',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-extended/all'],
  testMatch: ['**/*.spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
