import AnsiToHtml from "ansi-to-html";

// 创建 ANSI 到 HTML 转换器的工厂函数
export const createAnsiConverter = (isLight: boolean) =>
  new AnsiToHtml({
    fg: isLight ? "#000" : "#fff",
    bg: isLight ? "#fff" : "#000",
    newline: true,
    escapeXML: true,
    stream: false,
  });

// ANSI 转 HTML 转换函数
export const convertAnsiToHtml = (text: string, converter: any) => {
  return converter.toHtml(text);
};

// 默认转换器（深色主题）
const defaultConverter = new AnsiToHtml({
  fg: "#d4d4d4",
  bg: "#1e1e1e",
  newline: true,
  escapeXML: true,
  stream: false,
});

// 简单的 ANSI 转 HTML 函数
export const ansiToHtml = (text: string): string => {
  if (!text) return '';
  return defaultConverter.toHtml(text);
};