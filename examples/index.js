// After npm install, replace the relative import below with:
// import { StoredDataObject } from 'stored-data-object';
// Or with commonjs:
// const StoredDataObject = require('stored-data-object');

// @ts-check
import { StoredDataObject } from '../src/index.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.join(__dirname, 'storage');

console.log('StoredDataObject Examples\n');

await exampleBasic();
await exampleWithInitValue();
await exampleArray();
await exampleReload();
await exampleValidation();
await exampleReset();

/**
 * Example 1: Basic object storage with schema defaults
 */
async function exampleBasic() {
	console.log('Example 1: Basic object storage');

	const userData = await StoredDataObject.from({
		file: path.join(storageDir, 'user.json'),
		storageType: 'object',
		schema: {
			name: 'string', // defaults to ""
			age: 'number', // defaults to 0
			isActive: 'boolean', // defaults to false
			email: 'string?', // optional, defaults to undefined
		},
	});

	console.log('\tInitial data:', userData.data);
	// Output: { name: "", age: 0, isActive: false }

	userData.data.name = 'Dungx';
	userData.data.age = 25;
	userData.data.email = 'mtdung114290504@gmail.com';

	await userData.write();
	console.log('\tSaved data:', userData.data);
	console.log();
}

/**
 * Example 2: Object with custom initial values
 */
async function exampleWithInitValue() {
	console.log('Example 2: Custom initial values');

	const config = await StoredDataObject.from({
		file: path.join(storageDir, 'config.json'),
		storageType: 'object',
		schema: {
			port: 'number',
			host: 'string',
			debug: 'boolean',
		},
		initValue: {
			port: 3000,
			host: 'localhost',
			debug: true,
		},
	});

	console.log('\tConfig data:', config.data);
	console.log();
}

/**
 * Example 3: Array storage for collections
 */
async function exampleArray() {
	console.log('Example 3: Array storage');

	const todoList = await StoredDataObject.from({
		file: path.join(storageDir, 'todos.json'),
		storageType: 'array',
		schema: {
			id: 'number',
			task: 'string',
			done: 'boolean',
		},
	});

	console.log('\tInitial array:', todoList.data); // []

	todoList.data.push(
		{ id: 1, task: 'Sleep', done: true },
		{ id: 2, task: 'Wake up', done: false }
	);

	await todoList.write();
	console.log('\tArray with items:', todoList.data);
	console.log();
}

/**
 * Example 4: Reload data from file
 */
async function exampleReload() {
	console.log('Example 4: Reload functionality');

	// Two instances of same file
	const counter1 = await StoredDataObject.from({
		file: path.join(storageDir, 'counter.json'),
		storageType: 'object',
		schema: { count: 'number' },
	});

	const counter2 = await StoredDataObject.from({
		file: path.join(storageDir, 'counter.json'),
		storageType: 'object',
		schema: { count: 'number' },
	});

	console.log('\tCounter1 initial:', counter1.data);
	console.log('\tCounter2 initial:', counter2.data);

	// Update from first instance
	counter1.data.count = 42;
	await counter1.write();

	// Second instance still has old data
	console.log('\tCounter2 before reload:', counter2.data);

	// Reload to get updated data
	await counter2.reload();
	console.log('\tCounter2 after reload:', counter2.data);
	console.log();
}

/**
 * Example 5: Validation modes
 */
async function exampleValidation() {
	console.log('Example 5: Validation behavior');

	// With validation (default)
	console.log('\tTesting with validation enabled:');
	try {
		await StoredDataObject.from({
			file: path.join(storageDir, 'strict.json'),
			storageType: 'object',
			schema: { text: 'string', num: 'number' },

			// @ts-expect-error: Wrong types -> throw error
			initValue: { text: 123, num: 'abc' },
		});
	} catch (error) {
		console.log('\tExpected validation error:', /** @type {Error} */ (error).message);
	}

	// Without validation
	console.log('\tTesting with validation disabled:');
	const lenientData = await StoredDataObject.from(
		{
			file: path.join(storageDir, 'lenient.json'),
			storageType: 'object',
			schema: { text: 'string', num: 'number' },

			// @ts-expect-error: Wrong type but still accepted and data is written
			initValue: { text: 123, num: 'abc' },
		},
		{ autoValidate: false }
	);

	console.log('\tRaw data (no validation):', lenientData.data);
	console.log('\tType of text:', typeof lenientData.data.text);
	console.log('\tType of num:', typeof lenientData.data.num);
	console.log();
}

// Example 6: Reset data
async function exampleReset() {
	console.log('Example 6: Reset functionality');

	const settings = await StoredDataObject.from({
		file: path.join(storageDir, 'settings.json'),
		storageType: 'object',
		schema: { theme: 'string', volume: 'number' },
		initValue: { theme: 'light', volume: 50 },
	});

	console.log('\tInitial settings:', settings.data);

	// Modify data
	settings.data.theme = 'dark';
	settings.data.volume = 80;
	await settings.write();
	console.log('\tModified settings:', settings.data);

	// Reset to original
	await settings.reset();
	console.log('\tAfter reset:', settings.data);

	// Reset with new values
	await settings.reset({ theme: 'blue', volume: 30 });
	console.log('\tReset with new values:', settings.data);
	console.log();
}
