import { promises as fs } from 'fs';
import path from 'path';

/** @type {Map<string, FileLock>} */
const fileLocks = new Map();

/**
 * Get the shared lock for a file to prevent race conditions across multiple instances
 * @param {string} filePath - Absolute path to the file
 * @returns {FileLock} The file lock instance
 */
function getFileLock(filePath) {
	if (!fileLocks.has(filePath)) {
		fileLocks.set(filePath, new FileLock());
	}
	return fileLocks.get(filePath);
}

/**
 * File lock implementation to ensure sequential file operations
 */
class FileLock {
	constructor() {
		/** @type {Promise<void>} */
		this.queue = Promise.resolve();
	}

	/**
	 * Ensures tasks are executed sequentially to prevent file corruption
	 *
	 * @param {() => Promise<any>} task - The async task to execute
	 * @returns {Promise<any>} Promise that resolves when task completes
	 */
	async run(task) {
		this.queue = this.queue.then(task, (err) => {
			console.error('> [StoredDataObject.FileLock] Task failed:', err.message);
			throw err;
		});
		return this.queue;
	}
}

/**
 * Builder class for StoredDataObject with chainable init method
 * 
 * @template T
 * @template {T extends any[] ? T : { [K in keyof T]?: T[K] }} InitData
 */
class StoredDataObjectBuilder {
	/**
	 * @param {string} filePath
	 * @param {T} schema
	 * @param {Object} options
	 */
	constructor(filePath, schema, options = {}) {
		this.filePath = filePath;
		this.schema = schema;
		this.options = options;
		this.initData = null;
	}

	/**
	 * Set initialization data for default values
     * 
	 * @template {T extends any[] ? T : Partial<T>} R
	 * @param {R} initData - Object with default values to merge with loaded data
	 * @returns {StoredDataObjectBuilder<T, R>}
	 */
	init(initData) {
		const newBuilder = new StoredDataObjectBuilder(this.filePath, this.schema, this.options);
		newBuilder.initData = initData;
		return newBuilder;
	}

	/**
	 * Build the final StoredDataObject
     * 
	 * @returns {Promise<{
	 *   data: T extends any[] ? T : InitData extends null ? Partial<T> : InitData extends T ? InitData : InitData & Partial<Omit<T, keyof InitData>>,
	 *   write(): Promise<void>,
	 *   reload(): Promise<void>,
	 *   filePath: string
	 * }>}
	 */
	async build() {
		const { encoding = 'utf8' } = this.options;
		const absPath = path.resolve(this.filePath);

		// Create default value based on schema type & init
		const defaultValue = Array.isArray(this.schema) ? [] : this.initData ? { ...this.initData } : {};

		// Ensure file exists, create with default value if not
		try {
			await fs.access(absPath);
		} catch {
			console.log(`> [StoredDataObject.from] File not found, creating: ${absPath}`);
			await fs.mkdir(path.dirname(absPath), { recursive: true });
			await fs.writeFile(absPath, JSON.stringify(defaultValue, null, 2), encoding);
		}

		// Read and parse initial data
		let raw = await fs.readFile(absPath, encoding);
		let parsedData;
		try {
			parsedData = raw.trim() ? JSON.parse(raw) : defaultValue;
		} catch (err) {
			console.error(`> [StoredDataObject.from] Failed to parse JSON from: ${absPath}`);
			throw new Error(`Invalid JSON in file: ${absPath}. ${err.message}`);
		}

		// Merge with init data if provided
		const data = this.initData && !Array.isArray(this.schema) ? { ...this.initData, ...parsedData } : parsedData;

		const lock = getFileLock(absPath);

		return {
			data,
			filePath: absPath,

			/**
			 * Write current data to the JSON file
			 * @returns {Promise<void>}
			 */
			async write() {
				await lock.run(async () => {
					await fs.writeFile(absPath, JSON.stringify(data, null, 2), encoding);
				});
			},

			/**
			 * Reload data from the JSON file, replacing current data
			 * @returns {Promise<void>}
			 */
			async reload() {
				await lock.run(async () => {
					const rawReload = await fs.readFile(absPath, encoding);
					let newParsedData;
					try {
						newParsedData = rawReload.trim() ? JSON.parse(rawReload) : defaultValue;
					} catch (err) {
						console.error(`> [StoredDataObject.reload] Failed to parse JSON during reload: ${absPath}`);
						throw new Error(`Invalid JSON during reload: ${absPath}. ${err.message}`);
					}

					// Merge with init data if provided
					const newData =
						this.initData && !Array.isArray(this.schema) ? { ...this.initData, ...newParsedData } : newParsedData;

					// Replace data content while maintaining reference
					if (Array.isArray(data)) {
						data.length = 0;
						data.push(...newData);
					} else {
						Object.keys(data).forEach((key) => delete data[key]);
						Object.assign(data, newData);
					}
				});
			},
		};
	}
}

/**
 * A lightweight JSON-based data persistence library for demo/lite projects
 */
export class StoredDataObject {
	/**
	 * Create a data wrapper from a JSON file with automatic persistence capabilities
	 *
	 * @template T
	 * @param {string} filePath - Path to the JSON file (relative or absolute)
	 * @param {T} schema - Schema object/array that defines the structure and provides type inference
	 * @param {Object} [options] - Configuration options
	 * @param {BufferEncoding} [options.encoding='utf8'] - File encoding
	 * @returns {StoredDataObjectBuilder<T, null>}
	 */
	static from(filePath, schema, options = {}) {
		return new StoredDataObjectBuilder(filePath, schema, options);
	}
}
