import { promises as fs } from 'fs';
import path from 'path';

import { getFileLock } from './helpers/file-lock.js';

/**
 * @typedef {'string' | 'number' | 'boolean'} SchemaPropertyBaseType
 * @typedef {`${SchemaPropertyBaseType}${'?' | ''}`} SchemaPropertyType
 * @typedef {[SchemaPropertyType | SchemaDefinition]} ArraySchemaType
 * @typedef {{ [key: string]: SchemaPropertyType | SchemaDefinition | ArraySchemaType }} SchemaDefinition
 */

/**
 * Create default value from schema
 *
 * @param {SchemaDefinition | SchemaPropertyType | ArraySchemaType} schema - Schema definition
 * @returns {any} Default value based on schema
 */
function createDefaultFromSchema(schema) {
	// Handle array schema
	if (isArraySchema(schema)) {
		return [];
	}

	// Handle primitive types
	if (typeof schema === 'string') {
		const isOptional = schema.endsWith('?');
		const baseType = isOptional ? schema.slice(0, -1) : schema;

		if (isOptional) {
			return undefined;
		}

		switch (baseType) {
			case 'string':
				return '';
			case 'number':
				return 0;
			case 'boolean':
				return false;
		}
	}

	// Handle object schema
	if (typeof schema === 'object' && schema !== null && !Array.isArray(schema)) {
		/** @type {Record<string, any>} */
		const result = {};

		for (const [key, type] of Object.entries(schema)) {
			result[key] = createDefaultFromSchema(type);
		}

		return result;
	}

	return undefined;
}

/**
 * Validate and coerce data according to schema
 *
 * @param {any} data - Input data to validate
 * @param {SchemaDefinition | SchemaPropertyType | ArraySchemaType} schema - Schema definition
 * @param {string} [path=''] - Current path for error messages
 * @returns {any} Validated and coerced data
 * @throws {Error} When validation fails
 */
function validateAndCoerce(data, schema, path = '') {
	// Handle array schema
	if (isArraySchema(schema)) {
		if (!Array.isArray(data)) {
			throw new Error(`Field '${path}' must be an array, got ${typeof data}`);
		}

		const itemSchema = schema[0];
		return data.map((item, index) => {
			try {
				return validateAndCoerce(item, itemSchema, `${path}[${index}]`);
			} catch (err) {
				throw new Error(`${/** @type {Error} */ (err).message}`);
			}
		});
	}

	// Handle primitive types
	if (typeof schema === 'string') {
		const isOptional = schema.endsWith('?');
		const baseType = isOptional ? schema.slice(0, -1) : schema;

		if (data === undefined || data === null) {
			if (!isOptional) {
				// Required field, use default
				switch (baseType) {
					case 'string':
						return '';
					case 'number':
						return 0;
					case 'boolean':
						return false;
				}
			}
			return undefined;
		}

		// Strict validation with clear error messages
		switch (baseType) {
			case 'string':
				if (typeof data !== 'string') {
					throw new Error(`Field '${path}' must be a string, got ${typeof data}: ${JSON.stringify(data)}`);
				}
				return data;
			case 'number':
				if (typeof data !== 'number' || isNaN(data)) {
					throw new Error(`Field '${path}' must be a number, got ${typeof data}: ${JSON.stringify(data)}`);
				}
				return data;
			case 'boolean':
				if (typeof data !== 'boolean') {
					throw new Error(`Field '${path}' must be a boolean, got ${typeof data}: ${JSON.stringify(data)}`);
				}
				return data;
		}
	}

	// Handle object schema
	if (typeof schema === 'object' && schema !== null && !Array.isArray(schema)) {
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			throw new Error(`Field '${path}' must be an object, got ${typeof data}`);
		}

		const inputData = /** @type {Record<string, any>} */ (data);
		/** @type {Record<string, any>} */
		const result = {};

		for (const [key, type] of Object.entries(schema)) {
			const fieldPath = path ? `${path}.${key}` : key;
			result[key] = validateAndCoerce(inputData[key], type, fieldPath);
		}

		return result;
	}

	return data;
}

/**
 * Check if a type definition is an array schema
 *
 * @param {any} type
 * @returns {type is ArraySchemaType}
 * @throws {TypeError} When the schema is invalid
 */
function isArraySchema(type) {
	const len = type.length;

	if (Array.isArray(type))
		if (len === 1) return true;
		else throw new TypeError('Invalid array schema, required tuple length 1 declare schema type');

	return false;
}

/**
 * Read and parse JSON file safely
 *
 * @param {string} absPath - Absolute file path
 * @param {BufferEncoding} encoding - File encoding
 * @param {any} defaultValue - Fallback value if parsing fails
 * @returns Parsed data
 */
async function readAndParseJSON(absPath, encoding, defaultValue) {
	const raw = /** @type {string} */ (await fs.readFile(absPath, encoding));

	try {
		return raw.trim() ? JSON.parse(raw) : defaultValue;
	} catch (err) {
		console.error(`> [stored-data-object.from] Failed to parse JSON: ${absPath}`);
		throw new Error(`Invalid JSON in file: ${absPath}. ${/** @type {Error} */ (err).message}`);
	}
}

/**
 * Update data reference safely maintaining object references
 *
 * @param {any} data - Current data reference
 * @param {any} newValidatedData - New data to update to
 */
function updateDataRef(data, newValidatedData) {
	if (typeof data !== 'object' || data === null) {
		return; // Cannot update non-object references
	}

	const isDataObject = !Array.isArray(data);
	const isNewDataObject =
		typeof newValidatedData === 'object' && newValidatedData !== null && !Array.isArray(newValidatedData);

	if (isDataObject && isNewDataObject) updateObject(data, newValidatedData);
}

