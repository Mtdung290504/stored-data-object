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
			console.error('[stored-data-object.FileLock] Task failed:', err.message);
			throw err;
		});
		this.queue = result.catch(() => {}); // Prevent unhandled rejection in queue
		return result;
	}
}

/** @type {Map<string, FileLock>} */
export const fileLocks = new Map();

/**
 * Get the shared lock for a file to prevent race conditions
 * @param {string} filePath - Absolute path to the file
 * @returns {FileLock} The file lock instance
 */
export function getFileLock(filePath) {
	if (!fileLocks.has(filePath)) {
		fileLocks.set(filePath, new FileLock());
	}

	// @ts-ignore: Safe because we just set it above if it didn't exist
	return fileLocks.get(filePath);
}
