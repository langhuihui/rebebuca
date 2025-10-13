#!/bin/bash
# 测试脚本 - 生成 stdout 和 stderr 输出

echo "这是正常输出到 stdout"
echo "这是错误输出到 stderr" >&2
echo "再次输出到 stdout"
sleep 1
echo "另一个错误输出" >&2
echo "最后的正常输出"

