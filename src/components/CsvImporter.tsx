import React, { useState, useRef } from 'react';
import { Upload, FileCode, CheckCircle, AlertCircle, Eye, CornerDownLeft, EyeOff } from 'lucide-react';
import { LoginItem, VaultItem } from '../types';

interface CsvImporterProps {
  onImportCompleted: (importedItems: VaultItem[]) => void;
  onCancel: () => void;
}

export default function CsvImporter({ onImportCompleted, onCancel }: CsvImporterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [parsedItems, setParsedItems] = useState<Partial<LoginItem>[]>([]);
  const [showPasswordIndex, setShowPasswordIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Robust CSV parser that handles quoted cells correctly
  const parseRawCSV = (text: string): string[][] => {
    const lines = text.split(/\r\n|\n/);
    const result: string[][] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const row: string[] = [];
      let inQuotes = false;
      let currentVal = '';
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(currentVal.replace(/^"|"$/g, '').trim()); // Strip wrapping quotes
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      row.push(currentVal.replace(/^"|"$/g, '').trim());
      result.push(row);
    }
    return result;
  };

  const processCSVFile = (text: string) => {
    try {
      setError('');
      setSuccess('');
      setParsedItems([]);

      const dataset = parseRawCSV(text);
      if (dataset.length < 2) {
        throw new Error('فایل CSV خالی است یا معتبر نمی‌باشد.');
      }

      const headers = dataset[0].map(h => h.toLowerCase().trim());
      
      // Map columns
      const nameIdx = headers.findIndex(h => h.includes('title') || h.includes('name') || h === 'title');
      const userIdx = headers.findIndex(h => h.includes('user') || h === 'login_username' || h === 'username');
      const passIdx = headers.findIndex(h => h.includes('pass') || h === 'login_password' || h === 'password');
      const urlIdx = headers.findIndex(h => h.includes('url') || h.includes('uri') || h === 'website' || h === 'link');
      const notesIdx = headers.findIndex(h => h.includes('note') || h === 'login_notes');
      const totpIdx = headers.findIndex(h => h.includes('totp') || h.includes('secret') || h === 'login_totp');

      if (nameIdx === -1 && passIdx === -1) {
        throw new Error('قالب فایل نامعتبر است. ستون‌های اساسی مانند نام (Title/Name) یا کلمه‌عبور (Password) یافت نشدند.');
      }

      const items: Partial<LoginItem>[] = [];
      for (let i = 1; i < dataset.length; i++) {
        const row = dataset[i];
        if (row.length < Math.max(nameIdx, userIdx, passIdx, urlIdx)) continue;

        const title = nameIdx !== -1 ? row[nameIdx] : 'مورد وارد شده بدون نام';
        const username = userIdx !== -1 ? row[userIdx] : '';
        const password = passIdx !== -1 ? row[passIdx] : '';
        const url = urlIdx !== -1 ? row[urlIdx] : '';
        const notes = notesIdx !== -1 ? row[notesIdx] : '';
        const totpSecret = totpIdx !== -1 ? row[totpIdx] : '';

        // Skip rows that are completely blank
        if (!title && !username && !password) continue;

        items.push({
          id: `csv-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'login',
          title: title || 'رمز عبور وارد شده',
          username,
          password,
          url,
          notes,
          totpSecret,
          favorite: false,
          tags: ['CSV'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      if (items.length === 0) {
        throw new Error('هیچ رمزی در این فایل برای وارد کردن پیدا نشد.');
      }

      setParsedItems(items);
      setSuccess(`فایل با موفقیت بررسی شد. تعداد ${items.length} رمز عبور شناسایی گردید.`);
    } catch (err: any) {
      setError(err?.message || 'خطا در بارگذاری فایل CSV. لطفاً ساختار فایل را بررسی کنید.');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            processCSVFile(event.target.result as string);
          }
        };
        reader.readAsText(file);
      } else {
        setError('تنها وارد کردن فایل‌های با فرمت .csv پشتیبانی می‌شود.');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          processCSVFile(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const finalizeImport = () => {
    if (parsedItems.length === 0) return;
    onImportCompleted(parsedItems as VaultItem[]);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl max-w-2xl mx-auto" dir="rtl">
      
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-white text-md flex items-center gap-2 font-heading">
          <Upload className="w-5 h-5 text-white animate-pulse" />
          <span>وارد کردن لیست رمز عبور قدیمی (CSV) • Import CSV</span>
        </h3>
        <button
          onClick={onCancel}
          className="text-xs text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-neutral-850 border border-neutral-850 transition cursor-pointer"
        >
          خروج و انصراف
        </button>
      </div>

      {!parsedItems.length ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer transition ${
            dragActive 
              ? 'border-white bg-neutral-850' 
              : 'border-neutral-800 bg-neutral-950 hover:border-neutral-600 hover:bg-neutral-850/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleChange}
            className="hidden"
          />
          <FileCode className="w-14 h-14 text-neutral-700 mb-4" />
          <p className="text-sm font-semibold text-neutral-300">
            فایل CSV خود را به اینجا بکشید یا برای انتخاب کلیک کنید.
          </p>
          <p className="text-xs text-neutral-500 mt-2">
            فرمت‌های استاندارد مرورگر کروم، بیت‌واردن و وان‌پسورد کاملاً شناسایی و تفکیک می‌شوند.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Output Preview */}
          <div className="flex items-center justify-between p-3.5 bg-neutral-950 border border-neutral-800 rounded-lg">
            <div className="flex items-center gap-2 text-neutral-300 text-xs font-semibold">
              <CheckCircle className="w-5 h-5 shrink-0 text-white" />
              <span>{success}</span>
            </div>
            <button
              onClick={() => setParsedItems([])}
              className="text-xs text-neutral-400 hover:text-white hover:underline px-2.5 py-1"
            >
              حذف و انتخاب مجدد
            </button>
          </div>

          <div className="border border-neutral-800 bg-neutral-950 rounded-lg overflow-y-auto max-h-60">
            <table className="w-full text-xs text-right">
              <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 font-bold sticky top-0">
                <tr>
                  <th className="p-3">عنوان سایت / پنل</th>
                  <th className="p-3">نام کاربری</th>
                  <th className="p-3">رمز عبور</th>
                  <th className="p-3">آدرس URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {parsedItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-neutral-850/40 text-neutral-300">
                    <td className="p-3 font-semibold">{item.title}</td>
                    <td className="p-3 font-mono">{item.username || <span className="text-neutral-600">-</span>}</td>
                    <td className="p-3 font-mono">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowPasswordIndex(showPasswordIndex === idx ? null : idx)}
                          className="text-neutral-500 hover:text-white transition"
                        >
                          {showPasswordIndex === idx ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <span>{showPasswordIndex === idx ? item.password : '••••••••'}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-neutral-500 text-[11px] truncate max-w-[150px]">{item.url || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 bg-neutral-950 border border-neutral-850 rounded-lg text-xs text-neutral-300">
            با کلیک بر روی تأیید، این داده‌ها با استفاده از الگوریتم مستحکم رمزنگاری محلی <strong className="font-bold underline text-white">PBKDF2 / AES-GCM</strong> روی مرورگر شما قفل بازنشانی شده و افزوده خواهند شد.
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={finalizeImport}
              className="flex-1 py-3 bg-white hover:bg-neutral-200 text-neutral-950 font-bold text-xs rounded-lg transition cursor-pointer"
            >
              افزودن و همگام‌سازی موارد تایید شده ({parsedItems.length} مورد)
            </button>
            <button
              onClick={() => setParsedItems([])}
              className="py-3 px-5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 font-bold text-xs rounded-lg transition cursor-pointer"
            >
              پاک کردن
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-neutral-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
