# wsv

**wsv** is a lightweight, dependency-free and pretty robust stream strigifier for data with character separated values like `csv`, `tsv` and similar. It's versatile enough to produce most formats.
It's deliberately written in plain old JavaScript and can be used with any node version capable of `Stream.Transform`.

## Usage Example

```javascript
var fs = require("fs");
var wsv = require("wsv");

var data = [{
	"a": 1,
	"b": true,
	"c": "hello",
	"d": null,
},{
	"a": 2,
	"b": false,
	"c": "world"
	"e": "",
}];

var stringify = wsv({
	sep: 0x9,
	quote: 0x22,
	escape: "\\",
	empty: "",
	untab: true,
});

wsv.pipe(fs.createReadStream("file.tsv"));

data.forEach(function(record){ wsv.write(record); })

wsv.end();

```

## Options

wsv takes one argument, which is either a string or an object. In case of a string, it can eiter be the name of a preset (`csv`, `tsv` or `asv`) or will be interpreted as the separation character.

In case of an object, 

### `preset` (`<string>`)
* Identifier of a preset: `csv`, `tsv` or `asv`

### `sep` (`<string>`|`<Buffer>`|`<int>`)
* Delimiter
* Default: `,`

### `quote` (`<string>`|`<Buffer>`|`<int>`)
* Character to enclose a string containing a delimiter
* Default: `"`

### `startquote`  (`<string>`|`<Buffer>`|`<int>`)
* Alternative character to start a quoted string, in case the format requires different characters at start and end
* Default: Same as `quote` 
	
### `escape` (`<string>`|`<Buffer>`|`<int>`)
* Escape character
* Default: `\`

### `empty` (`<string>`|`<Buffer>`|`<int>`)
* Value for empty / nonexistant values
* Default: *(empty field, zero bytes, no quotes)*

### `header` (`<array(<string>,...)`)
* Array of header keys
* Default: `Object.keys` of first record

### `buffers` (`<boolean>`)
* Serialze Buffers as hexadecimal numbers (*`<Buffer aa bb cc>` → `0xaabbcc`*)
* Default: `true`

### `objects` (`<boolean>`)
* Serialize Objects as JSON strings
* Default: `true`

### `unbreak` (`<boolean>`)
* Replace ASCII breaks in strings with ANSI escape sequences (*`<LF>` → `\n`*, *`<CR>` → `\r`*, *`<VT>` → `\v`*, *`<FF>` → `\f`*)
* Default: `true`

### `untab` (`<boolean>`)
* Escape tab characters in strings with its ANSI escape seqence (*`<TAB>` → `\t`*)
* Default: `true`

## License

[UNLICENSE](UNLICENSE)

