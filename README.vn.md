# StoredDataObject

StoredDataObject là thư viện lưu trữ dữ liệu dạng JSON nhẹ, phù hợp cho prototype, demo, hoặc ứng dụng nhỏ. Tài liệu này chỉ mô tả **Quick Start**, **API** và **datatype** — các ví dụ chi tiết nằm trong `example/index.js`.

## Quick Start

Cài đặt:

```bash
npm install stored-data-object
```

Sử dụng cơ bản:

```js
import { StoredDataObject, defineSchema } from 'stored-data-object';

const userSchema = defineSchema({
	name: 'string',
	age: 'number?',
	active: 'boolean',
});

// Tạo hoặc mở file lưu mảng objects
const users = await StoredDataObject.from({
	file: './data/users.json',
	storageType: 'array',
	schema: userSchema,
});

users.data.push({ name: 'Alice', active: true });
await users.write();

// Reload dữ liệu từ file (giữ nguyên tham chiếu object)
await users.reload();

// Reset về giá trị mặc định (hoặc truyền newInitValue)
await users.reset();
```

Nếu cần khởi tạo file lần đầu với giá trị cụ thể, truyền `initValue` trong config:

```js
const settings = await StoredDataObject.from({
	file: './data/settings.json',
	storageType: 'object',
	schema: defineSchema({ theme: 'string', debug: 'boolean?' }),
	initValue: { theme: 'dark', debug: false },
});
```

Ví dụ chi tiết hơn: xem tại `example/index.js` trong repository.

## API

### `defineSchema(schemaDef)`

Khai báo schema để dùng cho inference/kiểm tra kiểu. Trả về chính `schemaDef` (dùng cho type inference khi dùng TypeScript/JSDoc).

**Tham số**

- `schemaDef` — object định nghĩa schema (xem phần Datatypes).

**Trả về**

- object `schemaDef` (nguyên vẹn).

---

### `StoredDataObject.from(config, options?)`

Tạo (hoặc mở) store từ file JSON. Hàm là `static async` và trả về một đối tượng chứa `data`, `filePath` và các method thao tác.

**Tham số `config` (object):**

- `file: string` — đường dẫn tới file JSON (file sẽ được tạo nếu không tồn tại).
- `storageType: 'object' | 'array'` — chế độ lưu trữ: một object đơn hoặc một mảng các object theo schema.
- `schema: SchemaDefinition` — schema định nghĩa dữ liệu.
- `initValue?` — (tuỳ chọn) giá trị khởi tạo khi file không tồn tại. Với `storageType: 'object'` truyền 1 object; với `'array'` truyền 1 mảng các object.

**Tham số `options` (tuỳ chọn):**

- `encoding?: BufferEncoding` — mặc định `'utf8'`.
- `autoValidate?: boolean` — mặc định `true`. Nếu `true` thì dữ liệu khởi tạo và dữ liệu đọc từ file sẽ được validate theo schema; nếu validation thất bại sẽ ném lỗi.

**Trả về:** một object có dạng (tóm tắt):

```js
{
  data,       // dữ liệu đã được load/khởi tạo
  filePath,   // đường dẫn tuyệt đối tới file
  async write(),   // ghi data hiện tại vào file (validate trước khi ghi nếu autoValidate = true)
  async reload(),  // đọc lại file và cập nhật dữ liệu hiện tại (giữ tham chiếu)
  async reset(newInitValue?) // reset về mặc định hoặc newInitValue và ghi ra file
}
```

**Hành vi quan trọng**

- Nếu file không tồn tại, thư viện sẽ tạo thư mục cha (recursive) và ghi file với giá trị `initValue` hoặc giá trị mặc định sinh từ schema.
- Mặc định `autoValidate` là `true`. Nếu bất kỳ giá trị nào không khớp schema, hàm sẽ ném lỗi với thông báo chi tiết.
- Thư viện có cơ chế _file lock_ nội bộ để đảm bảo các thao tác đọc/ghi/reload/reset được thực hiện tuần tự trong cùng một tiến trình (giảm race condition). Đây không phải cơ chế lock giữa các tiến trình khác nhau.
- Khi `reload()` hoặc `reset()` được gọi, dữ liệu hiện tại được cập nhật **tại chỗ** (mutate) để giữ nguyên tham chiếu cho code khác đang giữ tham chiếu tới `data` (ví dụ: UI, systems, v.v.).

## Datatypes / Schema

Schema định nghĩa bằng object; mỗi property có thể là một **loại cơ bản** hoặc một **nested schema**.

**Các giá trị kiểu property hợp lệ**

- `'string'` — chuỗi bắt buộc, nếu không có giá trị sẽ được khởi tạo thành `''`.
- `'string?'` — chuỗi tùy chọn (`string | undefined`).
- `'number'` — số bắt buộc, mặc định `0`.
- `'number?'` — số tùy chọn (`number | undefined`).
- `'boolean'` — boolean bắt buộc, mặc định `false`.
- `'boolean?'` — boolean tùy chọn (`boolean | undefined`).
- nested object — schema lồng nhau (các key con theo cùng cú pháp ở trên).

**Ví dụ schema hợp lệ**

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

**Mapping sang runtime types (tổng quan)**

- `string` → `string` (mặc định `''` nếu required và không có giá trị)
- `string?` → `string | undefined`
- `number` → `number` (mặc định `0`)
- `number?` → `number | undefined`
- `boolean` → `boolean` (mặc định `false`)
- `boolean?` → `boolean | undefined`
- nested object → object có các field tương ứng

**Ghi chú về giá trị mặc định**

- `createDefaultFromSchema` sẽ sinh giá trị mặc định cho các field **không optional** theo quy tắc trên. Các field optional sẽ không được set (giữ `undefined`) nếu không có giá trị khởi tạo.

## Lỗi & xử lý ngoại lệ

- Nếu file chứa JSON không hợp lệ, hàm đọc sẽ ném lỗi kèm thông báo `"Invalid JSON in file: <path>..."`.
- Nếu `autoValidate: true` và dữ liệu (từ `initValue` hoặc file) không khớp schema thì `from()` hoặc `write()` sẽ ném lỗi với thông báo chi tiết (chỉ rõ field và kiểu mong đợi).
- Với `storageType: 'array'`, khi validate bắt buộc dữ liệu đọc từ file phải là một mảng (nếu không sẽ ném lỗi).

## Ghi chú vận hành / giới hạn

- Cơ chế khóa file là cho mức tiến trình (in-process) — không đảm bảo an toàn cho nhiều tiến trình/instance cùng sửa file đồng thời.
- Thiết kế phù hợp cho dataset nhỏ/mức read-write vừa phải; không khuyến nghị cho ứng dụng production có nhu cầu concurrency cao hoặc dataset lớn.
- Các thông báo lỗi cố gắng rõ ràng để dễ debug (ví dụ nêu field nào sai kiểu và giá trị hiện tại).

## Ví dụ chi tiết

Các ví dụ đầy đủ (array handling, multi-instance sync, error cases, v.v.) nằm trong `example/index.js`.
