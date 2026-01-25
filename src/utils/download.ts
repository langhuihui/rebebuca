/**
 * 文件下载工具函数
 */

/**
 * 下载文件
 * @param content 文件内容
 * @param filename 文件名
 * @param mimeType MIME 类型（可选）
 */
export function downloadFile(content: string, filename: string, mimeType?: string): void {
  // 创建 Blob 对象
  const blob = new Blob([content], { type: mimeType || 'application/octet-stream' });

  // 创建下载链接
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // 触发下载
  document.body.appendChild(link);
  link.click();

  // 清理
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 下载 JSON 文件
 * @param data JSON 数据
 * @param filename 文件名
 */
export function downloadJsonFile(data: any, filename: string): void {
  const content = JSON.stringify(data, null, 2);
  downloadFile(content, filename, 'application/json');
}

/**
 * 下载文本文件
 * @param text 文本内容
 * @param filename 文件名
 */
export function downloadTextFile(text: string, filename: string): void {
  downloadFile(text, filename, 'text/plain');
}

/**
 * 从 URL 下载文件
 * @param url 文件 URL
 * @param filename 文件名
 */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Failed to download file:', error);
    throw error;
  }
}
