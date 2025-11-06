import type {Config} from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    testMatch: ['**/*.test.ts'],
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.(ts)$': ['ts-jest', {tsconfig: '<rootDir>/tsconfig.json', useESM: true}],
    },
    collectCoverageFrom: ['src/handlers/**/*.ts'],
    coverageDirectory: 'coverage',
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
};

export default config;
