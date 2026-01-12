import React, { useState, useEffect } from 'react';
import { User, BodyMeasurements, Order, OrderStatus, ChatMessage, Transaction, MerchantProfile, ChatConversation, CatalogItem, UserRole } from '../types';
import { 
  Ruler, ShoppingBag, MessageSquare, Wand2, LogOut, 
  Menu, X, Upload, CheckCircle, Search, Star, CreditCard, Send, ArrowLeft,
  ChevronRight, MapPin, Truck, CreditCard as CardIcon, FileText, User as UserIcon, Settings, Lock, Bell, Paperclip, Save, Camera, Loader2, RefreshCw, UploadCloud, Sparkles, AlertTriangle, Copy, Check, AlertCircle, Trash2, Eye,
  Image as ImageIcon, ZoomIn, Calendar, Filter, Download
} from 'lucide-react';
import { generateStyleAdvice } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  subscribeToOrders, createOrder, getAllMerchants, 
  getChatId, subscribeToMessages, sendMessage, updateOrderStatus,
  saveUserProfile, updateUserPassword, updateUserEmail, subscribeToChatList, createTransaction, subscribeToCustomerTransactions, addReview
} from '../services/firebase';
import { uploadToCloudinary } from '../services/cloudinaryService';

interface CustomerDashboardProps {
  user: User;
  onLogout: () => void;
}

interface ExtendedOrder extends Order {
  isReviewed?: boolean;
}

const INITIAL_MEASUREMENTS: BodyMeasurements = {
  height: 160, weight: 55, bust: 88, waist: 70, hips: 92, shoulder: 38, sleeveLength: 55
};

const MEASUREMENT_LABELS: Record<keyof BodyMeasurements, string> = {
  height: "Tinggi Badan",
  weight: "Berat Badan",
  bust: "Lingkar Dada",
  waist: "Lingkar Pinggang",
  hips: "Lingkar Pinggul",
  shoulder: "Lebar Bahu",
  sleeveLength: "Panjang Lengan"
};

const ORDER_STEPS = [
  OrderStatus.CONSULTATION, 
  OrderStatus.DESIGN, 
  OrderStatus.PRODUCTION, 
  OrderStatus.FINISHING, 
  OrderStatus.SHIPPED, 
  OrderStatus.COMPLETED
];

