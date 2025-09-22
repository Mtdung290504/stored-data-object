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
 * 	autoValidate?: false;
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
 * @returns {Record<string, any>} Validated and coerced data
 */
function validateAndCoerce(data, schema) {
	if (!data || typeof data !== 'object') {
		return createDefaultFromSchema(schema);
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
				// Coerce the value
				switch (baseType) {
					case 'string':
						result[key] = String(value);
						break;
					case 'number': {
						const num = Number(value);
						result[key] = isNaN(num) ? 0 : num;
						break;
					}
					case 'boolean':
						result[key] = Boolean(value);
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
 * Ensure file exists and create with initial data if needed
 *
 * @param {string} absPath - Absolute file path
 * @param {any} defaultValue - Default value to write
 * @param {BufferEncoding} encoding - File encoding
 *
 * @returns {Promise<void>}
 */
async function ensureFileExists(absPath, defaultValue, encoding) {
	try {
		await fs.access(absPath);
	} catch {
		console.log(`> [StoredDataObject.from] File not found, creating: ${absPath}`);
		await fs.mkdir(path.dirname(absPath), { recursive: true });
		await fs.writeFile(absPath, JSON.stringify(defaultValue, null, '\t'), encoding);
	}
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
 * @param {any} parsedData - Raw parsed data
 * @param {SchemaDefinition} schemaDefinition - Schema definition
 * @param {'object' | 'array'} mode - Storage mode
 * @param {boolean} autoValidate - Whether to validate
 * @returns {any} Validated data
 */
function validateParsedData(parsedData, schemaDefinition, mode, autoValidate) {
	if (!autoValidate) {
		return parsedData;
	}

	if (mode === 'array') {
		if (!Array.isArray(parsedData)) {
			return [];
		}
		return parsedData.map((item) => validateAndCoerce(item, schemaDefinition));
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
	 * @template {'object' | 'array'} Mode
	 * @template {SchemaDefinition} S
	 *
	 * @param {Object} config
	 * @param {string} config.file - Path to JSON file
	 * @param {Mode} config.storageType - Storage mode
	 * @param {S} config.schema - Schema definition
	 * @param {'array' extends Mode ? SchemaToType<S>[] : SchemaToType<S>} [config.initValue]
	 *
	 * @param {StoredDataOptions} [options] - Configuration options
	 *
	 * @returns {Promise<StoredDataResult<'array' extends Mode ? SchemaToType<S>[] : SchemaToType<S>>>}
	 */
	static async from(config, options = {}) {
		const { encoding = 'utf8', autoValidate = true } = options;
		const { file: filePath, storageType: mode, schema, initValue } = config;
		const absPath = path.resolve(filePath);

		// Create default value
		const defaultItem = createDefaultFromSchema(schema);
		const defaultValue = resolveInitValue(initValue, mode, defaultItem);

		// Ensure file exists
		await ensureFileExists(absPath, defaultValue, encoding);

		// Read and parse initial data
		const parsedData = await readAndParseJSON(absPath, encoding, defaultValue);

		// Validate data
		const validatedData = validateParsedData(parsedData, schema, mode, autoValidate);
		const data = validatedData;
		const lock = getFileLock(absPath);

		return {
			data,
			filePath: absPath,

			/**
			 * Write current data to file
			 * @returns {Promise<void>}
			 */
			async write() {
				await lock.run(async () => await fs.writeFile(absPath, JSON.stringify(data, null, '\t'), encoding));
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
