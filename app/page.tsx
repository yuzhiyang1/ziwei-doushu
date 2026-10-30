import Link from 'next/link';
export default function Home() {
  return <main className="local-shell"><p className="local-kicker">PERSONAL · LOCAL FIRST</p><h1>紫微 · 个人研究室</h1><p>不需要注册、订阅或业务后端。排盘与规则解读在浏览器运行，档案由你保管。</p><div className="local-grid">{[
    ['/chart','排盘与本地档案','六层时间、十三维规则解读、相似盘、报告及 PNG'],
    ['/heming','双人合盘','两张盘的结构对照，不把相似度解释成关系概率'],
    ['/library','古籍摘编研读','3本待校勘摘编、搜索与本地笔记'],
    ['/datasets','公开数据集','按年下载、本地流式索引、精确读取公开十三维原文'],
    ['/study','三纪研读','公开仓库的学习提要和判语索引'],
  ].map(([href,title,description])=><Link className="local-card" href={href} key={href}><h2>{title} →</h2><p>{description}</p></Link>)}</div><aside className="local-card"><h2>边界与隐私</h2><p>这是基于 MIT 开源引擎的独立个人版，不是官网专业版解锁器，不含未公开断语库、专属课程或官方 AI 提示词。传统命理仅供文化研究，不用于医疗、投资或关系决策。</p><p>本地档案不是云备份。请定期导出，清除浏览器数据会丢失记录。AI 仅在你配置模型并同意发送时联网，服务商可能收费。</p></aside></main>;
}
