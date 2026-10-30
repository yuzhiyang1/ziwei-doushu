/**
 * 古籍原典查询库 — 类型定义
 *
 * 设计：仓库整理摘编静态打包；含现代转述、待校勘，不能由古籍书名推断逐段来源或授权
 * Next.js 启动时一次性加载到内存，零 DB 依赖
 */

export interface Paragraph {
  /** 段落唯一 id（用于锚点跳转） */
  id: string;
  /** 段落序号（章节内） */
  idx: number;
  /** 仓库摘编文本（未逐段校勘，不保证古文原文） */
  text: string;
  /** 现代翻译（可选，未来填充） */
  translation?: string;
  /** 课程引文（仅有可核查出处时填写，不得自行归于倪师） */
  niNote?: string;
}

export interface Chapter {
  /** 章节标题（如"卷一"、"总论篇"）*/
  title: string;
  /** 章节副标题/简介（可选）*/
  subtitle?: string;
  paragraphs: Paragraph[];
}

export interface Book {
  /** 书名 */
  title: string;
  /** 书 slug（URL 用，如 'guisuifu'）*/
  slug: string;
  /** 朝代 */
  dynasty: string;
  /** 作者（多人或不详时填"不详"或多人）*/
  author: string;
  /** 简介 */
  intro: string;
  /** 上游原书估算字数（不可当作实际收录字数）*/
  wordCount: number;
  chapters: Chapter[];
}

export interface SearchHit {
  bookSlug: string;
  bookTitle: string;
  chapterTitle: string;
  paragraphId: string;
  /** 高亮片段（含 <mark> 标签） */
  snippet: string;
  /** 原文 */
  text: string;
}
