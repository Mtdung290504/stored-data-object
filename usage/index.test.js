// Complete usage examples for StoredDataObject
// @ts-check

import { StoredDataObject } from '../src/index.js';

// Với init data tĩnh
const userStore = await StoredDataObject.from({
	file: './data/student.json',
	storageType: 'object',
	schema: { name: 'string', age: 'number' },
	initValue: { name: 'Default User', age: 18 },
});

// Với init data function
const configStore = await StoredDataObject.from({
	file: './data/config.json',
	storageType: 'object',
	schema: { theme: 'string', version: 'string' },
	initValue: { theme: 'dark', version: '1.0.0' },
});

// // Reset về init data
// await userStore.reset();

// // Reset với data mới
// await userStore.reset({ name: 'New User', age: 25 });
