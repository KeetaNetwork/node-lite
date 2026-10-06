/** @type {import('jest').Config} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src'],
	/*
	 * Copied node tests are named *.FROM_NODE.test.ts so they match the
	 * default *.test.ts pattern. ts-jest turns off noImplicitOverride
	 * because those suites subclass production types without override.
	 */
	testMatch: [
		'<rootDir>/src/**/*.test.ts'
	],
	testPathIgnorePatterns: [
		'/node_modules/'
	],
	moduleFileExtensions: ['ts', 'js', 'json'],
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				tsconfig: {
					types: ['node', 'jest'],
					noImplicitOverride: false
				}
			}
		]
	},
	testTimeout: 120000
};
