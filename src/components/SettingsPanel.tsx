import React, { useState } from 'react';
import { ShieldAlert, Download, KeyRound, Trash2, RefreshCw, Chrome, Cloud } from 'lucide-react';
import { UserSettings, VaultState } from '../types';

interface SettingsPanelProps {
  settings: UserSettings;
  vaultState: VaultState;
  onUpdateSettings: (s: UserSettings) => void;
  onChangeMasterPassword: (oldPass: string, newPass: string) => Promise<boolean>;
  onClearAllData: () => void;
  gdriveToken: string | null;
  onConnectGDrive: () => void;
  onDisconnectGDrive: () => void;
  onTriggerCsvImport: () => void;
  onSyncManual: () => void;
  isSyncing: boolean;
}

export default function SettingsPanel({
  settings,
  vaultState,
  onUpdateSettings,
  onChangeMasterPassword,
  onClearAllData,
  gdriveToken,
  onConnectGDrive,
  onDisconnectGDrive,
  onTriggerCsvImport,
  onSyncManual,
  isSyncing
}: SettingsPanelProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [customClientId, setCustomClientId] = useState(settings.googleClientId || '');
  const [showInstructions, setShowInstructions] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 8) {
      setPwError('رمز عبور مستر جدید باید حداقل دارای ۸ کاراکتر باشد.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwError('رمزهای جدید با هم تطابق ندارند.');
      return;
    }

    try {
      const success = await onChangeMasterPassword(oldPassword, newPassword);
      if (success) {
        setPwSuccess('رمز عبور مستر با موفقیت تغییر یافت و اطلاعات گاوصندوق مجدداً با کلید جدید رمزگذاری شد.');
        setOldPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPwError('رمز عبور فعلی نامعتبر است.');
      }
    } catch (err: any) {
      setPwError(err?.message || 'خطا در اعمال رمز جدید.');
    }
  };

  const handleSaveClientId = () => {
    onUpdateSettings({
      ...settings,
      googleClientId: customClientId.trim() || undefined
    });
    alert('نشانه Client ID گوگل با موفقیت ذخیره شد.');
  };

  const downloadEncryptedJson = () => {
    const rawPayload = localStorage.getItem('vault_payload');
    if (!rawPayload) return;
    
    const blob = new Blob([rawPayload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passwords-encrypted-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadDecryptedCsv = () => {
    const confirmBackup = window.confirm(
      'آیا مطمئن هستید؟ یک فایل CSV فاقد هرگونه چترک امنیتی و قفل رمزارزی بوده و به راحتی توسط هرکسی قابل مشاهده است. توصیه می‌شود تنها بر روی سیستم بسیار امن اقدام به دانلود این فایل کنید.'
    );
    if (!confirmBackup) return;

    // Create CSV columns
    let csvContent = '\ufeff'; // BOM for Excel Persian UTF-8
    csvContent += 'Title,Username,Password,URL,Notes,Type,Tags\n';

    vaultState.items.forEach((item) => {
      const title = `"${(item.title || '').replace(/"/g, '""')}"`;
      const tags = `"${(item.tags || []).join(';')}"`;
      const notes = `"${(item.notes || '').replace(/"/g, '""')}"`;
      
      let username = '';
      let password = '';
      let url = '';
      let typeText: string = item.type;

      if (item.type === 'login') {
        username = `"${(item.username || '').replace(/"/g, '""')}"`;
        password = `"${(item.password || '').replace(/"/g, '""')}"`;
        url = `"${(item.url || '').replace(/"/g, '""')}"`;
        typeText = 'Login';
      } else if (item.type === 'card') {
        username = `"${(item.cardholder || '').replace(/"/g, '""')}"`;
        password = `"${(item.number || '').replace(/"/g, '""')}"`;
        typeText = 'Card';
      } else if (item.type === 'note') {
        typeText = 'Secure Note';
      }

      csvContent += `${title},${username},${password},${url},${notes},${typeText},${tags}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-passwords-decrypted-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto" dir="rtl">
      
      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Google Drive Cloud Synced Panel */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Cloud className={`w-5.5 h-5.5 ${gdriveToken ? 'text-white' : 'text-neutral-500'}`} />
              <h4 className="font-bold text-white text-sm font-heading">همگام‌سازی ابری گوگل‌درایو • Cloud Sync</h4>
            </div>
            <p className="text-xs text-neutral-400 leading-5 mb-4">
              با فعالسازی این گزینه، گاوصندوق رمز عبور شما ابتدا با کلید رمز مستر در مرورگر کاملاً قفل‌گذاری شده و سپس فایل کاملاً رمز شده روی فضای ابری گوگل‌درایو اختصاصی شما همگام‌سازی می‌گردد تا در تمامی دستگاه‌ها قابل‌دسترس باشد.
            </p>

            {/* Connection Status */}
            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-850 mb-4 flex items-center justify-between text-xs">
              <span className="text-neutral-400">وضعیت اتصال:</span>
              {gdriveToken ? (
                <span className="text-white font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  متصل به گوگل درایو 🟢
                </span>
              ) : (
                <span className="text-neutral-500 font-bold">قطع اتصال ⚪</span>
              )}
            </div>

            {/* Client ID Customization */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-neutral-400">شناسه OAuth Client ID گوگل</label>
                <button
                  type="button"
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="text-[10px] text-neutral-300 hover:text-white hover:underline transition cursor-pointer"
                >
                  راهنمای دریافت شناسه گوگل 💡
                </button>
              </div>
              <input
                type="text"
                value={customClientId}
                onChange={(e) => setCustomClientId(e.target.value)}
                placeholder="Google Client ID اختیاری خود را وارد کنید..."
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs font-mono outline-none text-white placeholder:text-neutral-750 focus:ring-0"
              />
              <button
                type="button"
                onClick={handleSaveClientId}
                className="w-full py-2 bg-neutral-955 hover:bg-neutral-850 border border-neutral-800 font-bold text-[11px] rounded-lg text-neutral-300 transition cursor-pointer"
              >
                بروزرسانی Client ID
              </button>
            </div>

            {showInstructions && (
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg mb-4 text-[11px] text-neutral-400 space-y-2 leading-4">
                <p className="font-bold text-white">مراحل ۳ دقیقه‌ای دریافت شناسه شخصی گوگل:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>به Console.cloud.google.com مراجعه کنید و یک پروژه بسازید.</li>
                  <li>در بخش Credentials، یک کلاینت جدید از نوع Web Application بسازید.</li>
                  <li>آدرس وب کنونی برنامه را به عنوان <b className="text-white">Authorized Redirect URIs</b> ثبت کنید:
                    <div className="font-mono bg-neutral-900 p-1.5 rounded-md mt-1 mb-1 border border-neutral-800 select-all overflow-x-auto text-[10px] text-left text-white">
                      {window.location.origin}
                    </div>
                  </li>
                  <li>شناسه کلاینت (معمولاً پسوند client.googleusercontent.com دارد) حاصل را در بالا جایگذاری کنید.</li>
                </ol>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {gdriveToken ? (
              <>
                <button
                  type="button"
                  onClick={onSyncManual}
                  disabled={isSyncing}
                  className="flex-1 py-2.5 bg-white hover:bg-neutral-200 text-neutral-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>همگام سازی کانتینری</span>
                </button>
                <button
                  type="button"
                  onClick={onDisconnectGDrive}
                  className="px-3.5 py-2.5 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 text-rose-500 font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  قطع ارتباط
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onConnectGDrive}
                className="w-full py-2.5 bg-white hover:bg-neutral-200 text-neutral-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Cloud className="w-4 h-4" />
                <span>اتصال ابری به گوگل‌درایو (Google Drive)</span>
              </button>
            )}
          </div>
        </div>

        {/* Change Master Password Panel */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-5.5 h-5.5 text-white" />
              <h4 className="font-bold text-white text-sm font-heading">تغییر رمز عبور مستر (Master)</h4>
            </div>
            <p className="text-xs text-neutral-400 leading-5 mb-4">
              تغییر این رمز تمام اطلاعات شما را بازگشایی کرده و فوراً با الگوریتم و نمک رمزارزی کاملاً متفاوت مجدداً پلمب می‌نماید. حتماً این رمز را به خاطر بسپارید.
            </p>

            {pwError && (
              <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 text-rose-450 text-xs mb-3">
                {pwError}
              </div>
            )}

            {pwSuccess && (
              <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs mb-3">
                {pwSuccess}
              </div>
            )}
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-3">
            <input
              type="password"
              placeholder="رمز مستر فعلی شما"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs outline-none text-white placeholder:text-neutral-700 focus:ring-0"
              required
            />
            <input
              type="password"
              placeholder="رمز مستر جدید (حداقل ۸ کاراکتر)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs outline-none text-white placeholder:text-neutral-700 focus:ring-0"
              required
            />
            <input
              type="password"
              placeholder="تکرار رمز مستر جدید"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs outline-none text-white placeholder:text-neutral-700 focus:ring-0"
              required
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-white hover:bg-neutral-200 text-neutral-950 font-bold text-xs rounded-lg transition cursor-pointer"
            >
              تأیید و به‌روزرسانی نهایی رمز
            </button>
          </form>
        </div>
      </div>

      {/* Advanced Backup Actions */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl">
        <h4 className="font-bold text-white text-sm mb-3 font-heading">واردکردن/خروجی گرفتن از پایگاه داده (Zero-Knowledge Import/Export)</h4>
        <p className="text-xs text-neutral-400 leading-5 mb-5">
           با کلیک روی دکمه‌های زیر می‌توانید یک لوح یا پشتیبان آفلاین از داده‌های رمزنگاری شده کپی کنید یا فایل CSV را برای وارد کردن فعال نمایید.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <button
            onClick={onTriggerCsvImport}
            className="p-3 bg-neutral-950 hover:bg-neutral-850/65 border border-neutral-850 text-neutral-300 rounded-lg text-xs font-bold select-none flex flex-col items-center gap-1.5 transition cursor-pointer"
          >
            <Chrome className="w-5 h-5 text-white" />
            <span>واردکردن از فایل قدیمی CSV</span>
          </button>
          <button
            onClick={downloadEncryptedJson}
            className="p-3 bg-neutral-950 hover:bg-neutral-850/65 border border-neutral-850 text-neutral-300 rounded-lg text-xs font-bold select-none flex flex-col items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-5 h-5 text-white" />
            <span>دانلود نسخه پشتیبان (Encrypted JSON)</span>
          </button>
          <button
            onClick={downloadDecryptedCsv}
            className="p-3 bg-neutral-950 hover:bg-neutral-850/65 border border-neutral-850 text-neutral-300 rounded-lg text-xs font-bold select-none flex flex-col items-center gap-1.5 transition cursor-pointer"
          >
            <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
            <span>خروجی گرفتن بازنشده (Decrypted CSV)</span>
          </button>
        </div>
      </div>

      {/* Dangerous/Master Reset Actions */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="font-bold text-rose-500 text-sm flex items-center gap-2">
            <Trash2 className="w-5 h-5 shrink-0" />
            <span>ریست سخت‌افزاری پایگاه داده (پاک کردن کامل حافظه)</span>
          </h4>
          <p className="text-xs text-neutral-400 leading-5 max-w-xl">
            این اقدام تمام اطلاعات ذخیره شده شما را روی حافظه مرورگر و برنامه کاملاً امحاء می‌کند. این اقدام غیر قابل بازگشت بوده و در صورت عدم همگام‌سازی، داده‌ها از دست می‌روند.
          </p>
        </div>
        <button
          onClick={onClearAllData}
          className="py-3 px-5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
        >
          پاک‌سازی کامل گاوصندوق
        </button>
      </div>

    </div>
  );
}