/**
 * Recursively update existing properties to maintain references
 *
 * @param {any} target - Target object
 * @param {any} source - Source object
 */
function updateObject(target, source) {
	// Remove properties that don't exist in source
	for (const key of Object.keys(target)) {
		if (!(key in source)) {
			delete target[key];
		}
	}

	// Update or add properties from source
	for (const [key, value] of Object.entries(source)) {
		const isTargetObject = target[key] && typeof target[key] === 'object' && !Array.isArray(target[key]);
		const isSourceObject = typeof value === 'object' && !Array.isArray(value);

		if (isTargetObject && isSourceObject) {
			// Recursively update nested objects to preserve references
			updateObject(target[key], value);
		} else if (Array.isArray(target[key]) && Array.isArray(value)) {
			// Handle arrays by clearing and repopulating
			target[key].length = 0;
			target[key].push(...value);
		} else {
			// Direct assignment for primitives or new objects
			target[key] = value;
		}
	}
}

/**
 * Create schema definition for reuse with type safety
 *
 * @template {SchemaDefinition} T
 * @param {T} schemaDef - Schema definition object
 * @returns {T} The same schema definition (for type inference)
 */
const defineSchema = (schemaDef) => schemaDef;

/**
 * A lightweight JSON-based data persistence library
 */
export default { create: createSDO, schema: defineSchema };

/**
 * @template S
 * @typedef {S extends 'string' ? string :
 * 	S extends 'string?' ? string | undefined :
 * 		S extends 'number' ? number :
 * 			S extends 'number?' ? number | undefined :
 * 				S extends 'boolean' ? boolean :
 * 					S extends 'boolean?' ? boolean | undefined :
 * 						S extends [infer Item] ? SchemaToType<Item>[] :
 * 							S extends SchemaDefinition ? { [K in keyof S]: SchemaToType<S[K]> } : unknown
 * } SchemaToType
 */

/**
 * Create a data store from JSON file
 * 
 * @template {SchemaDefinition} S
 * @param {Object} config
 * @param {string} config.file - Path to JSON file
 * @param {S} config.schema - Schema definition
 * @param {SchemaToType<S>} [config.default] - If the file does not exist, it will be created with this value as the default.
 * @param {{
 * 	encoding?: BufferEncoding;
 * 	autoValidate?: boolean;
 * }} [options] - Configuration options
 * @throws {Error} When autoValidate is true (default) and initValue does not match schema
 */
async function createSDO(config, options = {}) {
	const { encoding = 'utf8', autoValidate = true } = options;
	const { file: filePath, schema, default: defaultValueIn } = config;
	const absPath = path.resolve(filePath);

	// Create default value from schema
	const defaultValue = defaultValueIn !== undefined ? defaultValueIn : createDefaultFromSchema(schema);

	// VALIDATE FIRST - before any file operations
	if (autoValidate) {
		try {
			validateAndCoerce(defaultValue, schema, '');
		} catch (err) {
			throw new Error(`Initial value validation failed: ${/** @type {Error} */ (err).message}`);
		}
	}

	let parsedData;
	let validatedData;

	// Check if file exists
	try {
		await fs.access(absPath);

		// File exists - read and validate
		parsedData = await readAndParseJSON(absPath, encoding, defaultValue);

		// Validate existing data BEFORE using it
		if (autoValidate) {
			try {
				validatedData = validateAndCoerce(parsedData, schema, '');
			} catch (err) {
				throw new Error(`Existing file data validation failed: ${/** @type {Error} */ (err).message}`);
			}
		} else {
			validatedData = parsedData;
		}
	} catch (accessError) {
		// File doesn't exist - use validated default value
		console.log(`> [stored-data-object.from] File not found, creating: ${absPath}`);

		// Create directory structure
		await fs.mkdir(path.dirname(absPath), { recursive: true });

		// Use already-validated default value
		validatedData = autoValidate ? validateAndCoerce(defaultValue, schema, '') : defaultValue;

		// Write initial data to file
		await fs.writeFile(absPath, JSON.stringify(validatedData, null, '\t'), encoding);
	}

	const data = validatedData;
	const lock = getFileLock(absPath);

	return {
		/**@type {SchemaToType<S>} */
		data,

		filePath: absPath,

		/**
		 * Write current data to file
		 *
		 * @returns {Promise<void>}
		 * @throws {Error} When autoValidate is true (default) and data does not match schema
		 */
		async write() {
			await lock.run(async () => {
				// Validate before writing
				if (autoValidate) {
					try {
						validateAndCoerce(data, schema, '');
					} catch (err) {
						throw new Error(`Data validation failed before write: ${/** @type {Error} */ (err).message}`);
					}
				}
				await fs.writeFile(absPath, JSON.stringify(data, null, '\t'), encoding);
			});
		},

		/**
		 * Reload data from file
		 * @returns {Promise<void>}
		 */
		async reload() {
			await lock.run(async () => {
				const newParsedData = await readAndParseJSON(absPath, encoding, defaultValue);
				const newValidatedData = autoValidate ? validateAndCoerce(newParsedData, schema, '') : newParsedData;
				updateDataRef(data, newValidatedData);
			});
		},

		/**
		 * Reset data to initial state and write to file
		 * @param {SchemaToType<S>} [newDefault] - Optional new init data to use instead of original
		 */
		async reset(newDefault) {
			await lock.run(async () => {
				const resetValue = newDefault !== undefined ? newDefault : defaultValue;
				const resetValidatedData = autoValidate ? validateAndCoerce(resetValue, schema, '') : resetValue;
				updateDataRef(data, resetValidatedData);

				// Write reset data to file
				await fs.writeFile(absPath, JSON.stringify(data, null, '\t'), encoding);
			});
		},
	};
}
