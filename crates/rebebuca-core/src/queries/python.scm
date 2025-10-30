; Python syntax highlighting queries

; Keywords
[
  "and"
  "as"
  "assert"
  "break"
  "class"
  "continue"
  "def"
  "del"
  "elif"
  "else"
  "except"
  "exec"
  "finally"
  "for"
  "from"
  "global"
  "if"
  "import"
  "in"
  "is"
  "lambda"
  "not"
  "or"
  "pass"
  "print"
  "raise"
  "return"
  "try"
  "while"
  "with"
  "yield"
] @keyword

; Built-in functions
[
  "abs"
  "all"
  "any"
  "bin"
  "bool"
  "chr"
  "dict"
  "dir"
  "divmod"
  "enumerate"
  "eval"
  "exec"
  "filter"
  "float"
  "format"
  "frozenset"
  "getattr"
  "hasattr"
  "hash"
  "help"
  "hex"
  "id"
  "input"
  "int"
  "isinstance"
  "issubclass"
  "iter"
  "len"
  "list"
  "locals"
  "map"
  "max"
  "min"
  "next"
  "object"
  "oct"
  "open"
  "ord"
  "pow"
  "print"
  "property"
  "range"
  "repr"
  "reversed"
  "round"
  "set"
  "setattr"
  "slice"
  "sorted"
  "str"
  "sum"
  "super"
  "tuple"
  "type"
  "vars"
  "zip"
] @function.builtin

; Function definitions
(function_definition
  name: (identifier) @function)

; Class definitions
(class_definition
  name: (identifier) @type)

; Variable assignments
(assignment
  left: (identifier) @variable)

; Function calls
(call
  function: (identifier) @function.call)

; Attributes
(attribute
  attribute: (identifier) @property)

; Strings
(string) @string
(f_string) @string

; Comments
(comment) @comment

; Numbers
(integer) @number
(float) @number

; Boolean literals
[
  "True"
  "False"
  "None"
] @constant.builtin

; Operators
[
  "="
  "+"
  "-"
  "*"
  "/"
  "//"
  "%"
  "**"
  "=="
  "!="
  "<"
  ">"
  "<="
  ">="
  "and"
  "or"
  "not"
  "in"
  "is"
  "+="
  "-="
  "*="
  "/="
  "//="
  "%="
  "**="
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
  ":"
  "."
  ";"
] @punctuation.delimiter

; Decorators
(decorator) @decorator

; Imports
(import_statement
  module: (dotted_name) @namespace)

(from_import_statement
  module: (dotted_name) @namespace)

; Exception handling
(except_clause
  (identifier) @type)
