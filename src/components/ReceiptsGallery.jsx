import React, { useEffect } from 'react';
import { formatKRW, parseAmount } from '../utils/format';
import Card from './Card';
import { useSerialNumbers } from '../hooks/useSerialNumbers';

const ReceiptsGallery = ({ expenses, onJumpToExpense, highlightId }) => {
  const serialMap = useSerialNumbers();
  const totalCount = expenses.length;

  // 파이프(|) 구분 다중 URL 확장 → 각 URL을 개별 카드로
  const expandedReceipts = React.useMemo(() => {
    const result = [];
    for (const e of expenses) {
      if (!e.receiptUrl) continue;
      const urls = e.receiptUrl.split('|').filter(Boolean);
      urls.forEach((url, idx) => {
        result.push({ ...e, _url: url, _idx: idx, _total: urls.length });
      });
    }
    return result;
  }, [expenses]);

  const receiptCount = expenses.filter(e => e.receiptUrl).length;

  useEffect(() => {
    if (highlightId) {
      const el = document.getElementById(`receipt-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-indigo-400', 'animate-pulse');
        setTimeout(() => el.classList.remove('animate-pulse'), 1000);
        setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-400'), 3000);
      }
    }
  }, [highlightId]);

  const ReceiptCard = ({ e }) => {
    const serialNum = serialMap[e.id];
    const imgUrl = e._url.includes("drive.google.com") && e._url.includes("id=")
      ? (() => { try { return `https://drive.google.com/thumbnail?id=${new URL(e._url).searchParams.get("id")}&sz=w800`; } catch { return e._url; } })()
      : e._url;

    return (
      <div id={`receipt-${e.id}`} className="border rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow transition-all duration-500">
        {/* Image Area */}
        <div
          className="aspect-video bg-gray-100 overflow-hidden relative group cursor-pointer"
          onClick={() => window.open(e._url, '_blank')}
        >
          <img
            src={imgUrl}
            alt={e.description || "receipt"}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(ev) => { if (!ev.target.src.includes("export=view")) ev.target.src = e._url; }}
          />
          {e._total > 1 && (
            <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {e._idx + 1}/{e._total}
            </span>
          )}
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="bg-black/50 text-white px-2 py-1 rounded text-sm">원본 보기</span>
          </div>
        </div>

        {/* Text Area */}
        <div
          className="p-3 text-base cursor-pointer hover:bg-blue-50 transition-colors"
          onClick={() => onJumpToExpense?.(e.id)}
          title="해당 내역으로 이동"
        >
          <div className="font-medium flex items-center justify-between">
            <span>
              {serialNum ? <span className="text-gray-500 mr-2 font-mono text-sm">#{serialNum}</span> : null}
              <span className="text-gray-800">{e.description || "영수증"}</span>
            </span>
          </div>
          <div className="text-gray-600 mt-1 text-sm">{e.date} · {e.category}</div>
          <div className="mt-1 font-bold text-gray-900">
            {formatKRW(parseAmount(e.amount))}
            <span className="font-normal text-gray-500 text-sm">({e.purchaser || "미지정"})</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <Card title={
        <div className="flex items-center gap-2">
          <span>{`영수증 갤러리 (${receiptCount}건 / 전체 지출 ${totalCount}건)`}</span>
          <a
            href="https://drive.google.com/drive/folders/1cNH_IBqRSsUyFPKtEB7ozmgs1S6imtFU"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1 font-normal"
          >
            📂 드라이브
          </a>
        </div>
      }>
        {expandedReceipts.length === 0 ? (
          <p className="text-base text-gray-500">등록된 영수증이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {expandedReceipts.map((e, i) => (
              <ReceiptCard key={`${e.id}-${e._idx}`} e={e} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ReceiptsGallery;
