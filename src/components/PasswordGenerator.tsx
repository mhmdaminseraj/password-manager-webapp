import { useState, useEffect } from 'react';
import { RefreshCw, Copy, Check, ShieldAlert, Sparkles } from 'lucide-react';

interface PasswordGeneratorProps {
  onUsePassword?: (p: string) => void;
  inline?: boolean;
}

export default function PasswordGenerator({ onUsePassword, inline = false }: PasswordGeneratorProps) {
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [easyToRead, setEasyToRead] = useState(false);
  const [isPassphrase, setIsPassphrase] = useState(false);
  const [wordCount, setWordCount] = useState(4);
  const [copied, setCopied] = useState(false);

  // Simple Persian/English friendly words for passphrases
  const words = [
    'safari', 'planet', 'ocean', 'forest', 'mountain', 'galaxy', 'quantum', 'cipher', 'matrix',
    'nebula', 'glacier', 'canyon', 'pyramid', 'vintage', 'harmony', 'summit', 'aurora', 'eclipse',
    'horizon', 'odyssey', 'pinnacle', 'mirage', 'monolith', 'paradigm', 'sanctuary', 'solitude',
    'oasis', 'velvet', 'cascade', 'zenith', 'breeze', 'echo', 'shadow', 'glowing', 'vibrant', 'crystal'
  ];

  const generate = () => {
    if (isPassphrase) {
      let selectedWords: string[] = [];
      for (let i = 0; i < wordCount; i++) {
        const randIndex = Math.floor(Math.random() * words.length);
        selectedWords.push(words[randIndex]);
      }
      setPassword(selectedWords.join('-'));
      return;
    }

    let charset = '';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (includeUppercase) charset += uppercase;
    if (includeLowercase) charset += lowercase;
    if (includeNumbers) charset += numbers;
    if (includeSymbols) charset += symbols;

    // Filter out confusing characters if chosen
    if (easyToRead) {
      // Excludes: I, l, 1, O, 0, o, |, i
      charset = charset.replace(/[Il1Oo0|i]/g, '');
    }

    if (!charset) {
      setPassword('یک گزینه را فعال کنید!');
      return;
    }

    let generated = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      generated += charset[randomIndex];
    }
    setPassword(generated);
  };

  useEffect(() => {
    generate();
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, easyToRead, isPassphrase, wordCount]);

  const copyToClipboard = () => {
    if (!password || password.startsWith('یک گزینه')) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate entropy & quality
  const getEntropyInfo = () => {
    if (!password) return { label: 'بی‌ارزش', color: 'bg-rose-500 w-0', percent: 0 };
    
    // Entropy = L * log2(R)
    let poolSize = 0;
    if (!isPassphrase) {
      if (includeUppercase) poolSize += 26;
      if (includeLowercase) poolSize += 26;
      if (includeNumbers) poolSize += 10;
      if (includeSymbols) poolSize += 26;
      if (easyToRead) poolSize -= 8;
    } else {
      poolSize = words.length;
    }
    
    const size = isPassphrase ? wordCount : length;
    const entropy = size * Math.log2(poolSize || 1);
    
    if (entropy < 40) return { label: 'بسیار ضعیف 🔴', color: 'bg-rose-500 w-1/4', percent: 25 };
    if (entropy < 60) return { label: 'متوسط 🟡', color: 'bg-amber-400 w-2/4', percent: 50 };
    if (entropy < 80) return { label: 'امن و قوی 🟢', color: 'bg-emerald-500 w-3/4', percent: 75 };
    return { label: 'فوق العاده امن 🔥', color: 'bg-teal-500 w-full', percent: 100 };
  };

  const strength = getEntropyInfo();

  return (
    <div className={`p-5 rounded-lg bg-neutral-900 border border-neutral-800 ${inline ? 'shadow-none p-0 border-0 bg-transparent' : 'shadow-2xl'}`} dir="rtl">
      
      {/* Header */}
      {!inline && (
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-white animate-pulse" />
          <h3 className="font-bold text-white text-sm font-heading">مولد رمزهای تصادفی پیشرفته • Password Generator</h3>
        </div>
      )}

      {/* Primary Display */}
      <div className="relative flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-3 mb-4 overflow-hidden">
        <textarea
          readOnly
          value={password}
          rows={isPassphrase && wordCount > 5 ? 2 : 1}
          className="w-full pr-10 pl-2 bg-transparent text-white font-mono text-left text-sm font-semibold outline-none border-none resize-none focus:ring-0 overflow-y-auto"
        />
        
        {/* Actions inside field */}
        <div className="absolute right-2 flex gap-1.5">
          <button
            type="button"
            onClick={generate}
            title="تولید مجدد"
            className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-850 transition flex items-center justify-center cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={copyToClipboard}
            title="کپی کردن"
            className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-850 transition flex items-center justify-center cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-450" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Strength Quality */}
      <div className="mb-5 space-y-2">
        <div className="flex justify-between items-center text-[11px] font-semibold text-neutral-400">
          <span>امنیت رمز: <b className="text-white">{strength.label}</b></span>
          <span>{isPassphrase ? `${length || password.length} کاراکتر` : `${length} کاراکتر`}</span>
        </div>
        <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
          <div className={`h-full ${strength.color} transition-all duration-300 rounded-full`} />
        </div>
      </div>

      {/* Generator Type Selector */}
      <div className="flex bg-neutral-950 p-1 rounded-lg gap-1 mb-5 border border-neutral-850">
        <button
          type="button"
          onClick={() => setIsPassphrase(false)}
          className={`flex-1 py-1.5 text-[11px] font-bold rounded transition-all cursor-pointer ${!isPassphrase ? 'bg-neutral-850 text-white shadow-xs' : 'text-neutral-400 hover:text-white'}`}
        >
          رمز عبور کاراکتری
        </button>
        <button
          type="button"
          onClick={() => setIsPassphrase(true)}
          className={`flex-1 py-1.5 text-[11px] font-bold rounded transition-all cursor-pointer ${isPassphrase ? 'bg-neutral-850 text-white shadow-xs' : 'text-neutral-400 hover:text-white'}`}
        >
          عبارت چندکلمه‌ای خوانا
        </button>
      </div>

      {/* Standard Settings */}
      {!isPassphrase ? (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-neutral-400">طول رمز عبور</span>
              <span className="text-xs font-mono font-bold text-white">{length}</span>
            </div>
            <input
              type="range"
              min="8"
              max="64"
              value={length}
              onChange={(e) => setLength(parseInt(e.target.value))}
              className="w-full accent-white cursor-pointer h-1 bg-neutral-800 rounded appearance-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5 pt-1">
            <label className="flex items-center gap-2.5 text-xs text-neutral-300 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={includeUppercase}
                onChange={(e) => setIncludeUppercase(e.target.checked)}
                className="rounded border-neutral-800 bg-neutral-950 text-white focus:ring-0 w-4 h-4"
              />
              <span>حروف بزرگ (A-Z)</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-neutral-300 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={includeLowercase}
                onChange={(e) => setIncludeLowercase(e.target.checked)}
                className="rounded border-neutral-800 bg-neutral-950 text-white focus:ring-0 w-4 h-4"
              />
              <span>حروف کوچک (a-z)</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-neutral-300 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={includeNumbers}
                onChange={(e) => setIncludeNumbers(e.target.checked)}
                className="rounded border-neutral-800 bg-neutral-950 text-white focus:ring-0 w-4 h-4"
              />
              <span>اعداد (0-9)</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-neutral-300 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={includeSymbols}
                onChange={(e) => setIncludeSymbols(e.target.checked)}
                className="rounded border-neutral-800 bg-neutral-950 text-white focus:ring-0 w-4 h-4"
              />
              <span>نمادها (!@#$)</span>
            </label>
          </div>

          <div className="pt-2 border-t border-neutral-800">
            <label className="flex items-center gap-2.5 text-xs text-neutral-305 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={easyToRead}
                onChange={(e) => setEasyToRead(e.target.checked)}
                className="rounded border-neutral-800 bg-neutral-950 text-white focus:ring-0 w-4 h-4"
              />
              <div className="flex flex-col">
                <span className="font-semibold text-neutral-200">خوانایی آسان</span>
                <span className="text-[10px] text-neutral-500">حذف کاراکترهای شبیه به هم (مثل l, 1, I, o, 0)</span>
              </div>
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-neutral-400">تعداد کلمات در عبارت</span>
              <span className="text-xs font-mono font-bold text-white">{wordCount} کلمه</span>
            </div>
            <input
              type="range"
              min="3"
              max="8"
              value={wordCount}
              onChange={(e) => setWordCount(parseInt(e.target.value))}
              className="w-full accent-white cursor-pointer h-1 bg-neutral-800 rounded appearance-none"
            />
          </div>
          <p className="text-[11px] text-neutral-500 leading-4">
            عبارت‌های چندکلمه‌ای تلفظ و حفظ کردن بسیار راحت‌تری دارند و در عین حال به دلیل ترکیب کلمات کاملاً تصادفی، در برابر حملات تحلیل بسامدی (Dictionary) مقاومت بسیار بالایی دارند.
          </p>
        </div>
      )}

      {/* Action Button */}
      {onUsePassword && (
        <button
          type="button"
          onClick={() => onUsePassword(password)}
          className="w-full mt-5 py-2.5 bg-white hover:bg-neutral-200 text-neutral-950 font-bold text-xs rounded-lg shadow-sm transition cursor-pointer"
        >
          جایگذاری و استفاده از این رمز
        </button>
      )}
    </div>
  );
}
