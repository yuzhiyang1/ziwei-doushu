import Link from 'next/link';
import LocalDatasetPanel from '@/components/LocalDatasetPanel';
export default function DatasetsPage() {
 return <main className="local-shell"><nav className="local-toolbar"><Link href="/">← 研究室</Link><Link href="/chart">个人命盘与匹配 →</Link></nav><h1>公开数据 · 本地索引管理</h1><p>按需下载单年，在浏览器本地建立索引。无需账户、模型或上传出生信息。</p><LocalDatasetPanel/></main>;
}