const renderProgressBar = (currentStatus: OrderStatus) => {
  if (currentStatus === OrderStatus.CANCELLED || currentStatus === OrderStatus.COMPLAINT) return null;
  const currentIdx = ORDER_STEPS.indexOf(currentStatus);
  return (
    <div className="w-full mt-4">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-stone-200 -z-10"></div>
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-berry-rich -z-10 transition-all duration-500" style={{ width: `${(currentIdx / (ORDER_STEPS.length - 1)) * 100}%` }}></div>
        {ORDER_STEPS.map((step, idx) => {
          const isCompleted = idx <= currentIdx;
          const isActive = idx === currentIdx;
          const labels: Record<string, string> = {
            [OrderStatus.CONSULTATION]: "Konsul", [OrderStatus.DESIGN]: "Desain", [OrderStatus.PRODUCTION]: "Produksi", [OrderStatus.FINISHING]: "Finishing", [OrderStatus.SHIPPED]: "Dikirim", [OrderStatus.COMPLETED]: "Selesai"
          };
          return (
            <div key={step} className="flex flex-col items-center group">
              <div className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${isCompleted ? 'bg-berry-rich border-berry-rich scale-110' : 'bg-stone-100 border-stone-300'} ${isActive ? 'ring-4 ring-berry-rich/20' : ''}`}></div>
              <span className={`text-[10px] mt-2 font-bold uppercase tracking-wider transition-colors duration-300 ${isCompleted ? 'text-berry-rich' : 'text-stone-400'} ${isActive ? 'scale-110' : ''}`}>{labels[step]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BINDERBYTE_API_KEY = '990c2606587d7318c449e8eacbe3334f6dc9eea23c71d569b4481b4b058a8630';
const ORIGIN_CITY_ID = '3273'; 

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ user, onLogout }) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'orders' | 'profile' | 'ai-stylist' | 'chat' | 'find-partner' | 'transactions' | 'settings'>('orders');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // Data State
  const [merchants, setMerchants] = useState<User[]>([]);
  const [isLoadingMerchants, setIsLoadingMerchants] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<User | null>(null);
  const [myOrders, setMyOrders] = useState<ExtendedOrder[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeConversations, setActiveConversations] = useState<ChatConversation[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ExtendedOrder | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurements>(user.measurements || INITIAL_MEASUREMENTS);
  const [profileData, setProfileData] = useState({ name: user.name, email: user.email, phone: user.phone || '', address: user.address || '', photoUrl: user.photoUrl || '', bodyFitPhotoUrl: user.bodyFitPhotoUrl || '' });
  const [notification, setNotification] = useState<{ show: boolean; type: 'success' | 'error'; title: string; message: string; } | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transFilters, setTransFilters] = useState({ status: 'All', startDate: '', endDate: '' });
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingBodyFit, setIsUploadingBodyFit] = useState(false); 
  const [isUploadingChat, setIsUploadingChat] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  // Complaint State
  const [isComplaintModalOpen, setComplaintModalOpen] = useState(false);
  const [complaintReason, setComplaintReason] = useState('');
  const [complaintImage, setComplaintImage] = useState('');
  const [isUploadingComplaint, setIsUploadingComplaint] = useState(false);
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);
  const [orderToComplaint, setOrderToComplaint] = useState<ExtendedOrder | null>(null);

  // Cancellation State
  const [isCancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [orderToCancel, setOrderToCancel] = useState<ExtendedOrder | null>(null);

  // Order Received Confirmation State
  const [isReceiveConfirmOpen, setReceiveConfirmOpen] = useState(false);
  const [orderToReceive, setOrderToReceive] = useState<ExtendedOrder | null>(null);

  // Settings, AI, Chat, Checkout, Review States
  const [settingsForm, setSettingsForm] = useState({ newEmail: user.email, newPassword: '', confirmPassword: '', notifications: true });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState({ occasion: '', preference: '', bodyType: '' });
  const [aiRecommendation, setAiRecommendation] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentChatParticipant, setCurrentChatParticipant] = useState<{id: string, name: string} | null>(null);
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [checkoutItem, setCheckoutItem] = useState<CatalogItem | null>(null);
  const [activeItemImage, setActiveItemImage] = useState<string>(''); 
  const [previewItem, setPreviewItem] = useState<CatalogItem | null>(null);
  const [previewActiveImage, setPreviewActiveImage] = useState<string>('');
  const [provinces, setProvinces] = useState<{id: string, name: string}[]>([]);
  const [cities, setCities] = useState<{id: string, name: string}[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(false);
  const [checkoutData, setCheckoutData] = useState({ measurements: INITIAL_MEASUREMENTS, notes: '', address: '', provinceId: '', cityId: '', cityName: '', courier: '', shippingMethod: '', shippingCost: 0, paymentMethod: '', paymentProofUrl: '' });
  const [shippingOptions, setShippingOptions] = useState<{service: string, description: string, cost: number, etd: string}[]>([]);
  const [isLoadingShippingCost, setIsLoadingShippingCost] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isReviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<ExtendedOrder | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => { if (notification?.show) { const timer = setTimeout(() => { setNotification(null); }, 5000); return () => clearTimeout(timer); } }, [notification]);
  const showToast = (type: 'success' | 'error', title: string, message: string) => { setNotification({ show: true, type, title, message }); };
  useEffect(() => { if (isCheckoutOpen) { fetchProvinces(); } }, [isCheckoutOpen]);
  const fetchProvinces = async () => { try { const response = await fetch(`https://api.binderbyte.com/wilayah/provinsi?api_key=${BINDERBYTE_API_KEY}`); const data = await response.json(); if (data.value) { setProvinces(data.value); } } catch (error) { console.error("Failed to fetch provinces", error); } };
  const fetchCities = async (provinceId: string) => { setIsLoadingRegions(true); setCities([]); try { const response = await fetch(`https://api.binderbyte.com/wilayah/kabupaten?api_key=${BINDERBYTE_API_KEY}&id_provinsi=${provinceId}`); const data = await response.json(); if (data.value) { setCities(data.value); } } catch (error) { console.error("Failed to fetch cities", error); } finally { setIsLoadingRegions(false); } };
  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => { const provId = e.target.value; setCheckoutData(prev => ({ ...prev, provinceId: provId, cityId: '', cityName: '' })); if (provId) { fetchCities(provId); } else { setCities([]); } };
  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => { const cityId = e.target.value; const cityObj = cities.find(c => c.id === cityId); setCheckoutData(prev => ({ ...prev, cityId: cityId, cityName: cityObj ? cityObj.name : '' })); };
  const handleCheckShipping = () => { if (!checkoutData.cityId || !checkoutData.courier) { showToast('error', 'Validasi', 'Mohon pilih kota dan kurir terlebih dahulu.'); return; } setIsLoadingShippingCost(true); setShippingOptions([]); setCheckoutData(prev => ({ ...prev, shippingMethod: '', shippingCost: 0 })); setTimeout(() => { const mockResults = [ { service: 'OKE', description: 'Ongkos Kirim Ekonomis', cost: 18000, etd: '3-4 Hari' }, { service: 'REG', description: 'Layanan Reguler', cost: 22000, etd: '1-2 Hari' }, { service: 'YES', description: 'Yakin Esok Sampai', cost: 35000, etd: '1 Hari' } ]; setShippingOptions(mockResults); setIsLoadingShippingCost(false); }, 1500); };
  useEffect(() => { const unsubscribe = subscribeToOrders(user.id, UserRole.CUSTOMER, (liveOrders) => { setMyOrders(liveOrders as ExtendedOrder[]); }); return () => unsubscribe(); }, [user.id]);
  useEffect(() => { if (selectedOrder) { const updated = myOrders.find(o => o.id === selectedOrder.id); if (updated && updated.status !== selectedOrder.status) { setSelectedOrder(updated); } } }, [myOrders, selectedOrder]);
  useEffect(() => { const unsubscribe = subscribeToChatList(user.id, (chats) => { setActiveConversations(chats); }); return () => unsubscribe(); }, [user.id]);
  useEffect(() => { const unsubscribe = subscribeToCustomerTransactions(user.id, (trans) => { setTransactions(trans); }); return () => unsubscribe(); }, [user.id]);
  useEffect(() => { const fetchMerchants = async () => { setIsLoadingMerchants(true); const data = await getAllMerchants(); setMerchants(data); setIsLoadingMerchants(false); }; if (activeTab === 'find-partner') { fetchMerchants(); } }, [activeTab]);
  useEffect(() => { if (!activeChatId) return; const unsubscribe = subscribeToMessages(activeChatId, (msgs) => { const processedMsgs = msgs.map(m => ({ ...m, isMe: m.senderId === user.id })); setMessages(processedMsgs); }); return () => unsubscribe(); }, [activeChatId, user.id]);
  useEffect(() => { if (user.measurements) { setMeasurements(user.measurements); } setProfileData(prev => ({ ...prev, photoUrl: user.photoUrl || prev.photoUrl, bodyFitPhotoUrl: user.bodyFitPhotoUrl || prev.bodyFitPhotoUrl, name: user.name, phone: user.phone || prev.phone, address: user.address || prev.address })); }, [user]);

  const filteredTransactions = transactions.filter(t => { const matchStatus = transFilters.status === 'All' || t.status === transFilters.status; let matchDate = true; if (transFilters.startDate) { matchDate = matchDate && new Date(t.date) >= new Date(transFilters.startDate); } if (transFilters.endDate) { const end = new Date(transFilters.endDate); end.setDate(end.getDate() + 1); matchDate = matchDate && new Date(t.date) < end; } return matchStatus && matchDate; });
  const handleAiConsultation = async () => { setLoadingAi(true); const advice = await generateStyleAdvice(aiPrompt.occasion, aiPrompt.preference, aiPrompt.bodyType, language); setAiRecommendation(advice); setLoadingAi(false); };
  const handleSendMessage = async () => { if (!chatInput.trim() || !activeChatId) return; try { const participants = currentChatParticipant ? [user.id, currentChatParticipant.id] : undefined; const participantNames = currentChatParticipant ? { [user.id]: user.name, [currentChatParticipant.id]: currentChatParticipant.name } : undefined; await sendMessage( activeChatId, { senderId: user.id, senderName: user.name, text: chatInput, }, participants, participantNames ); setChatInput(''); } catch (e) { console.error(e); } };
  const handleChatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file && activeChatId) { setIsUploadingChat(true); try { const imageUrl = await uploadToCloudinary(file); const participants = currentChatParticipant ? [user.id, currentChatParticipant.id] : undefined; const participantNames = currentChatParticipant ? { [user.id]: user.name, [currentChatParticipant.id]: currentChatParticipant.name } : undefined; await sendMessage( activeChatId, { senderId: user.id, senderName: user.name, text: 'Mengirim gambar', attachmentUrl: imageUrl }, participants, participantNames ); } catch (error) { showToast('error', 'Error', "Gagal mengunggah gambar. Silakan coba lagi."); } finally { setIsUploadingChat(false); } } };
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setIsUploadingProfile(true); try { const photoUrl = await uploadToCloudinary(file); setProfileData(prev => ({ ...prev, photoUrl })); } catch (error) { showToast('error', 'Error', "Gagal mengunggah foto."); } finally { setIsUploadingProfile(false); } } };
  const handleBodyFitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setIsUploadingBodyFit(true); try { const url = await uploadToCloudinary(file); setProfileData(prev => ({ ...prev, bodyFitPhotoUrl: url })); showToast('success', 'Upload Berhasil', 'Foto body fit berhasil diunggah.'); } catch (error) { showToast('error', 'Upload Gagal', "Gagal mengunggah foto body fit."); } finally { setIsUploadingBodyFit(false); } } };
  const handlePaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setIsUploadingProof(true); try { const url = await uploadToCloudinary(file); setCheckoutData(prev => ({ ...prev, paymentProofUrl: url })); } catch (error) { showToast('error', 'Error', "Gagal mengunggah bukti pembayaran."); } finally { setIsUploadingProof(false); } } };
  const handleCopy = (text: string) => { navigator.clipboard.writeText(text).then(() => { setCopiedText(text); setTimeout(() => setCopiedText(null), 2000); showToast('success', 'Disalin', 'Nomor berhasil disalin ke clipboard.'); }); };
  const handleSaveProfile = async () => { try { await saveUserProfile({ ...user, name: profileData.name, phone: profileData.phone, address: profileData.address, photoUrl: profileData.photoUrl, bodyFitPhotoUrl: profileData.bodyFitPhotoUrl, measurements: measurements }); showToast('success', 'Profil Disimpan', 'Perubahan profil berhasil disimpan.'); } catch (e) { console.error(e); showToast('error', 'Gagal', 'Gagal menyimpan perubahan.'); } };
  const handleUpdateSettings = async (e: React.FormEvent) => { e.preventDefault(); setSettingsLoading(true); let messages = []; try { if (settingsForm.newPassword) { if (settingsForm.newPassword !== settingsForm.confirmPassword) { showToast('error', 'Error', t.passwordsNoMatch); setSettingsLoading(false); return; } if (settingsForm.newPassword.length < 6) { showToast('error', 'Error', "Password must be at least 6 characters."); setSettingsLoading(false); return; } await updateUserPassword(settingsForm.newPassword); messages.push("Password diperbarui."); } if (settingsForm.newEmail !== user.email) { await updateUserEmail(settingsForm.newEmail); messages.push("Email diperbarui."); } if (messages.length > 0) { showToast('success', 'Sukses', messages.join(" ")); setSettingsForm(prev => ({ ...prev, newPassword: '', confirmPassword: '' })); } else { showToast('success', 'Sukses', "Pengaturan disimpan."); } } catch (error: any) { console.error(error); if (error.code === 'auth/requires-recent-login') { showToast('error', 'Keamanan', "Untuk keamanan, silakan login ulang untuk mengubah pengaturan sensitif."); } else { showToast('error', 'Error', error.message); } } finally { setSettingsLoading(false); } };
  const startChatWithMerchant = (merchant: User, initialMessage?: string, attachmentUrl?: string) => { if (!merchant.id) { showToast('error', 'Error', "ID Mitra tidak valid."); return; } const chatId = getChatId(user.id, merchant.id); setActiveTab('chat'); setActiveChatId(chatId); setCurrentChatParticipant({ id: merchant.id, name: merchant.brandName || merchant.name }); const exists = activeConversations.find(c => c.id === chatId); if (!exists) { setActiveConversations(prev => [...prev, { id: chatId, participantName: merchant.brandName || merchant.name, lastMessage: initialMessage || 'Mulai percakapan', timestamp: new Date(), unreadCount: 0 }]); } if (initialMessage || attachmentUrl) { sendMessage( chatId, { senderId: user.id, senderName: user.name, text: initialMessage || 'Halo!', attachmentUrl: attachmentUrl }, [user.id, merchant.id], { [user.id]: user.name, [merchant.id]: merchant.brandName || merchant.name } ); } setSelectedMerchant(null); };
  const handleDiscussCatalogItem = (merchant: User, item: CatalogItem) => { const message = `Halo ${merchant.brandName || merchant.name}, saya tertarik dengan model "${item.title}" ini. Apakah bisa dibuatkan?`; const imageToSend = item.images && item.images.length > 0 ? item.images[0] : item.imageUrl; startChatWithMerchant(merchant, message, imageToSend); };
  const handleOpenImagePreview = (item: CatalogItem) => { const initialImage = item.images && item.images.length > 0 ? item.images[0] : (item.imageUrl || ''); setPreviewItem(item); setPreviewActiveImage(initialImage); };
  const openCheckout = (merchant: User, item: CatalogItem) => { setCheckoutItem(item); const mainImage = item.images && item.images.length > 0 ? item.images[0] : (item.imageUrl || ''); setActiveItemImage(mainImage); setCheckoutData({ measurements: measurements, notes: '', address: profileData.address || '', provinceId: '', cityId: '', cityName: '', courier: '', shippingMethod: '', shippingCost: 0, paymentMethod: '', paymentProofUrl: '' }); setShippingOptions([]); setCheckoutStep(1); setCheckoutOpen(true); };
  const handleSubmitOrder = async () => { if (!checkoutItem || !selectedMerchant) return; if (!checkoutData.paymentMethod) { showToast('error', 'Validasi', "Silakan pilih metode pembayaran."); return; } if (checkoutData.paymentMethod !== 'COD' && !checkoutData.paymentProofUrl) { showToast('error', 'Validasi', "Silakan unggah bukti pembayaran."); return; } if (!checkoutData.shippingMethod && checkoutData.shippingMethod !== 'Pick Up') { showToast('error', 'Validasi', "Silakan pilih opsi pengiriman/ongkir."); return; } try { const fullShippingAddress = `${checkoutData.address}, ${checkoutData.cityName}`; const finalPrice = (checkoutItem.price || 0) + checkoutData.shippingCost; const mainImage = checkoutItem.images && checkoutItem.images.length > 0 ? checkoutItem.images[0] : checkoutItem.imageUrl; await createOrder({ merchantId: selectedMerchant.id, merchantName: selectedMerchant.brandName || selectedMerchant.name, customerId: user.id, customerName: user.name, designName: checkoutItem.title, status: OrderStatus.CONSULTATION, price: finalPrice, date: new Date().toISOString().split('T')[0], imageUrl: mainImage, measurements: checkoutData.measurements, customerNotes: checkoutData.notes, shippingMethod: `${checkoutData.courier.toUpperCase()} - ${checkoutData.shippingMethod}`, shippingAddress: fullShippingAddress, paymentMethod: checkoutData.paymentMethod, paymentProofUrl: checkoutData.paymentProofUrl }); setCheckoutOpen(false); setActiveTab('orders'); setSelectedMerchant(null); showToast('success', 'Berhasil', t.orderSuccess); } catch (e) { console.error("Failed to place order", e); showToast('error', 'Gagal', "Gagal membuat pesanan. Silakan coba lagi."); } };
  
  const promptCancelOrder = (order: ExtendedOrder) => { setOrderToCancel(order); setCancelReason(''); setCancelModalOpen(true); };
  const handleConfirmCancel = async () => { if(!orderToCancel) return; if(!cancelReason.trim()) { showToast('error', 'Validasi', "Mohon isi alasan pembatalan."); return; } setIsProcessingOrder(true); try { await updateOrderStatus(orderToCancel.id, { status: OrderStatus.CANCELLED, cancellationReason: cancelReason }); showToast('success', 'Dibatalkan', "Pesanan berhasil dibatalkan."); setCancelModalOpen(false); setOrderToCancel(null); if(selectedOrder?.id === orderToCancel.id) { setSelectedOrder(null); } } catch (e) { console.error(e); showToast('error', 'Gagal', "Gagal membatalkan pesanan."); } finally { setIsProcessingOrder(false); } };
  const promptOrderReceived = (order: ExtendedOrder, e?: React.MouseEvent) => { e?.stopPropagation(); setOrderToReceive(order); setReceiveConfirmOpen(true); };
  const confirmOrderReceived = async () => { if(!orderToReceive) return; setIsProcessingOrder(true); try { await updateOrderStatus(orderToReceive.id, { status: OrderStatus.COMPLETED }); if (orderToReceive.merchantId) { await createTransaction({ merchantId: orderToReceive.merchantId, customerId: user.id, amount: orderToReceive.price, description: `Pembayaran untuk pesanan ${orderToReceive.designName}`, status: 'Success', type: 'Payment', date: new Date().toISOString() }); } setReceiveConfirmOpen(false); showToast('success', 'Selesai', "Pesanan selesai! Terima kasih."); if (selectedOrder?.id === orderToReceive.id) { setSelectedOrder(null); } openReviewModal(orderToReceive); setOrderToReceive(null); } catch (error: any) { console.error("Error completing order", error); if (error.code === 'permission-denied') { showToast('error', 'Izin Ditolak', "Mohon periksa Security Rules Firebase Anda."); } else { showToast('error', 'Error', "Terjadi kesalahan. Coba lagi."); } } finally { setIsProcessingOrder(false); } };

  const handleComplaintImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setIsUploadingComplaint(true); try { const url = await uploadToCloudinary(file); setComplaintImage(url); } catch (error) { showToast('error', 'Error', "Gagal mengunggah gambar."); } finally { setIsUploadingComplaint(false); } } };
  const promptComplaint = (order: ExtendedOrder, e?: React.MouseEvent) => {
     e?.stopPropagation();
     setOrderToComplaint(order);
     setComplaintReason('');
     setComplaintImage('');
     setComplaintModalOpen(true);
  };
  const handleSubmitComplaint = async () => {
     const targetOrder = orderToComplaint || selectedOrder;
     if(!complaintReason) { showToast('error', 'Validasi', "Mohon isi alasan komplain."); return; }
     if(!targetOrder) { showToast('error', 'Error', "Data pesanan tidak ditemukan."); return; }
     setIsSubmittingComplaint(true);
     try {
         await updateOrderStatus(targetOrder.id, {
             status: OrderStatus.COMPLAINT,
             complaint: { reason: complaintReason, imageUrl: complaintImage, date: new Date().toISOString(), status: 'Pending' }
         });
         showToast('success', 'Terkirim', "Komplain berhasil dikirim. Mitra akan segera merespon.");
         setComplaintModalOpen(false);
         setOrderToComplaint(null);
     } catch (e) { console.error(e); showToast('error', 'Gagal', "Gagal mengirim komplain."); } finally { setIsSubmittingComplaint(false); }
  };

  const openReviewModal = (order: ExtendedOrder) => { setSelectedOrderForReview(order); setReviewRating(5); setReviewComment(''); setReviewModalOpen(true); };
  const submitReview = async (e?: React.MouseEvent) => {
    // Prevent event propagation if triggered by click
    if(e) e.stopPropagation();
    
    if (selectedOrderForReview && selectedOrderForReview.merchantId) {
      setIsSubmittingReview(true);
      try {
          const reviewPayload = { rating: reviewRating, comment: reviewComment, reviewerName: user.name, customerId: user.id, imageUrl: selectedOrderForReview.imageUrl || "" };
          await addReview(selectedOrderForReview.merchantId, selectedOrderForReview.id, reviewPayload);
          setReviewModalOpen(false);
          showToast('success', 'Terima Kasih', t.reviewThanks);
      } catch (e: any) { 
          console.error("Error submitting review:", e); 
          if (e.code === 'permission-denied') {
             showToast('error', 'Izin Ditolak', "Gagal memperbarui rating mitra. Mohon cek Rules Database.");
          } else {
             showToast('error', 'Gagal', "Gagal mengirim ulasan."); 
          }
      } finally { setIsSubmittingReview(false); }
    } else { showToast('error', 'Error', "Data Merchant tidak valid."); }
  };

  const NavItem = ({ id, icon: Icon, label }: { id: string; icon: any; label: string }) => (
    <button onClick={() => { setActiveTab(id as any); setSidebarOpen(false); setSelectedMerchant(null); }} className={`w-full flex items-center gap-4 px-6 py-4 transition-all duration-300 relative group ${activeTab === id ? 'text-white' : 'text-purple-200 hover:text-white hover:bg-white/5'}`}> {activeTab === id && ( <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-gold shadow-[0_0_10px_#D4AF37]"></div> )} {activeTab === id && ( <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div> )} <Icon size={20} className={activeTab === id ? 'text-brand-gold' : ''} /> <span className="font-medium tracking-wide">{label}</span> </button>
  );

  return (
    <div className="h-screen bg-[#FDFBF7] flex relative overflow-hidden">
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-brand-gold/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-berry-rich/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
      {notification && ( <div className="fixed top-6 right-6 z-[100] animate-fade-in-up w-full max-w-sm px-4 md:px-0"> <div className={`bg-white shadow-2xl rounded-2xl p-4 border-l-4 flex items-start gap-4 ${notification.type === 'success' ? 'border-green-500' : 'border-red-500'}`}> <div className={`p-2 rounded-full shrink-0 ${notification.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}> {notification.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />} </div> <div className="flex-1"> <h4 className={`font-bold text-sm ${notification.type === 'success' ? 'text-green-800' : 'text-red-800'}`}> {notification.title} </h4> <p className="text-xs text-stone-600 mt-1 leading-relaxed"> {notification.message} </p> </div> <button onClick={() => setNotification(null)} className="text-stone-400 hover:text-stone-600"> <X size={18} /> </button> </div> </div> )}
      {isReceiveConfirmOpen && ( <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"> <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center animate-scale-in"> <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600"> <CheckCircle size={32} /> </div> <h3 className="text-xl font-serif font-bold text-berry-rich mb-2">Terima Pesanan?</h3> <p className="text-stone-500 text-sm mb-6">Pastikan barang sudah diterima dengan baik. Dana akan diteruskan ke Mitra dan transaksi tercatat.</p> <div className="flex gap-3"> <button onClick={() => setReceiveConfirmOpen(false)} className="flex-1 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50"> Batal </button> <button onClick={confirmOrderReceived} disabled={isProcessingOrder} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 flex items-center justify-center gap-2"> {isProcessingOrder ? <Loader2 className="animate-spin" size={16} /> : "Ya, Selesaikan"} </button> </div> </div> </div> )}
      {isCancelModalOpen && ( <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"> <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center animate-scale-in"> <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"> <AlertTriangle size={32} /> </div> <h3 className="text-xl font-serif font-bold text-berry-rich mb-2">Batalkan Pesanan?</h3> <p className="text-stone-500 text-sm mb-4">Tindakan ini tidak dapat dibatalkan.</p> <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Alasan pembatalan..." className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50 text-sm mb-6 focus:ring-2 focus:ring-red-200 outline-none" /> <div className="flex gap-3"> <button onClick={() => setCancelModalOpen(false)} className="flex-1 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50"> Kembali </button> <button onClick={handleConfirmCancel} disabled={isProcessingOrder} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 flex items-center justify-center gap-2"> {isProcessingOrder ? <Loader2 className="animate-spin" size={16} /> : "Ya, Batalkan"} </button> </div> </div> </div> )}

      {isComplaintModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden p-6 animate-scale-in">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-serif font-bold text-red-700 flex items-center gap-2">
                          <AlertTriangle size={24} />
                          Ajukan Komplain
                      </h3>
                      <button onClick={() => setComplaintModalOpen(false)} className="text-stone-400 hover:text-red-600">
                          <X size={24} />
                      </button>
                  </div>
                  <div className="space-y-4">
                      <div><label className="block text-xs font-bold text-stone-500 uppercase mb-2">Alasan Komplain</label><textarea className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50 focus:ring-2 focus:ring-red-200 outline-none h-32 text-sm" placeholder="Jelaskan masalah pada pesanan..." value={complaintReason} onChange={(e) => setComplaintReason(e.target.value)} /></div>
                      <div><label className="block text-xs font-bold text-stone-500 uppercase mb-2">Bukti Foto (Opsional)</label><div className="flex gap-4 items-center"><label className={`flex-1 cursor-pointer ${isUploadingComplaint ? 'opacity-50 pointer-events-none' : ''}`}><div className="h-20 border-2 border-dashed border-stone-300 rounded-xl bg-stone-50 hover:bg-white transition-colors flex flex-col items-center justify-center text-center p-2">{isUploadingComplaint ? <Loader2 className="animate-spin text-red-500" size={20} /> : <Camera className="text-stone-400" size={20} />}<span className="text-[10px] font-bold text-stone-500 mt-1">Unggah Foto</span><input type="file" className="hidden" accept="image/*" onChange={handleComplaintImageUpload} /></div></label>{complaintImage && (<div className="h-20 w-20 rounded-xl overflow-hidden border border-stone-200 relative group"><img src={complaintImage} alt="Bukti" className="w-full h-full object-cover" /><button onClick={() => setComplaintImage('')} className="absolute top-1 right-1 bg-white rounded-full p-1 text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button></div>)}</div></div>
                  </div>
                  <div className="mt-8 flex gap-3">
                      <button onClick={() => setComplaintModalOpen(false)} className="flex-1 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50">Batal</button>
                      <button onClick={handleSubmitComplaint} disabled={isSubmittingComplaint || !complaintReason} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">{isSubmittingComplaint ? <Loader2 className="animate-spin" size={16} /> : "Kirim Komplain"}</button>
                  </div>
              </div>
          </div>
      )}

      {isReviewModalOpen && selectedOrderForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-berry-rich/20 backdrop-blur-md p-4 animate-fade-in">
           <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-white">
              <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center"><h3 className="text-xl font-serif font-bold text-berry-rich">{t.giveRating}</h3><button onClick={() => setReviewModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-berry-rich transition-colors"><X size={20} /></button></div>
              <div className="p-8">
                  <div className="flex flex-col items-center mb-6"><div className="w-20 h-20 rounded-xl bg-stone-100 mb-3 overflow-hidden"><img src={selectedOrderForReview.imageUrl || 'https://via.placeholder.com/100'} alt="" className="w-full h-full object-cover" /></div><p className="font-serif font-bold text-lg text-berry-rich">{selectedOrderForReview.designName}</p><p className="text-stone-500 text-sm">{selectedOrderForReview.merchantName}</p></div>
                  <div className="flex justify-center gap-2 mb-8">{[1, 2, 3, 4, 5].map((star) => (<button key={star} onClick={() => setReviewRating(star)} className={`p-1 transition-transform hover:scale-110 ${star <= reviewRating ? 'text-brand-gold' : 'text-stone-200'}`}><Star size={32} fill={star <= reviewRating ? "currentColor" : "none"} /></button>))}</div>
                  <textarea className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 h-32 mb-6" placeholder={t.writeReview} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
                  {/* Updated Button with better Click Handler */}
                  <button onClick={(e) => submitReview(e)} disabled={isSubmittingReview} className="w-full py-3 bg-berry-rich text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer">
                     {isSubmittingReview ? <Loader2 className="animate-spin" size={20} /> : t.submitReview}
                  </button>
              </div>
           </div>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-berry-rich/20 backdrop-blur-md p-4 animate-fade-in">
           <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col border border-white">
              <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center"><div><h3 className="text-xl font-serif font-bold text-berry-rich">{t.viewOrderDetails}</h3><p className="text-xs text-stone-500 mt-1 font-mono">ID: {selectedOrder.id}</p></div><div className="flex items-center gap-2">{selectedOrder.status === OrderStatus.CONSULTATION && (<button onClick={() => promptCancelOrder(selectedOrder)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-2"><Trash2 size={16} /> Batalkan Pesanan</button>)}<button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-berry-rich transition-colors"><X size={24} /></button></div></div>
              <div className="bg-white px-8 py-6 border-b border-stone-100">{renderProgressBar(selectedOrder.status)}</div>
              {selectedOrder.status === OrderStatus.COMPLAINT && (<div className="bg-red-50 px-8 py-6 border-b border-red-100 flex items-center gap-3"><AlertTriangle className="text-red-600" size={24} /><div><p className="text-red-800 font-bold text-lg">Pesanan Dikomplain</p><p className="text-red-600 text-sm">Menunggu respon dari Mitra.</p></div></div>)}
              {selectedOrder.status === OrderStatus.CANCELLED && (<div className="bg-red-50 px-8 py-6 border-b border-red-100 flex items-center gap-3"><X className="text-red-600" size={24} /><div><p className="text-red-800 font-bold text-lg">Pesanan Dibatalkan</p><p className="text-red-600 text-sm">Alasan: "{selectedOrder.cancellationReason || 'Tidak ada alasan'}"</p></div></div>)}
              <div className="p-8 overflow-y-auto space-y-8 flex-1"><div className="flex flex-col md:flex-row gap-8"><div className="md:w-1/3 space-y-6"><img src={selectedOrder.imageUrl || 'https://via.placeholder.com/100'} alt="" className="w-full h-48 rounded-2xl object-cover shadow-lg hover:scale-105 transition-transform duration-500" />{selectedOrder.trackingNumber && (<div className="bg-blue-50 p-4 rounded-2xl border border-blue-100"><p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Tracking Number</p><p className="font-mono font-bold text-lg text-blue-900">{selectedOrder.trackingNumber}</p></div>)}{selectedOrder.complaint && (<div className="bg-red-50 p-4 rounded-2xl border border-red-100 space-y-2"><p className="text-xs font-bold text-red-600 uppercase tracking-wide">Info Komplain</p><p className="text-sm font-medium text-stone-700 italic">"{selectedOrder.complaint.reason}"</p>{selectedOrder.complaint.imageUrl && (<div className="w-20 h-20 rounded-lg overflow-hidden border border-red-200"><img src={selectedOrder.complaint.imageUrl} className="w-full h-full object-cover" /></div>)}</div>)}{selectedOrder.status === OrderStatus.SHIPPED && (<div className="flex flex-col gap-3"><button onClick={(e) => promptOrderReceived(selectedOrder, e)} className="w-full py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-2"><CheckCircle size={20} />Pesanan Diterima</button><button onClick={(e) => promptComplaint(selectedOrder, e)} className="w-full py-3 bg-white border-2 border-red-100 text-red-500 rounded-xl font-bold hover:bg-red-50 hover:text-red-600 transition-colors">Ajukan Komplain</button></div>)}{selectedOrder.status === OrderStatus.COMPLETED && !selectedOrder.isReviewed && (<button onClick={() => openReviewModal(selectedOrder)} className="w-full py-3 bg-brand-gold text-white rounded-xl font-bold hover:bg-yellow-600 transition-colors shadow-lg"><Star size={18} className="inline mr-2 mb-1" /> {t.giveRating}</button>)}</div><div className="md:w-2/3 space-y-6"><div className="flex justify-between items-start"><div><h4 className="font-serif font-bold text-2xl text-berry-rich">{selectedOrder.designName}</h4><p className="text-stone-500 font-medium mt-1">by {selectedOrder.merchantName}</p></div><div className="text-right"><p className="font-serif font-bold text-2xl text-brand-gold">Rp {selectedOrder.price.toLocaleString()}</p><span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-[10px] rounded-full font-bold uppercase tracking-wider mt-1">LUNAS</span></div></div><div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 space-y-5"><div><h5 className="font-bold text-sm text-stone-700 flex items-center gap-2 mb-2 uppercase tracking-wide"><Truck size={16} className="text-berry-rich" /> {t.shippingInfo}</h5><p className="font-medium text-stone-800">{selectedOrder.shippingMethod}</p><p className="text-sm text-stone-500 mt-1">{selectedOrder.shippingAddress}</p></div><div className="border-t border-stone-200 pt-4"><h5 className="font-bold text-sm text-stone-700 flex items-center gap-2 mb-2 uppercase tracking-wide"><MessageSquare size={16} className="text-berry-rich" /> {t.notes}</h5><p className="text-stone-600 italic bg-white p-3 rounded-xl border border-stone-100 text-sm">"{selectedOrder.customerNotes || 'Tidak ada catatan'}"</p></div></div>{selectedOrder.measurements && (<div><h5 className="font-bold text-sm text-berry-rich flex items-center gap-2 mb-4 uppercase tracking-wide"><Ruler size={16} /> {t.bodyMeasurements} (cm)</h5><div className="grid grid-cols-3 gap-3">{Object.entries(selectedOrder.measurements).map(([key, val]) => (<div key={key} className="bg-white border border-stone-200 p-3 rounded-xl text-center hover:border-brand-gold/50 transition-colors"><span className="block text-[10px] text-stone-400 uppercase tracking-wider mb-1 font-bold">{MEASUREMENT_LABELS[key as keyof BodyMeasurements] || key}</span><span className="font-serif font-bold text-lg text-berry-rich">{val}</span></div>))}</div></div>)}</div></div></div></div>
        </div>
      )}

      {/* Checkout Modal (Placeholder Implementation based on state) */}
      {isCheckoutOpen && checkoutItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-berry-rich/20 backdrop-blur-md p-4 animate-fade-in">
           <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-stone-100 flex justify-between items-center"><h3 className="text-xl font-serif font-bold text-berry-rich">{t.checkoutTitle}</h3><button onClick={() => setCheckoutOpen(false)}><X size={20} /></button></div>
              <div className="p-8 overflow-y-auto">
                 {/* Simplified Checkout Content for fix */}
                 <div className="mb-6"><h4 className="font-bold mb-2">{checkoutItem.title}</h4><p className="text-brand-gold font-bold">Rp {checkoutItem.price?.toLocaleString()}</p></div>
                 <button onClick={handleSubmitOrder} className="w-full py-4 bg-berry-rich text-white rounded-xl font-bold">{t.submitOrder}</button>
              </div>
           </div>
        </div>
      )}

      <aside className={`fixed md:static inset-y-0 left-0 w-72 bg-gradient-to-b from-berry-rich to-berry-dark text-white z-30 flex flex-col h-full transform transition-transform duration-500 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-8 flex items-center justify-between">
            <div className="flex flex-col gap-2">
                <img src="https://raw.githubusercontent.com/idantexe/berrylybelle/refs/heads/main/logoooo.webp" alt="Berryly Belle" className="h-28 w-auto object-contain self-start drop-shadow-lg brightness-0 invert" />
                <span className="font-serif font-bold text-white text-3xl tracking-wide mt-2">Berryly <span className="text-brand-gold italic">Belle</span></span>
            </div>
            <button className="md:hidden text-white/70 hover:text-white" onClick={() => setSidebarOpen(false)}><X size={24} /></button>
        </div>
        <div className="px-4 py-6 flex-1 overflow-y-auto">
            <nav className="space-y-2">
                <NavItem id="orders" icon={ShoppingBag} label={t.myOrders} />
                <NavItem id="find-partner" icon={Search} label={t.findPartner} />
                <NavItem id="ai-stylist" icon={Wand2} label={t.aiStylist} />
                <NavItem id="chat" icon={MessageSquare} label={t.consultations} />
                <NavItem id="transactions" icon={CreditCard} label={t.transactions} />
                <NavItem id="profile" icon={UserIcon} label={t.profile} />
                <NavItem id="settings" icon={Settings} label={t.settings} />
            </nav>
        </div>
        <div className="p-4 mt-auto">
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-6 py-4 text-red-200 hover:bg-white/10 hover:text-red-100 rounded-xl transition-colors font-medium"><LogOut size={20} /><span>{t.signOut}</span></button>
            <p className="text-[10px] text-white/30 text-center mt-4">v1.0.0 (Build 20250523)</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto h-full bg-transparent">
        <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 p-4 md:hidden flex items-center justify-between sticky top-0 z-10 shadow-sm">
            <h1 className="font-serif font-bold text-lg text-berry-rich">Berryly Belle</h1>
            <button onClick={() => setSidebarOpen(true)} className="p-2 bg-stone-100 rounded-lg text-berry-rich"><Menu size={24} /></button>
        </header>

        <div className="p-6 md:p-12 max-w-7xl mx-auto">
          {activeTab === 'orders' && (
            <div className="space-y-8 animate-fade-in-up">
              <h2 className="text-4xl font-serif font-bold mb-8 text-berry-rich">{t.activeOrders}</h2>
              {myOrders.length === 0 ? (<div className="text-center py-20 bg-white rounded-[2rem] border border-stone-100"><ShoppingBag size={48} className="mx-auto text-stone-300 mb-4" /><p className="text-stone-500">Belum ada pesanan. Mulai cari mitra!</p></div>) : (
                <div className="grid gap-6">
                    {myOrders.map((order) => (
                    <div key={order.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100 flex flex-col md:flex-row gap-8 items-center hover:shadow-xl transition-all duration-300 hover:border-brand-gold/30 group cursor-pointer" onClick={() => setSelectedOrder(order)}>
                        <div className="w-32 h-32 bg-stone-100 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner">{order.imageUrl ? (<img src={order.imageUrl} alt={order.designName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />) : (<div className="w-full h-full flex items-center justify-center text-stone-400">{t.noImage}</div>)}</div>
                        <div className="flex-1 w-full text-center md:text-left">
                        <div className="flex justify-between items-start mb-3"><div><h3 className="text-2xl font-serif font-bold text-berry-rich">{order.designName}</h3><p className="text-stone-500 font-medium mt-1">oleh {order.merchantName}</p></div><span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${order.status === OrderStatus.PRODUCTION ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : (order.status === OrderStatus.COMPLETED ? 'bg-green-50 text-green-700 border-green-200' : (order.status === OrderStatus.COMPLAINT ? 'bg-red-50 text-red-700 border-red-200' : (order.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200')))}`}>{order.status}</span></div>
                        <div className="mt-4 mb-2">{renderProgressBar(order.status)}</div>
                        <div className="flex justify-between items-center mt-3">
                            <div className="flex gap-4 text-[10px] uppercase tracking-widest text-stone-400 font-bold"></div>
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                {order.status === OrderStatus.SHIPPED && (
                                    <>
                                        <button onClick={(e) => promptOrderReceived(order, e)} className="px-4 py-2 bg-green-600 text-white rounded-full text-xs font-bold flex items-center gap-2 hover:bg-green-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"><CheckCircle size={14} /> Pesanan Diterima</button>
                                        <button onClick={(e) => promptComplaint(order, e)} className="px-4 py-2 bg-white border border-red-200 text-red-500 rounded-full text-xs font-bold hover:bg-red-50 transition-colors flex items-center gap-2"><AlertTriangle size={14} /> Komplain</button>
                                    </>
                                )}
                                {order.status === OrderStatus.COMPLETED && (<button onClick={() => !order.isReviewed && openReviewModal(order)} disabled={order.isReviewed} className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${order.isReviewed ? 'bg-stone-100 text-stone-400 cursor-default' : 'bg-brand-gold text-white hover:bg-yellow-600 hover:shadow-md'}`}><Star size={14} className={order.isReviewed ? "" : "fill-current"} />{order.isReviewed ? t.ratingSubmitted : t.giveRating}</button>)}
                            </div>
                        </div>
                        </div>
                    </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'find-partner' && (
              <div className="space-y-8 animate-fade-in-up">
                  <h2 className="text-4xl font-serif font-bold text-berry-rich mb-8">{t.browseMerchants}</h2>
                  {isLoadingMerchants ? (<div className="flex justify-center py-20"><Loader2 className="animate-spin text-berry-rich" size={32} /></div>) : (
                      selectedMerchant ? (
                          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-stone-100">
                             <button onClick={() => setSelectedMerchant(null)} className="mb-6 flex items-center gap-2 text-stone-500 hover:text-berry-rich"><ArrowLeft size={16} /> {t.backToBrowse}</button>
                             <div className="flex flex-col md:flex-row gap-8 mb-8">
                                <img src={selectedMerchant.photoUrl || 'https://via.placeholder.com/150'} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-stone-100" />
                                <div><h3 className="text-2xl font-serif font-bold text-berry-rich">{selectedMerchant.brandName || selectedMerchant.name}</h3><p className="text-stone-500">{selectedMerchant.bio || "No bio available"}</p><div className="flex gap-4 mt-4"><button onClick={() => startChatWithMerchant(selectedMerchant)} className="px-6 py-2 bg-berry-rich text-white rounded-full font-bold text-sm flex items-center gap-2"><MessageSquare size={16} /> Chat</button></div></div>
                             </div>
                             <h4 className="font-bold text-lg mb-4 text-berry-rich">Katalog</h4>
                             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                {selectedMerchant.catalog?.map(item => (
                                    <div key={item.id} className="group cursor-pointer" onClick={() => handleOpenImagePreview(item)}>
                                        <div className="rounded-xl overflow-hidden aspect-[3/4] mb-3 relative"><img src={item.imageUrl || (item.images && item.images[0]) || 'https://via.placeholder.com/200'} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><span className="bg-white/90 px-4 py-2 rounded-full text-xs font-bold text-berry-rich">Lihat Detail</span></div></div>
                                        <h5 className="font-bold text-stone-800">{item.title}</h5>
                                        <p className="text-brand-gold font-bold text-sm">Rp {item.price?.toLocaleString()}</p>
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={(e) => { e.stopPropagation(); handleDiscussCatalogItem(selectedMerchant, item); }} className="flex-1 py-2 border border-berry-rich text-berry-rich rounded-lg text-xs font-bold hover:bg-berry-rich hover:text-white transition-colors">Chat</button>
                                            <button onClick={(e) => { e.stopPropagation(); openCheckout(selectedMerchant, item); }} className="flex-1 py-2 bg-brand-gold text-white rounded-lg text-xs font-bold hover:bg-yellow-600 transition-colors">Order</button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {merchants.map(m => (
                                  <div key={m.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100 hover:shadow-xl transition-all cursor-pointer" onClick={() => setSelectedMerchant(m)}>
                                      <div className="flex items-center gap-4 mb-4">
                                          <img src={m.photoUrl || 'https://via.placeholder.com/60'} alt="" className="w-16 h-16 rounded-full object-cover" />
                                          <div><h3 className="font-serif font-bold text-lg text-berry-rich">{m.brandName || m.name}</h3><div className="flex items-center gap-1 text-sm text-stone-500"><Star size={14} className="text-brand-gold fill-brand-gold" /><span>{m.rating ? m.rating.toFixed(1) : "N/A"}</span></div></div>
                                      </div>
                                      <p className="text-stone-500 text-sm line-clamp-2 mb-4">{m.bio || "Fashion Designer"}</p>
                                      <button className="w-full py-2 bg-stone-50 text-stone-600 rounded-xl text-sm font-bold hover:bg-stone-100">{t.viewProfile}</button>
                                  </div>
                              ))}
                          </div>
                      )
                  )}
              </div>
          )}

          {/* ... Rest of components ... */}
          {activeTab === 'ai-stylist' && (<div className="max-w-xl mx-auto space-y-8 animate-fade-in-up text-center"><div className="w-20 h-20 bg-gradient-to-tr from-brand-gold to-yellow-200 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-brand-gold/30"><Sparkles size={40} className="text-white" /></div><h2 className="text-4xl font-serif font-bold text-berry-rich">{t.aiTitle}</h2><p className="text-stone-500">{t.aiDesc}</p><div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100 text-left space-y-4"><div><label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.occasion}</label><input type="text" className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50" placeholder={t.occasionPlaceholder} value={aiPrompt.occasion} onChange={(e) => setAiPrompt({...aiPrompt, occasion: e.target.value})} /></div><div><label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.stylePref}</label><input type="text" className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50" placeholder={t.stylePlaceholder} value={aiPrompt.preference} onChange={(e) => setAiPrompt({...aiPrompt, preference: e.target.value})} /></div><div><label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{t.bodyType}</label><input type="text" className="w-full p-4 border border-stone-200 rounded-xl bg-stone-50" placeholder="e.g. Hourglass, Pear..." value={aiPrompt.bodyType} onChange={(e) => setAiPrompt({...aiPrompt, bodyType: e.target.value})} /></div><button onClick={handleAiConsultation} disabled={loadingAi} className="w-full py-4 bg-berry-rich text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2">{loadingAi ? <><Loader2 className="animate-spin" /> {t.analyze}</> : <><Wand2 size={18} /> {t.generate}</>}</button></div>{aiRecommendation && (<div className="bg-purple-50 p-8 rounded-[2rem] border border-purple-100 animate-scale-in text-left relative"><div className="absolute -top-3 left-8 bg-purple-200 text-purple-800 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Gemini Recommendation</div><p className="text-purple-900 leading-relaxed font-medium">{aiRecommendation}</p></div>)}</div>)}
          {activeTab === 'chat' && (<div className="grid md:grid-cols-3 h-[600px] bg-white rounded-[2.5rem] shadow-xl border border-stone-100 overflow-hidden animate-fade-in-up"><div className="border-r border-stone-100 bg-stone-50/50 flex flex-col h-full overflow-hidden"><div className="p-6 border-b border-stone-100"><h3 className="font-serif font-bold text-berry-rich text-xl">{t.consultations}</h3></div><div className="flex-1 overflow-y-auto p-3">{activeConversations.map(convo => (<div key={convo.id} onClick={() => { setActiveChatId(convo.id); setCurrentChatParticipant({id: convo.id.replace(user.id, '').replace('_', ''), name: convo.participantName}); }} className={`p-4 mb-2 rounded-2xl cursor-pointer transition-all ${activeChatId === convo.id ? 'bg-white shadow-md border border-stone-100' : 'hover:bg-white/50 hover:shadow-sm'}`}><div className="flex justify-between mb-1"><span className={`font-bold text-sm ${activeChatId === convo.id ? 'text-berry-rich' : 'text-stone-700'}`}>{convo.participantName}</span></div><p className="text-xs text-stone-500 truncate font-medium">Klik untuk chat</p></div>))}{activeConversations.length === 0 && (<p className="text-center p-4 text-stone-400 text-sm">Belum ada percakapan.</p>)}</div></div><div className="md:col-span-2 flex flex-col bg-white h-full overflow-hidden">{activeChatId ? (<><div className="p-6 border-b border-stone-100 bg-white flex items-center justify-between"><h3 className="font-serif font-bold text-berry-rich text-xl">Chat</h3></div><div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FDFBF7]">{messages.map((msg) => (<div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[75%] p-4 rounded-2xl shadow-sm relative group transition-transform hover:scale-[1.01] ${msg.isMe ? 'bg-berry-rich text-white rounded-tr-none shadow-berry-rich/20' : 'bg-white text-stone-800 rounded-tl-none border border-stone-100'}`}>{msg.attachmentUrl && (<div className="mb-3 rounded-xl overflow-hidden border border-white/20"><img src={msg.attachmentUrl} alt="Attached" className="w-full h-auto max-h-48 object-cover" /></div>)}<p className="text-sm whitespace-pre-wrap leading-relaxed font-medium">{msg.text}</p></div></div>))}</div><div className="p-6 border-t border-stone-100 bg-white"><div className="flex gap-3"><label className={`p-4 bg-stone-50 border border-stone-200 rounded-2xl cursor-pointer hover:bg-stone-100 transition-colors flex items-center justify-center ${isUploadingChat ? 'opacity-50 pointer-events-none' : ''}`}>{isUploadingChat ? <Loader2 className="animate-spin text-stone-500" size={20} /> : <Paperclip size={20} className="text-stone-500" />}<input type="file" className="hidden" accept="image/*" onChange={handleChatImageUpload} disabled={isUploadingChat} /></label><input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={t.typeMessage} className="flex-1 p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-berry-rich/20 text-sm font-medium transition-all" /><button onClick={handleSendMessage} className="p-4 bg-berry-rich text-white rounded-2xl hover:bg-berry-dark transition-colors shadow-lg hover:shadow-berry-rich/30"><Send size={20} /></button></div></div></>) : (<div className="flex-1 flex items-center justify-center flex-col text-stone-300"><MessageSquare size={32} className="opacity-50 mb-4" /><p className="font-serif text-lg">{t.selectConversation}</p></div>)}</div></div>)}
          {activeTab === 'profile' && (<div className="space-y-8 animate-fade-in-up"><h2 className="text-4xl font-serif font-bold text-berry-rich mb-8">{t.profile}</h2><div className="grid md:grid-cols-2 gap-8"><div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100"><h3 className="font-serif font-bold text-xl mb-6 text-berry-rich">{t.personalInfo}</h3><div className="space-y-4"><div className="flex items-center gap-4 mb-6"><div className="w-20 h-20 rounded-full bg-stone-100 overflow-hidden relative group">{profileData.photoUrl ? <img src={profileData.photoUrl} alt="Profile" className="w-full h-full object-cover" /> : <UserIcon className="w-full h-full p-4 text-stone-300" />}<label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Camera className="text-white" size={20} /><input type="file" className="hidden" onChange={handlePhotoUpload} /></label></div><div><h4 className="font-bold text-lg">{profileData.name}</h4><p className="text-stone-500 text-sm">{profileData.email}</p></div></div><div><label className="block text-xs font-bold text-stone-500 uppercase mb-2">{t.fullName}</label><input type="text" className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50" value={profileData.name} onChange={(e) => setProfileData({...profileData, name: e.target.value})} /></div><div><label className="block text-xs font-bold text-stone-500 uppercase mb-2">{t.phone}</label><input type="tel" className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50" value={profileData.phone} onChange={(e) => setProfileData({...profileData, phone: e.target.value})} /></div><div><label className="block text-xs font-bold text-stone-500 uppercase mb-2">{t.address}</label><textarea className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50 h-24" value={profileData.address} onChange={(e) => setProfileData({...profileData, address: e.target.value})} /></div><button onClick={handleSaveProfile} className="w-full py-3 bg-berry-rich text-white rounded-xl font-bold">{t.saveProfile}</button></div></div><div className="space-y-8"><div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100"><h3 className="font-serif font-bold text-xl mb-6 text-berry-rich">{t.bodyMeasurements} (cm)</h3><div className="grid grid-cols-2 gap-4">{Object.keys(INITIAL_MEASUREMENTS).map((key) => (<div key={key}><label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">{MEASUREMENT_LABELS[key as keyof BodyMeasurements]}</label><input type="number" className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50" value={measurements[key as keyof BodyMeasurements]} onChange={(e) => setMeasurements({...measurements, [key]: Number(e.target.value)})} /></div>))}</div></div><div className="bg-white p-8 rounded-[2rem] shadow-sm border border-stone-100"><h3 className="font-serif font-bold text-xl mb-4 text-berry-rich">Foto Body Fit</h3><p className="text-stone-500 text-sm mb-4">Unggah foto full-body agar penjahit lebih memahami postur Anda.</p>{profileData.bodyFitPhotoUrl ? (<div className="relative rounded-xl overflow-hidden mb-4 border border-stone-200"><img src={profileData.bodyFitPhotoUrl} alt="Body Fit" className="w-full h-auto" /><button onClick={() => setProfileData({...profileData, bodyFitPhotoUrl: ''})} className="absolute top-2 right-2 bg-white p-2 rounded-full text-red-500 shadow-sm"><Trash2 size={16} /></button></div>) : (<label className={`w-full h-32 border-2 border-dashed border-stone-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-stone-50 transition-colors ${isUploadingBodyFit ? 'opacity-50 pointer-events-none' : ''}`}>{isUploadingBodyFit ? <Loader2 className="animate-spin text-berry-rich" /> : <UploadCloud className="text-stone-400 mb-2" />}<span className="text-xs font-bold text-stone-500">Unggah Foto</span><input type="file" className="hidden" onChange={handleBodyFitUpload} accept="image/*" /></label>)}</div></div></div></div>)}
          {activeTab === 'transactions' && (<div className="space-y-8 animate-fade-in-up"><h2 className="text-4xl font-serif font-bold text-berry-rich mb-8">{t.transactions}</h2><div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100 flex flex-wrap items-end gap-4 mb-6"><div className="flex items-center gap-2 text-berry-rich font-bold border-r border-stone-200 pr-4 mr-2"><Filter size={20} /> Filter</div><div><label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Status</label><select className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm" value={transFilters.status} onChange={(e) => setTransFilters({...transFilters, status: e.target.value})}><option value="All">Semua</option><option value="Success">Success</option><option value="Pending">Pending</option></select></div><div><label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Mulai</label><input type="date" className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm" value={transFilters.startDate} onChange={(e) => setTransFilters({...transFilters, startDate: e.target.value})} /></div><div><label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">Akhir</label><input type="date" className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm" value={transFilters.endDate} onChange={(e) => setTransFilters({...transFilters, endDate: e.target.value})} /></div></div><div className="bg-white rounded-[2rem] shadow-sm border border-stone-100 overflow-hidden"><table className="w-full text-left"><thead className="bg-stone-50/80 border-b border-stone-200"><tr><th className="p-6 font-bold text-stone-500 uppercase text-xs">Tanggal</th><th className="p-6 font-bold text-stone-500 uppercase text-xs">Deskripsi</th><th className="p-6 font-bold text-stone-500 uppercase text-xs">Status</th><th className="p-6 font-bold text-stone-500 uppercase text-xs text-right">Jumlah</th></tr></thead><tbody>{filteredTransactions.map(tr => (<tr key={tr.id} className="border-b border-stone-100 hover:bg-stone-50"><td className="p-6 text-stone-500 text-sm">{new Date(tr.date).toLocaleDateString()}</td><td className="p-6 font-bold text-stone-700">{tr.description}</td><td className="p-6"><span className={`px-3 py-1 rounded-full text-xs font-bold ${tr.status === 'Success' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{tr.status}</span></td><td className="p-6 text-right font-bold text-berry-rich">Rp {tr.amount.toLocaleString()}</td></tr>))}</tbody></table></div></div>)}
          {activeTab === 'settings' && (<div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up"><h2 className="text-4xl font-serif font-bold text-berry-rich mb-8">{t.accountSettings}</h2><div className="bg-white p-8 rounded-[2rem] border border-stone-100 shadow-sm"><h3 className="text-xl font-serif font-bold text-berry-rich mb-6 flex items-center gap-2"><Lock size={20} /> {t.security}</h3><form onSubmit={handleUpdateSettings} className="space-y-6"><div className="p-4 bg-stone-50 rounded-xl border border-stone-200"><h4 className="font-bold text-stone-700 mb-4">{t.changePassword}</h4><div className="space-y-4"><div><label className="block text-xs font-bold text-stone-500 uppercase mb-2">{t.newPassword}</label><input type="password" className="w-full p-4 border border-stone-200 rounded-xl bg-white" value={settingsForm.newPassword} onChange={(e) => setSettingsForm({...settingsForm, newPassword: e.target.value})} /></div><div><label className="block text-xs font-bold text-stone-500 uppercase mb-2">{t.confirmNewPassword}</label><input type="password" className="w-full p-4 border border-stone-200 rounded-xl bg-white" value={settingsForm.confirmPassword} onChange={(e) => setSettingsForm({...settingsForm, confirmPassword: e.target.value})} /></div></div></div><div className="p-4 bg-stone-50 rounded-xl border border-stone-200"><h4 className="font-bold text-stone-700 mb-4">Update Email</h4><div><label className="block text-xs font-bold text-stone-500 uppercase mb-2">{t.email}</label><input type="email" className="w-full p-4 border border-stone-200 rounded-xl bg-white" value={settingsForm.newEmail} onChange={(e) => setSettingsForm({...settingsForm, newEmail: e.target.value})} /></div></div><div className="flex justify-end pt-4"><button type="submit" disabled={settingsLoading} className="px-8 py-4 bg-berry-rich text-white rounded-xl font-bold hover:shadow-xl transition-all flex items-center gap-2">{settingsLoading ? 'Saving...' : <><Save size={18} /> {t.saveSettings}</>}</button></div></form></div></div>)}
        </div>
      </main>
    </div>
  );
};