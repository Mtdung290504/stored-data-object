import { promises as fs } from 'fs';
import path from 'path';

/**
 * @typedef {'string' | 'number' | 'boolean'} SchemaPropertyBaseType
 * @typedef {`${SchemaPropertyBaseType}${'?' | ''}`} SchemaPropertyType
 * @typedef {{ [key: string]: SchemaPropertyType | SchemaDefinition }} SchemaDefinition
 */

/**
 * @template S
 * @typedef {S extends 'string' ? string :
 * 	S extends 'string?' ? string | undefined :
 * 		S extends 'number' ? number :
 * 			S extends 'number?' ? number | undefined :
 * 				S extends 'boolean' ? boolean :
 * 					S extends 'boolean?' ? boolean | undefined :
 * 						S extends SchemaDefinition ? { [K in keyof S]: SchemaToType<S[K]> } : unknown
 * } SchemaToType
 */

/**
 * @template T
 * @typedef {{
 * 	data: T;
 * 	filePath: string;
 * 	write(): Promise<void>;
 * 	reload(): Promise<void>;
 * 	reset(initValue?: T): Promise<void>;
 * }} StoredDataResult
 */

/**
 * @typedef {{
 * 	encoding?: BufferEncoding;
 * 	autoValidate?: boolean;
 * }} StoredDataOptions
 */

/** @type {Map<string, FileLock>} */
const fileLocks = new Map();

/**
 * Get the shared lock for a file to prevent race conditions
 * @param {string} filePath - Absolute path to the file
 * @returns {FileLock} The file lock instance
 */
function getFileLock(filePath) {
	if (!fileLocks.has(filePath)) {
		fileLocks.set(filePath, new FileLock());
	}

	// @ts-ignore: Safe because we just set it above if it didn't exist
	return fileLocks.get(filePath);
}

/**
 * File lock implementation to ensure sequential file operations
 */
class FileLock {
	constructor() {
		/** @type {Promise<any>} */
		this.queue = Promise.resolve();
	}

	/**
	 * @template T
	 * @param {() => Promise<T>} task - The async task to execute
	 * @returns {Promise<T>}
	 */
	async run(task) {
		const result = this.queue.then(task, (err) => {
			console.error('> [StoredDataObject.FileLock] Task failed:', err.message);
			throw err;
		});
		this.queue = result.catch(() => {}); // Prevent unhandled rejection in queue
		return result;
	}
}

/**
 * Create schema definition
 *
 * @template {SchemaDefinition} T
 * @param {T} schemaDef - Schema definition object
 * @returns {T} The same schema definition (for type inference)
 */
export function defineSchema(schemaDef) {
	return schemaDef;
}

/**
 * Create default value from schema
 *
 * @param {SchemaDefinition} schema - Schema definition
 * @returns {Record<string, any>} Default object based on schema
 */
function createDefaultFromSchema(schema) {
	/** @type {Record<string, any>} */
	const result = {};

	for (const [key, type] of Object.entries(schema)) {
		if (typeof type === 'object' && type !== null) {
			// Nested schema
			result[key] = createDefaultFromSchema(type);
		} else {
			// Handle type strings like 'string', 'string?', 'number', etc.
			const isOptional = type.endsWith('?');
			const baseType = isOptional ? type.slice(0, -1) : type;

			if (!isOptional) {
				switch (baseType) {
					case 'string':
						result[key] = '';
						break;
					case 'number':
						result[key] = 0;
						break;
					case 'boolean':
						result[key] = false;
						break;
				}
			}
			// Optional fields are not set (undefined)
		}
	}

	return result;
}

/**
 * Validate and coerce data according to schema
 *
 * @param {any} data - Input data to validate
 * @param {SchemaDefinition} schema - Schema definition
 *
 * @returns {Record<string, any>} Validated and coerced data
 * @throws {Error} When validation fails
 */
