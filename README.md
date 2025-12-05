# stored-data-object

`stored-data-object` is a lightweight JSON-based data persistence Node library (JS only), ideal for prototypes, demos, or small applications. It supports schema validation, type safety and automatically handles JSON file operations.

## Installation

```bash
npm install stored-data-object
```

## Quick Start

### Single Object

```js
import SDO from 'stored-data-object';

// Define schema
const settingsSchema = SDO.schema({
	theme: 'string',
	fontSize: 'number',
	notifications: 'boolean?',
});

// Create or open file
const settings = await SDO.create({
	file: './data/settings.json',
	schema: settingsSchema,
	default: { theme: 'dark', fontSize: 14 },
});

// Use it
settings.data.theme = 'light';
await settings.write();

// Reload from file
await settings.reload();

// Reset to default
await settings.reset();
```

### Array of Objects

```js
const userSchema = SDO.schema({
	id: 'number',
	name: 'string',
	email: 'string',
	active: 'boolean',
});

// Define schema with array of users
const usersSchema = SDO.schema({
	users: [userSchema], // Array of user objects
	lastUpdated: 'number',
});

const db = await SDO.create({
	file: './data/users.json',
	schema: usersSchema,
	default: { users: [], lastUpdated: Date.now() },
});

// Add new user
db.data.users.push({
	id: 1,
	name: 'Alice',
	email: 'alice@example.com',
	active: true,
});
db.data.lastUpdated = Date.now();
await db.write();
```

### Nested Objects

```js
const profileSchema = SDO.schema({
	user: {
		name: 'string',
		age: 'number?',
		contact: {
			email: 'string',
			phone: 'string?',
		},
	},
	preferences: {
		theme: 'string',
		language: 'string',
	},
});

const profile = await SDO.create({
	file: './data/profile.json',
	schema: profileSchema,
});

profile.data.user.name = 'Bob';
profile.data.user.contact.email = 'bob@example.com';
await profile.write();
```

## API Reference

### `SDO.schema(schemaDef)`

Define a schema for type inference and validation. Returns the schema object itself (used for TypeScript/JSDoc type inference).

**Parameters:**

- `schemaDef` — Object defining the data structure (see Schema Types section)

**Returns:**

- Schema definition object (as-is)

**Example:**

```js
const mySchema = SDO.schema({
	id: 'number',
	name: 'string',
	tags: ['string'], // Array of strings
});
```

---

### `SDO.create(config, options?)`

Create or open a stored data object from a JSON file. If the file doesn't exist, it will be automatically created with default values.

**`config` Parameters:**

- `file: string` — Path to JSON file (relative or absolute)
- `schema: SchemaDefinition` — Schema defining the data structure
- `default?: any` — Initial value when file doesn't exist (if not provided, uses default values generated from schema)

**`options` Parameters (optional):**

- `encoding?: BufferEncoding` — File encoding, defaults to `'utf8'`
- `autoValidate?: boolean` — Automatically validate data, defaults to `true`

**Returns:**

Promise resolving to an object with properties:

```typescript
{
  data: T,              // Data typed according to schema
  filePath: string,     // Absolute path to file
  write(): Promise<void>,        // Write data to file
  reload(): Promise<void>,       // Reload from file
  reset(newDefault?: T): Promise<void>  // Reset to default value
}
```

**Example:**

```js
const store = await SDO.create({
	file: './data.json',
	schema: SDO.schema({ count: 'number' }),
	default: { count: 0 },
});
```

---

### `store.write()`

Write current data to file. If `autoValidate: true`, validates before writing.

**Returns:** `Promise<void>`

**Throws:** Error if validation fails (when `autoValidate: true`)

**Example:**

```js
store.data.count = 42;
await store.write();
```

---

### `store.reload()`

Reload data from file and update `store.data` **in-place** (preserving object references).

**Returns:** `Promise<void>`

**Note:** This method updates the current object reference rather than creating a new object, ensuring other components holding references continue to work correctly.

**Example:**

```js
const dataRef = store.data;
await store.reload();
console.log(dataRef === store.data); // true - same reference
```

---

### `store.reset(newDefault?)`

Reset data to original default value (or `newDefault` if provided) and write to file.

