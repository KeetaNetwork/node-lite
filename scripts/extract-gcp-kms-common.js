#!/usr/bin/env node
'use strict';

/**
 * The client package ships gcp-kms.common.d.ts but folds the JS into
 * gcp-kms.js. Pull the two shared helpers out so node-lite can expose the
 * same module path without reimplementing them.
 */
const fs = require('fs');
const path = require('path');

const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
	console.error('Usage: extract-gcp-kms-common.js <gcp-kms.js> <out.js>');
	process.exit(1);
}

const source = fs.readFileSync(inputPath, 'utf8');

function extractFunction(name) {
	const patterns = [
		`async function ${name}(`,
		`function ${name}(`
	];
	let start = -1;
	for (const pattern of patterns) {
		start = source.indexOf(pattern);
		if (start >= 0) {
			break;
		}
	}
	if (start < 0) {
		throw new Error(`Could not find function ${name} in ${inputPath}`);
	}
	let i = start;
	let depth = 0;
	let started = false;
	for (; i < source.length; i++) {
		const ch = source[i];
		if (ch === '{') {
			depth++;
			started = true;
		} else if (ch === '}') {
			depth--;
			if (started && depth === 0) {
				i++;
				break;
			}
		}
	}
	return source.slice(start, i);
}

const parseFn = extractFunction('parseGCPKMSKeyName');
const buildFn = extractFunction('buildGCPKMSKeyNameBase');

const out = `'use strict';
${parseFn}

${buildFn}

exports.parseGCPKMSKeyName = parseGCPKMSKeyName;
exports.buildGCPKMSKeyNameBase = buildGCPKMSKeyNameBase;
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, out);
