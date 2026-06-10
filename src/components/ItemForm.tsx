import React, { useState } from 'react';
import { Eye, EyeOff, Sparkles, Folder as FolderIcon, Tag, Save, ArrowLeft, KeyRound, CreditCard, StickyNote, HelpCircle } from 'lucide-react';
import { VaultItem, Folder, ItemType } from '../types';
import PasswordGenerator from './PasswordGenerator';

interface ItemFormProps {
  item?: VaultItem;
  folders: Folder[];
  onSave: (savedItem: VaultItem) => void;
  onCancel: () => void;
}

export default function ItemForm({ item, folders, onSave, onCancel }: ItemFormProps) {
  const isEditing = !!item;
  const [type, setType] = useState<ItemType>(item?.type || 'login');
  const [title, setTitle] = useState(item?.title || '');
  const [favorite, setFavorite] = useState(item?.favorite || false);
  const [tags, setTags] = useState(item?.tags?.join(', ') || '');
  const [folderId, setFolderId] = useState(item?.folderId || '');
  const [notes, setNotes] = useState(item?.notes || '');
  
  // Login fields
  const [username, setUsername] = useState((item?.type === 'login' && item.username) || '');
  const [password, setPassword] = useState((item?.type === 'login' && item.password) || '');
  const [url, setUrl] = useState((item?.type === 'login' && item.url) || '');
  const [totpSecret, setTotpSecret] = useState((item?.type === 'login' && item.totpSecret) || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showGen, setShowGen] = useState(false);

  // Card fields
  const [cardholder, setCardholder] = useState((item?.type === 'card' && item.cardholder) || '');
  const [cardNumber, setCardNumber] = useState((item?.type === 'card' && item.number) || '');
  const [expiry, setExpiry] = useState((item?.type === 'card' && item.expiry) || '');
  const [cvv, setCvv] = useState((item?.type === 'card' && item.cvv) || '');
  const [pin, setPin] = useState((item?.type === 'card' && item.pin) || '');
  const [cardBrand, setCardBrand] = useState<'visa'|'mastercard'|'amex'|'discover'|'generic'>((item?.type === 'card' && item.brand) || 'generic');

  // Note fields
  const [content, setContent] = useState((item?.type === 'note' && item.content) || '');
  const [noteColor, setNoteColor] = useState((item?.type === 'note' && item.color) || 'slate');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('لطفاً عنوان گاوصندوق را وارد کنید.');
      return;
    }

    const baseData = {
      id: item?.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: title.trim(),
      favorite,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      folderId: folderId || undefined,
      notes: notes.trim() || undefined,
      createdAt: item?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let finalizedItem: VaultItem;

    if (type === 'login') {
      finalizedItem = {
        ...baseData,
        type: 'login',
        username: username.trim(),
        password,
        url: url.trim(),
        totpSecret: totpSecret.replace(/\s+/g, '').trim()
      };
    } else if (type === 'card') {
      finalizedItem = {
        ...baseData,
        type: 'card',
        cardholder: cardholder.trim(),
        number: cardNumber.replace(/\s+/g, '').trim(),
        expiry: expiry.trim(),
        cvv: cvv.trim(),
        pin: pin.trim(),
        brand: cardBrand
      };
    } else {
      finalizedItem = {
        ...baseData,
        type: 'note',
        content: content.trim(),
        color: noteColor
      };
    }

    onSave(finalizedItem);
  };

  const handleUsePassword = (suggested: string) => {
    setPassword(suggested);
    setShowGen(false);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 md:p-6 shadow-2xl max-w-2xl mx-auto" dir="rtl">
      
      {/* Header Controls */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-neutral-800/80">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white cursor-pointer transition"
        >
          <ArrowLeft className="w-4 h-4 -scale-x-100" />
          <span>بازگشت</span>
        </button>
        <span className="text-sm font-bold text-white font-heading">
          {isEditing ? 'ویرایش اطلاعات گاوصندوق • Edit Item' : 'کارت‌پوشه جدید در گاوصندوق • New Item'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Type Selector (Only on create) */}
        {!isEditing && (
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setType('login')}
              className={`py-3 px-3 rounded-lg border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                type === 'login'
                  ? 'border-neutral-200 bg-neutral-850 text-white font-bold shadow-sm'
                  : 'border-neutral-800 text-neutral-450 hover:bg-neutral-850'
              }`}
            >
              <KeyRound className="w-4.5 h-4.5" />
              <span className="text-xs">حساب ورودی (Login)</span>
            </button>
            <button
              type="button"
              onClick={() => setType('card')}
              className={`py-3 px-3 rounded-lg border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                type === 'card'
                  ? 'border-neutral-200 bg-neutral-850 text-white font-bold shadow-sm'
                  : 'border-neutral-800 text-neutral-450 hover:bg-neutral-850'
              }`}
            >
              <CreditCard className="w-4.5 h-4.5" />
              <span className="text-xs">کارت بانکی (Card)</span>
            </button>
            <button
              type="button"
              onClick={() => setType('note')}
              className={`py-3 px-3 rounded-lg border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                type === 'note'
                  ? 'border-neutral-200 bg-neutral-850 text-white font-bold shadow-sm'
                  : 'border-neutral-800 text-neutral-450 hover:bg-neutral-850'
              }`}
            >
              <StickyNote className="w-4.5 h-4.5" />
              <span className="text-xs">یادداشت امن (Note)</span>
            </button>
          </div>
        )}

        {/* Common Field: Title */}
        <div>
          <label className="block text-xs font-bold text-neutral-400 mb-1.5">عنوان مورد {type === 'note' ? 'یادداشت' : type === 'card' ? 'کارت بانکی' : 'حساب'}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثلاً گوگل ایمیل شخصی، حساب دیجی‌کالا، ملّی‌کارت و..."
            className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs outline-none text-white placeholder:text-neutral-600 focus:ring-0"
            required
          />
        </div>

        {/* Dynamic Fields: Login */}
        {type === 'login' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1.5">نام کاربری یا ایمیل (Username / Email)</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs font-mono text-left outline-none text-white focus:ring-0"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-neutral-400">کلمه عبور (Password)</label>
                  <button
                    type="button"
                    onClick={() => setShowGen(!showGen)}
                    className="text-[10px] text-neutral-405 hover:text-white flex items-center gap-1 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>تولید رمز تصادفی</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs font-mono text-left outline-none text-white placeholder:text-neutral-700 focus:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 px-3 flex items-center text-neutral-500 hover:text-white transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Embedded Password Generator Drawer */}
            {showGen && (
              <div className="p-4 bg-neutral-950 border border-neutral-850 rounded-lg">
                <PasswordGenerator onUsePassword={handleUsePassword} inline />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1.5">آدرس وبسایت و لینک مستقیم (URL)</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/login"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs font-mono text-left outline-none text-white focus:ring-0"
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="block text-xs font-bold text-neutral-400">شناسه دومرحله‌ای (TOTP Secret Key / Base32)</label>
                  <div className="group relative cursor-help">
                    <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-950 border border-neutral-800 text-neutral-350 text-[10px] rounded opacity-0 group-hover:opacity-100 transition duration-150 leading-relaxed z-20">
                      کلید متنی برای تولید خودکار کدهای ۲ مرحله‌ای (۲FA) - این کلید را سرویس‌های مبدا (مثلاً گوگل یا گیت‌هاب) در قالب متن به شما می‌دهند.
                    </span>
                  </div>
                </div>
                <input
                  type="text"
                  value={totpSecret}
                  onChange={(e) => setTotpSecret(e.target.value)}
                  placeholder="اختیاری: JBSWY3DPEHPK3PXP..."
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs font-mono text-left placeholder:text-neutral-700 outline-none text-white focus:ring-0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Fields: Card */}
        {type === 'card' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1.5">دارنده کارت (Cardholder Name)</label>
                <input
                  type="text"
                  value={cardholder}
                  onChange={(e) => setCardholder(e.target.value)}
                  placeholder="احمد علوی"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs outline-none text-white focus:ring-0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1.5">شماره ۱۶ رقمی کارت بانکی</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="6037-9912-3456-7890"
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs font-mono text-left outline-none text-white focus:ring-0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1.5">تاریخ انقضاء</label>
                <input
                  type="text"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="06/09"
                  maxLength={5}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs font-mono text-left outline-none text-white focus:ring-0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1.5">رمز دوم / CVV2</label>
                <input
                  type="text"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="1234"
                  maxLength={4}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs font-mono text-left outline-none text-white focus:ring-0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1.5">رمز اول / PIN</label>
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs font-mono text-left outline-none text-white focus:ring-0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1.5">شبکه پرداخت</label>
                <select
                  value={cardBrand}
                  onChange={(e) => setCardBrand(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs outline-none text-white cursor-pointer focus:ring-0"
                >
                  <option value="generic">کارت همرکاب عمومی</option>
                  <option value="visa">ویزا (Visa)</option>
                  <option value="mastercard">مسترکارت (MasterCard)</option>
                  <option value="amex">امریکن اکسپرس</option>
                  <option value="discover">دیسکاور (Discover)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Fields: Note */}
        {type === 'note' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-1.5">متن یادداشت امن</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="یادداشت امن خود یا کد‌های بازنشانی محرمانه و اطلاعات مهم خود را مخفی و رمزشده بنویسید..."
                rows={6}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs outline-none text-white leading-relaxed placeholder:text-neutral-700 focus:ring-0"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2">رنگ تم یادداشت</label>
              <div className="flex gap-2">
                {['slate', 'indigo', 'emerald', 'teal', 'rose', 'amber'].map((color) => {
                  const bgClasses: any = {
                    slate: 'bg-neutral-800 border-neutral-700',
                    indigo: 'bg-indigo-950/40 border-indigo-900',
                    emerald: 'bg-emerald-950/40 border-emerald-900',
                    teal: 'bg-teal-950/40 border-teal-900',
                    rose: 'bg-rose-950/40 border-rose-900',
                    amber: 'bg-amber-950/40 border-amber-900'
                  };
                  return (
                    <button
                      type="button"
                      key={color}
                      onClick={() => setNoteColor(color)}
                      className={`w-8 h-8 rounded-full border ${bgClasses[color]} ${noteColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'} transition cursor-pointer`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <hr className="border-neutral-800/80" />

        {/* Structural Metadata (Folders, Tags, Notes) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Folders select */}
          <div>
            <label className="block text-xs font-bold text-neutral-400 mb-2.5 flex items-center gap-1.5">
              <FolderIcon className="w-4 h-4 text-white" />
              <span>پوشه (نظم‌دهی)</span>
            </label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs outline-none text-white cursor-pointer focus:ring-0"
            >
              <option value="">بدون پوشه (پیش‌فرض)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-neutral-400 mb-2.5 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-white" />
              <span>برچسب‌ها (با ویرگول جدا کنید)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="شخصی، کاری، مالی، اجتماعی"
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs outline-none text-white placeholder:text-neutral-600 focus:ring-0"
            />
          </div>
        </div>

        {/* General Notes for Logins/Cards */}
        {type !== 'note' && (
          <div>
            <label className="block text-xs font-bold text-neutral-400 mb-1.5">توضیحات و جزئیات تکمیلی</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثلاً کدهای بازیابی اضطراری، زمان انقضای رمز عبور..."
              rows={2}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs outline-none text-white placeholder:text-neutral-600 focus:ring-0"
            />
          </div>
        )}

        {/* Favorite toggle */}
        <div className="flex items-center">
          <label className="relative flex items-center gap-2.5 text-xs text-neutral-450 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={favorite}
              onChange={(e) => setFavorite(e.target.checked)}
              className="rounded border-neutral-800 text-white focus:ring-neutral-700 bg-neutral-950 w-4.5 h-4.5 cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="font-bold text-neutral-200">افزودن به برگزیده‌ها ⭐</span>
              <span className="text-[10px] text-neutral-500">به صورت فوری در راه‌بند بالایی یا فهرست برگزیده‌های شما قرار می‌گیرد</span>
            </div>
          </label>
        </div>

        {/* Submit Actions */}
        <div className="flex gap-3 pt-3">
          <button
            type="submit"
            className="flex-1 py-3 bg-white hover:bg-neutral-200 text-neutral-950 font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره نهایی در گاوصندوق امن</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="py-3 px-6 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 font-bold text-xs rounded-lg transition cursor-pointer"
          >
            انصراف
          </button>
        </div>
      </form>
    </div>
  );
}
