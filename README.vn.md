# stored-data-object

`stored-data-object` là thư viện Node (chỉ JS) lưu trữ dữ liệu dạng JSON nhẹ, phù hợp cho prototype, demo, hoặc ứng dụng nhỏ. Thư viện hỗ trợ schema validation, type safety, và tự động xử lý các thao tác xử lý file JSON.

## Cài đặt

```bash
npm install stored-data-object
```

## Quick Start

### Object đơn

```js
import SDO from 'stored-data-object';

// Định nghĩa schema
const settingsSchema = SDO.schema({
	theme: 'string',
	fontSize: 'number',
	notifications: 'boolean?',
});

// Tạo hoặc mở file
const settings = await SDO.create({
	file: './data/settings.json',
	schema: settingsSchema,
	default: { theme: 'dark', fontSize: 14 },
});

// Sử dụng
settings.data.theme = 'light';
await settings.write();

// Reload từ file
await settings.reload();

// Reset về mặc định
await settings.reset();
```

### Mảng objects

```js
const userSchema = SDO.schema({
	id: 'number',
	name: 'string',
	email: 'string',
	active: 'boolean',
});

// Định nghĩa schema cho mảng user
const usersSchema = SDO.schema({
	users: [userSchema], // Mảng các user objects
	lastUpdated: 'number',
});

const db = await SDO.create({
	file: './data/users.json',
	schema: usersSchema,
	default: { users: [], lastUpdated: Date.now() },
});

// Thêm user mới
db.data.users.push({
	id: 1,
	name: 'Alice',
	email: 'alice@example.com',
	active: true,
});
db.data.lastUpdated = Date.now();
await db.write();
```

### Nested objects

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

Định nghĩa schema cho type inference và validation. Trả về chính object schema (dùng cho TypeScript/JSDoc type inference).

**Tham số:**

- `schemaDef` — Object định nghĩa cấu trúc dữ liệu (xem phần Schema Types)

**Trả về:**

- Schema definition object (nguyên vẹn)

**Ví dụ:**

```js
const mySchema = SDO.schema({
	id: 'number',
	name: 'string',
	tags: ['string'], // Array of strings
});
```

---

### `SDO.create(config, options?)`

Tạo hoặc mở một stored data object từ file JSON. Nếu file không tồn tại, sẽ tự động tạo với giá trị mặc định.

**Tham số `config`:**

- `file: string` — Đường dẫn tới file JSON (tương đối hoặc tuyệt đối)
- `schema: SchemaDefinition` — Schema định nghĩa cấu trúc dữ liệu
- `default?: any` — Giá trị khởi tạo khi file chưa tồn tại (nếu không cung cấp, sẽ dùng giá trị mặc định từ schema)

**Tham số `options` (tùy chọn):**

- `encoding?: BufferEncoding` — Encoding của file, mặc định `'utf8'`
- `autoValidate?: boolean` — Tự động validate dữ liệu, mặc định `true`

**Trả về:**

Promise resolve về object có các thuộc tính:

```typescript
{
  data: T,              // Dữ liệu typed theo schema
  filePath: string,     // Đường dẫn tuyệt đối tới file
  write(): Promise<void>,        // Ghi data xuống file
  reload(): Promise<void>,       // Đọc lại từ file
  reset(newDefault?: T): Promise<void>  // Reset về giá trị mặc định
}
```

**Ví dụ:**

```js
const store = await SDO.create({
	file: './data.json',
	schema: SDO.schema({ count: 'number' }),
	default: { count: 0 },
});
```

---

### `store.write()`

Ghi dữ liệu hiện tại xuống file. Nếu `autoValidate: true`, sẽ validate trước khi ghi.

**Trả về:** `Promise<void>`

**Throws:** Error nếu validation thất bại (khi `autoValidate: true`)

**Ví dụ:**

```js
store.data.count = 42;
await store.write();
```

---

### `store.reload()`

Đọc lại dữ liệu từ file và cập nhật `store.data` **in-place** (giữ nguyên tham chiếu object).

**Trả về:** `Promise<void>`

**Lưu ý:** Method này cập nhật object reference hiện tại thay vì tạo object mới, giúp các component khác đang giữ reference vẫn hoạt động đúng.

**Ví dụ:**

```js
const dataRef = store.data;
await store.reload();
console.log(dataRef === store.data); // true - cùng reference
```

---

### `store.reset(newDefault?)`

Reset dữ liệu về giá trị mặc định ban đầu (hoặc `newDefault` nếu được cung cấp) và ghi xuống file.

**Tham số:**

- `newDefault?: T` — Giá trị mới để reset (tùy chọn)

**Trả về:** `Promise<void>`

**Ví dụ:**

```js
// Reset về default ban đầu
await store.reset();

// Reset về giá trị mới
await store.reset({ count: 100 });
```

## Schema Types

Schema định nghĩa cấu trúc và kiểu dữ liệu. Mỗi property có thể là:

### Primitive Types

