
import React, { useEffect, useState, useRef } from 'react';
import { getSupabaseClient } from './services/supabaseClient';
import { Logo } from './components/Logo';
import { Input } from './components/Input';
import { Button } from './components/Button';
import { Modal } from './components/Modal';
import { Badge } from './components/Badge';
import { Avatar } from './components/Avatar';
import { OtpCard } from './components/OtpCard';
import { ADMIN_USERS_FUNCTION_URL, SHARED_OTPS_FUNCTION_URL } from './constants';
import { AdminUser, SharedToken, PaginatedResponse } from './types'; 
import { 
  Mail, 
  Lock, 
  LogOut, 
  LayoutDashboard, 
  Users, 
  Globe,
  AlertCircle,
  UserPlus,
  Shuffle,
  Copy,
  CheckCircle2,
  User as UserIcon,
  Search,
  Edit2,
  Trash2,
  Ban,
  Unlock,
  RefreshCw,
  Calendar,
  CheckSquare,
  KeyRound,
  Plus,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  X
} from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null); // State to store role from DB
  const [isLoading, setIsLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);

  // App State
  const [currentView, setCurrentView] = useState<'dashboard' | 'users' | 'profiles' | '2fa'>('dashboard');

  // Users Management State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState({ page: 1, per_page: 10, total: 0 });

  // Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [countdown, setCountdown] = useState(0); // Safety Countdown

  // Shared 2FA State
  const [sharedTokens, setSharedTokens] = useState<SharedToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'delete' | 'ban' | 'create_token' | 'delete_token' | 'bulk_delete' | 'bulk_ban'>('create');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedToken, setSelectedToken] = useState<SharedToken | null>(null);
  
  // Form State (User)
  const [formNickname, setFormNickname] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  
  // Form State (2FA Token)
  const [formTokenProvider, setFormTokenProvider] = useState('');
  const [formTokenSecret, setFormTokenSecret] = useState('');
  
  // Expiration Date Logic
  const [useDefaultExpiry, setUseDefaultExpiry] = useState(true);
  const [expiryDate, setExpiryDate] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Computed Check
  // Check if current user is admin based on DB Role
  const isAdmin = userRole === 'admin';

  // --- Helpers ---

  const getFutureDate = (daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    return d.toISOString().split('T')[0];
  };

  const formatDate = (dateString: string | null | undefined) => {
    // Regra 1: Se for null/undefined, mostra "Eterno"
    if (!dateString) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
          Eterno
        </span>
      );
    }
    
    // Normalize date string: handle Postgres timestamp (space to T)
    let safeDate = dateString.replace(' ', 'T');
    
    // Regra 2: Fix de Timezone
    // Se a string for apenas YYYY-MM-DD (10 chars), adicionamos T12:00:00.
    if (safeDate.length === 10) {
        safeDate = `${safeDate}T12:00:00`;
    }
    
    const date = new Date(safeDate);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return <span className="text-gray-600">--</span>;

    const now = new Date();
    // Compare only dates by stripping time for expiration check
    const today = new Date();
    today.setHours(0,0,0,0);
    const expDate = new Date(date);
    expDate.setHours(0,0,0,0);
    
    const isExpired = expDate < today;
    
    return (
      <span className={isExpired ? "text-red-400 font-medium" : "text-gray-300"}>
        {date.toLocaleDateString('pt-BR')}
      </span>
    );
  };

  // --- Initialization ---

  useEffect(() => {
    const supabase = getSupabaseClient();
    
    const savedEmail = localStorage.getItem('ninjabr_saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const fetchRole = async (uid: string) => {
       const { data } = await supabase.from('profiles').select('role').eq('id', uid).single();
       if (data?.role) setUserRole(data.role);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
         fetchRole(session.user.id);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
         fetchRole(session.user.id);
      } else {
         setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // View Effects
  useEffect(() => {
    if (!session) return;
    
    if (currentView === 'users') {
      fetchUsers(1); // Reset to page 1 on view change
    }
    if (currentView === '2fa') {
      fetchSharedTokens();
    }
  }, [session, currentView]);

  // Countdown Effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isModalOpen && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown, isModalOpen]);


  // --- API Functions ---

  const fetchUsers = async (page = 1) => {
    setUsersLoading(true);
    // Clear selection on page change to avoid confusion, 
    // or keep it if you want cross-page selection (simplified to clear here)
    setSelectedIds(new Set()); 
    
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        per_page: '10'
      });
      
      // If backend supports search, we would add it here:
      // if (usersSearch) queryParams.append('search', usersSearch);

      const response = await fetch(`${ADMIN_USERS_FUNCTION_URL}?${queryParams.toString()}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) throw new Error('Falha ao carregar usuários');
      
      const json: PaginatedResponse = await response.json();
      
      setUsers(json.data);
      if (json.meta) {
        setPaginationMeta(json.meta);
        setCurrentPage(json.meta.page);
      }
    } catch (error) {
      console.error(error);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchSharedTokens = async () => {
    setTokensLoading(true);
    try {
      const response = await fetch(SHARED_OTPS_FUNCTION_URL, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSharedTokens(data);
      }
    } catch (error) {
      console.error("Erro ao buscar tokens", error);
    } finally {
      setTokensLoading(false);
    }
  };

  const handleCreateUser = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const finalExpiresAt = useDefaultExpiry ? null : `${expiryDate}T23:59:59`;
      const response = await fetch(ADMIN_USERS_FUNCTION_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({
          nickname: formNickname,
          email: formEmail || `${formNickname.toLowerCase().replace(/\s+/g, '')}@ninjabr.local`,
          password: formPassword,
          expires_at: finalExpiresAt
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao criar');
      }

      setActionMessage({ type: 'success', text: 'Usuário criado com sucesso!' });
      fetchUsers(currentPage); 
      setTimeout(() => {
         setIsModalOpen(false);
         resetForm();
      }, 1500);
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const body: any = { id: selectedUser.id, nickname: formNickname };
      if (formEmail && formEmail !== selectedUser.email) body.email = formEmail;
      if (formPassword) body.password = formPassword;

      // Logic: If Default is checked, send NULL to clear expiration or use default DB behavior
      // If unchecked, send the specific date.
      const finalExpiresAt = useDefaultExpiry ? null : `${expiryDate}T23:59:59`;
      body.expires_at = finalExpiresAt;

      const response = await fetch(ADMIN_USERS_FUNCTION_URL, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error('Erro ao editar');

      setActionMessage({ type: 'success', text: 'Usuário atualizado!' });
      fetchUsers(currentPage);
      setTimeout(() => {
        setIsModalOpen(false);
        resetForm();
      }, 1000);
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      // Using Bulk format for single delete as well to be safe with the new API version.
      const response = await fetch(ADMIN_USERS_FUNCTION_URL, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ ids: [selectedUser.id] })
      });

      if (!response.ok) throw new Error('Erro ao deletar');
      fetchUsers(currentPage);
      setIsModalOpen(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBan = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    const isBanned = !!selectedUser.banned_until;
    const duration = isBanned ? "none" : "876000h"; 
    try {
      // Using Bulk format for single action
      const response = await fetch(ADMIN_USERS_FUNCTION_URL, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ ids: [selectedUser.id], ban_duration: duration })
      });
      if (!response.ok) throw new Error('Erro ao alterar status');
      fetchUsers(currentPage);
      setIsModalOpen(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- Bulk Actions Handlers ---

  const handleBulkDelete = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(ADMIN_USERS_FUNCTION_URL, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });

      if (!response.ok) throw new Error('Erro ao deletar em massa');
      fetchUsers(currentPage);
      setIsModalOpen(false);
      setSelectedIds(new Set());
    } catch (error: any) {
      alert(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkBan = async (ban: boolean) => {
    setActionLoading(true);
    const duration = ban ? "876000h" : "none";
    try {
      const response = await fetch(ADMIN_USERS_FUNCTION_URL, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ ids: Array.from(selectedIds), ban_duration: duration })
      });
      if (!response.ok) throw new Error('Erro ao alterar status em massa');
      fetchUsers(currentPage);
      setIsModalOpen(false);
      setSelectedIds(new Set());
    } catch (error: any) {
      alert(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- Shared Token Handlers ---

  const handleCreateToken = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const response = await fetch(SHARED_OTPS_FUNCTION_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({
          provider_name: formTokenProvider,
          otp_secret: formTokenSecret
        })
      });

      if (!response.ok) throw new Error('Erro ao adicionar conta 2FA');

      setActionMessage({ type: 'success', text: 'Conta adicionada!' });
      fetchSharedTokens();
      setTimeout(() => {
        setIsModalOpen(false);
        resetForm();
      }, 1000);
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteToken = async () => {
    if (!selectedToken) return;
    setActionLoading(true);
    try {
      const response = await fetch(SHARED_OTPS_FUNCTION_URL, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ id: selectedToken.id })
      });

      if (!response.ok) throw new Error('Erro ao remover conta');
      
      fetchSharedTokens();
      setIsModalOpen(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- Auth Handlers ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) return;

    if (rememberEmail) {
      localStorage.setItem('ninjabr_saved_email', email);
    } else {
      localStorage.removeItem('ninjabr_saved_email');
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError("Credenciais inválidas.");
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
  };

  // --- UI Handlers ---

  const openModal = (mode: typeof modalMode, user?: AdminUser, token?: SharedToken) => {
    setModalMode(mode);
    setSelectedUser(user || null);
    setSelectedToken(token || null);
    setActionMessage(null);
    
    // Safety Countdown Logic
    if (mode === 'bulk_delete' || mode === 'bulk_ban') {
      setCountdown(5); // 5 seconds wait time
    } else {
      setCountdown(0);
    }
    
    // Pre-fill Logic
    if (mode === 'edit' && user) {
      setFormNickname(user.username || '');
      setFormEmail(user.email || '');
      setFormPassword('');
      // Check if user has an expiration date
      if (user.expires_at) {
        setUseDefaultExpiry(false);
        // Extract YYYY-MM-DD safely
        setExpiryDate(user.expires_at.split('T')[0]);
      } else {
        setUseDefaultExpiry(true);
        // Default to 30 days ahead if switching from infinite to custom
        setExpiryDate(getFutureDate(30));
      }
    } else if (mode === 'create') {
      resetForm();
    } else if (mode === 'create_token') {
      setFormTokenProvider('');
      setFormTokenSecret('');
    }
    
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormNickname('');
    setFormEmail('');
    setFormPassword('');
    setUseDefaultExpiry(true);
    setExpiryDate(getFutureDate(30));
    setFormTokenProvider('');
    setFormTokenSecret('');
  };

  const generateRandom = (e: React.MouseEvent) => {
    e.preventDefault();
    const adjectives = ['Ninja', 'Shadow', 'Ghost', 'Viper', 'Cyber'];
    const nouns = ['Agent', 'Walker', 'Coder', 'Master', 'Snake'];
    const nick = `${adjectives[Math.floor(Math.random()*adjectives.length)]}${nouns[Math.floor(Math.random()*nouns.length)]}_${Math.floor(Math.random()*100)}`;
    const pass = Math.random().toString(36).slice(-10) + "!@";
    setFormNickname(nick);
    setFormPassword(pass);
    if (!formEmail) setFormEmail(`${nick.toLowerCase().replace(/\s+/g, '')}@ninjabr.local`);
  };

  // --- Selection Logic ---
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newSet = new Set(selectedIds);
      users.forEach(u => newSet.add(u.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      users.forEach(u => newSet.delete(u.id));
      setSelectedIds(newSet);
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const isAllSelected = users.length > 0 && users.every(u => selectedIds.has(u.id));

  // Client-side search filtering (if needed, but ideally API handles it. Keeping simple client filter for now on page)
  const filteredUsers = users.filter(u => {
    const displayNick = (u.username || '').toLowerCase();
    const displayEmail = (u.email || '').toLowerCase();
    const search = usersSearch.toLowerCase();
    return displayEmail.includes(search) || displayNick.includes(search);
  });

  // Calculate Total Pages
  const totalPages = Math.ceil((paginationMeta.total || 0) / (paginationMeta.per_page || 10)) || 1;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ninja-500"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-ninja-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="w-full max-w-md z-10">
          <div className="text-center mb-10">
            <Logo className="justify-center scale-[2] mb-6" />
          </div>
          <div className="bg-dark-800 p-8 rounded-2xl shadow-2xl border border-dark-700">
            <form onSubmit={handleLogin} className="space-y-6">
              {authError && <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded">{authError}</div>}
              <Input label="Email" type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail className="w-4 h-4" />} />
              <Input label="Senha" type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} icon={<Lock className="w-4 h-4" />} />
              <div className="flex items-center">
                <input id="remember-me" type="checkbox" checked={rememberEmail} onChange={(e) => setRememberEmail(e.target.checked)} className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-ninja-500 accent-ninja-500 focus:ring-ninja-500 focus:ring-offset-dark-800" />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400">Lembrar meu email</label>
              </div>
              <Button type="submit" fullWidth size="lg" isLoading={authLoading}>Entrar</Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 flex text-gray-100 font-sans">
      <aside className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col hidden md:flex">
        <div className="p-6"><Logo /></div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <SidebarItem icon={<LayoutDashboard size={20}/>} label="Visão Geral" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')}/>
          <SidebarItem icon={<Users size={20}/>} label="Usuários" active={currentView === 'users'} onClick={() => setCurrentView('users')}/>
          <SidebarItem icon={<Globe size={20}/>} label="Browser Profiles" active={currentView === 'profiles'} onClick={() => setCurrentView('profiles')}/>
          
          <div className="pt-4 mt-2 border-t border-dark-700/50">
             <SidebarItem icon={<KeyRound size={20}/>} label="Tokens 2FA" active={currentView === '2fa'} onClick={() => setCurrentView('2fa')}/>
          </div>
        </nav>
        <div className="p-4 border-t border-dark-700">
          <Button variant="secondary" fullWidth onClick={handleLogout} className="text-xs"><LogOut className="w-4 h-4 mr-2" /> Sair</Button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col h-screen relative">
        <header className="h-16 border-b border-dark-700 flex items-center justify-between px-4 md:px-8 bg-dark-800/50 backdrop-blur-sm">
          <div className="md:hidden"><Logo className="scale-75 origin-left" /></div>
          <h1 className="text-lg font-semibold hidden md:block">
            {currentView === 'dashboard' ? 'Dashboard' : currentView === 'users' ? 'Gerenciar Usuários' : currentView === '2fa' ? 'Autenticação 2FA' : 'Perfis'}
          </h1>
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end mr-2">
               <span className="text-xs text-white font-medium">{session.user.email}</span>
               <span className="text-[10px] text-ninja-500 uppercase tracking-wide border border-ninja-500/30 px-1 rounded bg-ninja-500/10">
                 {isAdmin ? 'Administrador' : 'Usuário'}
               </span>
             </div>
             <Avatar seed={session.user.email} size={32} />
          </div>
        </header>
        
        <div className="md:hidden bg-dark-800 border-b border-dark-700 p-2 flex justify-around">
          <button onClick={() => setCurrentView('dashboard')} className={`p-2 rounded-lg ${currentView === 'dashboard' ? 'text-ninja-500' : 'text-gray-400'}`}><LayoutDashboard/></button>
          <button onClick={() => setCurrentView('users')} className={`p-2 rounded-lg ${currentView === 'users' ? 'text-ninja-500' : 'text-gray-400'}`}><Users/></button>
          <button onClick={() => setCurrentView('2fa')} className={`p-2 rounded-lg ${currentView === '2fa' ? 'text-ninja-500' : 'text-gray-400'}`}><KeyRound/></button>
          <button onClick={handleLogout} className="p-2 text-red-400"><LogOut/></button>
        </div>

        <div className="p-4 md:p-8 flex-1 overflow-y-auto pb-24">
          {currentView === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Usuários (Total)" value={String(paginationMeta.total || 0)} trend="--" />
              <StatCard title="Perfis Ativos" value="124" trend="+12%" />
              
              <button onClick={() => setCurrentView('users')} className="bg-gradient-to-br from-ninja-600 to-ninja-800 p-6 rounded-xl text-left shadow-lg transform transition hover:scale-[1.02]">
                <UserPlus className="w-8 h-8 text-white mb-4" />
                <h3 className="text-xl font-bold text-white">Criar Novo Usuário</h3>
                <p className="text-ninja-100 text-sm mt-1">Adicionar acesso ao painel</p>
              </button>
            </div>
          )}

          {currentView === 'users' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Buscar na página..." className="w-full bg-dark-800 border border-dark-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-ninja-500 outline-none" value={usersSearch} onChange={(e) => setUsersSearch(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => fetchUsers(currentPage)} disabled={usersLoading}>
                    <RefreshCw className={`w-4 h-4 ${usersLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  {isAdmin && <Button onClick={() => openModal('create')}><UserPlus className="w-4 h-4 mr-2" /> Novo Usuário</Button>}
                </div>
              </div>

              <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-dark-900/50 text-gray-400 text-xs uppercase font-medium">
                      <tr>
                        {isAdmin && (
                          <th className="px-6 py-4 w-10">
                            <input 
                              type="checkbox" 
                              checked={isAllSelected}
                              onChange={handleSelectAll}
                              className="rounded border-dark-600 bg-dark-700 text-ninja-500 accent-ninja-500 focus:ring-ninja-500"
                            />
                          </th>
                        )}
                        <th className="px-6 py-4">Usuário / Email</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Expira em</th>
                        {isAdmin && <th className="px-6 py-4 text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-700">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className={`hover:bg-dark-700/30 transition-colors ${selectedIds.has(user.id) ? 'bg-ninja-500/5' : ''}`}>
                          {isAdmin && (
                            <td className="px-6 py-4">
                              <input 
                                type="checkbox"
                                checked={selectedIds.has(user.id)}
                                onChange={() => handleSelectOne(user.id)}
                                className="rounded border-dark-600 bg-dark-700 text-ninja-500 accent-ninja-500 focus:ring-ninja-500"
                              />
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar seed={user.email} size={40} />
                              <div>
                                <div className="font-medium text-white">{user.username || "Sem apelido"}</div>
                                <div className="text-xs text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {user.banned_until ? <Badge variant="error">Bloqueado</Badge> : <Badge variant="success">Ativo</Badge>}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {formatDate(user.expires_at || user.user_metadata?.expires_at)}
                          </td>
                          {isAdmin && (
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => openModal('edit', user)} className="p-2 hover:bg-dark-600 rounded-lg text-gray-400 hover:text-white transition" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => openModal('ban', user)} className={`p-2 hover:bg-dark-600 rounded-lg transition ${user.banned_until ? 'text-green-500' : 'text-orange-500'}`} title={user.banned_until ? 'Desbloquear' : 'Bloquear'}>{user.banned_until ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}</button>
                                <button onClick={() => openModal('delete', user)} className="p-2 hover:bg-dark-600 rounded-lg text-red-500 hover:text-red-400 transition" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && !usersLoading && <tr><td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination Controls */}
                <div className="border-t border-dark-700 px-6 py-4 flex items-center justify-between bg-dark-800/50">
                   <div className="text-sm text-gray-400">
                     Página <span className="text-white font-medium">{currentPage}</span> de <span className="text-white font-medium">{totalPages}</span> 
                     <span className="ml-2 text-xs opacity-60">({paginationMeta.total} registros)</span>
                   </div>
                   <div className="flex gap-2">
                     <Button 
                       variant="secondary" 
                       size="sm" 
                       disabled={currentPage <= 1 || usersLoading}
                       onClick={() => fetchUsers(currentPage - 1)}
                     >
                       <ChevronLeft className="w-4 h-4 mr-1"/> Anterior
                     </Button>
                     <Button 
                       variant="secondary" 
                       size="sm" 
                       disabled={currentPage >= totalPages || usersLoading}
                       onClick={() => fetchUsers(currentPage + 1)}
                     >
                       Próximo <ChevronRight className="w-4 h-4 ml-1"/>
                     </Button>
                   </div>
                </div>
              </div>
            </div>
          )}

          {currentView === '2fa' && (
             <div className="space-y-6">
                <div className="flex items-center justify-between">
                   <div>
                     <h2 className="text-xl font-bold text-white flex items-center gap-2">
                       <ShieldCheck className="text-ninja-500"/> Contas Conectadas
                     </h2>
                     <p className="text-sm text-gray-400">Tokens TOTP compartilhados para acesso externo</p>
                   </div>
                   <div className="flex gap-2">
                      <Button variant="secondary" onClick={fetchSharedTokens} disabled={tokensLoading}>
                        <RefreshCw className={`w-4 h-4 ${tokensLoading ? 'animate-spin' : ''}`} />
                      </Button>
                      {isAdmin && (
                        <Button onClick={() => openModal('create_token')}>
                          <Plus className="w-4 h-4 mr-2" /> Adicionar Conta
                        </Button>
                      )}
                   </div>
                </div>

                {tokensLoading && sharedTokens.length === 0 ? (
                  <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ninja-500"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sharedTokens.map(token => (
                      <OtpCard 
                        key={token.id} 
                        token={token} 
                        isAdmin={isAdmin} 
                        onDelete={() => openModal('delete_token', undefined, token)} 
                      />
                    ))}
                    {sharedTokens.length === 0 && (
                       <div className="col-span-full py-12 text-center text-gray-500 bg-dark-800/50 rounded-xl border border-dashed border-dark-700">
                          <KeyRound className="mx-auto w-12 h-12 mb-3 opacity-20"/>
                          Nenhum token configurado.
                       </div>
                    )}
                  </div>
                )}
             </div>
          )}
        </div>

        {/* Bulk Action Floating Bar */}
        {isAdmin && selectedIds.size > 0 && currentView === 'users' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-dark-800 border border-dark-600 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-5 fade-in z-20">
             <div className="text-sm font-medium text-white border-r border-dark-600 pr-4">
                {selectedIds.size} selecionado(s)
             </div>
             <div className="flex gap-2">
               <button onClick={() => openModal('bulk_ban')} className="p-2 hover:bg-dark-700 rounded-full text-orange-500 transition tooltip" title="Bloquear/Desbloquear em massa">
                 <Ban size={18} />
               </button>
               <button onClick={() => openModal('bulk_delete')} className="p-2 hover:bg-dark-700 rounded-full text-red-500 transition tooltip" title="Excluir em massa">
                 <Trash2 size={18} />
               </button>
               <button onClick={() => setSelectedIds(new Set())} className="ml-2 text-xs text-gray-500 hover:text-white underline">
                 Cancelar
               </button>
             </div>
          </div>
        )}
      </main>

      {/* USER MODALS (Create/Edit) */}
      <Modal
        isOpen={isModalOpen && (modalMode === 'create' || modalMode === 'edit')}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={modalMode === 'create' ? handleCreateUser : handleEditUser} isLoading={actionLoading}>
              {modalMode === 'create' ? 'Criar Usuário' : 'Salvar Alterações'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {actionMessage && (
            <div className={`p-3 rounded-lg text-sm flex gap-2 ${actionMessage.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4"/> : <AlertCircle className="w-4 h-4"/>}
              {actionMessage.text}
            </div>
          )}
          
          <div className="flex justify-end">
            <button onClick={generateRandom} className="text-xs text-ninja-500 flex items-center hover:underline">
              <Shuffle className="w-3 h-3 mr-1" /> Gerar Aleatório
            </button>
          </div>

          <Input label="Apelido (Username)" value={formNickname} onChange={e => setFormNickname(e.target.value)} icon={<UserIcon className="w-4 h-4"/>}/>
          <Input label="Email" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} icon={<Mail className="w-4 h-4"/>}/>
          <div className="relative">
             <Input label={modalMode === 'edit' ? "Nova Senha (deixe em branco para manter)" : "Senha"} value={formPassword} onChange={e => setFormPassword(e.target.value)} icon={<Lock className="w-4 h-4"/>}/>
            {formPassword && (
              <button type="button" onClick={() => navigator.clipboard.writeText(formPassword)} className="absolute right-3 top-9 text-gray-500 hover:text-white"><Copy className="w-4 h-4" /></button>
            )}
          </div>

          <div className="pt-2 border-t border-dark-700/50 mt-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">Validade do Acesso</label>
            <div className="flex items-center mb-3">
              <button type="button" onClick={() => setUseDefaultExpiry(!useDefaultExpiry)} className={`flex items-center text-sm ${useDefaultExpiry ? 'text-ninja-400' : 'text-gray-500'}`}>
                {useDefaultExpiry ? <CheckSquare className="w-4 h-4 mr-2" /> : <div className="w-4 h-4 mr-2 border border-gray-500 rounded" />}
                Padrão (Eterno / 30 Dias)
              </button>
            </div>
            {!useDefaultExpiry && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} icon={<Calendar className="w-4 h-4" />} label="Data de Expiração"/>
                <p className="text-xs text-gray-500 mt-1 ml-1">O acesso expirará às 23:59 do dia selecionado.</p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* USER MODAL (Delete/Ban) */}
      <Modal
        isOpen={isModalOpen && modalMode === 'delete'}
        onClose={() => setIsModalOpen(false)}
        title="Confirmar Exclusão"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDeleteUser} isLoading={actionLoading}>Excluir Usuário</Button>
          </>
        }
      >
        <div className="text-gray-300">
          <p>Tem certeza que deseja excluir o usuário <strong className="text-white">{selectedUser?.username || selectedUser?.email}</strong>?</p>
          <p className="text-sm text-gray-500 mt-2">Esta ação não pode ser desfeita. Todos os perfis associados serão perdidos.</p>
        </div>
      </Modal>

      <Modal
        isOpen={isModalOpen && modalMode === 'ban'}
        onClose={() => setIsModalOpen(false)}
        title={selectedUser?.banned_until ? "Desbloquear Usuário" : "Bloquear Usuário"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button variant={selectedUser?.banned_until ? "primary" : "danger"} onClick={handleToggleBan} isLoading={actionLoading}>
              {selectedUser?.banned_until ? "Confirmar Desbloqueio" : "Confirmar Bloqueio"}
            </Button>
          </>
        }
      >
        <div className="text-gray-300">
          <p>Deseja realmente {selectedUser?.banned_until ? "desbloquear" : "bloquear"} o acesso de <strong className="text-white mx-1">{selectedUser?.username || selectedUser?.email}</strong>?</p>
          {!selectedUser?.banned_until && <p className="text-sm text-gray-500 mt-2">O usuário será desconectado imediatamente e não poderá acessar o painel.</p>}
        </div>
      </Modal>
      
      {/* BULK MODALS */}
      <Modal
        isOpen={isModalOpen && modalMode === 'bulk_delete'}
        onClose={() => setIsModalOpen(false)}
        title={`Excluir ${selectedIds.size} Usuários`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button 
              variant="danger" 
              onClick={handleBulkDelete} 
              isLoading={actionLoading}
              disabled={countdown > 0}
            >
              {countdown > 0 ? `Aguarde (${countdown}s)` : 'Excluir Todos'}
            </Button>
          </>
        }
      >
        <div className="text-gray-300">
          <p>Você selecionou <strong className="text-white">{selectedIds.size}</strong> usuários para exclusão.</p>
          <p className="text-sm text-red-400 mt-2 border-l-2 border-red-500 pl-3">Atenção: Esta ação é irreversível.</p>
        </div>
      </Modal>

      <Modal
        isOpen={isModalOpen && modalMode === 'bulk_ban'}
        onClose={() => setIsModalOpen(false)}
        title="Gerenciar Bloqueio em Massa"
        footer={null} // Custom Footer in body for split buttons
      >
        <div className="text-gray-300 space-y-4">
          <p>O que deseja fazer com os <strong className="text-white">{selectedIds.size}</strong> usuários selecionados?</p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <button 
              onClick={() => handleBulkBan(false)}
              disabled={countdown > 0 || actionLoading}
              className="flex flex-col items-center justify-center p-4 rounded-xl border border-dark-600 bg-dark-700/50 hover:bg-green-900/20 hover:border-green-500/50 transition gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Unlock className="text-green-500 group-hover:scale-110 transition"/>
              <span className="font-medium text-green-400">
                {countdown > 0 ? `(${countdown}s)` : 'Desbloquear Todos'}
              </span>
            </button>
            <button 
              onClick={() => handleBulkBan(true)}
              disabled={countdown > 0 || actionLoading}
              className="flex flex-col items-center justify-center p-4 rounded-xl border border-dark-600 bg-dark-700/50 hover:bg-red-900/20 hover:border-red-500/50 transition gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Ban className="text-orange-500 group-hover:scale-110 transition"/>
              <span className="font-medium text-orange-400">
                {countdown > 0 ? `(${countdown}s)` : 'Bloquear Todos'}
              </span>
            </button>
          </div>
          {actionLoading && <div className="text-center text-xs text-gray-500 animate-pulse">Processando...</div>}
        </div>
      </Modal>

      {/* SHARED TOKEN MODALS */}
      <Modal
        isOpen={isModalOpen && modalMode === 'create_token'}
        onClose={() => setIsModalOpen(false)}
        title="Adicionar Conta 2FA"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateToken} isLoading={actionLoading}>Salvar Conta</Button>
          </>
        }
      >
        <div className="space-y-4">
           {actionMessage && (
            <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-400 flex gap-2">
              <AlertCircle className="w-4 h-4"/> {actionMessage.text}
            </div>
           )}
           <p className="text-sm text-gray-400">Adicione uma nova conta compartilhada. Todos os usuários poderão gerar códigos para este serviço.</p>
           <Input 
             label="Nome do Serviço (ex: Google Ads 01)" 
             value={formTokenProvider} 
             onChange={e => setFormTokenProvider(e.target.value)} 
             icon={<Globe className="w-4 h-4"/>}
             placeholder="Identificação da conta"
           />
           <Input 
             label="Chave Secreta (Key/Secret)" 
             value={formTokenSecret} 
             onChange={e => setFormTokenSecret(e.target.value)} 
             icon={<KeyRound className="w-4 h-4"/>}
             placeholder="Ex: JBSWY3DPEHPK3PXP"
           />
        </div>
      </Modal>

      <Modal
        isOpen={isModalOpen && modalMode === 'delete_token'}
        onClose={() => setIsModalOpen(false)}
        title="Remover Conta 2FA"
        footer={
           <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDeleteToken} isLoading={actionLoading}>Excluir Conta</Button>
           </>
        }
      >
         <div className="text-gray-300">
          <p>Tem certeza que deseja remover a conta <strong className="text-white">{selectedToken?.provider_name}</strong>?</p>
          <p className="text-sm text-gray-500 mt-2">Nenhum usuário conseguirá mais gerar códigos para este serviço.</p>
        </div>
      </Modal>

    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${active ? 'bg-ninja-500/10 text-ninja-500 border border-ninja-500/20' : 'text-gray-400 hover:bg-dark-700 hover:text-white'}`}>
    {icon} <span>{label}</span>
  </button>
);

const StatCard = ({ title, value, trend }: any) => (
  <div className="bg-dark-800 p-5 rounded-xl border border-dark-700 shadow-sm">
    <p className="text-sm text-gray-400 mb-1">{title}</p>
    <div className="flex items-end justify-between">
      <h4 className="text-2xl font-bold text-white">{value}</h4>
      <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400">{trend}</span>
    </div>
  </div>
);

export default App;
