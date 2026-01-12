import React, { useState, useEffect } from 'react';
import { User, Order, OrderStatus, ChatMessage, Transaction, Review, CatalogItem, ChatConversation, UserRole } from '../types';
import { 
  LayoutDashboard, ShoppingBag, MessageSquare, LogOut, 
  Menu, X, TrendingUp, Users, CreditCard, Star, Send,
  Image as ImageIcon, Plus, Trash2, Save, Ruler, MapPin, Truck,
  CheckCircle, Scissors, Package, ArrowRight, AlertCircle, Edit, UploadCloud, User as UserIcon, Settings, Lock, Bell, Paperclip, Camera, Upload, Loader2, FileText, RefreshCw, AlertTriangle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  subscribeToOrders, updateOrderStatus, updateMerchantCatalog, 
  subscribeToMessages, sendMessage, getUserProfile,
  updateUserPassword, updateUserEmail, saveUserProfile, getChatId, subscribeToChatList, subscribeToTransactions, subscribeToMerchantReviews
} from '../services/firebase';
import { uploadToCloudinary } from '../services/cloudinaryService';

interface MerchantDashboardProps {
  user: User;
  onLogout: () => void;
}

export const MerchantDashboard: React.FC<MerchantDashboardProps> = ({ user, onLogout }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'profile' | 'chat' | 'transactions' | 'reviews' | 'catalog' | 'settings'>('overview');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // Data State
  const [orders, setOrders] = useState<Order[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [chartData, setChartData] = useState<{name: string, orders: number}[]>([]);
  
  // Profile State
  const [profileData, setProfileData] = useState({
    brandName: user.brandName || user.name,
    ownerName: user.name,
    email: user.email,
    phone: user.phone || '',
    address: user.address || '',
    bio: user.bio || 'Specializing in custom high-end dresses and kebaya since 2018.',
    photoUrl: user.photoUrl || '',
    // Payment Details
    bankName: user.bankDetails?.bankName || '',
    accountNumber: user.bankDetails?.accountNumber || '',
    accountHolder: user.bankDetails?.accountHolder || '',
    walletName: user.ewalletDetails?.walletName || '',
    walletNumber: user.ewalletDetails?.phoneNumber || '',
    
    rating: user.rating || 0,
    reviewCount: user.reviewCount || 0
  });

  // Notification State
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  // Auto-hide notification
  useEffect(() => {
    if (notification?.show) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showToast = (type: 'success' | 'error', title: string, message: string) => {
    setNotification({ show: true, type, title, message });
  };

  // Uploading States
  const [isUploadingCatalog, setIsUploadingCatalog] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingChat, setIsUploadingChat] = useState(false);

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    newEmail: user.email,
    newPassword: '',
    confirmPassword: '',
    notifications: true
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Order Details Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [inputTracking, setInputTracking] = useState('');

  // Catalog State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<any>({ title: '', imageUrl: '', description: '', price: 0 });

  // Chat State
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConversations, setActiveConversations] = useState<ChatConversation[]>([]);

  // 1. Fetch Orders Live & Sync Selected Order
  useEffect(() => {
    const unsubscribe = subscribeToOrders(user.id, UserRole.MERCHANT, (liveOrders) => {
        setOrders(liveOrders);
    });
    return () => unsubscribe();
  }, [user.id]);

  // Sync selectedOrder with live data
  useEffect(() => {
      if (selectedOrder) {
          const updated = orders.find(o => o.id === selectedOrder.id);
          if (updated && updated.status !== selectedOrder.status) {
              setSelectedOrder(updated);
          }
      }
  }, [orders, selectedOrder]);

  // 2. Fetch Chat List
  useEffect(() => {
    const unsubscribe = subscribeToChatList(user.id, (chats) => {
        setActiveConversations(chats);
    });
    return () => unsubscribe();
  }, [user.id]);

  // 3. Fetch Transactions
  useEffect(() => {
    const unsubscribe = subscribeToTransactions(user.id, (trans) => {
        setTransactions(trans);
    });
    return () => unsubscribe();
  }, [user.id]);

  // 4. Fetch Reviews
  useEffect(() => {
    const unsubscribe = subscribeToMerchantReviews(user.id, (reviewsData) => {
        setReviews(reviewsData);
    });
    return () => unsubscribe();
  }, [user.id]);

  // 5. Fetch Profile (to get latest rating) & Catalog
  useEffect(() => {
    const fetchCatalog = async () => {
        const freshUser = await getUserProfile(user.id);
        if(freshUser) {
            if((freshUser as any).catalog) {
                setCatalog((freshUser as any).catalog);
            }
            setProfileData(prev => ({
                ...prev,
                photoUrl: freshUser.photoUrl || prev.photoUrl,
                brandName: freshUser.brandName || freshUser.name,
                ownerName: freshUser.name,
                phone: freshUser.phone || prev.phone,
                address: freshUser.address || prev.address,
                bio: freshUser.bio || prev.bio,
                bankName: freshUser.bankDetails?.bankName || prev.bankName,
                accountNumber: freshUser.bankDetails?.accountNumber || prev.accountNumber,
                accountHolder: freshUser.bankDetails?.accountHolder || prev.accountHolder,
                walletName: freshUser.ewalletDetails?.walletName || prev.walletName,
                walletNumber: freshUser.ewalletDetails?.phoneNumber || prev.walletNumber,
                rating: freshUser.rating || prev.rating,
                reviewCount: freshUser.reviewCount || prev.reviewCount
            }));
        }
    };
    fetchCatalog();
  }, [user.id]);

  // 6. Chat Subscription
  useEffect(() => {
    if (!activeChatId) return;
    const unsubscribe = subscribeToMessages(activeChatId, (msgs) => {
        const processedMsgs = msgs.map(m => ({
            ...m,
            isMe: m.senderId === user.id
        }));
        setMessages(processedMsgs);
    });
    return () => unsubscribe();
  }, [activeChatId, user.id]);

  // 7. Calculate Chart Data (Order Statistics)
  useEffect(() => {
    if (orders.length === 0) {
      setChartData([]);
      return;
    }

    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const today = new Date();
    const last6Months = [];

    // Initialize buckets for the last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      last6Months.push({
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
        name: monthsShort[d.getMonth()],
        count: 0
      });
    }

    // Process orders
    orders.forEach(order => {
        // Exclude cancelled orders from statistics
        if (order.status !== OrderStatus.CANCELLED) {
            const orderDate = new Date(order.date);
            const oMonth = orderDate.getMonth();
            const oYear = orderDate.getFullYear();

            // Find matching bucket
            const bucket = last6Months.find(b => b.monthIndex === oMonth && b.year === oYear);
            if (bucket) {
                bucket.count++;
            }
        }
    });

    const formattedData = last6Months.map(b => ({
        name: b.name,
        orders: b.count
    }));

    setChartData(formattedData);
  }, [orders]);


  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeChatId) return;
    try {
        await sendMessage(activeChatId, {
            senderId: user.id,
            senderName: user.brandName || user.name,
            text: chatInput,
        });
        setChatInput('');
    } catch (e) {
        console.error(e);
    }
  };

  const handleChatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeChatId) {
      setIsUploadingChat(true);
      try {
        const imageUrl = await uploadToCloudinary(file);
        await sendMessage(activeChatId, {
            senderId: user.id,
            senderName: user.brandName || user.name,
            text: 'Sent an image',
            attachmentUrl: imageUrl
        });
      } catch (error) {
        showToast('error', 'Error', "Failed to upload image. Please try again.");
      } finally {
        setIsUploadingChat(false);
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingCatalog(true);
      try {
        const imageUrl = await uploadToCloudinary(file);
        setNewItem({ ...newItem, imageUrl });
      } catch (error) {
        showToast('error', 'Error', "Failed to upload image.");
      } finally {
        setIsUploadingCatalog(false);
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingProfile(true);
      try {
        const photoUrl = await uploadToCloudinary(file);
        setProfileData(prev => ({ ...prev, photoUrl }));
      } catch (error) {
        showToast('error', 'Error', "Failed to upload profile photo.");
      } finally {
        setIsUploadingProfile(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    try {
        const updates: any = {
            ...user,
            brandName: profileData.brandName,
            name: profileData.ownerName,
            phone: profileData.phone,
            address: profileData.address,
            bio: profileData.bio,
            photoUrl: profileData.photoUrl,
        };

        if (profileData.bankName || profileData.accountNumber) {
            updates.bankDetails = {
                bankName: profileData.bankName,
                accountNumber: profileData.accountNumber,
                accountHolder: profileData.accountHolder
            };
        }

        if (profileData.walletName || profileData.walletNumber) {
            updates.ewalletDetails = {
                walletName: profileData.walletName,
                phoneNumber: profileData.walletNumber
            };
        }

        await saveUserProfile(updates);
        showToast('success', 'Tersimpan', "Perubahan profil berhasil disimpan!");
    } catch(e) { 
        console.error(e);
        showToast('error', 'Gagal', "Gagal menyimpan perubahan.");
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    let messages = [];

    try {
        if (settingsForm.newPassword) {
            if (settingsForm.newPassword !== settingsForm.confirmPassword) {
                showToast('error', 'Validasi', t.passwordsNoMatch);
                setSettingsLoading(false);
                return;
            }
            if (settingsForm.newPassword.length < 6) {
                showToast('error', 'Validasi', "Password must be at least 6 characters.");
                setSettingsLoading(false);
                return;
            }
            await updateUserPassword(settingsForm.newPassword);
            messages.push("Password updated.");
        }

        if (settingsForm.newEmail !== user.email) {
            await updateUserEmail(settingsForm.newEmail);
            messages.push("Email updated.");
        }
        
        if (messages.length > 0) {
            showToast('success', 'Sukses', "Pengaturan berhasil disimpan!");
            setSettingsForm(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
        }

    } catch (error: any) {
        console.error(error);
        if (error.code === 'auth/requires-recent-login') {
            showToast('error', 'Keamanan', "Demi keamanan, silakan login ulang untuk mengubah pengaturan sensitif.");
        } else {
            showToast('error', 'Gagal', "Gagal menyimpan pengaturan: " + error.message);
        }
    } finally {
        setSettingsLoading(false);
    }
  };

  const openAddModal = () => {
    setNewItem({ title: '', imageUrl: '', description: '', price: 0 });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: CatalogItem) => {
    setNewItem({
      title: item.title,
      imageUrl: item.imageUrl,
      description: item.description || '',
      price: item.price || 0
    });
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const handleSaveCatalogItem = async () => {
    if (!newItem.title || !newItem.imageUrl) {
        showToast('error', 'Validasi', "Please provide a title and an image.");
        return;
    }
    
    let updatedCatalog = [...catalog];

    if (editingId) {
      updatedCatalog = updatedCatalog.map(item => 
        item.id === editingId 
        ? { ...item, ...newItem, price: Number(newItem.price) }
        : item
      );
    } else {
      const item: CatalogItem = {
        id: Date.now().toString(),
        title: newItem.title,
        imageUrl: newItem.imageUrl,
        description: newItem.description,
        price: Number(newItem.price)
      };
      updatedCatalog.push(item);
    }
    
    try {
        await updateMerchantCatalog(user.id, updatedCatalog);
        setCatalog(updatedCatalog);
        setNewItem({ title: '', imageUrl: '', description: '', price: 0 });
        setIsModalOpen(false);
        setEditingId(null);
        showToast('success', 'Sukses', "Item berhasil disimpan!");
    } catch (e) {
        console.error(e);
        showToast('error', 'Gagal', "Gagal menyimpan item.");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if(window.confirm('Are you sure you want to delete this item?')) {
       const updatedCatalog = catalog.filter(item => item.id !== id);
       try {
        await updateMerchantCatalog(user.id, updatedCatalog);
        setCatalog(updatedCatalog);
        showToast('success', 'Dihapus', "Item berhasil dihapus.");
       } catch (e) {
        showToast('error', 'Gagal', "Gagal menghapus item.");
       }
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus, extraData?: Partial<Order>) => {
    // Optimistic update for UI responsiveness
    if (selectedOrder && selectedOrder.id === orderId) {
       setSelectedOrder({ ...selectedOrder, status: newStatus, ...extraData });
    }
    
    try {
        await updateOrderStatus(orderId, { status: newStatus, ...extraData });
        showToast('success', 'Updated', `Status pesanan diubah ke ${newStatus}`);
    } catch (e) {
        console.error(e);
        showToast('error', 'Gagal', "Gagal update status di database");
        // Revert if failed (optional, but for simple app just alert)
    }
  };

  const handleCancelOrder = (orderId: string) => {
    if (window.confirm(t.cancelConfirm)) {
      handleUpdateOrderStatus(orderId, OrderStatus.CANCELLED);
    }
  };

  // ... (Render methods same as before) ...
  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-stone-500 font-medium text-sm mb-2 uppercase tracking-wide">{label}</p>
          <h3 className="text-3xl font-serif font-bold text-berry-rich">{value}</h3>
        </div>
        <div className={`p-4 rounded-2xl ${color} bg-opacity-20`}>
          <Icon size={24} className="text-berry-rich" />
        </div>
      </div>
    </div>
  );

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.CONSULTATION: return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case OrderStatus.DESIGN: return 'bg-purple-50 text-purple-800 border-purple-200';
      case OrderStatus.PRODUCTION: return 'bg-orange-50 text-orange-800 border-orange-200';
      case OrderStatus.FINISHING: return 'bg-blue-50 text-blue-800 border-blue-200';
      case OrderStatus.SHIPPED: return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case OrderStatus.COMPLETED: return 'bg-green-50 text-green-800 border-green-200';
      case OrderStatus.CANCELLED: return 'bg-red-50 text-red-800 border-red-200';
      case OrderStatus.COMPLAINT: return 'bg-red-100 text-red-800 border-red-300'; // Complaint Color
      default: return 'bg-stone-50 text-stone-800 border-stone-200';
    }
  };

  const renderWorkflowActions = (order: Order) => {
    // ... same as previous ...
    if (order.status === OrderStatus.CANCELLED) {
      return (<div className="bg-red-50/50 p-6 rounded-3xl border border-red-200"><div className="flex items-center gap-3 mb-3"><AlertCircle className="text-red-600" size={24} /><p className="font-bold text-red-900 text-lg">{t.orderCancelled}</p></div></div>);
    }
    
    // COMPLAINT STATUS
    if (order.status === OrderStatus.COMPLAINT) {
        return (
            <div className="bg-red-50 p-6 rounded-3xl border border-red-200 space-y-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="text-red-600 mt-1" size={24} />
                    <div>
                        <p className="font-bold text-red-900 text-lg">Komplain dari Pelanggan</p>
                        <p className="text-sm text-red-800 italic">"{order.complaint?.reason}"</p>
                    </div>
                </div>
                {order.complaint?.imageUrl && (
                    <div className="w-full h-32 rounded-xl overflow-hidden border border-red-100">
                        <img src={order.complaint.imageUrl} className="w-full h-full object-cover" alt="Bukti" />
                    </div>
                )}
                <p className="text-xs text-stone-500">Silakan hubungi pelanggan via Chat untuk solusi.</p>
                <div className="flex gap-2">
                     <button onClick={() => alert("Silakan chat pelanggan untuk refund atau revisi.")} className="flex-1 py-3 bg-white text-red-600 border border-red-200 rounded-xl font-bold">Diskusi (Chat)</button>
                     <button onClick={() => handleUpdateOrderStatus(order.id, OrderStatus.COMPLETED)} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold">Selesai (Manual)</button>
                </div>
            </div>
        );
    }

    switch (order.status) {
      case OrderStatus.CONSULTATION:
        return (
          <div className="bg-yellow-50/50 p-6 rounded-3xl border border-yellow-200 space-y-4">
             <div className="flex items-start gap-3">
                <AlertCircle className="text-yellow-600 mt-1" size={20} />
                <div>
                  <p className="font-bold text-yellow-900 text-lg">{t.newOrderRequest}</p>
                  <p className="text-sm text-yellow-800/80">{t.reviewRequest}</p>
                </div>
             </div>
             
             {order.paymentProofUrl && (
                <div className="bg-white p-4 rounded-xl border border-yellow-200">
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-2">Payment Proof</p>
                    <a href={order.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-lg">
                        <img src={order.paymentProofUrl} alt="Payment Proof" className="w-full h-32 object-cover rounded-lg" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-white text-xs font-bold">View Full Image</span>
                        </div>
                    </a>
                </div>
             )}

             <button onClick={() => handleUpdateOrderStatus(order.id, OrderStatus.DESIGN)} className="w-full py-3 bg-berry-rich text-white rounded-xl font-bold hover:bg-berry-dark transition-colors shadow-lg shadow-yellow-100">{t.acceptOrder}</button>
             <button className="w-full py-3 bg-white border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50">{t.declineRequest}</button>
          </div>
        );
      
      case OrderStatus.DESIGN:
        return (<div className="bg-purple-50/50 p-6 rounded-3xl border border-purple-200 space-y-4"><div className="flex items-start gap-3"><Scissors className="text-purple-600 mt-1" size={20} /><div><p className="font-bold text-purple-900 text-lg">{t.designPhase}</p><p className="text-sm text-purple-800/80">{t.designPhaseDesc}</p></div></div><button onClick={() => handleUpdateOrderStatus(order.id, OrderStatus.PRODUCTION)} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-100">{t.startProduction}</button></div>);

      case OrderStatus.PRODUCTION:
        return (<div className="bg-orange-50/50 p-6 rounded-3xl border border-orange-200 space-y-4"><div className="flex items-start gap-3"><Scissors className="text-orange-600 mt-1" size={20} /><div><p className="font-bold text-orange-900 text-lg">{t.inProduction}</p><p className="text-sm text-orange-800/80">{t.productionDesc}</p></div></div><button onClick={() => handleUpdateOrderStatus(order.id, OrderStatus.FINISHING)} className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-100">{t.moveToFinishing}</button></div>);

      case OrderStatus.FINISHING:
        return (<div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-200 space-y-4"><div className="flex items-start gap-3"><Package className="text-blue-600 mt-1" size={20} /><div><p className="font-bold text-blue-900 text-lg">{t.readyToShip}</p><p className="text-sm text-blue-800/80">{t.shipDesc}</p></div></div><input type="text" placeholder={t.trackingPlaceholder} className="w-full p-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white" value={inputTracking} onChange={(e) => setInputTracking(e.target.value)} /><button onClick={() => { if(inputTracking) { handleUpdateOrderStatus(order.id, OrderStatus.SHIPPED, { trackingNumber: inputTracking }); setInputTracking(''); } else { showToast('error', 'Validasi', t.enterTrackingAlert); } }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">{t.markShipped}</button></div>);

      case OrderStatus.SHIPPED:
        return (<div className="bg-green-50/50 p-6 rounded-3xl border border-green-200"><div className="flex items-center gap-3 mb-3"><CheckCircle className="text-green-600" size={24} /><p className="font-bold text-green-900 text-lg">{t.orderShipped}</p></div><p className="text-sm text-green-800 mb-2">{t.trackingLabel} <span className="font-mono bg-white px-3 py-1 rounded-lg border border-green-200 ml-1 font-bold">{order.trackingNumber}</span></p><p className="text-xs text-green-600 mt-3">{t.shippedDesc}</p></div>);

      case OrderStatus.COMPLETED:
        return (<div className="bg-green-100/50 p-6 rounded-3xl border border-green-300"><div className="flex items-center gap-3 mb-3"><CheckCircle className="text-green-700" size={24} /><p className="font-bold text-green-900 text-lg">Completed</p></div><p className="text-sm text-green-800">Funds have been released.</p></div>);

      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-[#FDFBF7] flex relative overflow-hidden">
      {/* Background Decor */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-brand-gold/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-berry-rich/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-[100] animate-fade-in-up w-full max-w-sm px-4 md:px-0">
          <div className={`bg-white shadow-2xl rounded-2xl p-4 border-l-4 flex items-start gap-4 ${notification.type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
            <div className={`p-2 rounded-full shrink-0 ${notification.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {notification.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
            </div>
            <div className="flex-1">
              <h4 className={`font-bold text-sm ${notification.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {notification.title}
              </h4>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                {notification.message}
              </p>
            </div>
            <button onClick={() => setNotification(null)} className="text-stone-400 hover:text-stone-600">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Catalog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-berry-rich/20 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white">
            <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
              <h3 className="text-xl font-serif font-bold text-berry-rich">
                {editingId ? t.editProject : t.addNewProject}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-berry-rich transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {/* ... Catalog form inputs same as before ... */}
              <div><label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.projectTitle}</label><input type="text" className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50" placeholder={t.projectTitlePlaceholder} value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} /></div><div><label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.basePrice}</label><input type="number" className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50" placeholder="e.g. 500000" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} /></div><div><label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Description</label><textarea className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50 h-24" placeholder="Describe the material, style, etc..." value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} /></div><div><label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.imageUrl}</label><div className="flex gap-4 items-center">{newItem.imageUrl && (<div className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100"><img src={newItem.imageUrl} alt="Preview" className="w-full h-full object-cover" /></div>)}<label className={`flex-1 cursor-pointer ${isUploadingCatalog ? 'opacity-50 pointer-events-none' : ''}`}><div className="h-20 border-2 border-dashed border-stone-300 rounded-xl bg-stone-50 hover:bg-white transition-colors flex flex-col items-center justify-center text-center">{isUploadingCatalog ? (<Loader2 className="animate-spin text-berry-rich" size={20} />) : (<UploadCloud className="text-stone-400 mb-1" size={20} />)}<span className="text-xs font-medium text-stone-500">{isUploadingCatalog ? 'Uploading...' : 'Upload Image'}</span><input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} /></div></label></div></div><button onClick={handleSaveCatalogItem} disabled={isUploadingCatalog} className="w-full py-4 bg-berry-rich text-white rounded-xl font-bold hover:shadow-lg transition-all">{editingId ? t.updateProject : t.saveProject}</button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-berry-rich/20 backdrop-blur-md p-4 animate-fade-in">
           <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col border border-white">
              {/* ... Content ... */}
              <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center"><div><h3 className="text-xl font-serif font-bold text-berry-rich">{t.viewOrderDetails}</h3><p className="text-xs text-stone-500 mt-1 font-mono">ID: {selectedOrder.id}</p></div><div className="flex items-center gap-2">{selectedOrder.status !== OrderStatus.CANCELLED && selectedOrder.status !== OrderStatus.COMPLETED && selectedOrder.status !== OrderStatus.SHIPPED && (<button onClick={() => handleCancelOrder(selectedOrder.id)} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors mr-2 border border-red-100">{t.cancelOrder}</button>)}<button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-berry-rich transition-colors"><X size={24} /></button></div></div>
              {selectedOrder.status !== OrderStatus.CANCELLED && selectedOrder.status !== OrderStatus.COMPLAINT && (<div className="bg-white px-8 py-6 border-b border-stone-100 overflow-x-auto"><div className="flex items-center gap-2 text-xs min-w-max">{[OrderStatus.CONSULTATION, OrderStatus.DESIGN, OrderStatus.PRODUCTION, OrderStatus.FINISHING, OrderStatus.SHIPPED, OrderStatus.COMPLETED].map((step, idx) => { const currentIdx = [OrderStatus.CONSULTATION, OrderStatus.DESIGN, OrderStatus.PRODUCTION, OrderStatus.FINISHING, OrderStatus.SHIPPED, OrderStatus.COMPLETED].indexOf(selectedOrder.status); const stepIdx = [OrderStatus.CONSULTATION, OrderStatus.DESIGN, OrderStatus.PRODUCTION, OrderStatus.FINISHING, OrderStatus.SHIPPED, OrderStatus.COMPLETED].indexOf(step); const isActive = stepIdx <= currentIdx; return (<div key={step} className="flex items-center gap-2"><div className={`px-4 py-2 rounded-full font-bold transition-all ${isActive ? 'bg-berry-rich text-white shadow-md' : 'bg-stone-100 text-stone-400'}`}>{step}</div>{idx < 5 && <div className={`w-10 h-1 rounded-full ${isActive ? 'bg-berry-rich' : 'bg-stone-100'}`}></div>}</div>);})}</div></div>)}
              {selectedOrder.status === OrderStatus.COMPLAINT && (<div className="bg-red-50 px-8 py-6 border-b border-red-100 flex items-center gap-3"><AlertTriangle className="text-red-600" size={24} /><div><p className="text-red-800 font-bold text-lg">Pesanan Dikomplain</p><p className="text-red-600 text-sm">Pelanggan melaporkan masalah.</p></div></div>)}
              <div className="p-8 overflow-y-auto space-y-8 flex-1"><div className="flex flex-col md:flex-row gap-8"><div className="md:w-1/3 space-y-6"><img src={selectedOrder.imageUrl || 'https://via.placeholder.com/100'} alt="" className="w-full h-48 rounded-2xl object-cover shadow-lg hover:scale-105 transition-transform duration-500" />{renderWorkflowActions(selectedOrder)}</div><div className="md:w-2/3 space-y-6"><div className="flex justify-between items-start"><div><h4 className="font-serif font-bold text-2xl text-berry-rich">{selectedOrder.designName}</h4><p className="text-stone-500 font-medium mt-1">{t.customer}: <span className="text-stone-800">{selectedOrder.customerName}</span></p></div><div className="text-right"><p className="font-serif font-bold text-2xl text-brand-gold">Rp {selectedOrder.price.toLocaleString()}</p><span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-[10px] rounded-full font-bold uppercase tracking-wider mt-1">PAID</span></div></div><div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 space-y-5"><div><h5 className="font-bold text-sm text-stone-700 flex items-center gap-2 mb-2 uppercase tracking-wide"><Truck size={16} className="text-berry-rich" /> {t.shippingInfo}</h5><p className="font-medium text-stone-800">{selectedOrder.shippingMethod}</p><p className="text-sm text-stone-500 mt-1">{selectedOrder.shippingAddress}</p></div><div className="border-t border-stone-200 pt-4"><h5 className="font-bold text-sm text-stone-700 flex items-center gap-2 mb-2 uppercase tracking-wide"><MessageSquare size={16} className="text-berry-rich" /> {t.notes}</h5><p className="text-stone-600 italic bg-white p-3 rounded-xl border border-stone-100 text-sm">"{selectedOrder.customerNotes || 'No notes'}"</p></div></div>{selectedOrder.measurements && (<div><h5 className="font-bold text-sm text-berry-rich flex items-center gap-2 mb-4 uppercase tracking-wide"><Ruler size={16} /> {t.bodyMeasurements} (cm)</h5><div className="grid grid-cols-3 gap-3">{Object.entries(selectedOrder.measurements).map(([key, val]) => (<div key={key} className="bg-white border border-stone-200 p-3 rounded-xl text-center hover:border-brand-gold/50 transition-colors"><span className="block text-[10px] text-stone-400 uppercase tracking-wider mb-1 font-bold">{key}</span><span className="font-serif font-bold text-lg text-berry-rich">{val}</span></div>))}</div></div>)}</div></div></div>
           </div>
        </div>
      )}

      {/* Sidebar & Main Content (Same as before) */}
      <aside className={`fixed md:static inset-y-0 left-0 w-72 bg-gradient-to-b from-berry-rich to-berry-dark text-white z-30 flex flex-col h-full transform transition-transform duration-500 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-8 flex items-center justify-between"><div className="flex flex-col gap-2"><img src="https://raw.githubusercontent.com/idantexe/berrylybelle/refs/heads/main/logoooo.webp" alt="Berryly Belle" className="h-28 w-auto object-contain self-start drop-shadow-lg brightness-0 invert" /><span className="font-serif font-bold text-white text-3xl tracking-wide mt-2">Berryly <span className="text-brand-gold italic">Belle</span></span></div><button className="md:hidden text-white/70 hover:text-white" onClick={() => setSidebarOpen(false)}><X size={24} /></button></div>
        <div className="px-4 py-6 flex-1 overflow-y-auto"><nav className="space-y-2">{['overview', 'orders', 'transactions', 'catalog', 'reviews', 'chat', 'profile', 'settings'].map((tab) => (<button key={tab} onClick={() => { setActiveTab(tab as any); setSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-6 py-4 transition-all duration-300 relative group capitalize ${activeTab === tab ? 'text-white' : 'text-purple-200 hover:text-white hover:bg-white/5'}`}>{activeTab === tab && (<div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-gold shadow-[0_0_10px_#D4AF37]"></div>)}{activeTab === tab && (<div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>)}{tab === 'overview' && <LayoutDashboard size={20} className={activeTab === tab ? 'text-brand-gold' : ''} />}{tab === 'orders' && <ShoppingBag size={20} className={activeTab === tab ? 'text-brand-gold' : ''} />}{tab === 'transactions' && <CreditCard size={20} className={activeTab === tab ? 'text-brand-gold' : ''} />}{tab === 'catalog' && <ImageIcon size={20} className={activeTab === tab ? 'text-brand-gold' : ''} />}{tab === 'reviews' && <Star size={20} className={activeTab === tab ? 'text-brand-gold' : ''} />}{tab === 'chat' && <MessageSquare size={20} className={activeTab === tab ? 'text-brand-gold' : ''} />}{tab === 'profile' && <UserIcon size={20} className={activeTab === tab ? 'text-brand-gold' : ''} />}{tab === 'settings' && <Settings size={20} className={activeTab === tab ? 'text-brand-gold' : ''} />}<span className="font-medium tracking-wide">{t[tab as keyof typeof t] || tab}</span></button>))}</nav></div>
        <div className="p-4 mt-auto"><button onClick={onLogout} className="w-full flex items-center gap-3 px-6 py-4 text-red-200 hover:bg-white/10 hover:text-red-100 rounded-xl transition-colors font-medium"><LogOut size={20} /><span>{t.signOut}</span></button></div>
      </aside>

      <main className="flex-1 overflow-y-auto h-full bg-transparent">
        <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 p-4 md:hidden flex items-center justify-between sticky top-0 z-10 shadow-sm"><h1 className="font-serif font-bold text-lg text-berry-rich">{t.merchantPortal}</h1><button onClick={() => setSidebarOpen(true)} className="p-2 bg-stone-100 rounded-lg text-berry-rich"><Menu size={24} /></button></header>
        <div className="p-6 md:p-12 max-w-7xl mx-auto">
          {/* Dashboard Content */}
          {activeTab === 'overview' && (<div className="space-y-10 animate-fade-in-up"><div><h2 className="text-4xl font-serif font-bold text-berry-rich mb-2">{t.hello}, <span className="text-stone-700">{user.brandName || user.name}</span></h2><p className="text-stone-500 text-lg font-light">{t.happening}</p></div><div className="grid md:grid-cols-3 gap-8"><StatCard icon={ShoppingBag} label={t.activeOrders} value={orders.length.toString()} color="bg-pink-100 text-pink-600" /><StatCard icon={TrendingUp} label={t.totalRevenue} value={`Rp ${transactions.reduce((acc, t) => acc + t.amount, 0).toLocaleString()}`} color="bg-green-100 text-green-600" /><StatCard icon={Users} label={t.newCustomers} value="0" color="bg-blue-100 text-blue-600" /></div><div className="grid md:grid-cols-3 gap-8"><div className="md:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100"><h3 className="font-serif font-bold text-xl mb-8 text-berry-rich">{t.orderStats}</h3><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF'}} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF'}} /><Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} cursor={{fill: '#FDFBF7'}} /><Bar dataKey="orders" fill="#8B1E5B" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></div><div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col"><h3 className="font-serif font-bold text-xl mb-6 text-berry-rich">{t.recentRequests}</h3><div className="space-y-4 flex-1">{orders.length === 0 ? (<p className="text-stone-400 text-sm text-center py-4">No active orders.</p>) : (orders.slice(0, 4).map(order => (<div key={order.id} onClick={() => setSelectedOrder(order)} className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-stone-100 group"><img src={order.imageUrl || 'https://via.placeholder.com/50'} alt="" className="w-14 h-14 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform" /><div className="flex-1 min-w-0"><p className="font-bold text-sm truncate text-berry-rich">{order.designName}</p><p className="text-xs text-stone-500 truncate mt-0.5">{order.customerName}</p></div><span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${getStatusColor(order.status)}`}>{order.status}</span></div>)))}</div><button onClick={() => setActiveTab('orders')} className="w-full mt-6 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors">{t.viewAll}</button></div></div></div>)}
          {activeTab === 'orders' && (<div className="space-y-8 animate-fade-in-up"><h2 className="text-4xl font-serif font-bold text-berry-rich mb-8">{t.orderMgmt}</h2><div className="bg-white rounded-[2rem] shadow-sm border border-stone-100 overflow-hidden"><table className="w-full text-left"><thead className="bg-stone-50/80 border-b border-stone-200"><tr><th className="p-6 font-bold text-stone-500 uppercase tracking-wider text-xs">Order ID</th><th className="p-6 font-bold text-stone-500 uppercase tracking-wider text-xs">{t.orders}</th><th className="p-6 font-bold text-stone-500 uppercase tracking-wider text-xs">{t.customer}</th><th className="p-6 font-bold text-stone-500 uppercase tracking-wider text-xs">Status</th><th className="p-6 font-bold text-stone-500 uppercase tracking-wider text-xs text-right">Action</th></tr></thead><tbody>{orders.map(order => (<tr key={order.id} className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors" onClick={() => setSelectedOrder(order)}><td className="p-6 text-stone-500 font-mono text-xs">{order.id}</td><td className="p-6 font-bold text-berry-rich flex items-center gap-4"><img src={order.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shadow-sm" />{order.designName}</td><td className="p-6 text-stone-600 font-medium">{order.customerName}</td><td className="p-6"><span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>{order.status}</span></td><td className="p-6 text-right"><button className="text-berry-rich font-bold text-xs uppercase tracking-wide hover:text-brand-gold transition-colors">{t.manage}</button></td></tr>))}{orders.length === 0 && (<tr><td colSpan={5} className="p-10 text-center text-stone-400">No orders yet.</td></tr>)}</tbody></table></div></div>)}
          {/* Other tabs... */}
          {activeTab === 'catalog' && (/* ... */ <div className="space-y-8 animate-fade-in-up"><div className="flex justify-between items-center mb-8"><div><h2 className="text-4xl font-serif font-bold text-berry-rich mb-2">{t.catalog}</h2><p className="text-stone-500">{t.catalogDesc}</p></div><button onClick={openAddModal} className="px-6 py-3 bg-berry-rich text-white rounded-xl font-bold hover:bg-berry-dark transition-all flex items-center gap-2 shadow-lg hover:shadow-berry-rich/30"><Plus size={20} /> {t.addCatalogItem}</button></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{catalog.length === 0 ? (<div className="col-span-3 text-center py-20 bg-white rounded-[2rem] border border-stone-100"><ImageIcon size={48} className="mx-auto text-stone-300 mb-4" /><p className="text-stone-500 italic">You haven't added any items yet.</p></div>) : (catalog.map((item) => (<div key={item.id} className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-stone-100 hover:shadow-xl transition-all group"><div className="h-64 overflow-hidden relative"><img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4"><button onClick={() => openEditModal(item)} className="p-3 bg-white rounded-full text-stone-700 hover:text-berry-rich"><Edit size={20} /></button><button onClick={() => handleDeleteItem(item.id)} className="p-3 bg-white rounded-full text-stone-700 hover:text-red-500"><Trash2 size={20} /></button></div></div><div className="p-6"><h3 className="font-serif font-bold text-xl text-berry-rich mb-1">{item.title}</h3><p className="text-brand-gold font-bold mb-3">Rp {item.price?.toLocaleString() || '0'}</p><p className="text-sm text-stone-500 line-clamp-2">{item.description}</p></div></div>)))}</div></div>)}
          {activeTab === 'transactions' && (<div className="space-y-8 animate-fade-in-up"><h2 className="text-4xl font-serif font-bold mb-8 text-berry-rich">{t.transactions}</h2>{transactions.length === 0 ? (<div className="bg-white rounded-[2rem] shadow-sm border border-stone-100 overflow-hidden text-center py-20"><CreditCard size={48} className="mx-auto text-stone-300 mb-4" /><p className="text-stone-500">No transactions yet.</p></div>) : (<div className="bg-white rounded-[2rem] shadow-sm border border-stone-100 overflow-hidden"><table className="w-full text-left"><thead className="bg-stone-50/80 border-b border-stone-200"><tr><th className="p-6 font-bold text-stone-500 uppercase tracking-wider text-xs">Date</th><th className="p-6 font-bold text-stone-500 uppercase tracking-wider text-xs">Description</th><th className="p-6 font-bold text-stone-500 uppercase tracking-wider text-xs">Status</th><th className="p-6 font-bold text-stone-500 uppercase tracking-wider text-xs text-right">Amount</th></tr></thead><tbody>{transactions.map(tr => (<tr key={tr.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors"><td className="p-6 text-stone-500 text-sm">{new Date(tr.date).toLocaleDateString()}</td><td className="p-6 font-bold text-stone-700">{tr.description}</td><td className="p-6"><span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">{tr.status}</span></td><td className="p-6 text-right font-serif font-bold text-berry-rich">Rp {tr.amount.toLocaleString()}</td></tr>))}</tbody></table></div>)}</div>)}
          
          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="space-y-8 animate-fade-in-up">
              <h2 className="text-4xl font-serif font-bold mb-8 text-berry-rich">{t.reviews}</h2>
              <div className="flex gap-6 mb-8">
                  <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-4">
                      <div className="p-4 bg-brand-gold/10 rounded-full text-brand-gold"><Star size={24} fill="currentColor" /></div>
                      <div>
                          <p className="text-xs text-stone-500 uppercase tracking-wide font-bold">Average Rating</p>
                          <p className="text-2xl font-serif font-bold text-berry-rich">{profileData.rating ? profileData.rating.toFixed(1) : "0.0"}</p>
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-4">
                      <div className="p-4 bg-berry-rich/10 rounded-full text-berry-rich"><Users size={24} /></div>
                      <div>
                          <p className="text-xs text-stone-500 uppercase tracking-wide font-bold">Total Reviews</p>
                          <p className="text-2xl font-serif font-bold text-berry-rich">{profileData.reviewCount || 0}</p>
                      </div>
                  </div>
              </div>

              {reviews.length === 0 ? (
                <div className="bg-white rounded-[2rem] shadow-sm border border-stone-100 overflow-hidden text-center py-20">
                    <Star size={48} className="mx-auto text-stone-300 mb-4" />
                    <p className="text-stone-500">Belum ada ulasan.</p>
                </div>
              ) : (
                <div className="grid gap-6">
                    {reviews.map((review) => (
                        <div key={review.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100 flex gap-6 hover:shadow-lg transition-all">
                            <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 flex-shrink-0 font-bold text-xl">
                                {review.reviewerName ? review.reviewerName.charAt(0).toUpperCase() : "?"}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-berry-rich">{review.reviewerName || "Anonymous"}</h4>
                                    <span className="text-xs text-stone-400">{new Date(review.date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-1 mb-3">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star key={star} size={14} className={star <= review.rating ? "text-brand-gold fill-brand-gold" : "text-stone-200"} />
                                    ))}
                                </div>
                                <p className="text-stone-600 text-sm italic">"{review.comment}"</p>
                                {review.imageUrl && (
                                    <div className="mt-4 w-20 h-20 rounded-lg overflow-hidden border border-stone-200">
                                        <img src={review.imageUrl} alt="Review" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'chat' && (<div className="grid md:grid-cols-3 h-[650px] bg-white rounded-[2.5rem] shadow-xl border border-stone-100 overflow-hidden animate-fade-in-up"><div className="border-r border-stone-100 bg-stone-50/50 flex flex-col h-full overflow-hidden"><div className="p-6 border-b border-stone-100"><h3 className="font-serif font-bold text-berry-rich text-xl">{t.chats}</h3></div><div className="flex-1 overflow-y-auto p-3">{activeConversations.map(convo => (<div key={convo.id} onClick={() => setActiveChatId(convo.id)} className={`p-4 mb-2 rounded-2xl cursor-pointer transition-all ${activeChatId === convo.id ? 'bg-white shadow-md border border-stone-100' : 'hover:bg-white/50 hover:shadow-sm'}`}><div className="flex justify-between mb-1"><span className={`font-bold text-sm ${activeChatId === convo.id ? 'text-berry-rich' : 'text-stone-700'}`}>{convo.participantName}</span></div><p className="text-xs text-stone-500 truncate font-medium">Click to chat</p></div>))}{activeConversations.length === 0 && (<p className="text-center p-4 text-stone-400 text-sm">No active chats.</p>)}</div></div><div className="md:col-span-2 flex flex-col bg-white h-full overflow-hidden">{activeChatId ? (<><div className="p-6 border-b border-stone-100 bg-white flex items-center justify-between"><h3 className="font-serif font-bold text-berry-rich text-xl">Chat</h3></div><div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FDFBF7]">{messages.map((msg) => (<div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[75%] p-4 rounded-2xl shadow-sm relative group transition-transform hover:scale-[1.01] ${msg.isMe ? 'bg-berry-rich text-white rounded-tr-none shadow-berry-rich/20' : 'bg-white text-stone-800 rounded-tl-none border border-stone-100'}`}>{msg.attachmentUrl && (<div className="mb-3 rounded-xl overflow-hidden border border-white/20"><img src={msg.attachmentUrl} alt="Attached" className="w-full h-auto max-h-48 object-cover" /></div>)}<p className="text-sm whitespace-pre-wrap leading-relaxed font-medium">{msg.text}</p><span className={`text-[10px] block text-right mt-1.5 opacity-70 font-medium ${msg.isMe ? 'text-pink-100' : 'text-stone-400'}`}>{msg.timestamp?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div></div>))}</div><div className="p-6 border-t border-stone-100 bg-white"><div className="flex gap-3"><label className={`p-4 bg-stone-50 border border-stone-200 rounded-2xl cursor-pointer hover:bg-stone-100 transition-colors flex items-center justify-center ${isUploadingChat ? 'opacity-50 pointer-events-none' : ''}`}>{isUploadingChat ? <Loader2 className="animate-spin text-stone-500" size={20} /> : <Paperclip size={20} className="text-stone-500" />}<input type="file" className="hidden" accept="image/*" onChange={handleChatImageUpload} disabled={isUploadingChat} /></label><input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={t.typeMessage || "Type a message..."} className="flex-1 p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-berry-rich/20 text-sm font-medium transition-all" /><button onClick={handleSendMessage} className="p-4 bg-berry-rich text-white rounded-2xl hover:bg-berry-dark transition-colors shadow-lg hover:shadow-berry-rich/30"><Send size={20} /></button></div></div></>) : (<div className="flex-1 flex items-center justify-center flex-col text-stone-300"><div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6"><MessageSquare size={32} className="opacity-50" /></div><p className="font-serif text-lg">{t.selectConversation}</p></div>)}</div></div>)}
          {activeTab === 'profile' && (
             <div className="space-y-8 animate-fade-in-up">
              <h2 className="text-4xl font-serif font-bold mb-8 text-berry-rich">{t.profile}</h2>
              <div className="grid md:grid-cols-2 gap-10">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-stone-100 relative overflow-hidden">
                   <h3 className="font-serif font-bold text-2xl mb-6 text-berry-rich">{t.storeInfo}</h3>
                   <div className="flex flex-col items-center mb-8">
                      <div className="w-24 h-24 rounded-full bg-stone-100 border-4 border-white shadow-lg overflow-hidden mb-4 relative group">
                         {profileData.photoUrl ? (
                            <img src={profileData.photoUrl} alt="Logo" className="w-full h-full object-cover" />
                         ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                               <UserIcon size={40} />
                            </div>
                         )}
                         {isUploadingProfile && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Loader2 className="animate-spin text-white" />
                            </div>
                         )}
                         <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <Camera size={20} className="text-white" />
                            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploadingProfile} />
                         </label>
                      </div>
                      <p className="text-xs text-stone-400">Click to upload brand logo</p>
                   </div>
                   <div className="space-y-5">
                      <div>
                         <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.brandName}</label>
                         <input type="text" className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50 text-stone-800" value={profileData.brandName} onChange={(e) => setProfileData({...profileData, brandName: e.target.value})} />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.fullName}</label>
                         <input type="text" className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50 text-stone-800" value={profileData.ownerName} onChange={(e) => setProfileData({...profileData, ownerName: e.target.value})} />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.bio}</label>
                         <textarea className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50 text-stone-800 h-24" value={profileData.bio} onChange={(e) => setProfileData({...profileData, bio: e.target.value})} />
                      </div>
                   </div>
                </div>
                
                <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-stone-100 relative overflow-hidden">
                   <h3 className="font-serif font-bold text-2xl mb-6 text-berry-rich">{t.contactInfo} & {t.paymentInfo}</h3>
                   <div className="space-y-5">
                      <div>
                         <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.email}</label>
                         <input type="email" disabled className="w-full p-4 border border-stone-200 rounded-xl bg-stone-100 text-stone-500 cursor-not-allowed" value={profileData.email} />
                         <p className="text-xs text-stone-400 mt-1">To change email, go to Settings.</p>
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.phone}</label>
                         <input type="tel" className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50 text-stone-800" value={profileData.phone} onChange={(e) => setProfileData({...profileData, phone: e.target.value})} />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.address}</label>
                         <textarea className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50 text-stone-800 h-24" value={profileData.address} onChange={(e) => setProfileData({...profileData, address: e.target.value})} />
                      </div>

                      <div className="pt-4 border-t border-stone-100 mt-4">
                          <h4 className="font-bold text-berry-rich mb-4 flex items-center gap-2"><CreditCard size={18} /> Detail Pembayaran (Bank)</h4>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-[10px] text-stone-500 uppercase font-bold mb-1">Nama Bank</label>
                                  <input type="text" className="w-full p-3 border border-stone-200 rounded-lg bg-stone-50 text-sm" placeholder="BCA / Mandiri" value={profileData.bankName} onChange={(e) => setProfileData({...profileData, bankName: e.target.value})} />
                              </div>
                              <div>
                                  <label className="block text-[10px] text-stone-500 uppercase font-bold mb-1">No. Rekening</label>
                                  <input type="text" className="w-full p-3 border border-stone-200 rounded-lg bg-stone-50 text-sm" placeholder="1234567890" value={profileData.accountNumber} onChange={(e) => setProfileData({...profileData, accountNumber: e.target.value})} />
                              </div>
                              <div className="col-span-2">
                                  <label className="block text-[10px] text-stone-500 uppercase font-bold mb-1">Atas Nama (Pemilik Rekening)</label>
                                  <input type="text" className="w-full p-3 border border-stone-200 rounded-lg bg-stone-50 text-sm" placeholder="Nama Lengkap" value={profileData.accountHolder} onChange={(e) => setProfileData({...profileData, accountHolder: e.target.value})} />
                              </div>
                          </div>
                      </div>

                      <div className="pt-4 border-t border-stone-100 mt-4">
                          <h4 className="font-bold text-berry-rich mb-4 flex items-center gap-2"><CreditCard size={18} /> Detail E-Wallet</h4>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-[10px] text-stone-500 uppercase font-bold mb-1">E-Wallet</label>
                                  <input type="text" className="w-full p-3 border border-stone-200 rounded-lg bg-stone-50 text-sm" placeholder="Gopay / OVO" value={profileData.walletName} onChange={(e) => setProfileData({...profileData, walletName: e.target.value})} />
                              </div>
                              <div>
                                  <label className="block text-[10px] text-stone-500 uppercase font-bold mb-1">No. HP / Akun</label>
                                  <input type="text" className="w-full p-3 border border-stone-200 rounded-lg bg-stone-50 text-sm" placeholder="08123..." value={profileData.walletNumber} onChange={(e) => setProfileData({...profileData, walletNumber: e.target.value})} />
                              </div>
                          </div>
                      </div>

                      <button onClick={handleSaveProfile} className="w-full mt-4 py-4 bg-gradient-to-r from-berry-rich to-berry-dark text-white rounded-xl hover:shadow-xl transition-all font-bold">
                        {t.saveProfile}
                      </button>
                   </div>
                </div>
              </div>
             </div>
          )}
          {activeTab === 'settings' && (/* ... */ <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up"><h2 className="text-4xl font-serif font-bold mb-8 text-berry-rich">{t.accountSettings}</h2><div className="bg-white p-8 rounded-[2rem] border border-stone-100 shadow-sm"><h3 className="text-xl font-serif font-bold text-berry-rich mb-6 flex items-center gap-2"><Lock size={20} /> {t.security}</h3><form onSubmit={handleUpdateSettings} className="space-y-6"><div className="p-4 bg-stone-50 rounded-xl border border-stone-200"><h4 className="font-bold text-stone-700 mb-4">{t.changePassword}</h4><div className="space-y-4"><div><label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.newPassword}</label><input type="password" className="w-full p-4 border border-stone-200 rounded-xl bg-white" placeholder="Min. 6 characters" value={settingsForm.newPassword} onChange={(e) => setSettingsForm({...settingsForm, newPassword: e.target.value})} /></div><div><label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.confirmNewPassword}</label><input type="password" className="w-full p-4 border border-stone-200 rounded-xl bg-white" placeholder="Confirm new password" value={settingsForm.confirmPassword} onChange={(e) => setSettingsForm({...settingsForm, confirmPassword: e.target.value})} /></div></div></div><div className="p-4 bg-stone-50 rounded-xl border border-stone-200"><h4 className="font-bold text-stone-700 mb-4">Update Email</h4><div><label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.email}</label><input type="email" className="w-full p-4 border border-stone-200 rounded-xl bg-white" value={settingsForm.newEmail} onChange={(e) => setSettingsForm({...settingsForm, newEmail: e.target.value})} /><p className="text-xs text-orange-500 mt-2 flex items-center gap-1"><Bell size={12} /> Note: Changing email requires you to re-login.</p></div></div><div className="flex justify-end pt-4"><button type="submit" disabled={settingsLoading} className="px-8 py-4 bg-gradient-to-r from-berry-rich to-berry-dark text-white rounded-xl font-bold hover:shadow-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-70">{settingsLoading ? 'Saving...' : <><Save size={18} /> {t.saveSettings}</>}</button></div></form></div></div>)}
        </div>
      </main>
    </div>
  );
};