// Complete usage examples for StoredDataObject

import { StoredDataObject } from '../src/index.v3.js';

// Với init data tĩnh
const userStore = await StoredDataObject.from('./data/student.json', { name: 'string', age: 'number' }, 'object', {
	initData: { name: 'Default User', age: 18 },
});

// Với init data function
const configStore = await StoredDataObject.from(
	'./data/config.json',
	{ theme: 'string', version: 'string' },
	'object',
	{ initData: { theme: 'dark', version: '1.0.0' } }
);

// // Reset về init data
// await userStore.reset();

// // Reset với data mới
// await userStore.reset({ name: 'New User', age: 25 });
