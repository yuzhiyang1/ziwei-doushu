'use client';
import { motion } from 'framer-motion';
import type { Palace, Star } from '@/lib/ziwei/types';
import { STEMS, BRANCHES } from '@/lib/ziwei/constants';
import clsx from 'clsx';

interface PalaceCellProps {
  palace: Palace;
  onClick?: () => void;
  onStarClick?: (star: Star) => void;
  isSelected?: boolean;
  isSanFang?: boolean;
  delay?: number;
  /** 叠加四化：星名 → 四化类型（'禄'/'权'/'科'/'忌'） */
  overlayStarSiHua?: Record<string, string>;
  /** 叠加标签：'年'（流年）或 '限'（大限） */
  overlayLabel?: string;
  /** 点击叠加四化 badge 回调 */
  onSiHuaClick?: (starName: string, siHua: string) => void;
}

const SIHUA_STYLES: Record<string, string> = {
  '禄': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  '权': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  '科': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  '忌': 'text-red-400 bg-red-500/10 border-red-500/30',
};

const SiHuaBadge = ({
  siHua,
  overlay,
  label,
  onClick,
}: {
  siHua: string;
  overlay?: boolean;
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
}) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center text-[9px] px-0.5 rounded border leading-tight py-px font-semibold flex-shrink-0',
        SIHUA_STYLES[siHua],
        overlay && 'border-dashed opacity-80',
        onClick && 'cursor-pointer hover:opacity-100',
      )}
      style={{ color: 'var(--t-text)' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${label ?? ''}化${siHua}，查看说明` : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); e.currentTarget.click(); } } : undefined}
    >
      {overlay && label && <span className="mr-px opacity-70">{label}</span>}
      {siHua}
    </span>
  );
};

export default function PalaceCell({
  palace, onClick, onStarClick, isSelected, isSanFang, delay = 0,
  overlayStarSiHua, overlayLabel, onSiHuaClick,
}: PalaceCellProps) {
  const { branch, stem, name, stars, daXianAge, isCurrentDaXian, isMingGong, isShenGong } = palace;
  const ganzhi = `${STEMS[stem]}${BRANCHES[branch]}`;

  const majorStars = stars.filter(s => s.type === 'major');
  const luckyStars = stars.filter(s => s.type === 'lucky');
  const shaStars = stars.filter(s => s.type === 'sha');

  return (
    <motion.div
      data-testid={`palace-cell-${branch}`}
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      onClick={onClick}
      className="relative flex min-w-0 flex-col p-1.5 cursor-pointer transition-colors duration-200 h-full"
      style={{
        minHeight: '142px',
        minWidth: 0,
        overflowWrap: 'anywhere',
        background: isSelected
          ? 'rgba(37,99,235,0.18)'
          : isCurrentDaXian
          ? 'rgba(147,51,234,0.08)'
          : isSanFang
          ? 'rgba(37,99,235,0.09)'
          : isMingGong
          ? 'rgba(212,168,67,0.04)'
          : 'var(--t-bg)',
        boxShadow: isSelected
          ? 'inset 0 0 0 1.5px rgba(37,99,235,0.7)'
          : isCurrentDaXian
          ? 'inset 3px 0 0 rgba(147,51,234,0.5)'
          : isSanFang
          ? 'inset 0 0 0 1px rgba(37,99,235,0.4)'
          : 'none',
      }}
    >
      {/* A real, non-nested button keeps each palace keyboard-accessible. */}
      <button
        type="button"
        aria-label={`选择${name.endsWith('宫') ? name : `${name}宫`}（${ganzhi}），查看三方四正`}
        aria-pressed={!!isSelected}
        onClick={e => { e.stopPropagation(); onClick?.(); }}
        className="palace-label-button flex w-full min-w-0 items-center flex-wrap gap-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
        style={{ border: 0, borderRadius: 3, padding: '0 0 3px', background: 'transparent', color: isMingGong ? 'var(--t-gold)' : 'var(--t-text)', fontSize: 11, fontWeight: 700, lineHeight: 1.4 }}
      >
        <span>{name}</span>
        {isMingGong && <span className="text-[9px] border rounded px-0.5 font-normal" style={{ color: 'var(--t-gold)' }}>命</span>}
        {isShenGong && <span className="text-[9px] border rounded px-0.5 font-normal" style={{ color: 'var(--t-text2)' }}>身</span>}
      </button>
      <div className="flex flex-wrap justify-between gap-x-1 gap-y-0.5 text-[9px] mb-1.5 leading-snug tabular-nums" style={{ color: 'var(--t-text2)' }}>
        <span>{ganzhi}</span>
        {daXianAge && <span title={`大限 ${daXianAge[0]}至${daXianAge[1]}岁`} style={{ color: isCurrentDaXian ? 'var(--t-gold)' : undefined }}>{daXianAge[0]}–{daXianAge[1]}岁</span>}
      </div>
      {palace.changsheng12 && <span className="text-[9px] mb-1 leading-snug" data-testid={`changsheng-${branch}`} style={{ color: 'var(--t-text2)' }}>长生十二神：{palace.changsheng12}</span>}

      {/* 主星 */}
      <div className="flex min-w-0 flex-col gap-1 flex-1">
        {majorStars.length === 0 && (
          <span className="text-[11px]" style={{ color: 'var(--t-text2)' }}>空宫</span>
        )}
        {majorStars.map((star) => {
          const overlaySiHua = overlayStarSiHua?.[star.name];
          return (
            <div
              key={star.name}
              className="flex min-w-0 flex-wrap items-center gap-x-0.5 gap-y-0.5"
            >
              <span
                role={onStarClick ? 'button' : undefined}
                tabIndex={onStarClick ? 0 : undefined}
                aria-label={onStarClick ? `查看${star.name}星曜说明` : undefined}
                onClick={onStarClick ? e => { e.stopPropagation(); onStarClick(star); } : undefined}
                onKeyDown={onStarClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onStarClick(star); } } : undefined}
                className="text-[12px] leading-snug font-semibold whitespace-nowrap focus-visible:outline focus-visible:outline-2"
                style={{ color: 'var(--t-gold)' }}
              >
                {star.name}
              </span>
              {star.brightnessRaw && <span className="text-[9px] leading-snug" style={{ color: 'var(--t-text2)' }} title={`${star.name}亮度：${star.brightnessRaw}`}>{star.brightnessRaw}</span>}
              {star.siHua && <SiHuaBadge siHua={star.siHua} />}
              {overlaySiHua && (
                <SiHuaBadge
                  siHua={overlaySiHua}
                  overlay
                  label={overlayLabel}
                  onClick={onSiHuaClick ? e => {
                    e.stopPropagation();
                    onSiHuaClick(star.name, overlaySiHua);
                  } : undefined}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 吉星 */}
      {luckyStars.length > 0 && (
        <div className="flex min-w-0 flex-wrap gap-x-1 gap-y-0.5 mt-1.5">
          {luckyStars.map(s => {
            const overlaySiHua = overlayStarSiHua?.[s.name];
            return (
              <span key={s.name} className="inline-flex min-w-0 flex-wrap items-center gap-0.5 text-[10px] leading-snug" style={{ color: 'var(--t-text2)' }}>
                {s.name}
                {s.siHua && <SiHuaBadge siHua={s.siHua} />}
                {overlaySiHua && (
                  <SiHuaBadge
                    siHua={overlaySiHua}
                    overlay
                    label={overlayLabel}
                    onClick={onSiHuaClick ? e => {
                      e.stopPropagation();
                      onSiHuaClick(s.name, overlaySiHua);
                    } : undefined}
                  />
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* 煞星 */}
      {shaStars.length > 0 && (
        <div className="flex min-w-0 flex-wrap gap-x-1 gap-y-0.5 mt-1">
          {shaStars.map(s => (
            <span key={s.name} className="text-[10px] leading-snug" style={{ color: 'var(--t-text2)' }}>
              {s.name}{s.siHua && <SiHuaBadge siHua={s.siHua} />}
            </span>
          ))}
        </div>
      )}

    </motion.div>
  );
}
