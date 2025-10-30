; JSON syntax highlighting queries

; Strings
(string) @string

; Numbers
(number) @number

; Boolean literals
[
  "true"
  "false"
] @constant.builtin

; Null
[
  "null"
] @constant.builtin

; Punctuation
[
  "{"
  "}"
  "["
  "]"
  ","
  ":"
] @punctuation.delimiter

; Object keys
(pair
  key: (string) @property)

; Comments (for JSON with comments)
(comment) @comment
