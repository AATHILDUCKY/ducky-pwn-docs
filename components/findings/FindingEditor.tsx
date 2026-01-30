
import React, { useRef, useState } from 'react';
import { Bold, Italic, Code, Link, Table as TableIcon, ImageIcon, Video, PlusCircle, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Issue } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';

type ToolbarAction = 'bold' | 'italic' | 'code' | 'link' | 'table';

const EditorToolbar: React.FC<{
  onUpload: (type: 'image' | 'video') => void;
  onAction: (action: ToolbarAction) => void;
}> = ({ onUpload, onAction }) => (
  <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xl shadow-slate-200/50 z-[50] animate-in fade-in slide-in-from-bottom-1 duration-200">
    <button onClick={() => onAction('bold')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600" title="Bold"><Bold size={13} /></button>
    <button onClick={() => onAction('italic')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600" title="Italic"><Italic size={13} /></button>
    <button onClick={() => onAction('code')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600" title="Inline code"><Code size={13} /></button>
    <button onClick={() => onAction('link')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600" title="Link"><Link size={13} /></button>
    <button onClick={() => onAction('table')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600" title="Table"><TableIcon size={13} /></button>
    <div className="w-px h-4 bg-slate-200 mx-1.5"></div>
    <button onClick={() => onUpload('image')} className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-600 transition-colors" title="Insert image"><ImageIcon size={13} /></button>
    <button onClick={() => onUpload('video')} className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-600 transition-colors" title="Insert video"><Video size={13} /></button>
  </div>
);

export const FindingEditor: React.FC<{ 
  workingCopy: Issue; 
  onUpdate: (data: Issue) => void;
  onOpenUpload: (type: 'image' | 'video', targetField: string, selection?: { start: number; end: number }) => void;
}> = ({ workingCopy, onUpdate, onOpenUpload }) => {
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const selectionRef = useRef<Record<string, { start: number; end: number }>>({});
  const fieldRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const updateMainField = (key: keyof Issue, value: any) => onUpdate({ ...workingCopy, [key]: value });
  
  const updateCustomField = (id: string, key: 'label' | 'value', val: string) => {
    const fields = workingCopy.customFields.map(f => f.id === id ? { ...f, [key]: val } : f);
    onUpdate({ ...workingCopy, customFields: fields });
  };

  const rememberSelection = (fieldId: string, element: HTMLTextAreaElement | null) => {
    if (!element) return;
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    selectionRef.current[fieldId] = { start, end };
  };

  const setFieldRef = (fieldId: string) => (element: HTMLTextAreaElement | null) => {
    fieldRefs.current[fieldId] = element;
  };

  const resolveSelection = (fieldId: string) => {
    const existing = selectionRef.current[fieldId];
    if (existing) return existing;
    const fallback =
      fieldId === 'description'
        ? workingCopy.description || ''
        : workingCopy.customFields.find((field) => field.id === fieldId)?.value || '';
    const end = fallback.length;
    return { start: end, end };
  };

  const getFieldValue = (fieldId: string) =>
    fieldId === 'description'
      ? workingCopy.description || ''
      : workingCopy.customFields.find((field) => field.id === fieldId)?.value || '';

  const setFieldValue = (fieldId: string, value: string) => {
    if (fieldId === 'description') {
      updateMainField('description', value);
      return;
    }
    updateCustomField(fieldId, 'value', value);
  };

  const insertAtSelection = (
    text: string,
    insert: string,
    selection: { start: number; end: number }
  ) => {
    const safeText = text || '';
    const rawStart = selection.start ?? safeText.length;
    const rawEnd = selection.end ?? safeText.length;
    const start = Math.max(0, Math.min(rawStart, safeText.length));
    const end = Math.max(0, Math.min(rawEnd, safeText.length));
    const [from, to] = start <= end ? [start, end] : [end, start];
    const nextText = `${safeText.slice(0, from)}${insert}${safeText.slice(to)}`;
    return { nextText, start: from, end: from + insert.length };
  };

  const applySelection = (fieldId: string, start: number, end: number) => {
    selectionRef.current[fieldId] = { start, end };
    window.requestAnimationFrame(() => {
      const element = fieldRefs.current[fieldId];
      if (!element) return;
      element.focus();
      try {
        element.setSelectionRange(start, end);
      } catch {
        // ignore selection errors for unsupported inputs
      }
    });
  };

  const applyFormat = (fieldId: string, action: ToolbarAction) => {
    const current = getFieldValue(fieldId);
    const selection = resolveSelection(fieldId);
    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);
    const selected = current.slice(start, end);

    if (action === 'table') {
      const table = `\n\n| Column | Details |\n| --- | --- |\n| Value | Value |\n`;
      const { nextText, start: insertStart } = insertAtSelection(current, table, selection);
      setFieldValue(fieldId, nextText);
      applySelection(fieldId, insertStart + table.length, insertStart + table.length);
      return;
    }

    const wrap = (before: string, after: string, placeholder: string, selectUrl = false) => {
      const content = selected || placeholder;
      const insert = `${before}${content}${after}`;
      const { nextText, start: insertStart } = insertAtSelection(current, insert, selection);
      setFieldValue(fieldId, nextText);
      if (selectUrl && insert.includes('https://')) {
        const urlStart = insertStart + insert.indexOf('https://');
        applySelection(fieldId, urlStart, urlStart + 'https://example.com'.length);
      } else {
        const selectionStart = insertStart + before.length;
        applySelection(fieldId, selectionStart, selectionStart + content.length);
      }
    };

    if (action === 'bold') return wrap('**', '**', 'bold text');
    if (action === 'italic') return wrap('*', '*', 'italic text');
    if (action === 'code') return wrap('`', '`', 'code');
    if (action === 'link') return wrap('[', '](https://example.com)', 'link text', true);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const fields = [...workingCopy.customFields];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= fields.length) return;
    [fields[index], fields[target]] = [fields[target], fields[index]];
    onUpdate({ ...workingCopy, customFields: fields });
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Authoring Zone */}
      <div className="flex-1 overflow-y-auto bg-white border-r border-slate-100 p-6 sm:p-8 lg:p-14 relative custom-scrollbar no-scrollbar">
        <div className="max-w-3xl mx-auto space-y-12 sm:space-y-14">
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] px-1">Finding Identity</label>
            <input 
              type="text" 
              value={workingCopy.title} 
              onChange={(e) => updateMainField('title', e.target.value)} 
              className="w-full text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter p-1 border-none outline-none focus:ring-0 placeholder:text-slate-100 bg-transparent"
              placeholder="Finding Title..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 lg:gap-x-12 gap-y-8 sm:gap-y-10 border-y border-slate-50 py-10 sm:py-12">
            {[
              { id: 'severity', label: 'Severity' },
              { id: 'state', label: 'Status' },
              { id: 'cvssScore', label: 'CVSS Score' },
              { id: 'cvssVector', label: 'CVSS Vector' },
              { id: 'type', label: 'Domain' },
              { id: 'affected', label: 'Affected Asset' }
            ].map((f) => (
              <div key={f.id} className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{f.label}</label>
                {f.id === 'type' ? (
                  <select 
                    value={workingCopy.type} 
                    onChange={(e) => updateMainField('type', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none"
                  >
                    <option value="Internal">Internal</option>
                    <option value="External">External</option>
                  </select>
                ) : f.id === 'severity' ? (
                  <select
                    value={workingCopy.severity}
                    onChange={(e) => updateMainField('severity', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                    <option value="Info">Info</option>
                  </select>
                ) : f.id === 'state' ? (
                  <select
                    value={workingCopy.state}
                    onChange={(e) => updateMainField('state', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Fixed">Fixed</option>
                    <option value="Draft">Draft</option>
                    <option value="Published">Published</option>
                    <option value="QA">QA</option>
                    <option value="Closed">Closed</option>
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={(workingCopy as any)[f.id]} 
                    onChange={(e) => updateMainField(f.id as any, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 focus:bg-white transition-all shadow-sm outline-none"
                    placeholder={`Enter ${f.label}...`}
                  />
                )}
              </div>
            ))}
          </div>

            <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
              {focusedField === 'description' && (
                <EditorToolbar
                  onUpload={(type) => onOpenUpload(type, 'description', resolveSelection('description'))}
                  onAction={(action) => applyFormat('description', action)}
                />
              )}
            </div>
            <textarea 
              ref={setFieldRef('description')}
              value={workingCopy.description}
              onFocus={(e) => { setFocusedField('description'); rememberSelection('description', e.currentTarget); }}
              onClick={(e) => rememberSelection('description', e.currentTarget)}
              onSelect={(e) => rememberSelection('description', e.currentTarget)}
              onKeyUp={(e) => rememberSelection('description', e.currentTarget)}
              onChange={(e) => updateMainField('description', e.target.value)}
              className="w-full min-h-[260px] sm:min-h-[400px] text-[15px] sm:text-[16px] text-slate-800 leading-relaxed p-1 border-none outline-none focus:ring-0 placeholder:text-slate-100 bg-transparent resize-none font-medium"
              placeholder="Detail the vulnerability analysis..."
            />
          </div>

          <div className="space-y-10 pt-10 sm:pt-12 border-t border-slate-50 pb-24 sm:pb-32">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Tactical Intelligence Fields</label>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2">These will appear at the bottom of the final report</p>
              </div>
              <button 
                onClick={() => onUpdate({...workingCopy, customFields: [...workingCopy.customFields, { id: `cf-${Date.now()}`, label: 'New Attribute', value: '' }]})} 
                className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest transition-colors bg-indigo-50/50 px-4 py-2 rounded-xl"
              >
                <PlusCircle size={14} /> Add Tactical Field
              </button>
            </div>
            
            <div className="space-y-6">
              {workingCopy.customFields.map((cf, idx) => (
                <div key={cf.id} className="group bg-slate-50/50 border border-slate-100 rounded-3xl p-6 sm:p-8 hover:border-indigo-100 hover:bg-white transition-all shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveField(idx, 'up')} className="p-1 text-slate-300 hover:text-indigo-500"><ArrowUp size={12} /></button>
                        <button onClick={() => moveField(idx, 'down')} className="p-1 text-slate-300 hover:text-indigo-500"><ArrowDown size={12} /></button>
                      </div>
                      <div className="w-1.5 h-6 bg-slate-200 rounded-full mx-1"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attribute Segment {idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {focusedField === cf.id && (
                        <EditorToolbar
                          onUpload={(type) => onOpenUpload(type, cf.id, resolveSelection(cf.id))}
                          onAction={(action) => applyFormat(cf.id, action)}
                        />
                      )}
                      <button onClick={() => onUpdate({...workingCopy, customFields: workingCopy.customFields.filter(f => f.id !== cf.id)})} className="p-2 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 ml-2"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Field Heading</label>
                      <input 
                        type="text" value={cf.label} 
                        onChange={(e) => updateCustomField(cf.id, 'label', e.target.value)}
                        className="w-full bg-transparent border-none text-sm font-black text-slate-800 uppercase tracking-[0.2em] outline-none focus:text-indigo-700 placeholder:text-slate-200"
                        placeholder="Segment Heading..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Field Value (Markdown)</label>
                      <textarea 
                        ref={setFieldRef(cf.id)}
                        value={cf.value} 
                        onFocus={(e) => { setFocusedField(cf.id); rememberSelection(cf.id, e.currentTarget); }}
                        onClick={(e) => rememberSelection(cf.id, e.currentTarget)}
                        onSelect={(e) => rememberSelection(cf.id, e.currentTarget)}
                        onKeyUp={(e) => rememberSelection(cf.id, e.currentTarget)}
                        onChange={(e) => updateCustomField(cf.id, 'value', e.target.value)}
                        className="w-full bg-transparent border-none text-[15px] font-medium text-slate-800 outline-none resize-none min-h-[120px] leading-relaxed"
                        placeholder="Enter data or instructions..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview Console */}
      <div className="flex-1 bg-slate-50/50 overflow-y-auto custom-scrollbar no-scrollbar p-6 lg:p-12 border-l border-slate-100 hidden lg:block">
        <div className="max-w-xl mx-auto space-y-12">
          <div className="space-y-3">
            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.4em]">Live Intelligence Preview</span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-tight">{workingCopy.title || 'Draft Findings'}</h2>
          </div>
          <div className="space-y-16">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-indigo-50 pb-2">Description</h4>
              <MarkdownRenderer content={workingCopy.description} />
            </div>
            {workingCopy.customFields.map(cf => (
              <div key={cf.id} className="space-y-3">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{cf.label || 'Attribute Segment'}</h4>
                <div className="text-[14px] font-bold text-slate-800"><MarkdownRenderer content={cf.value} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
