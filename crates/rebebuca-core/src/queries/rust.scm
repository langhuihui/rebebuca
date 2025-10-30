; Rust syntax highlighting queries

; Keywords
[
  "as"
  "async"
  "await"
  "break"
  "const"
  "continue"
  "crate"
  "dyn"
  "else"
  "enum"
  "extern"
  "false"
  "fn"
  "for"
  "if"
  "impl"
  "in"
  "let"
  "loop"
  "match"
  "mod"
  "move"
  "mut"
  "pub"
  "ref"
  "return"
  "self"
  "Self"
  "static"
  "struct"
  "super"
  "trait"
  "true"
  "type"
  "union"
  "unsafe"
  "use"
  "where"
  "while"
] @keyword

; Built-in types
[
  "i8"
  "i16"
  "i32"
  "i64"
  "i128"
  "isize"
  "u8"
  "u16"
  "u32"
  "u64"
  "u128"
  "usize"
  "f32"
  "f64"
  "bool"
  "char"
  "str"
  "String"
  "Vec"
  "Option"
  "Result"
  "Box"
  "Rc"
  "Arc"
  "RefCell"
  "Mutex"
  "RwLock"
] @type.builtin

; Function definitions
(function_item
  name: (identifier) @function)

; Method definitions
(impl_item
  body: (declaration_list
    (function_item
      name: (identifier) @method)))

; Struct definitions
(struct_item
  name: (type_identifier) @type)

; Enum definitions
(enum_item
  name: (type_identifier) @type)

; Trait definitions
(trait_item
  name: (type_identifier) @type)

; Type aliases
(type_item
  name: (type_identifier) @type)

; Variable bindings
(let_declaration
  pattern: (identifier) @variable)

; Function calls
(call_expression
  function: (identifier) @function.call)

; Method calls
(call_expression
  function: (field_expression
    field: (field_identifier) @method.call))

; Strings
(string_literal) @string
(raw_string_literal) @string

; Comments
(line_comment) @comment
(block_comment) @comment

; Numbers
(integer_literal) @number
(float_literal) @number

; Boolean literals
[
  "true"
  "false"
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
  "+="
  "-="
  "*="
  "/="
  "%="
  "&="
  "|="
  "^="
  "<<="
  ">>="
  "++"
  "--"
  "?"
  ":"
  "::"
  "->"
  "=>"
  ".."
  "..."
  "..="
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

; Lifetimes
(lifetime) @label

; Attributes
(attribute) @attribute
(inner_attribute) @attribute

; Macros
(macro_invocation
  macro: (identifier) @function.macro)

; Generics
(type_arguments
  (type) @type)

; Imports
(use_declaration
  (scoped_use_list
    (crate) @namespace))

; Modules
(mod_item
  name: (identifier) @namespace)