function validateAndCoerce(data, schema) {
	if (!data || typeof data !== 'object') {
		throw new Error('Data must be an object');
	}

	const inputData = /** @type {Record<string, any>} */ (data);
	/** @type {Record<string, any>} */
	const result = {};

	for (const [key, type] of Object.entries(schema)) {
		if (typeof type === 'object' && type !== null) {
			// Nested schema
			result[key] = validateAndCoerce(inputData[key], type);
		} else {
			const isOptional = type.endsWith('?');
			const baseType = isOptional ? type.slice(0, -1) : type;
			const value = inputData[key];

			if (value === undefined || value === null) {
				if (!isOptional) {
					// Required field, use default
					switch (baseType) {
						case 'string':
							result[key] = '';
							break;
						case 'number':
							result[key] = 0;
							break;
						case 'boolean':
							result[key] = false;
							break;
					}
				}
				// Optional field stays undefined
			} else {
				// Strict validation with clear error messages
				switch (baseType) {
					case 'string':
						if (typeof value !== 'string') {
							throw new Error(`Field '${key}' must be a string, got ${typeof value}: ${JSON.stringify(value)}`);
						}
						result[key] = value;
						break;
					case 'number': {
						if (typeof value !== 'number' || isNaN(value)) {
							throw new Error(`Field '${key}' must be a number, got ${typeof value}: ${JSON.stringify(value)}`);
						}
						result[key] = value;
						break;
					}
					case 'boolean':
						if (typeof value !== 'boolean') {
							throw new Error(`Field '${key}' must be a boolean, got ${typeof value}: ${JSON.stringify(value)}`);
						}
						result[key] = value;
						break;
				}
			}
		}
	}

	return result;
}

/**
 * Resolve initial data from various sources
 * @template T
 *
 * @param {T | undefined} initValue - Can be data, function, or async function
 * @param {'object' | 'array'} mode - Storage mode
 * @param {T} defaultValue - Default schema item
 */
function resolveInitValue(initValue, mode, defaultValue) {
	let resolvedData;

	if (initValue !== undefined) {
		resolvedData = initValue;
	} else {
		resolvedData = mode === 'array' ? /** @type {T[]} */ ([]) : defaultValue;
	}

	return resolvedData;
}

/**
 * Read and parse JSON file safely
 * @param {string} absPath - Absolute file path
 * @param {BufferEncoding} encoding - File encoding
 * @param {any} defaultValue - Fallback value if parsing fails
 * @returns {Promise<any>} Parsed data
 */
async function readAndParseJSON(absPath, encoding, defaultValue) {
	const raw = /** @type {string} */ (await fs.readFile(absPath, encoding));

	try {
		return raw.trim() ? JSON.parse(raw) : defaultValue;
	} catch (err) {
		console.error(`> [StoredDataObject.from] Failed to parse JSON: ${absPath}`);
		throw new Error(`Invalid JSON in file: ${absPath}. ${/** @type {Error} */ (err).message}`);
	}
}

/**
 * Validate parsed data according to schema and mode
 *
 * @param {any} parsedData - Raw parsed data
 * @param {SchemaDefinition} schemaDefinition - Schema definition
 * @param {'object' | 'array'} mode - Storage mode
 * @param {boolean} autoValidate - Whether to validate
 *
 * @returns {any} Validated data
 * @throws {Error} When autoValidate is true and validation fails
 */
function validateParsedData(parsedData, schemaDefinition, mode, autoValidate) {
	if (!autoValidate) {
		return parsedData; // Return raw data, no validation
	}

	if (mode === 'array') {
		if (!Array.isArray(parsedData)) {
			throw new Error('Data must be an array when storageType is "array"');
		}
		return parsedData.map((item, index) => {
			try {
				return validateAndCoerce(item, schemaDefinition);
			} catch (err) {
				throw new Error(`Validation failed at array index ${index}: ${/** @type {Error} */ (err).message}`);
			}
		});
	}

	return validateAndCoerce(parsedData, schemaDefinition);
}

/**
 * Recursively update existing properties to maintain references
 * @param {any} target - Target object
 * @param {any} source - Source object
 */
