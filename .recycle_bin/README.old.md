# StoredDataObject
[![npm version](https://img.shields.io/npm/v/stored-data-object.svg)](https://www.npmjs.com/package/stored-data-object)
A lightweight JSON-based data persistence library for demo, prototype, and lite applications. Skip the database setup complexity and get straight to building your app.

## Features

- **Zero Configuration** - No database setup required
- **File-based Storage** - Uses simple JSON files
- **Thread Safe** - Built-in file locking prevents race conditions

## Perfect For

- Rapid prototyping
- Demo applications
- Local development
- Test environments
- Configuration storage
- Small data sets

## Quick Start

```bash
npm install stored-data-object
```

```javascript
import { StoredDataObject } from 'stored-data-object';

// Basic usage - data will be Partial<T>
const users = await StoredDataObject.from('./data/users.json', { name: '', age: 0, email: '' }).build();

users.data.name = 'John';
await users.write();

// With default values - ensures required fields exist
const settings = await StoredDataObject.from('./data/settings.json', { theme: '', lang: '', debug: false })
	.init({ theme: 'dark', lang: 'en', debug: false })
	.build();

// settings.data.theme is guaranteed to be 'dark' or loaded value
```

## API

### `StoredDataObject.from(filePath, schema, options?)`

Creates a new StoredDataObject builder.

- `filePath` - Path to JSON file (created if doesn't exist)
- `schema` - Object/array defining the data structure
- `options` - Configuration options (encoding, etc.)

### `.init(defaultValues)`

Optional chaining method to provide default values.

- `defaultValues` - Object with default values for schema fields
- Returns builder with enhanced type safety

### `.build()`

Builds the final data object.

Returns object with:

- `data` - Your typed data object
- `write()` - Save data to file
- `reload()` - Reload data from file
- `filePath` - Absolute path to file

## Type Safety

StoredDataObject provides intelligent TypeScript inference:

```javascript
// Without init: Partial<T> - all fields optional
const db1 = await StoredDataObject.from('file.json', { name: '', age: 0 }).build();
// db1.data: { name?: string, age?: number }

// With partial init: Mixed types
const db2 = await StoredDataObject.from('file.json', { name: '', age: 0, email: '' }).init({ name: 'Unknown' }).build();
// db2.data: { name: string } & Partial<{ age: number, email: string }>

// With full init: Complete type
const db3 = await StoredDataObject.from('file.json', { name: '', age: 0 }).init({ name: 'Unknown', age: 0 }).build();
// db3.data: { name: string, age: number }
```

## Examples

Check out the comprehensive examples in the [`usage/`](./usage/) directory:

- Basic usage patterns
- Type safety demonstrations
- Array handling
- Multi-instance synchronization
- Error handling
- Configuration management

Run the demo:

```bash
node .\usage\
```

## Use Cases

### User Preferences

```javascript
const prefs = await StoredDataObject.from('./user-prefs.json', { theme: '', fontSize: 0, notifications: true })
	.init({ theme: 'system', fontSize: 14, notifications: true })
	.build();
```

### Todo List

```javascript
const todos = await StoredDataObject.from('./todos.json', []).build();

todos.data.push({ id: 1, task: 'Learn StoredDataObject', done: false });
await todos.write();
```

### Application State

```javascript
const state = await StoredDataObject.from('./app-state.json', { currentUser: null, isLoggedIn: false })
	.init({ currentUser: null, isLoggedIn: false })
	.build();
```

## When NOT to Use

- Production applications with high concurrency
- Large datasets (>50MB)
- Complex relational data
- High-frequency writes (>1000/sec)
- Multi-server deployments

For these scenarios, use a proper database like PostgreSQL, MongoDB, or Redis.

## License

MIT
