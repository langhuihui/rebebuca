; Bash syntax highlighting queries

; Keywords
[
  "if"
  "then"
  "else"
  "elif"
  "fi"
  "for"
  "while"
  "do"
  "done"
  "case"
  "esac"
  "function"
  "return"
  "break"
  "continue"
  "exit"
  "local"
  "readonly"
  "export"
  "declare"
  "typeset"
  "unset"
  "alias"
  "unalias"
  "source"
  "."
] @keyword

; Built-in commands
[
  "echo"
  "printf"
  "read"
  "cd"
  "pwd"
  "ls"
  "cat"
  "grep"
  "sed"
  "awk"
  "sort"
  "uniq"
  "wc"
  "head"
  "tail"
  "cut"
  "tr"
  "find"
  "xargs"
  "which"
  "whereis"
  "type"
  "command"
  "builtin"
  "eval"
  "exec"
  "shift"
  "set"
  "unset"
  "env"
  "export"
  "readonly"
  "declare"
  "typeset"
  "local"
  "return"
  "exit"
  "kill"
  "jobs"
  "fg"
  "bg"
  "wait"
  "trap"
  "umask"
  "ulimit"
] @function.builtin

; Variables
(variable_name) @variable
"$" @punctuation.special
"${" @punctuation.special
"}" @punctuation.special

; Strings
(string) @string
(raw_string) @string
(heredoc_body) @string

; Comments
(comment) @comment

; Numbers
(number) @number

; Operators
[
  "="
  "=="
  "!="
  "<"
  ">"
  "<="
  ">="
  "&&"
  "||"
  "!"
  "+"
  "-"
  "*"
  "/"
  "%"
  "**"
  "++"
  "--"
  "+="
  "-="
  "*="
  "/="
  "%="
] @operator

; Punctuation
[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
  ";"
  ","
  "."
  ".."
  "..."
] @punctuation.delimiter

; Redirections
[
  ">"
  ">>"
  "<"
  "<<"
  ">&"
  "<&"
  "|"
  "|&"
] @operator

; Special characters
[
  "&"
  "~"
  "?"
  "*"
  "["
  "]"
  "\\"
] @punctuation.special