function updateObjectRecursively(target, source) {
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
			updateObjectRecursively(target[key], value);
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
 * Update data reference safely maintaining object references
 * @param {any} data - Current data reference
 * @param {any} newValidatedData - New data to update to
 */
function updateDataReference(data, newValidatedData) {
	if (Array.isArray(data)) {
		data.length = 0;
		if (Array.isArray(newValidatedData)) {
			data.push(...newValidatedData);
		}
		return;
	}

	const isDataObject = data && typeof data === 'object';
	const isNewDataObject = newValidatedData && typeof newValidatedData === 'object' && !Array.isArray(newValidatedData);

	if (isDataObject && isNewDataObject) {
		const dataObj = /** @type {Record<string, any>} */ (data);
		const newDataObj = /** @type {Record<string, any>} */ (newValidatedData);
		updateObjectRecursively(dataObj, newDataObj);
	}
}

/**
 * A lightweight JSON-based data persistence library
 */
export class StoredDataObject {
	/**
	 * Create a data store from JSON file
	 *
	 * @template {'object' | 'array'} Mode
	 * @template {SchemaDefinition} S
	 *
	 * @param {Object} config
	 * @param {string} config.file - Path to JSON file
	 * @param {Mode} config.storageType - Storage mode, specifies whether you want to store an array of schema objects or just a single schema object
	 * @param {S} config.schema - Schema definition
	 * @param {'array' extends Mode ? SchemaToType<S>[] : SchemaToType<S>} [config.initValue] - If the file does not exist, it will be created with this value as the default.
	 * @param {StoredDataOptions} [options] - Configuration options
	 *
	 * @returns {Promise<StoredDataResult<'array' extends Mode ? SchemaToType<S>[] : SchemaToType<S>>>}
	 * @throws {Error} When autoValidate is true (default) and initValue does not match schema
	 */
	static async from(config, options = {}) {
		const { encoding = 'utf8', autoValidate = true } = options;
		const { file: filePath, storageType: mode, schema, initValue } = config;
		const absPath = path.resolve(filePath);

		// Create default value
		const defaultItem = createDefaultFromSchema(schema);
		const defaultValue = resolveInitValue(initValue, mode, defaultItem);

		// VALIDATE FIRST - before any file operations
		if (autoValidate) {
			try {
				validateParsedData(defaultValue, schema, mode, true);
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
					validatedData = validateParsedData(parsedData, schema, mode, true);
				} catch (err) {
					throw new Error(`Existing file data validation failed: ${/** @type {Error} */ (err).message}`);
				}
			} else {
				validatedData = parsedData;
			}
		} catch (accessError) {
			// File doesn't exist - use validated default value
			console.log(`> [StoredDataObject.from] File not found, creating: ${absPath}`);

			// Create directory structure
			await fs.mkdir(path.dirname(absPath), { recursive: true });

			// Use already-validated default value
			validatedData = autoValidate ? validateParsedData(defaultValue, schema, mode, true) : defaultValue;

			// Write initial data to file
			await fs.writeFile(absPath, JSON.stringify(validatedData, null, '\t'), encoding);
		}

		const data = validatedData;
		const lock = getFileLock(absPath);

		return {
			data,
			filePath: absPath,

			/**
			 * Write current data to file
			 * @returns {Promise<void>}
			 * @throws {Error} When autoValidate is true (default) and data does not match schema
			 */
			async write() {
				await lock.run(async () => {
					// Validate before writing
					if (autoValidate) {
						try {
							validateParsedData(data, schema, mode, true);
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
					const newValidatedData = validateParsedData(newParsedData, schema, mode, autoValidate);
					updateDataReference(data, newValidatedData);
				});
			},

			/**
			 * Reset data to initial state and optionally write to file
			 *
			 * @param {'array' extends Mode
			 *  ? SchemaToType<S>[]
			 *  : SchemaToType<S>
			 * } [newInitValue] - Optional new init data to use instead of original
			 */
			async reset(newInitValue) {
				await lock.run(async () => {
					const resetValue =
						newInitValue !== undefined ? resolveInitValue(newInitValue, mode, defaultItem) : defaultValue;

					const resetValidatedData = validateParsedData(resetValue, schema, mode, autoValidate);
					updateDataReference(data, resetValidatedData);

					// Write reset data to file
					await fs.writeFile(absPath, JSON.stringify(data, null, '\t'), encoding);
				});
			},
		};
	}
}
