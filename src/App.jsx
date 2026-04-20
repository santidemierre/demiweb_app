import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  query
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  LayoutDashboard, 
  Users, 
  CalendarClock, 
  ShieldCheck, 
  Globe, 
  Server, 
  Plus, 
  Trash2, 
  Edit3, 
  AlertTriangle,
  ExternalLink,
  Settings,
  Mail
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
// Reemplazar con tu configuración real de Firebase Console si es necesario
const firebaseConfigRaw = import.meta.env.VITE_FIREBASE_CONFIG;
let firebaseConfig = null;
let firebaseInitError = null;
let app = null;
let auth = null;
let db = null;

try {
  firebaseConfig = firebaseConfigRaw ? JSON.parse(firebaseConfigRaw) : null;
} catch (error) {
  firebaseInitError = error;
}

const hasFirebaseConfig = firebaseConfig && Object.keys(firebaseConfig).length > 0 && firebaseConfig.apiKey;

if (hasFirebaseConfig && !firebaseInitError) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    firebaseInitError = error;
  }
}

const appId = import.meta.env.VITE_APP_ID || 'vencimientos-web-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState({
    hostingResellerPrice: 0,
    domainPrice: 0,
    sslPrice: 0,
    lastUpdate: new Date().toISOString()
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  if (firebaseInitError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Error de configuración de Firebase</h1>
          <p className="text-slate-600 mb-4">{firebaseInitError.message}</p>
          <p className="text-sm text-slate-500">Verifica tu variable de entorno <code className="bg-slate-100 px-2 py-1 rounded">VITE_FIREBASE_CONFIG</code> en <code className="bg-slate-100 px-2 py-1 rounded">.env.local</code>.</p>
        </div>
      </div>
    );
  }

  if (!hasFirebaseConfig) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Falta configuración de Firebase</h1>
          <p className="text-slate-600 mb-4">Debes definir <code className="bg-slate-100 px-2 py-1 rounded">VITE_FIREBASE_CONFIG</code> en tu archivo <code className="bg-slate-100 px-2 py-1 rounded">.env.local</code>.</p>
          <p className="text-sm text-slate-500">Copia los valores de tu Firebase Console y reinicia el servidor.</p>
        </div>
      </div>
    );
  }

  // Auth initialization
  useEffect(() => {
    const initAuth = async () => {
      if (import.meta.env.VITE_INITIAL_AUTH_TOKEN) {
        await signInWithCustomToken(auth, import.meta.env.VITE_INITIAL_AUTH_TOKEN);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Sync Data
  useEffect(() => {
    if (!user) return;

    // Listen to clients
    const qClients = collection(db, 'artifacts', appId, 'public', 'data', 'clients');
    const unsubClients = onSnapshot(qClients, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(docs);
    }, (err) => console.error("Error fetching clients:", err));

    // Listen to settings/prices
    const qSettings = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'global');
    const unsubSettings = onSnapshot(qSettings, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
    }, (err) => console.error("Error fetching settings:", err));

    return () => {
      unsubClients();
      unsubSettings();
    };
  }, [user]);

  // Logic: Calcular vencimientos cercanos
  const alerts = useMemo(() => {
    const today = new Date();
    const threshold = 20; // Días para alertar
    
    return clients.flatMap(client => {
      const items = [
        { type: 'Dominio', date: client.domainExpiry, label: 'dominio' },
        { type: 'Hosting', date: client.hostingExpiry, label: 'hosting' },
        { type: 'SSL', date: client.sslExpiry, label: 'SSL' }
      ];

      return items
        .filter(item => item.date)
        .map(item => {
          const expiryDate = new Date(item.date);
          const diffTime = expiryDate - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return { ...item, diffDays, clientName: client.name, clientId: client.id };
        })
        .filter(item => item.diffDays <= threshold && item.diffDays >= -5); // Mostrar incluso si venció hace poco
    }).sort((a, b) => a.diffDays - b.diffDays);
  }, [clients]);

  // Handle CRUD
  const saveClient = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const clientData = {
      name: formData.get('name'),
      url: formData.get('url'),
      domainExpiry: formData.get('domainExpiry'),
      hostingExpiry: formData.get('hostingExpiry'),
      sslExpiry: formData.get('sslExpiry'),
      notes: formData.get('notes'),
      managesOwn: formData.get('managesOwn') === 'on',
      updatedAt: new Date().toISOString()
    };

    if (editingClient) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', editingClient.id), clientData);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), clientData);
    }
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const deleteClient = async (id) => {
    if (confirm('¿Estás seguro de eliminar este cliente?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', id));
    }
  };

  const updatePrices = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newPrices = {
      hostingResellerPrice: Number(formData.get('reseller')),
      domainPrice: Number(formData.get('domain')),
      sslPrice: Number(formData.get('ssl')),
      lastUpdate: new Date().toISOString()
    };
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'global'), newPrices);
  };

  // Función para enviar email simulada (Requiere EmailJS)
  const sendAlertEmail = (alert) => {
    // Aquí integrarías EmailJS: emailjs.send(serviceID, templateID, templateParams, publicKey)
    console.log(`Enviando alerta de email para ${alert.clientName}: ${alert.type} vence en ${alert.diffDays} días.`);
    alert(`Simulación: Se enviaría un email a tu Gmail avisando que el ${alert.type} de ${alert.clientName} vence en ${alert.diffDays} días.`);
  };

  if (!user) return <div className="flex items-center justify-center h-screen bg-slate-900 text-white">Cargando aplicación...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Globe size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">WebManager</h1>
        </div>

        <div className="flex flex-col gap-2">
          <button 
            onClick={() => setView('dashboard')}
            className={`flex items-center gap-3 p-3 rounded-lg transition ${view === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button 
            onClick={() => setView('clients')}
            className={`flex items-center gap-3 p-3 rounded-lg transition ${view === 'clients' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Users size={20} /> Mis Clientes
          </button>
          <button 
            onClick={() => setView('reseller')}
            className={`flex items-center gap-3 p-3 rounded-lg transition ${view === 'reseller' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Server size={20} /> Hosting Revendedor
          </button>
          <button 
            onClick={() => setView('settings')}
            className={`flex items-center gap-3 p-3 rounded-lg transition ${view === 'settings' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Settings size={20} /> Precios y Config.
          </button>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-800 text-xs text-slate-500">
          ID de Usuario: <br/> {user.uid}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Bienvenido, Desarrollador</h2>
                <p className="text-slate-500">Control de estados y alertas críticas.</p>
              </div>
              <div className="text-right bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-400 uppercase">Hoy</span>
                <p className="font-mono text-lg">{new Date().toLocaleDateString('es-AR')}</p>
              </div>
            </header>

            {/* Alertas Críticas */}
            <section>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} /> 
                Alertas Próximas (Menos de 20 días)
              </h3>
              {alerts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {alerts.map((alert, i) => (
                    <div key={i} className={`p-5 rounded-2xl border-l-4 shadow-sm bg-white ${alert.diffDays < 7 ? 'border-rose-500' : 'border-amber-500'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${alert.diffDays < 7 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          Vence en {alert.diffDays} días
                        </span>
                        <button 
                          onClick={() => sendAlertEmail(alert)}
                          className="text-slate-400 hover:text-indigo-600 transition"
                          title="Enviar recordatorio manual"
                        >
                          <Mail size={18} />
                        </button>
                      </div>
                      <h4 className="font-bold text-slate-800 text-lg">{alert.clientName}</h4>
                      <p className="text-slate-600 flex items-center gap-2 mt-1">
                        {alert.type === 'Dominio' && <Globe size={14} />}
                        {alert.type === 'Hosting' && <Server size={14} />}
                        {alert.type === 'SSL' && <ShieldCheck size={14} />}
                        {alert.type}: {new Date(alert.date).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-emerald-50 text-emerald-700 p-8 rounded-2xl border border-emerald-100 text-center">
                  <p className="font-medium">¡Todo al día! No hay vencimientos próximos detectados.</p>
                </div>
              )}
            </section>

            {/* Resumen General */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-slate-500 text-sm">Total Clientes</p>
                <p className="text-3xl font-bold text-slate-900">{clients.length}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-slate-500 text-sm">Próximo Abril</p>
                <p className="text-3xl font-bold text-indigo-600">${settings.hostingResellerPrice || '0'}</p>
                <p className="text-[10px] text-slate-400 uppercase mt-1">Hosting Revendedor</p>
              </div>
            </div>
          </div>
        )}

        {view === 'clients' && (
          <div className="space-y-6">
            <header className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Gestión de Clientes</h2>
                <p className="text-slate-500">Administra los servicios de cada desarrollo.</p>
              </div>
              <button 
                onClick={() => { setEditingClient(null); setIsModalOpen(true); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition"
              >
                <Plus size={20} /> Nuevo Cliente
              </button>
            </header>

            <div className="grid grid-cols-1 gap-4">
              {clients.map(client => (
                <div key={client.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-slate-800">{client.name}</h3>
                      {client.managesOwn && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase">Autogestionado</span>}
                    </div>
                    <a href={client.url} target="_blank" className="text-indigo-600 text-sm hover:underline flex items-center gap-1 mt-1">
                      {client.url} <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-[2]">
                    <div className="text-sm">
                      <p className="text-slate-400 font-medium flex items-center gap-1"><Globe size={14}/> Dominio</p>
                      <p className={new Date(client.domainExpiry) < new Date() ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                        {client.domainExpiry ? new Date(client.domainExpiry).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="text-slate-400 font-medium flex items-center gap-1"><Server size={14}/> Hosting</p>
                      <p className={new Date(client.hostingExpiry) < new Date() ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                        {client.hostingExpiry ? new Date(client.hostingExpiry).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="text-slate-400 font-medium flex items-center gap-1"><ShieldCheck size={14}/> SSL</p>
                      <p className={new Date(client.sslExpiry) < new Date() ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                        {client.sslExpiry ? new Date(client.sslExpiry).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setEditingClient(client); setIsModalOpen(true); }}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button 
                      onClick={() => deleteClient(client.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'reseller' && (
          <div className="max-w-4xl mx-auto py-10 space-y-8 text-center">
            <div className="bg-white p-12 rounded-[2rem] shadow-xl border border-slate-200">
              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CalendarClock size={40} />
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-4">Renovación Revendedor</h2>
              <p className="text-slate-500 max-w-md mx-auto mb-8">
                Recordatorio: Tu hosting reseller de DonWeb vence anualmente en el mes de <strong>Abril</strong>.
              </p>
              
              <div className="bg-slate-50 p-6 rounded-2xl inline-block border border-slate-100">
                <p className="text-sm text-slate-400 uppercase font-bold tracking-widest mb-1">Costo Estimado</p>
                <p className="text-5xl font-mono font-bold text-indigo-600">${settings.hostingResellerPrice || 0}</p>
              </div>

              <div className="mt-12 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-4 text-left">
                <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={20} />
                <p className="text-sm text-amber-800">
                  Asegúrate de tener fondos disponibles para la primera quincena de abril. 
                  DonWeb suele enviar la factura 10 días antes del vencimiento.
                </p>
              </div>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-2xl space-y-8">
            <header>
              <h2 className="text-2xl font-bold text-slate-900">Precios y Configuración</h2>
              <p className="text-slate-500">Ajusta los valores de mercado para tus estimaciones.</p>
            </header>

            <form onSubmit={updatePrices} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Hosting Reseller (Anual)</label>
                  <input 
                    name="reseller"
                    type="number" 
                    defaultValue={settings.hostingResellerPrice}
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Dominio .com / .ar (Anual)</label>
                  <input 
                    name="domain"
                    type="number" 
                    defaultValue={settings.domainPrice}
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Certificado SSL (Anual)</label>
                  <input 
                    name="ssl"
                    type="number" 
                    defaultValue={settings.sslPrice}
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400 italic">Última actualización: {new Date(settings.lastUpdate).toLocaleString()}</span>
                <button type="submit" className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition">
                  Guardar Valores
                </button>
              </div>
            </form>

            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
              <h4 className="font-bold text-indigo-900 mb-2">Nota sobre precios automáticos</h4>
              <p className="text-sm text-indigo-700 leading-relaxed">
                Debido a que DonWeb no expone una API pública de precios, los valores deben actualizarse manualmente aquí. 
                Esto te permite mantener un control de costos y saber cuánto cobrar a tus clientes finales.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Modal Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-slate-900">
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Plus className="rotate-45" size={28} />
              </button>
            </div>
            <form onSubmit={saveClient} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Cliente / Empresa</label>
                  <input name="name" required defaultValue={editingClient?.name} className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">URL del Sitio</label>
                  <input name="url" defaultValue={editingClient?.url} placeholder="https://..." className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Vencimiento Dominio</label>
                  <input name="domainExpiry" type="date" defaultValue={editingClient?.domainExpiry} className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Vencimiento Hosting</label>
                  <input name="hostingExpiry" type="date" defaultValue={editingClient?.hostingExpiry} className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Vencimiento SSL</label>
                  <input name="sslExpiry" type="date" defaultValue={editingClient?.sslExpiry} className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <input name="managesOwn" type="checkbox" defaultChecked={editingClient?.managesOwn} className="w-5 h-5 accent-indigo-600" id="mown" />
                  <label htmlFor="mown" className="text-sm font-bold text-slate-700">El cliente lo gestiona solo</label>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Notas / Mejoras pendientes</label>
                  <textarea name="notes" rows="3" defaultValue={editingClient?.notes} className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ideas para el futuro o pedidos de mejora..."></textarea>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition">Cancelar</button>
                <button type="submit" className="flex-[2] bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition">Guardar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
