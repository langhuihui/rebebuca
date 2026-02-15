/**
 * 编码器数据库服务
 * 加载和管理编码器配置数据
 */

import type { EncoderInfo, AudioEncoderInfo } from '../types/encoder';
import encodersData from '../data/encoders.json';

export class EncoderDatabase {
  private videoEncoders: Map<string, EncoderInfo> = new Map();
  private audioEncoders: Map<string, AudioEncoderInfo> = new Map();
  private containers: Map<string, any> = new Map();

  constructor() {
    this.loadEncoders();
  }

  /**
   * 加载编码器数据
   */
  private loadEncoders(): void {
    // 加载视频编码器（JSON 中 category 为 string，断言为 EncoderInfo）
    (encodersData.video as Array<EncoderInfo & { category?: string }>).forEach((encoder) => {
      this.videoEncoders.set(encoder.id, encoder as EncoderInfo);
    });

    // 加载音频编码器
    (encodersData.audio as Array<AudioEncoderInfo & { category?: string }>).forEach((encoder) => {
      this.audioEncoders.set(encoder.id, encoder as AudioEncoderInfo);
    });

    // 加载容器信息
    Object.entries(encodersData.containers).forEach(([key, value]) => {
      this.containers.set(key, value);
    });
  }

  /**
   * 获取所有视频编码器
   */
  getVideoEncoders(): EncoderInfo[] {
    return Array.from(this.videoEncoders.values());
  }

  /**
   * 根据类别获取视频编码器
   */
  getVideoEncodersByCategory(category: string): EncoderInfo[] {
    return this.getVideoEncoders().filter(
      encoder => encoder.category === category
    );
  }

  /**
   * 根据ID获取视频编码器
   */
  getVideoEncoder(id: string): EncoderInfo | undefined {
    return this.videoEncoders.get(id);
  }

  /**
   * 获取所有音频编码器
   */
  getAudioEncoders(): AudioEncoderInfo[] {
    return Array.from(this.audioEncoders.values());
  }

  /**
   * 根据类别获取音频编码器
   */
  getAudioEncodersByCategory(category: string): AudioEncoderInfo[] {
    return this.getAudioEncoders().filter(
      encoder => encoder.category === category
    );
  }

  /**
   * 根据ID获取音频编码器
   */
  getAudioEncoder(id: string): AudioEncoderInfo | undefined {
    return this.audioEncoders.get(id);
  }

  /**
   * 获取所有容器
   */
  getContainers(): string[] {
    return Array.from(this.containers.keys());
  }

  /**
   * 获取容器详情
   */
  getContainer(container: string): any {
    return this.containers.get(container);
  }

  /**
   * 获取容器支持的视频编码器
   */
  getSupportedVideoEncoders(container: string): EncoderInfo[] {
    const containerInfo = this.getContainer(container);
    if (!containerInfo || !containerInfo.videoEncoders) {
      return [];
    }

    return (containerInfo.videoEncoders as string[])
      .map((id: string) => this.getVideoEncoder(id))
      .filter((encoder): encoder is EncoderInfo => encoder !== undefined);
  }

  /**
   * 获取容器支持的音频编码器
   */
  getSupportedAudioEncoders(container: string): AudioEncoderInfo[] {
    const containerInfo = this.getContainer(container);
    if (!containerInfo || !containerInfo.audioEncoders) {
      return [];
    }

    return (containerInfo.audioEncoders as string[])
      .map((id: string) => this.getAudioEncoder(id))
      .filter((encoder): encoder is AudioEncoderInfo => encoder !== undefined);
  }

  /**
   * 检查视频编码器是否支持容器
   */
  isVideoEncoderSupported(encoderId: string, container: string): boolean {
    const supported = this.getSupportedVideoEncoders(container);
    return supported.some(encoder => encoder.id === encoderId);
  }

  /**
   * 检查音频编码器是否支持容器
   */
  isAudioEncoderSupported(encoderId: string, container: string): boolean {
    const supported = this.getSupportedAudioEncoders(container);
    return supported.some(encoder => encoder.id === encoderId);
  }

  /**
   * 获取编码器推荐设置
   */
  getRecommendedSettings(encoderId: string): any {
    const videoEncoder = this.getVideoEncoder(encoderId);
    const audioEncoder = this.getAudioEncoder(encoderId);

    return videoEncoder?.recommendedSettings || audioEncoder?.recommendedSettings || null;
  }
}

// 导出单例
export const encoderDatabase = new EncoderDatabase();