**Parameters:**

- `newDefault?: T` — New value to reset to (optional)

**Returns:** `Promise<void>`

**Example:**

```js
// Reset to original default
await store.reset();

// Reset to new value
await store.reset({ count: 100 });
```

## Schema Types

Schemas define data structure and types. Each property can be:

### Primitive Types

| Schema Type  | TypeScript Type        | Default Value | Description      |
| ------------ | ---------------------- | ------------- | ---------------- |
| `'string'`   | `string`               | `''`          | Required string  |
| `'string?'`  | `string \| undefined`  | `undefined`   | Optional string  |
| `'number'`   | `number`               | `0`           | Required number  |
| `'number?'`  | `number \| undefined`  | `undefined`   | Optional number  |
| `'boolean'`  | `boolean`              | `false`       | Required boolean |
| `'boolean?'` | `boolean \| undefined` | `undefined`   | Optional boolean |

### Array Types

To define arrays, use the syntax `[itemSchema]`:

```js
const schema = SDO.schema({
	tags: ['string'], // Array of strings
	scores: ['number'], // Array of numbers
	items: [
		{
			// Array of objects
			id: 'number',
			name: 'string',
		},
	],
});
```

**Note:** Array schema must be a tuple with exactly 1 element (the item schema).

### Nested Objects

```js
const schema = SDO.schema({
	user: {
		// Nested object
		profile: {
			// Deeply nested
			name: 'string',
			age: 'number?',
		},
		settings: {
			theme: 'string',
		},
	},
});
```

### Complex Example

```js
const blogSchema = SDO.schema({
	posts: [
		{
			id: 'number',
			title: 'string',
			content: 'string',
			published: 'boolean',
			tags: ['string'],
			author: {
				name: 'string',
				email: 'string',
			},
			metadata: {
				views: 'number',
				likes: 'number',
				createdAt: 'number',
			},
		},
	],
	config: {
		siteName: 'string',
		postsPerPage: 'number',
	},
});
```

## Validation

When `autoValidate: true` (default), data is validated in these cases:

1. **During initialization** - Validates `default` value
2. **When reading file** - Validates data from file
3. **Before writing** - Validates `store.data` before `write()`
4. **When resetting** - Validates `newDefault` value

### Validation Errors

When validation fails, the error message specifies:

- Which field has the error
- Expected type vs actual type
- Current value (JSON)

**Example errors:**

```
Field 'user.age' must be a number, got string: "25"
Field 'items[2].active' must be a boolean, got undefined
```

### Disabling Validation

To disable validation (not recommended), set `autoValidate: false`:

```js
const store = await SDO.create(
	{
		file: './data.json',
		schema: mySchema,
	},
	{
		autoValidate: false, // Disable validation
	}
);
```

## File Operations & Locking

### File Lock

The library implements **in-process file locking** to ensure operations (write, reload, reset) don't race within the same Node.js process.

**Note:** This is not inter-process locking. If multiple processes access the same file, you need an external solution (like a database or external locking mechanism).

### Auto-create File

If the file doesn't exist:

1. Automatically creates parent directories (recursive)
2. Creates file with `default` value or default values from schema
3. Formats JSON with indentation (tabs)

### Reference Preservation

When `reload()` or `reset()` is called, data is updated **in-place** instead of creating a new object:

```js
const store = await SDO.create({
	file: './data.json',
	schema: SDO.schema({ count: 'number' }),
});

const ref1 = store.data;
await store.reload();
const ref2 = store.data;

console.log(ref1 === ref2); // true - same reference
```

This is important when multiple parts of your application hold references to `store.data`.

## Error Handling

### Invalid JSON

If file contains invalid JSON:

```js
try {
	const store = await SDO.create({
		file: './corrupted.json',
		schema: mySchema,
	});
} catch (error) {
	// Error: Invalid JSON in file: /path/to/corrupted.json. Unexpected token...
}
```

### Schema Mismatch

If data doesn't match schema (with `autoValidate: true`):

```js
try {
	await store.write();
} catch (error) {
	// Error: Data validation failed before write: Field 'age' must be a number, got string: "25"
}
```

### File Access Errors

If there are no read/write permissions:

