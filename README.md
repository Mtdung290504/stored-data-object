# StoredDataObject

**_Note: This is a google translator translation from Vietnamese_**  
StoredDataObject is a lightweight JSON data storage library, suitable for prototypes, demos, or small applications. This documentation only describes the **Quick Start**, **API**, and **datatype** — detailed examples are in `example/index.js`.

## Quick Start

Installation:

```bash
npm install stored-data-object
```

Basic usage:

```js
import { StoredDataObject, defineSchema } from 'stored-data-object';

// Define a schema (you can use defineSchema to get type inference support when using TS/JSDoc).
// If inference is not important, you can pass the schema object directly to `schema`.
const userSchema = defineSchema({
	name: 'string',
	age: 'number?',
	active: 'boolean',
});

// Create or open a file to store an array of objects
const users = await StoredDataObject.from({
	file: './data/users.json',
	storageType: 'array',
	schema: userSchema,
	/*
        Or: {
            name: 'string',
            age: 'number?',
            active: 'boolean',
        }
    */
});

users.data.push({ name: 'Alice', active: true });
await users.write();

// Reload data from file (keep object reference)
await users.reload();

// Reset to default value (or pass newInitValue)
await users.reset();
```

If you need to initialize the file for the first time with a specific value, pass `initValue` in the config:

```js
const settings = await StoredDataObject.from({
	file: './data/settings.json',
	storageType: 'object',
	schema: { theme: 'string', debug: 'boolean?' },
	initValue: { theme: 'dark', debug: false },
});
```

For a more detailed example: see `example/index.js` in the repository.

## API

### `defineSchema(schemaDef)`

Declare a schema for inference/type checking. Returns the `schemaDef` itself (used for type inference when using TypeScript/JSDoc).

**Parameters**

- `schemaDef` — the object that defines the schema (see the Datatypes section).

**Returns**

- object `schemaDef` (intact).

---

### `StoredDataObject.from(config, options?)`

Create (or open) a store from a JSON file. The function is `static async` and returns an object containing `data`, `filePath` and manipulation methods.

**Parameters `config` (object):**

- `file: string` — path to the JSON file (file will be created if not existing).

- `storageType: 'object' | 'array'` — storage mode: a single object or an array of objects according to the schema.

- `schema: SchemaDefinition` — schema defining the data.

- `initValue?` — (optional) initial value when the file does not exist. With `storageType: 'object'` pass a single object; with `'array'` pass an array of objects.

**Optional `options` parameter:**

- `encoding?: BufferEncoding` — default `'utf8'`.

- `autoValidate?: boolean` — default `true`. If `true` then initial data and data read from file will be validated according to the schema; if validation fails an error will be thrown.

**Returns:** an object of the form (summary):

```js
{
    data, // loaded/initialized data
    filePath, // absolute path to the file
    async write(), // write current data to file (validate before writing if autoValidate = true)
    async reload(), // reread file and update current data (keep reference)
    async reset(newInitValue?) // reset to default or newInitValue and write to file
}
```

**Important Behavior**

- If the file does not exist, the library will create a parent directory (recursive) and write the file with `initValue` or default value generated from the schema.
- By default `autoValidate` is `true`. If any value does not match the schema, the function will throw an error with a detailed message.
- The library has an internal _file lock_ mechanism to ensure that read/write/reload/reset operations are performed sequentially in the same process (reducing race conditions). This is not a locking mechanism between different processes.
- When `reload()` or `reset()` is called, the current data is updated **in place** (mutated) to keep the reference intact for other code holding a reference to `data` (e.g. UI, systems, etc.).

## Datatypes / Schema

Schema is defined by object; each property can be a **basic type** or a **nested schema**.

**Valid property type values**

- `'string'` — required string, if no value is given, it will be initialized to `''`.
- `'string?'` — optional string (`string | undefined`).
- `'number'` — required number, defaults to `0`.
- `'number?'` — optional number (`number | undefined`).
- `'boolean'` — required boolean, default `false`.
- `'boolean?'` — optional boolean (`boolean | undefined`).
- nested object — nested schema (child keys follow the same syntax as above).

**Valid schema example**

```js
const schema = defineSchema({
	id: 'number',
	name: 'string?',
	profile: {
		email: 'string',
		verified: 'boolean?',
	},
});
```

**Mapping to runtime types (overview)**

- `string` → `string` (default `''` if required and no value)
- `string?` → `string | undefined`
- `number` → `number` (default `0`)
- `number?` → `number | undefined`
- `boolean` → `boolean` (default `false`)
- `boolean?` → `boolean | undefined`
- nested object → object with corresponding fields

**Notes on default values**

- `createDefaultFromSchema` will generate default values ​​for **non-optional** fields according to the above rule. Optional fields will not be set (keep `undefined`) if there is no initial value.

## Errors & Exception Handling

- If the file contains invalid JSON, the reader function will throw an error with the message `"Invalid JSON in file: <path>..."`.
- If `autoValidate: true` and the data (from `initValue` or file) does not match the schema, `from()` or `write()` will throw an error with a detailed message (specifying the expected field and type).

- With `storageType: 'array'`, validation requires the data read from the file to be an array (otherwise an error will be thrown).

## Operational notes / limitations

- The file locking mechanism is in-process — it is not safe for multiple processes/instances to edit the file simultaneously.

- The design is suitable for small datasets/moderate read-write; not recommended for production applications with high concurrency needs or large datasets.

- Error messages should be clear for easy debugging (e.g., state which field has the wrong type and current value).

## Detailed examples

The full examples (array handling, multi-instance sync, error cases, etc.) are in `example/index.js`.
