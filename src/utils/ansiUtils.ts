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