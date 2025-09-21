import { promises as fs } from 'fs';
import path from 'path';

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
 * @typedef {'string' | 'number' | 'boolean'} SchemaPropertyBaseType
 * @typedef {`${SchemaPropertyBaseType}${'?' | ''}`} SchemaPropertyType
 * @typedef {{ [key: string]: SchemaPropertyType | SchemaDefinition }} SchemaDefinition
 */

/**
 * @template S
 * @typedef {S extends 'string' ? string :
 * 		S extends 'string?' ? string | undefined :
 * 			S extends 'number' ? number :
 * 				S extends 'number?' ? number | undefined :
 * 					S extends 'boolean' ? boolean :
 * 						S extends 'boolean?' ? boolean | undefined :
 * 							S extends SchemaDefinition ? { [K in keyof S]: SchemaToType<S[K]> } : unknown
 * } SchemaToType
 */

/**
 * @template T
 * @typedef {{
 * 		data: T;
 * 		filePath: string;
 * 		write(): Promise<void>;
 * 		reload(): Promise<void>;
 * }} StoredDataResult
 */

/**
 * @typedef {{
 * 		encoding?: BufferEncoding;
 * 		autoValidate?: boolean;
 * }} StoredDataOptions
 */

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
 * A lightweight JSON-based data persistence library
 *
 * @example
 * // Object storage
 * const userStore = await StoredDataObject.from('./user.json', {
 * 	name: 'string',
 * 	age: 'number',
 * 	email: 'string?', // optional
 * 	settings: {
 * 		theme: 'string',
 * 		notifications: 'boolean',
 * 	},
 * }, 'object');
 *
 * // Array storage
 * const usersStore = await StoredDataObject.from('./users.json', {
 * 	name: 'string',
 * 	age: 'number',
 * }, 'array');
 *
 * // Usage
 * userStore.data.name = 'Dungx01';
 * await userStore.write();
 *
 * usersStore.data.push({ name: 'Dungx02', age: 25 });
 * await usersStore.write();
 */
export class StoredDataObject {
	/**
	 * Create a data store from JSON file (object mode)
	 * @template {SchemaDefinition} S
	 *
	 * @param {string} filePath - Path to JSON file
	 * @param {S} schemaDefinition - Schema created with schema() function
	 * @param {'object' | 'array'} mode - Storage mode
	 * @param {StoredDataOptions} [options] - Configuration options
	 *
	 * @returns {Promise<StoredDataResult<SchemaToType<S>>>}
	 */
	static async from(filePath, schemaDefinition, mode, options = {}) {
		const { encoding = 'utf8', autoValidate = true } = options;
		const absPath = path.resolve(filePath);

		// Create default value
		const defaultItem = createDefaultFromSchema(schemaDefinition);
		const defaultValue = mode === 'array' ? [] : defaultItem;

		// Ensure file exists
		try {
			await fs.access(absPath);
		} catch {
			console.log(`> [StoredDataObject.from] File not found, creating: ${absPath}`);
			await fs.mkdir(path.dirname(absPath), { recursive: true });
			await fs.writeFile(absPath, JSON.stringify(defaultValue, null, 2), encoding);
		}

		// Read and parse initial data
		const raw = /** @type {string} */ (await fs.readFile(absPath, encoding));
		let parsedData;

		try {
			parsedData = raw.trim() ? JSON.parse(raw) : defaultValue;
		} catch (err) {
			console.error(`> [StoredDataObject.from] Failed to parse JSON: ${absPath}`);
			throw new Error(`Invalid JSON in file: ${absPath}. ${/** @type {Error} */ (err).message}`);
		}

		// Validate data
		let validatedData;
		if (autoValidate) {
			if (mode === 'array') {
				if (!Array.isArray(parsedData)) {
					validatedData = [];
				} else {
					validatedData = parsedData.map((item) => validateAndCoerce(item, schemaDefinition));
				}
			} else {
				validatedData = validateAndCoerce(parsedData, schemaDefinition);
			}
		} else {
			validatedData = parsedData;
		}

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
				await lock.run(async () => {
					await fs.writeFile(absPath, JSON.stringify(data, null, 2), encoding);
				});
			},

			/**
			 * Reload data from file
			 * @returns {Promise<void>}
			 */
			async reload() {
				await lock.run(async () => {
					const rawReload = /** @type {string} */ (await fs.readFile(absPath, encoding));
					/** @type {any} */
					let newParsedData;

					try {
						newParsedData = rawReload.trim() ? JSON.parse(rawReload) : defaultValue;
					} catch (err) {
						console.error(`> [StoredDataObject.reload] Failed to parse JSON: ${absPath}`);
						const error = /** @type {Error} */ (err);
						throw new Error(`Invalid JSON during reload: ${absPath}. ${error.message}`);
					}

					// Validate new data
					/** @type {any} */
					let newValidatedData;
					if (autoValidate) {
						if (mode === 'array') {
							if (!Array.isArray(newParsedData)) {
								newValidatedData = [];
							} else {
								newValidatedData = newParsedData.map((item) => validateAndCoerce(item, schemaDefinition));
							}
						} else {
							newValidatedData = validateAndCoerce(newParsedData, schemaDefinition);
						}
					} else {
						newValidatedData = newParsedData;
					}

					// Update data reference safely
					if (Array.isArray(data)) {
						data.length = 0;
						if (Array.isArray(newValidatedData)) {
							data.push(...newValidatedData);
						}
					} else if (
						data &&
						typeof data === 'object' &&
						newValidatedData &&
						typeof newValidatedData === 'object' &&
						!Array.isArray(newValidatedData)
					) {
						const dataObj = /** @type {Record<string, any>} */ (data);
						const newDataObj = /** @type {Record<string, any>} */ (newValidatedData);
						updateObjectRecursively(dataObj, newDataObj);

						/**
						 * Recursively update existing properties to maintain references
						 *
						 * @param {any} target
						 * @param {any} source
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
								if (
									target[key] &&
									typeof target[key] === 'object' &&
									typeof value === 'object' &&
									!Array.isArray(target[key]) &&
									!Array.isArray(value)
								) {
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
					}
				});
			},
		};
	}
}
