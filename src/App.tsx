import React, { useState, useEffect } from 'react';
import { 
  Lock, Unlock, Search, Plus, FolderPlus, Trash2, KeyRound, CreditCard, 
  StickyNote, Star, Folder as FolderIcon, Moon, Sun, Cloud, RefreshCw, Key, 
  Copy, Check, Eye, EyeOff, AlertTriangle, ShieldCheck, LogOut, Settings2, FileText, ChevronRight
} from 'lucide-react';
import { VaultItem, Folder, UserSettings, VaultState, EncryptedVaultPayload } from './types';
import { encryptVault, checkMasterPassword } from './utils/crypto';
import { generateTOTP } from './utils/totp';
import UnlockScreen from './components/UnlockScreen';
import PasswordGenerator from './components/PasswordGenerator';
import CsvImporter from './components/CsvImporter';
import SettingsPanel from './components/SettingsPanel';
import ItemForm from './components/ItemForm';

export default function App() {
  // Authentication & Master Password State
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [vaultPayload, setVaultPayload] = useState<EncryptedVaultPayload | null>(null);
  
  // Decrypted State (Kept strictly in memory during runtime)
  const [items, setItems] = useState<VaultItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'dark',
    lockTimeoutMinutes: 15
  });

  // Google Drive OAuth & Synchronisation state
  const [gdriveToken, setGdriveToken] = useState<string | null>(null);
  const [gdriveFileId, setGdriveFileId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Active UI Navigation state
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'login' | 'card' | 'note' | 'fav'>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'create' | 'edit' | 'csv' | 'settings'>('dashboard');
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);

  // Detail display states
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [clipboardCopyField, setClipboardCopyField] = useState<string | null>(null);
  
  // Real-time TOTP state
  const [totpCode, setTotpCode] = useState('');
  const [totpCountdown, setTotpCountdown] = useState(30);

  // Load local state initially
  useEffect(() => {
    // 1. Theme application
    const savedPayload = localStorage.getItem('vault_payload');
    if (savedPayload) {
      setVaultPayload(JSON.parse(savedPayload));
    }

    const savedSettings = localStorage.getItem('vault_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      applyTheme(parsed.theme);
    } else {
      const defaultSettings = { theme: 'dark', lockTimeoutMinutes: 15 };
      setSettings(defaultSettings);
      localStorage.setItem('vault_settings', JSON.stringify(defaultSettings));
      applyTheme('dark');
    }

    // 2. Parse OAuth GDrive redirects
    const hash = window.location.hash;
    if (hash.includes('access_token=')) {
      const tokenMatch = hash.match(/access_token=([^&]*)/);
      if (tokenMatch && tokenMatch[1]) {
        const token = tokenMatch[1];
        setGdriveToken(token);
        localStorage.setItem('gdrive_token', token);
        // Clear hash smoothly
        window.history.replaceState(null, '', window.location.pathname);
      }
    } else {
      const token = localStorage.getItem('gdrive_token');
      if (token) setGdriveToken(token);
    }
  }, []);

  // Update theme helper
  const applyTheme = (themeValue: 'light' | 'dark') => {
    if (themeValue === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'light' ? 'dark' : 'light';
    const nextSettings = { ...settings, theme: nextTheme };
    setSettings(nextSettings);
    localStorage.setItem('vault_settings', JSON.stringify(nextSettings));
    applyTheme(nextTheme);
  };

  // Live TOTP Tick updates
  useEffect(() => {
    const selectedItem = items.find(i => i.id === selectedItemId);
    if (!selectedItem || selectedItem.type !== 'login' || !selectedItem.totpSecret) {
      setTotpCode('');
      return;
    }

    const updateTOTP = async () => {
      const res = await generateTOTP(selectedItem.totpSecret || '');
      setTotpCode(res.token);
      setTotpCountdown(res.secondsRemaining);
    };

    updateTOTP(); // Initial call
    const timer = setInterval(updateTOTP, 1000); // Tick every second
    return () => clearInterval(timer);
  }, [selectedItemId, items]);

  // Master State mutator - Saves & Encrypts automatically
  const saveVaultChanges = async (newItems: VaultItem[], newFolders: Folder[]) => {
    setItems(newItems);
    setFolders(newFolders);

    if (!masterPassword) return;

    try {
      const structState: VaultState = {
        items: newItems,
        folders: newFolders,
        version: (vaultPayload?.iterations || 1) + 1,
        lastSyncedAt: new Date().toISOString()
      };

      const encrypted = await encryptVault(structState, masterPassword);
      setVaultPayload(encrypted);
      localStorage.setItem('vault_payload', JSON.stringify(encrypted));

      // Auto GDrive Cloud Sync if connected
      if (gdriveToken) {
        syncToGDrive(encrypted);
      }
    } catch (err) {
      console.error('Vault autosave encryption failed:', err);
    }
  };

  // Google Drive REST operations
  const syncToGDrive = async (payloadToSync?: EncryptedVaultPayload) => {
    const payload = payloadToSync || vaultPayload;
    if (!payload || !gdriveToken) return;

    setIsSyncing(true);
    try {
      // 1. Search for existing vault.enc
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name%3D%27vault.enc%27+and+trashed%3Dfalse`,
        {
          headers: { Authorization: `Bearer ${gdriveToken}` }
        }
      );
      
      if (!searchRes.ok) {
        if (searchRes.status === 401) {
          handleDisconnectGDrive();
          throw new Error('نشست ورود به حساب گوگل شما منقضی شده است. لطفا مجددا متصل شوید.');
        }
        throw new Error('خطا در جستجوی گوگل‌درایو');
      }

      const searchData = await searchRes.json();
      let fileId = gdriveFileId;

      if (searchData.files && searchData.files.length > 0) {
        fileId = searchData.files[0].id;
        setGdriveFileId(fileId);
      }

      const payloadString = JSON.stringify(payload);

      if (fileId) {
        // Update existing cloud file
        const updateRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${gdriveToken}`,
              'Content-Type': 'application/json'
            },
            body: payloadString
          }
        );
        if (!updateRes.ok) throw new Error('عملیات آپدیت ابری با شکست مواجه شد.');
      } else {
        // First-time file creation metadata
        const createMetaRes = await fetch(
          'https://www.googleapis.com/drive/v3/files',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${gdriveToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: 'vault.enc',
              mimeType: 'application/octet-stream'
            })
          }
        );
        
        if (!createMetaRes.ok) throw new Error('خطا در ایجاد شناسنامه فایل ابری.');
        const newFile = await createMetaRes.json();
        const newFileId = newFile.id;
        setGdriveFileId(newFileId);

        // Upload media bytes
        const uploadContentRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${newFileId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${gdriveToken}`,
              'Content-Type': 'application/json'
            },
            body: payloadString
          }
        );
        if (!uploadContentRes.ok) throw new Error('خطا در بارگذاری محتوای فایل ابری جدید.');
      }
      
      console.log('Synchronised with cloud successfully!');
    } catch (e: any) {
      alert(`خطای همگام‌سازی ابری: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadGDrive = async () => {
    if (!gdriveToken) return;
    setIsSyncing(true);
    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name%3D%27vault.enc%27+and+trashed%3Dfalse`,
        {
          headers: { Authorization: `Bearer ${gdriveToken}` }
        }
      );
      const searchData = await searchRes.json();
      
      if (!searchData.files || searchData.files.length === 0) {
        alert('هیچ فایل رمزگذاری شده‌ای (vault.enc) روی گوگل درایو شما پیدا نشد.');
        return;
      }

      const fileId = searchData.files[0].id;
      setGdriveFileId(fileId);

      const downloadRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${gdriveToken}` }
        }
      );
      
      const payload: EncryptedVaultPayload = await downloadRes.json();
      
      // Decrypt cloud data with current Master password
      if (masterPassword) {
        const decrypted = await checkMasterPassword(masterPassword, payload);
          if (decrypted) {
            const confirmed = window.confirm(
              'اطلاعات گاوصندوق روی ابری گوگل یافت شد. آیا مایل هستید کل اطلاعات محلی شما پاک شده و این اطلاعات جایگزین شود؟'
            );
            if (confirmed) {
              localStorage.setItem('vault_payload', JSON.stringify(payload));
              setVaultPayload(payload);
              window.location.reload(); // Quick refresh to load decrypted state
            }
          } else {
            alert('خطای هموارسازی: پسورد ابری و پسورد فعلی مستر شما یکسان نیستند.');
          }
      }
    } catch (err: any) {
      alert(`بارگیری با خطا مواجه شد: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectGDrive = () => {
    // standard Client ID or user-provided personal ID
    const clientId = settings.googleClientId || '244257097574-e85t7o90ghh5m3re4ffb3b8g66cbeob1.apps.googleusercontent.com';
    
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: clientId,
      redirect_uri: window.location.origin,
      response_type: 'token',
      scope: 'https://www.googleapis.com/auth/drive.file',
      include_granted_scopes: 'true',
      state: 'gdrive_sync'
    }).toString();

    // Redirect to login
    window.location.href = googleAuthUrl;
  };

  const handleDisconnectGDrive = () => {
    setGdriveToken(null);
    setGdriveFileId(null);
    localStorage.removeItem('gdrive_token');
  };

  // Authentication callbacks
  const handleUnlocked = (password: string, decryptedItems: VaultItem[], decryptedFolders: Folder[]) => {
    setMasterPassword(password);
    setItems(decryptedItems);
    setFolders(decryptedFolders);
    setActiveView('dashboard');
  };

  // Change master password
  const handleChangeMasterPassword = async (oldPass: string, newPass: string): Promise<boolean> => {
    if (!masterPassword || oldPass !== masterPassword) return false;
    
    try {
      const structState: VaultState = {
        items,
        folders,
        version: (vaultPayload?.iterations || 1) + 1,
        lastSyncedAt: new Date().toISOString()
      };
      
      const nextEncrypted = await encryptVault(structState, newPass);
      setVaultPayload(nextEncrypted);
      localStorage.setItem('vault_payload', JSON.stringify(nextEncrypted));
      setMasterPassword(newPass);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Master nuclear clean
  const handleClearAllData = () => {
    const confirmation = window.confirm(
      'آیا مطمئن هستید؟ این قابلیت تمام کارهای شما را برای همیشه و بدون امکان بازگشت حذف می‌کند.'
    );
    if (confirmation) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // Filter operations
  const getFilteredItems = () => {
    let result = [...items];

    // Typology filtering
    if (selectedFilter !== 'all' && selectedFilter !== 'fav') {
      result = result.filter(item => item.type === selectedFilter);
    } else if (selectedFilter === 'fav') {
      result = result.filter(item => item.favorite);
    }

    // Folder structural filtering
    if (selectedFolderId) {
      result = result.filter(item => item.folderId === selectedFolderId);
    }

    // Query text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => 
        item.title.toLowerCase().includes(q) || 
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.type === 'login' && item.username && item.username.toLowerCase().includes(q)) ||
        (item.type === 'login' && item.url && item.url.toLowerCase().includes(q))
      );
    }

    return result;
  };

  // Clipboard copying triggers
  const handleCopyToClipboard = (val?: string, fieldName?: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setClipboardCopyField(fieldName || 'generic');
    setTimeout(() => setClipboardCopyField(null), 1500);
  };

  // Mutator actions
  const handleSaveItem = (saved: VaultItem) => {
    const itemIndex = items.findIndex(i => i.id === saved.id);
    let nextItems = [...items];

    if (itemIndex > -1) {
      nextItems[itemIndex] = saved;
    } else {
      nextItems.unshift(saved);
    }

    saveVaultChanges(nextItems, folders);
    setSelectedItemId(saved.id);
    setActiveView('dashboard');
  };

  const handleDeleteItem = (id: string) => {
    const confirm = window.confirm('آیا مایلید این مورد را برای همیشه حذف کنید؟');
    if (!confirm) return;

    const nextItems = items.filter(i => i.id !== id);
    saveVaultChanges(nextItems, folders);
    setSelectedItemId(null);
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      createdAt: new Date().toISOString()
    };

    saveVaultChanges(items, [...folders, newFolder]);
    setNewFolderName('');
    setShowFolderModal(false);
  };

  const handleDeleteFolder = (id: string) => {
    const confirm = window.confirm('با حذف این پوشه، دسته بندی موارد از بین می رود ولی رمزها باقی خواهند ماند.');
    if (!confirm) return;

    const nextFolders = folders.filter(f => f.id !== id);
    const nextItems = items.map(item => 
      item.folderId === id ? { ...item, folderId: undefined } : item
    );

    saveVaultChanges(nextItems, nextFolders);
    setSelectedFolderId(null);
  };

  const handleBulkImport = (imported: VaultItem[]) => {
    const nextItems = [...imported, ...items];
    saveVaultChanges(nextItems, folders);
    setActiveView('dashboard');
    alert(`تعداد ${imported.length} رمز جدید با موفقیت پلمپ و پایگاه داده محلی بروزرسانی شد.`);
  };

  // Return logon page if no master pass
  if (!masterPassword) {
    return (
      <UnlockScreen 
        payload={vaultPayload} 
        onUnlocked={handleUnlocked} 
      />
    );
  }

  // Active Item Details helper
  const selectedItem = items.find(i => i.id === selectedItemId);

  return (
    <div className="min-h-screen bg-neutral-950 font-sans flex flex-col transition-colors duration-300 selection:bg-neutral-800 selection:text-white" dir="rtl">
      
      {/* Upper Navigation Bar */}
      <header className="bg-neutral-900 border-b border-neutral-800 px-4 py-3.5 flex items-center justify-between sticky top-0 z-40 transition-colors duration-300">
        <div className="flex items-center gap-2 md:gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center text-neutral-300 shadow-sm">
            <KeyRound className="w-5 h-5 text-neutral-300" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-serif italic font-extrabold text-white tracking-tight">کلیدبان • Vault Master</h1>
            <p className="text-[9px] text-neutral-500 font-mono tracking-widest uppercase">Sophisticated Security Core</p>
          </div>
        </div>

        {/* Sync & Toolbar actions */}
        <div className="flex items-center gap-2">
          {gdriveToken && (
            <button
              onClick={() => syncToGDrive()}
              disabled={isSyncing}
              title="همگام سازی با گوگل درایو"
              className="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 text-neutral-400 flex items-center gap-1.5 text-xs transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-neutral-300 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline font-bold">همگام‌ ابری</span>
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-850 transition cursor-pointer"
          >
            {settings.theme === 'light' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
          </button>

          <button
            onClick={() => setActiveView('settings')}
            className={`p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-850 transition cursor-pointer ${activeView === 'settings' ? 'bg-neutral-800 text-white' : ''}`}
            title="تنظیمات"
          >
            <Settings2 className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={() => setMasterPassword(null)}
            className="p-2 rounded-lg text-rose-500 hover:bg-rose-950/20 transition cursor-pointer"
            title="خروج و قفل گاوصندوق"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* PANEL 1: Left Navigation Sidebar */}
        <aside className="w-full md:w-64 bg-neutral-900 border-l border-b md:border-b-0 border-neutral-800 p-4 shrink-0 transition-colors duration-300">
          <div className="space-y-6">
            
            {/* Quick Actions */}
            <button
              onClick={() => {
                setActiveView('create');
                setSelectedItemId(null);
              }}
              className="w-full py-2.5 bg-white hover:bg-neutral-200 text-neutral-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن مورد جدید</span>
            </button>

            {/* Core Type Categories */}
            <div>
              <h4 className="text-[10px] font-bold text-neutral-500 tracking-wider mb-2.5 uppercase">دسته‌بندی اصلی گاوصندوق</h4>
              <ul className="space-y-1">
                {[
                  { id: 'all', label: 'همه رمزها و کارت‌ها', icon: KeyRound, count: items.length },
                  { id: 'login', label: 'حساب‌های ورودی (Logins)', icon: Key, count: items.filter(i => i.type === 'login').length },
                  { id: 'card', label: 'کارت‌های اعتباری', icon: CreditCard, count: items.filter(i => i.type === 'card').length },
                  { id: 'note', label: 'یادداشت‌های فوق امن', icon: StickyNote, count: items.filter(i => i.type === 'note').length },
                  { id: 'fav', label: 'موارد برگزیده و ستاره‌دار', icon: Star, count: items.filter(i => i.favorite).length }
                ].map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <li key={cat.id}>
                      <button
                        onClick={() => {
                          setSelectedFilter(cat.id as any);
                          setSelectedFolderId(null);
                          setActiveView('dashboard');
                        }}
                        className={`w-full px-3 py-2.5 rounded-lg flex items-center justify-between text-xs transition cursor-pointer ${
                          selectedFilter === cat.id && !selectedFolderId && activeView === 'dashboard'
                            ? 'bg-neutral-800 text-white font-bold border-r-2 border-neutral-205'
                            : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${selectedFilter === cat.id && !selectedFolderId ? 'text-white' : 'text-neutral-500'}`} />
                          <span>{cat.label}</span>
                        </div>
                        <span className="font-mono text-[10px] bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded-full text-neutral-400 font-bold">{cat.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Folders Management section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold text-neutral-500 tracking-wider uppercase">پوشه‌ها و تفکیک محتوا</h4>
                <button
                  type="button"
                  onClick={() => setShowFolderModal(true)}
                  className="p-1 rounded-lg hover:bg-neutral-850 text-neutral-450 hover:text-white transition"
                  title="پوشه جدید"
                >
                  <FolderPlus className="w-4 h-4 cursor-pointer" />
                </button>
              </div>

              {folders.length === 0 ? (
                <p className="text-[10px] text-neutral-500 leading-relaxed text-center py-4">هنوز هیچ پوشه‌ای نساخته‌اید. با پوشه‌ها می‌توانید رمز کاربری شخصی و کاری را جدا تفکیک نمایید.</p>
              ) : (
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {folders.map((folder) => (
                    <li key={folder.id} className="group flex items-center justify-between rounded-lg hover:bg-neutral-850/45">
                      <button
                        onClick={() => {
                          setSelectedFolderId(folder.id);
                          setSelectedFilter('all');
                          setActiveView('dashboard');
                        }}
                        className={`flex-1 px-3 py-2 text-xs flex items-center gap-2 text-right transition cursor-pointer truncate ${
                          selectedFolderId === folder.id && activeView === 'dashboard'
                            ? 'text-white font-bold bg-neutral-800 border-r-2 border-neutral-205'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <FolderIcon className={`w-3.5 h-3.5 shrink-0 ${selectedFolderId === folder.id ? 'text-white' : 'text-neutral-500'}`} />
                        <span className="truncate">{folder.name}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="p-1 text-neutral-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition whitespace-nowrap px-2"
                        title="پاک کردن پوشه"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        </aside>

        {/* Workspace Dynamic Interface Router */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Create / Edit Form Router */}
          {activeView === 'create' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <ItemForm
                folders={folders}
                onSave={handleSaveItem}
                onCancel={() => setActiveView('dashboard')}
              />
            </div>
          )}

          {activeView === 'edit' && selectedItem && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <ItemForm
                item={selectedItem}
                folders={folders}
                onSave={handleSaveItem}
                onCancel={() => setActiveView('dashboard')}
              />
            </div>
          )}

          {activeView === 'csv' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <CsvImporter
                onImportCompleted={handleBulkImport}
                onCancel={() => setActiveView('dashboard')}
              />
            </div>
          )}

          {activeView === 'settings' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <SettingsPanel
                settings={settings}
                vaultState={{ items, folders, version: 1 }}
                onUpdateSettings={(next) => {
                  setSettings(next);
                  localStorage.setItem('vault_settings', JSON.stringify(next));
                }}
                onChangeMasterPassword={handleChangeMasterPassword}
                onClearAllData={handleClearAllData}
                gdriveToken={gdriveToken}
                onConnectGDrive={handleConnectGDrive}
                onDisconnectGDrive={handleDisconnectGDrive}
                onTriggerCsvImport={() => setActiveView('csv')}
                onSyncManual={() => syncToGDrive()}
                isSyncing={isSyncing}
              />
            </div>
          )}

          {activeView === 'dashboard' && (
            <>
              {/* PANEL 2: Middle Items List index */}
              <section className="w-full md:w-80 border-l border-neutral-800 flex flex-col h-full bg-neutral-900 overflow-hidden transition-colors duration-300">
                
                {/* Search Bar Block */}
                <div className="p-3.5 border-b border-neutral-800/85">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="جستجوی عنوان، ایمیل، یا آدرس..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pr-9 pl-3 py-2 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 focus:ring-0 rounded-lg text-xs outline-none text-white placeholder:text-neutral-600 transition"
                    />
                    <Search className="w-4 h-4 text-neutral-500 absolute top-2.5 right-3" />
                  </div>
                </div>

                {/* Lists items */}
                <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/30">
                  {getFilteredItems().length === 0 ? (
                    <div className="p-10 text-center text-neutral-600">
                      <Search className="w-8 h-8 mx-auto text-neutral-705 mb-3" />
                      <p className="text-xs font-sans">هیچ موردی پیدا نشد.</p>
                    </div>
                  ) : (
                    getFilteredItems().map((item) => {
                      const isSelected = item.id === selectedItemId;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          className={`p-3.5 text-right transition cursor-pointer select-none relative ${isSelected ? 'bg-neutral-850/60 border-r-2 border-white' : 'hover:bg-neutral-850/20'}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex gap-2.5 items-center truncate">
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-neutral-800 bg-neutral-950 text-neutral-450">
                                {item.type === 'login' ? <Key className="w-4 h-4" /> : item.type === 'card' ? <CreditCard className="w-4 h-4" /> : <StickyNote className="w-4 h-4" />}
                              </div>
                              <div className="truncate space-y-0.5">
                                <h5 className="text-[13px] font-bold text-neutral-200 truncate">{item.title}</h5>
                                {item.type === 'login' && item.username && (
                                  <p className="text-[11px] text-neutral-500 font-mono truncate">{item.username}</p>
                                )}
                                {item.type === 'card' && item.number && (
                                  <p className="text-[11px] text-neutral-500 font-mono truncate">•••• {item.number.slice(-4)}</p>
                                )}
                                {item.type === 'note' && (
                                  <p className="text-[11px] text-neutral-600 truncate">یادداشت پلمپ شده</p>
                                )}
                              </div>
                            </div>

                            {/* Icons and stats flags */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[9px] text-neutral-500 font-mono leading-none">
                                {new Date(item.updatedAt).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })}
                              </span>
                              {item.favorite && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* PANEL 3: Right selected item detail preview */}
              <section className="flex-1 overflow-y-auto p-4 md:p-6 bg-neutral-950 transition-colors duration-300">
                {!selectedItem ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
                    <div className="w-16 h-16 rounded-full border border-dashed border-neutral-800 flex items-center justify-center mb-4">
                      <Unlock className="w-6 h-6 text-neutral-600" />
                    </div>
                    <h3 className="font-bold font-heading text-neutral-300 text-xs mb-1 uppercase tracking-wider">صندوق قفل و محفوظ است</h3>
                    <p className="text-[11px] text-neutral-500 max-w-xs leading-relaxed font-sans mt-2">جهت رمزگشایی اطلاعات محلی، کپی کردن فیلدها یا نمایش کدهای شناسایی ۲ مرحله‌ای (TOTP)، یک حساب را از لیست کناری انتخاب نمایید.</p>
                  </div>
                ) : (
                  <div className="space-y-6 max-w-xl mx-auto">
                    
                    {/* Item Details Header block */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 relative overflow-hidden">
                      {/* Subtle elegant identity line indicator */}
                      <div className={`absolute top-0 left-0 right-0 h-[2px] ${selectedItem.type === 'note' ? 'bg-neutral-550' : selectedItem.type === 'card' ? 'bg-rose-600' : 'bg-neutral-300'}`} />
                      
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-neutral-950 border border-neutral-850 text-neutral-400 font-mono">
                            {selectedItem.type === 'login' ? 'حساب کاربری / LOGIN' : selectedItem.type === 'card' ? 'کارت نقدی-اعتباری / CARD' : 'یادداشت کلاینت / SECURE NOTE'}
                          </span>
                          <h2 className="text-xl font-serif italic font-bold text-white mt-3.5 tracking-tight">{selectedItem.title}</h2>
                          
                          {/* Created timeline */}
                          <p className="text-[10px] text-neutral-500 mt-1.5 font-mono tracking-wide">
                            بروزرسانی: {new Date(selectedItem.updatedAt).toLocaleDateString('fa-IR')} - ساعت {new Date(selectedItem.updatedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="flex gap-2.5 items-center">
                          <button
                            onClick={() => setActiveView('edit')}
                            className="text-xs text-neutral-300 hover:text-white bg-neutral-950 border border-neutral-850 px-3.5 py-1.5 rounded-lg hover:bg-neutral-900 transition cursor-pointer font-bold"
                          >
                            ویرایش اطلاعات
                          </button>
                          <button
                            onClick={() => handleDeleteItem(selectedItem.id)}
                            className="p-2 text-rose-500 hover:bg-rose-950/20 rounded-lg transition cursor-pointer"
                            title="حذف کامل از ماتریکس"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* TOTP Active Token segment */}
                    {selectedItem.type === 'login' && selectedItem.totpSecret && (
                      <div className="bg-neutral-900 border border-neutral-850/80 rounded-xl p-5 flex items-center justify-between shadow-xs">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-neutral-450 tracking-wider">راز تأیید هویت دو مرحله‌ای (TOTP 2FA)</span>
                          {totpCode ? (
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-mono font-bold tracking-widest text-neutral-200 select-all">
                                {totpCode.slice(0, 3)} {totpCode.slice(3)}
                              </span>
                              <button
                                onClick={() => handleCopyToClipboard(totpCode, 'totp')}
                                className="p-1 rounded bg-neutral-950 hover:bg-neutral-850 text-neutral-400 hover:text-white"
                                title="کپی کردن کد"
                              >
                                {clipboardCopyField === 'totp' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-500">در حال پردازش کد TOTP...</span>
                          )}
                        </div>

                        {/* Circular progress with Countdown */}
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="w-9 h-9 rounded-full border border-neutral-800 flex items-center justify-center relative bg-neutral-950">
                            <span className="text-xs font-mono font-bold text-neutral-200">{totpCountdown}</span>
                          </div>
                          <span className="text-[9px] text-neutral-505 mt-1">ثانیه</span>
                        </div>
                      </div>
                    )}

                    {/* Main Details card table */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 md:p-6 space-y-5">
                      
                      {/* LOGIN Specific Render */}
                      {selectedItem.type === 'login' && (
                        <div className="space-y-4">
                          <div>
                            <span className="text-[10px] font-bold text-neutral-450 block mb-1.5 uppercase tracking-wider">نام کاربری یا ایمیل</span>
                            <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-lg border border-neutral-850">
                              <span className="font-mono text-xs text-neutral-200 select-all">{selectedItem.username || 'بدون نام کاربری'}</span>
                              {selectedItem.username && (
                                <button
                                  onClick={() => handleCopyToClipboard(selectedItem.username, 'user')}
                                  className="text-neutral-500 hover:text-white"
                                >
                                  {clipboardCopyField === 'user' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-neutral-450 block mb-1.5 uppercase tracking-wider">کلمه عبور (Password)</span>
                            <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-lg border border-neutral-850">
                              <span className="font-mono text-xs text-neutral-200 select-all">
                                {showSensitive[selectedItem.id] ? selectedItem.password : '••••••••••••••••'}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setShowSensitive({ ...showSensitive, [selectedItem.id]: !showSensitive[selectedItem.id] })}
                                  className="text-neutral-500 hover:text-white"
                                >
                                  {showSensitive[selectedItem.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleCopyToClipboard(selectedItem.password, 'pass')}
                                  className="text-neutral-500 hover:text-white"
                                >
                                  {clipboardCopyField === 'pass' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {selectedItem.url && (
                            <div>
                              <span className="text-[10px] font-bold text-neutral-450 block mb-1.5 uppercase tracking-wider">آدرس مستقیم وبگاه (URL)</span>
                              <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-lg border border-neutral-850">
                                <a
                                  href={selectedItem.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-mono text-xs text-neutral-300 hover:underline select-all truncate ltr max-w-sm block"
                                >
                                  {selectedItem.url}
                                </a>
                                <button
                                  onClick={() => handleCopyToClipboard(selectedItem.url, 'url')}
                                  className="text-neutral-500 hover:text-white"
                                >
                                  {clipboardCopyField === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* CARD Specific Render */}
                      {selectedItem.type === 'card' && (
                        <div className="space-y-4">
                          <div className="bg-gradient-to-tr from-neutral-800 to-neutral-950 text-white rounded-lg p-5 font-mono border border-neutral-700 shadow-sm flex flex-col justify-between h-44 relative">
                            <div className="flex justify-between items-start">
                              <span className="text-[11px] uppercase tracking-widest font-heading font-bold text-neutral-300">Credit Card</span>
                              <span className="p-1 px-3 bg-neutral-900 border border-neutral-800 rounded text-[10px] font-heading font-bold capitalize text-neutral-300">{selectedItem.brand}</span>
                            </div>
                            
                            <div className="text-base md:text-lg font-bold tracking-widest text-center py-2 select-all text-neutral-100">
                              {selectedItem.number || '•••• •••• •••• ••••'}
                            </div>

                            <div className="flex justify-between items-end text-xs">
                              <div>
                                <p className="text-[9px] text-neutral-500 font-sans tracking-wide">CARDHOLDER</p>
                                <p className="font-sans font-bold tracking-wider text-neutral-200">{selectedItem.cardholder || 'N/A'}</p>
                              </div>
                              <div className="flex gap-4">
                                <div>
                                  <p className="text-[9px] text-neutral-500 font-sans">EXPIRES</p>
                                  <p className="font-sans font-bold text-neutral-200">{selectedItem.expiry || 'MM/YY'}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-neutral-500 font-sans">CVV</p>
                                  <p className="font-sans font-bold text-neutral-200">{selectedItem.cvv || '•••'}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <span className="text-[10px] font-bold text-neutral-550 block mb-1.5">شماره کامل کارت</span>
                              <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-lg border border-neutral-850">
                                <span className="font-mono text-xs select-all text-white">{selectedItem.number}</span>
                                <button onClick={() => handleCopyToClipboard(selectedItem.number, 'cnum')}>
                                  {clipboardCopyField === 'cnum' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-neutral-500" />}
                                </button>
                              </div>
                            </div>

                            {selectedItem.pin && (
                              <div>
                                <span className="text-[10px] font-bold text-neutral-550 block mb-1.5">کاربین رمز عبور کارت (PIN)</span>
                                <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-lg border border-neutral-850">
                                  <span className="font-mono text-xs select-all text-white">
                                    {showSensitive[`${selectedItem.id}-pin`] ? selectedItem.pin : '••••'}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => setShowSensitive({ ...showSensitive, [`${selectedItem.id}-pin`]: !showSensitive[`${selectedItem.id}-pin`] })}>
                                      {showSensitive[`${selectedItem.id}-pin`] ? <EyeOff className="w-4 h-4 text-neutral-500" /> : <Eye className="w-4 h-4 text-neutral-500" />}
                                    </button>
                                    <button onClick={() => handleCopyToClipboard(selectedItem.pin, 'cpin')}>
                                      {clipboardCopyField === 'cpin' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-neutral-500" />}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* SECURE NOTE Specific Render */}
                      {selectedItem.type === 'note' && (
                        <div>
                          <span className="text-[10px] font-bold text-neutral-450 block mb-2 uppercase tracking-wider">محتوای کدگذاری شده یادداشت</span>
                          <div className="p-4 bg-neutral-950 rounded-lg border border-neutral-850 h-56 overflow-y-auto relative">
                            {/* Copy note floating action */}
                            <button
                              onClick={() => handleCopyToClipboard(selectedItem.content, 'cnote')}
                              className="absolute top-2 left-2 p-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-md text-neutral-400 hover:text-white"
                            >
                              {clipboardCopyField === 'cnote' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <p className="text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap select-all pr-4">
                              {selectedItem.content || 'هیچ متنی نوشته نشده است.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Common Footer Metadata: Tags & Custom Notes */}
                      {(selectedItem.tags?.length > 0 || selectedItem.notes) && (
                        <div className="pt-4 border-t border-neutral-800/80 space-y-3">
                          {selectedItem.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {selectedItem.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] font-mono font-bold bg-neutral-950 text-neutral-400 px-2.5 py-0.5 rounded border border-neutral-850"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {selectedItem.notes && (
                            <div>
                              <span className="text-[10px] font-bold text-neutral-450 block mb-1">توضیحات تکمیلی</span>
                              <p className="text-xs text-neutral-400 leading-5 whitespace-pre-wrap bg-neutral-950 p-2.5 rounded-lg border border-neutral-850">
                                {selectedItem.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </section>
            </>
          )}

        </main>
      </div>

      {/* Sub Folder Modal drawer */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl transition">
            <h3 className="font-bold text-white text-sm mb-3 font-heading">ساخت پوشه نظم‌دهی جدید</h3>
            <form onSubmit={handleCreateFolder}>
              <input
                type="text"
                placeholder="نام پوشه (کارهای اداری، مالی، شخصی...)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 focus:border-neutral-500 rounded-lg text-xs outline-none text-white placeholder:text-neutral-600 mb-4"
                required
              />
              <div className="flex gap-2.5">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-white hover:bg-neutral-200 text-neutral-950 font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  اضافه کردن پوشه
                </button>
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