```js
try {
	const store = await SDO.create({
		file: '/root/protected.json',
		schema: mySchema,
	});
} catch (error) {
	// Error: EACCES: permission denied
}
```

## Best Practices

### 1. Use `SDO.schema()` for Type Safety

```js
// Good ✓
const schema = SDO.schema({
	name: 'string',
	age: 'number',
});

// OK but loses type inference
const schema = {
	name: 'string',
	age: 'number',
};
```

### 2. Always `await write()` After Changes

```js
// Good ✓
store.data.count++;
await store.write();

// Bad ✗ - Changes not persisted
store.data.count++;
// ... other code
```

### 3. Handle Errors

```js
try {
	await store.write();
} catch (error) {
	console.error('Failed to save:', error.message);
	// Rollback or retry
}
```

### 4. Use Reasonable Default Values

```js
const store = await SDO.create({
	file: './data.json',
	schema: SDO.schema({
		users: [{ id: 'number', name: 'string' }],
		settings: { theme: 'string' },
	}),
	default: {
		users: [], // Empty array ready to use
		settings: { theme: 'light' }, // Has default value
	},
});
```

### 5. Avoid Complex Mutations

```js
// Good ✓ - Simple, clear
store.data.count = 10;
await store.write();

// Risky ⚠ - Deep mutation, hard to track
const deepRef = store.data.nested.deeply.buried;
deepRef.value = 'changed';
await store.write();
```

## Use Cases

### Configuration Management

```js
const config = await SDO.create({
	file: './config.json',
	schema: SDO.schema({
		apiUrl: 'string',
		timeout: 'number',
		retries: 'number',
		debug: 'boolean?',
	}),
	default: {
		apiUrl: 'https://api.example.com',
		timeout: 5000,
		retries: 3,
	},
});
```

### Simple Database

```js
const db = await SDO.create({
	file: './todos.json',
	schema: SDO.schema({
		todos: [
			{
				id: 'number',
				text: 'string',
				completed: 'boolean',
				createdAt: 'number',
			},
		],
	}),
	default: { todos: [] },
});

// CRUD operations
const addTodo = async (text) => {
	db.data.todos.push({
		id: Date.now(),
		text,
		completed: false,
		createdAt: Date.now(),
	});
	await db.write();
};

const toggleTodo = async (id) => {
	const todo = db.data.todos.find((t) => t.id === id);
	if (todo) {
		todo.completed = !todo.completed;
		await db.write();
	}
};
```

### Cache Management

```js
const cache = await SDO.create({
	file: './cache.json',
	schema: SDO.schema({
		entries: [
			{
				key: 'string',
				value: 'string',
				expiry: 'number',
			},
		],
	}),
	default: { entries: [] },
});

const setCache = async (key, value, ttl = 3600000) => {
	const idx = cache.data.entries.findIndex((e) => e.key === key);
	const entry = {
		key,
		value: JSON.stringify(value),
		expiry: Date.now() + ttl,
	};

	if (idx >= 0) {
		cache.data.entries[idx] = entry;
	} else {
		cache.data.entries.push(entry);
	}

	await cache.write();
};

const getCache = (key) => {
	const entry = cache.data.entries.find((e) => e.key === key && e.expiry > Date.now());
	return entry ? JSON.parse(entry.value) : null;
};
```

## Limitations

- **Not suitable for production apps** with high traffic or large datasets
- **No inter-process locking** - Not safe when multiple processes access the same file
- **No transactions** - Changes are applied immediately, no automatic rollback
- **No indexing** - Array searches are O(n)
- **No query language** - Must use JavaScript to filter/find
- **File-based** - Performance depends on filesystem

If you need these features, consider a real database (SQLite, PostgreSQL, MongoDB, etc.)

## TypeScript Support

The library is written with JSDoc and provides full type inference for TypeScript:

```typescript
import SDO from 'stored-data-object';

const schema = SDO.schema({
	count: 'number',
	name: 'string',
	active: 'boolean?',
});

const store = await SDO.create({
	file: './data.json',
	schema,
});

// TypeScript knows exact types:
store.data.count; // number
store.data.name; // string
store.data.active; // boolean | undefined
```

## License

MIT
