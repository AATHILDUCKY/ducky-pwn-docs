import React, { useEffect, useState } from 'react';
import { ChevronLeft, Mail, Clock, Inbox } from 'lucide-react';
import { fetchEmailHistory, EmailHistoryEntry } from '../services/historyService';
import { notify } from '../utils/notify';

type HistoryPageProps = {
  onBack: () => void;
};

const PAGE_SIZE = 10;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const HistoryPage: React.FC<HistoryPageProps> = ({ onBack }) => {
  const [remembered, setRemembered] = useState<EmailHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadPage = async (nextOffset: number) => {
    setIsLoading(true);
    try {
      const data = await fetchEmailHistory({ limit: PAGE_SIZE, offset: nextOffset });
      setRemembered((prev) => [...prev, ...data]);
      setOffset(nextOffset);
      setHasMore(data.length === PAGE_SIZE);
    } catch (error) {
      console.error('Failed to load history', error);
      notify('Failed to load mail history.');
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage(0);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight">Mail History</h2>
          <p className="text-slate-500 font-medium text-sm">Latest report emails sent from this workstation.</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
        >
          <ChevronLeft size={14} />
          Back
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        {remembered.length === 0 && !isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50/60">
            <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-300">
              <Inbox size={28} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              No emails sent yet
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] sm:max-h-[520px] overflow-y-auto custom-scrollbar divide-y divide-slate-100">
            {remembered.map((entry) => (
              <div key={entry.id} className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Mail size={18} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">
                      {entry.issue_title ? 'Issue Report' : 'Project Report'}
                    </p>
                    <p className="text-sm font-bold text-slate-700">{entry.subject || 'Report Email'}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      To: {entry.recipient} · Format: {entry.format || 'pdf'}
                    </p>
                    {entry.project_name && (
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Project: {entry.project_name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <Clock size={12} />
                  {formatDate(entry.sent_at)}
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="p-6 text-center">
                <button
                  onClick={() => loadPage(offset + PAGE_SIZE)}
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-white transition-all"
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
