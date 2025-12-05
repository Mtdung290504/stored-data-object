// After npm install, replace the relative import below with:
// import SDO from 'stored-data-object';
// Or with commonjs:
// const SDO = require('stored-data-object');

// @ts-check
import SDO from '../src/index.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.join(__dirname, 'storage');

console.log('SDO Examples\n');

await exampleBasic();
await exampleWithInitValue();
await exampleArrays();
await exampleNestedArrays();
await exampleReload();
await exampleValidation();
await exampleReset();

/**
 * Example 1: Basic object storage with schema defaults
 */
async function exampleBasic() {
	console.log('Example 1: Basic object storage');

	const userData = await SDO.create({
		file: path.join(storageDir, 'user.json'),
		schema: {
			name: 'string', // defaults to ""
			age: 'number', // defaults to 0
			isActive: 'boolean', // defaults to false
			email: 'string?', // optional, defaults to undefined
		},
	});

	console.log('Initial data:', userData.data);
	// Output: { name: "", age: 0, isActive: false }

	userData.data.name = 'Dungx';
	userData.data.age = 25;
	userData.data.email = 'mtdung114290504@gmail.com';

	await userData.write();
	console.log('Saved data:', userData.data);
	console.log();
}

/**
 * Example 2: Object with custom initial values
 */
async function exampleWithInitValue() {
	console.log('Example 2: Custom initial values');

	const config = await SDO.create({
		file: path.join(storageDir, 'config.json'),
		schema: {
			port: 'number',
			host: 'string',
			debug: 'boolean',
		},
		default: {
			port: 3000,
			host: 'localhost',
			debug: true,
		},
	});

	console.log('Config data:', config.data);
	console.log();
}

/**
 * Example 3: Arrays of primitives and objects
 */
async function exampleArrays() {
	console.log('Example 3: Array storage');

	const appData = await SDO.create({
		file: path.join(storageDir, 'app-data.json'),
		schema: {
			todos: [
				{
					id: 'number',
					task: 'string',
					done: 'boolean',
				},
			],
			tags: ['string'],
			scores: ['number'],
		},
	});

	console.log('Initial data:', appData.data);
	// Output: { todos: [], tags: [], scores: [] }

	appData.data.todos.push({ id: 1, task: 'Sleep', done: true }, { id: 2, task: 'Wake up', done: false });
	appData.data.tags.push('urgent', 'personal');
	appData.data.scores.push(100, 95, 88);

	await appData.write();
	console.log('Data with items:', appData.data);
	console.log();
}

/**
 * Example 4: Nested arrays and complex structures
 */
async function exampleNestedArrays() {
	console.log('Example 4: Nested arrays');

	const projectData = await SDO.create({
		file: path.join(storageDir, 'projects.json'),
		schema: {
			name: 'string',
			projects: [
				{
					title: 'string',
					tasks: [
						{
							name: 'string',
							done: 'boolean',
						},
					],
					tags: ['string'],
				},
			],
			settings: {
				theme: 'string',
				recentColors: ['string'],
			},
		},
	});

	console.log('Initial data:', projectData.data);

	projectData.data.name = 'My Workspace';
	projectData.data.projects.push({
		title: 'Build App',
		tasks: [
			{ name: 'Design UI', done: true },
			{ name: 'Write code', done: false },
		],
		tags: ['frontend', 'urgent'],
	});
	projectData.data.settings.theme = 'dark';
	projectData.data.settings.recentColors.push('#ff0000', '#00ff00');

	await projectData.write();
	console.log('Complex data:', JSON.stringify(projectData.data, null, 2));
	console.log();
}

/**
 * Example 5: Reload data from file
 */
async function exampleReload() {
	console.log('Example 5: Reload functionality');

	// Two instances of same file
	const counter1 = await SDO.create({
		file: path.join(storageDir, 'counter.json'),
		schema: { count: 'number' },
	});

	const counter2 = await SDO.create({
		file: path.join(storageDir, 'counter.json'),
		schema: { count: 'number' },
	});

	console.log('Counter1 initial:', counter1.data);
	console.log('Counter2 initial:', counter2.data);

	// Update from first instance
	counter1.data.count = 42;
	await counter1.write();

	// Second instance still has old data
	console.log('Counter2 before reload:', counter2.data);

	// Reload to get updated data
	await counter2.reload();
	console.log('Counter2 after reload:', counter2.data);
	console.log();
}

/**
 * Example 6: Validation modes
 */
async function exampleValidation() {
	console.log('Example 6: Validation behavior');

	// With validation (default)
	console.log('Testing with validation enabled:');
	try {
		await SDO.create({
			file: path.join(storageDir, 'strict.json'),
			schema: { text: 'string', num: 'number' },

			// @ts-expect-error: Wrong types -> throw error
			default: { text: 123, num: 'abc' },
		});
	} catch (error) {
		console.log('Expected validation error:', /** @type {Error} */ (error).message);
	}

	// Without validation
	console.log('Testing with validation disabled:');
	const lenientData = await SDO.create(
		{
			file: path.join(storageDir, 'lenient.json'),
			schema: { text: 'string', num: 'number' },

			// @ts-expect-error: Wrong type but still accepted
			default: { text: 123, num: 'abc' },
		},
		{ autoValidate: false }
	);

	console.log('Raw data (no validation):', lenientData.data);
	console.log();
}

/**
 * Example 7: Reset data
 */
async function exampleReset() {
	console.log('Example 7: Reset functionality');

	const settings = await SDO.create({
		file: path.join(storageDir, 'settings.json'),
		schema: { theme: 'string', volume: 'number' },
		default: { theme: 'light', volume: 50 },
	});

	console.log('Initial settings:', settings.data);

	// Modify data
	settings.data.theme = 'dark';
	settings.data.volume = 80;
	await settings.write();
	console.log('Modified settings:', settings.data);

	// Reset to original
	await settings.reset();
	console.log('After reset:', settings.data);

	// Reset with new values
	await settings.reset({ theme: 'blue', volume: 30 });
	console.log('Reset with new values:', settings.data);
	console.log();
}
