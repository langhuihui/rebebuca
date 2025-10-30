; JavaScript syntax highlighting queries

; Keywords
[
  "break"
  "case"
  "catch"
  "class"
  "const"
  "continue"
  "debugger"
  "default"
  "delete"
  "do"
  "else"
  "export"
  "extends"
  "finally"
  "for"
  "function"
  "if"
  "import"
  "in"
  "instanceof"
  "let"
  "new"
  "return"
  "super"
  "switch"
  "this"
  "throw"
  "try"
  "typeof"
  "var"
  "void"
  "while"
  "with"
  "yield"
] @keyword

; Built-in objects
[
  "Array"
  "Boolean"
  "Date"
  "Error"
  "Function"
  "Math"
  "Number"
  "Object"
  "RegExp"
  "String"
  "Symbol"
  "console"
  "JSON"
  "Promise"
  "Map"
  "Set"
  "WeakMap"
  "WeakSet"
] @type.builtin

; Built-in functions
[
  "parseInt"
  "parseFloat"
  "isNaN"
  "isFinite"
  "decodeURI"
  "decodeURIComponent"
  "encodeURI"
  "encodeURIComponent"
  "escape"
  "unescape"
  "eval"
  "setTimeout"
  "setInterval"
  "clearTimeout"
  "clearInterval"
] @function.builtin

; Function declarations
(function_declaration
  name: (identifier) @function)

; Method definitions
(method_definition
  name: (property_identifier) @method)

; Arrow functions
(arrow_function) @function

; Variable declarations
(variable_declaration
  (variable_declarator
    name: (identifier) @variable))

; Class declarations
(class_declaration
  name: (identifier) @type)

; Function calls
(call_expression
  function: (identifier) @function.call)

; Method calls
(call_expression
  function: (member_expression
    property: (property_identifier) @method.call))

; Strings
(string) @string
(template_string) @string

; Comments
(comment) @comment

; Numbers
(number) @number

; Boolean literals
[
  "true"
  "false"
] @constant.builtin

; Null and undefined
[
  "null"
  "undefined"
] @constant.builtin

; Operators
[
  "="
  "+"
  "-"
  "*"
  "/"
  "%"
  "**"
  "=="
  "!="
  "==="
  "!=="
  "<"
  ">"
  "<="
  ">="
  "&&"
  "||"
  "!"
  "&"
  "|"
  "^"
  "~"
  "<<"
  ">>"
  ">>>"
  "+="
  "-="
  "*="
  "/="
  "%="
  "**="
  "&="
  "|="
  "^="
  "<<="
  ">>="
  ">>>="
  "++"
  "--"
  "?"
  ":"
  "in"
  "instanceof"
  "typeof"
  "delete"
  "void"
] @operator

; Punctuation
[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
  ","
  ";"
  "."
  ".."
  "..."
] @punctuation.delimiter

; Template literals
(template_string
  (template_substitution
    (identifier) @variable))

; Regular expressions
(regex) @string.regex

; Imports
(import_statement
  source: (string) @string)

(export_statement
  source: (string) @string)
