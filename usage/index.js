// After npm install, replace the relative import below with:
// import { StoredDataObject } from 'stored-data-object';
// Or with commonjs:
// const StoredDataObject = require('stored-data-object');
import { StoredDataObject } from '../src/index.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.join(__dirname, 'storage');

// Main demo runner
async function runAllDemos() {
	console.log('StoredDataObject Demo Suite\n');

	try {
		await demoBasic();
		await demoPartialInit();
		await demoFullInit();
		await demoArray();
		await demoReload();
		await demoErrorHandling();
		await demoOptions();

		console.log('All demos completed!');
		console.log('Check ./storage/ for generated files');
	} catch (error) {
		console.error('Demo suite failed:', error);
	}
}

// Run all demos
runAllDemos().catch(console.error);

// Demo 1: Basic usage without init (Partial type)
async function demoBasic() {
	console.log('Demo 1: Basic usage (Partial type)');

	const db = await StoredDataObject.from(path.join(storageDir, 'basic.json'), { name: '', age: 0, email: '' }).build();

	console.log('Initial:', db.data); // {}

	db.data.name = 'John';
	db.data.age = 30;
	// All remains undefined (Partial<T>)

	await db.write();
	console.log('Saved:', db.data);
	console.log('Basic demo completed\n');
}

// Demo 2: Partial init (merge types)
async function demoPartialInit() {
	console.log('Demo 2: Partial initialization');

	const db = await StoredDataObject.from(path.join(storageDir, 'partial-init.json'), {
		name: '',
		age: 0,
		email: '',
		phone: null,
	})
		.init({ name: 'Anonymous', age: 0 })
		.build();

	console.log('With defaults:', db.data); // { name: 'Anonymous', age: 0 }

	db.data.name = 'Jane';
	db.data.email = 'jane@example.com';
	// email & phone can still be undefined

	await db.write();
	console.log('Updated:', db.data);
	console.log('Partial init demo completed\n');
}

// Demo 3: Full init (no nullable fields)
async function demoFullInit() {
	console.log('Demo 3: Full initialization');

	const db = await StoredDataObject.from(path.join(storageDir, 'full-init.json'), {
		id: 0,
		name: '',
		email: '',
		active: true,
	})
		.init({
			id: 1,
			name: 'Default',
			email: 'default@example.com',
			active: true,
		})
		.build();

	console.log('All fields guaranteed:', db.data);

	db.data.name = 'Alice';
	db.data.id = 2;

	await db.write();
	console.log('Full init demo completed\n');
}

// Demo 4: Array schema
async function demoArray() {
	console.log('Demo 4: Array schema');

	const db = await StoredDataObject.from(path.join(storageDir, 'todos.json'), [
		{ id: 1, task: 'Learn library', done: false },
	]).build();

	console.log('Initial array:', db.data); // []

	db.data.push({ id: 1, task: 'Learn library', done: false }, { id: 2, task: 'Build app', done: false });

	await db.write();
	console.log('Added todos:', db.data);
	console.log('Array demo completed\n');
}

// Demo 5: Reload functionality
async function demoReload() {
	console.log('Demo 5: Reload functionality');

	const db1 = await StoredDataObject.from(path.join(storageDir, 'shared.json'), { counter: 0 })
		.init({ counter: 0 })
		.build();

	const db2 = await StoredDataObject.from(path.join(storageDir, 'shared.json'), { counter: 0 })
		.init({ counter: 0 })
		.build();

	console.log('DB1 before:', db1.data.counter);
	console.log('DB2 before:', db2.data.counter);

	// Update from db1
	db1.data.counter = 42;
	await db1.write();

	// Reload db2 to see changes
	await db2.reload();
	console.log('DB2 after reload:', db2.data.counter); // 42
	console.log('Reload demo completed\n');
}

// Demo 6: Error handling
async function demoErrorHandling() {
	console.log('Demo 6: Error handling');

	try {
		// This should work fine
		const db = await StoredDataObject.from(path.join(storageDir, 'error-test.json'), { value: 'test' }).build();

		console.log('File created successfully');

		// Test with invalid JSON would be demonstrated by manually corrupting a file
		console.log('Corrupt a JSON file manually to test error recovery');
	} catch (error) {
		console.error('Error caught:', error.message);
	}

	console.log('Error handling demo completed\n');
}

// Demo 7: Different encodings and options
async function demoOptions() {
	console.log('Demo 7: Custom options');

	const db = await StoredDataObject.from(
		path.join(storageDir, 'with-options.json'),
		{
			text: '',
			timestamp: '',
		},
		{ encoding: 'utf8' }
	)
		.init({
			text: 'Hello',
			timestamp: new Date().toISOString(),
		})
		.build();

	console.log('With custom options:', db.data);
	console.log('Options demo completed\n');
}