| Schema Type  | TypeScript Type        | Default Value | Mô tả            |
| ------------ | ---------------------- | ------------- | ---------------- |
| `'string'`   | `string`               | `''`          | Chuỗi bắt buộc   |
| `'string?'`  | `string \| undefined`  | `undefined`   | Chuỗi tùy chọn   |
| `'number'`   | `number`               | `0`           | Số bắt buộc      |
| `'number?'`  | `number \| undefined`  | `undefined`   | Số tùy chọn      |
| `'boolean'`  | `boolean`              | `false`       | Boolean bắt buộc |
| `'boolean?'` | `boolean \| undefined` | `undefined`   | Boolean tùy chọn |

### Array Types

Để định nghĩa array, sử dụng cú pháp `[itemSchema]`:

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

**Lưu ý:** Array schema phải là tuple với đúng 1 phần tử (item schema).

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

Khi `autoValidate: true` (mặc định), dữ liệu được validate trong các trường hợp:

1. **Khi khởi tạo** - Validate giá trị `default`
2. **Khi đọc file** - Validate dữ liệu từ file
3. **Trước khi ghi** - Validate `store.data` trước `write()`
4. **Khi reset** - Validate giá trị `newDefault`

### Validation Errors

Khi validation thất bại, error message sẽ chỉ rõ:

- Field nào bị lỗi
- Kiểu mong đợi vs kiểu thực tế
- Giá trị hiện tại (JSON)

**Ví dụ error:**

```
Field 'user.age' must be a number, got string: "25"
Field 'items[2].active' must be a boolean, got undefined
```

### Tắt Validation

Nếu muốn tắt validation (không khuyến nghị), set `autoValidate: false`:

```js
const store = await SDO.create(
	{
		file: './data.json',
		schema: mySchema,
	},
	{
		autoValidate: false, // Tắt validation
	}
);
```

## File Operations & Locking

### File Lock

Thư viện có cơ chế **in-process file locking** để đảm bảo các operations (write, reload, reset) không bị race condition trong cùng một Node.js process.

**Lưu ý:** Đây không phải inter-process lock. Nếu có nhiều processes cùng truy cập file, cần giải pháp khác (như database hoặc external locking mechanism).

### Auto-create File

Nếu file không tồn tại:

1. Tự động tạo thư mục cha (recursive)
2. Tạo file với giá trị `default` hoặc giá trị mặc định từ schema
3. Format JSON với indent (tab)

### Reference Preservation

Khi `reload()` hoặc `reset()`, dữ liệu được cập nhật **in-place** thay vì tạo object mới:

```js
const store = await SDO.create({
	file: './data.json',
	schema: SDO.schema({ count: 'number' }),
});

const ref1 = store.data;
await store.reload();
const ref2 = store.data;

console.log(ref1 === ref2); // true - cùng reference
```

Điều này quan trọng khi nhiều phần của ứng dụng giữ reference tới `store.data`.

## Error Handling

### Invalid JSON

Nếu file chứa JSON không hợp lệ:

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

Nếu dữ liệu không khớp schema (với `autoValidate: true`):

```js
try {
	await store.write();
} catch (error) {
	// Error: Data validation failed before write: Field 'age' must be a number, got string: "25"
}
```

### File Access Errors

Nếu không có quyền đọc/ghi file:

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

### 1. Sử dụng `SDO.schema()` cho Type Safety

```js
// Good ✓
const schema = SDO.schema({
	name: 'string',
	age: 'number',
});

// OK nhưng mất type inference
const schema = {
	name: 'string',
	age: 'number',
};
```

### 2. Luôn `await write()` sau khi thay đổi

```js
// Good ✓
store.data.count++;
await store.write();

// Bad ✗ - Thay đổi chưa được lưu
store.data.count++;
// ... code khác
```

### 3. Xử lý errors

```js
try {
	await store.write();
} catch (error) {
	console.error('Failed to save:', error.message);
	// Rollback hoặc retry
}
```

### 4. Sử dụng default values hợp lý

```js
const store = await SDO.create({
	file: './data.json',
	schema: SDO.schema({
		users: [{ id: 'number', name: 'string' }],
		settings: { theme: 'string' },
	}),
	default: {
		users: [], // Empty array sẵn sàng dùng
		settings: { theme: 'light' }, // Có giá trị mặc định
	},
});
```

### 5. Tránh mutations phức tạp

```js
// Good ✓ - Đơn giản, rõ ràng
store.data.count = 10;
await store.write();

// Risky ⚠ - Mutation sâu, khó track
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

- **Không phù hợp cho production apps** với traffic cao hoặc dữ liệu lớn
- **Không có inter-process locking** - Không an toàn khi nhiều processes cùng truy cập
- **Không có transactions** - Các thay đổi được apply ngay, không có rollback tự động
- **Không có indexing** - Tìm kiếm trong array là O(n)
- **Không có query language** - Phải dùng JavaScript để filter/find
- **File-based** - Performance phụ thuộc vào filesystem

Nếu cần các tính năng trên, hãy xem xét database thực (SQLite, PostgreSQL, MongoDB, etc.)

## TypeScript Support

Thư viện được viết với JSDoc và hỗ trợ đầy đủ type inference cho TypeScript:

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

// TypeScript biết chính xác types:
store.data.count; // number
store.data.name; // string
store.data.active; // boolean | undefined
```

## License

MIT
