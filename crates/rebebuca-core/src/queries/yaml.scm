; YAML syntax highlighting queries

; Strings
(string_scalar) @string
(double_quoted_scalar) @string
(single_quoted_scalar) @string

; Numbers
(integer_scalar) @number
(float_scalar) @number

; Boolean literals
[
  "true"
  "false"
  "True"
  "False"
  "TRUE"
  "FALSE"
  "yes"
  "no"
  "Yes"
  "No"
  "YES"
  "NO"
  "on"
  "off"
  "On"
  "Off"
  "ON"
  "OFF"
] @constant.builtin

; Null
[
  "null"
  "Null"
  "NULL"
  "~"
] @constant.builtin

; Keys
(mapping
  (block_mapping_pair
    key: (block_scalar) @property))

(flow_mapping
  (flow_mapping_pair
    key: (flow_scalar) @property))

; Punctuation
[
  ":"
  "-"
  "?"
  "|"
  ">"
  "&"
  "*"
  "!"
  "%"
  "@"
  "`"
] @punctuation.delimiter

; Comments
(comment) @comment

; Directives
(directive) @keyword

; Tags
(tag) @type

; Anchors and aliases
(anchor) @label
(alias) @label
