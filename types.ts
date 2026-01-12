export enum UserRole {
  GUEST = 'GUEST',
  CUSTOMER = 'CUSTOMER',
  MERCHANT = 'MERCHANT',
  ADMIN = 'ADMIN'
}

export interface CatalogItem {
  id: string;
  title: string;
  imageUrl: string;
  description?: string;
  price?: number; // Added price for catalog items
}

export interface BodyMeasurements {
  height: number;
  weight: number;
  bust: number;
  waist: number;
  hips: number;
  shoulder: number;
  sleeveLength: number;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface EWalletDetails {
  walletName: string; // e.g. Gopay, OVO, Dana
  phoneNumber: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  brandName?: string; // For merchants
  catalog?: CatalogItem[]; // For merchants
  // Profile fields
  phone?: string;
  address?: string;
  bio?: string;
  photoUrl?: string;
  bodyFitPhotoUrl?: string; // NEW: Field for full body photo
  measurements?: BodyMeasurements;
  bankAccount?: string; // Legacy field, keeping for backward compat
  
  // NEW PAYMENT FIELDS
  bankDetails?: BankDetails;
  ewalletDetails?: EWalletDetails;

  // Rating Fields (For Merchants)
  rating?: number;
  reviewCount?: number;
}

export enum OrderStatus {
  CONSULTATION = 'Consultation',
  DESIGN = 'Design',
  PRODUCTION = 'Production',
  FINISHING = 'Finishing',
  SHIPPED = 'Shipped',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
  COMPLAINT = 'Complaint' // NEW STATUS
}

export interface Order {
  id: string;
  merchantName: string;
  designName: string;
  status: OrderStatus;
  price: number;
  date: string;
  imageUrl?: string;
  // Custom tailoring details
  measurements?: BodyMeasurements;
  customerNotes?: string;
  paymentMethod?: string;
  shippingMethod?: string;
  shippingAddress?: string;
  trackingNumber?: string; // Added for shipping workflow
  customerName?: string;
  merchantId?: string; // Added for DB queries
  customerId?: string; // Added for DB queries
  paymentProofUrl?: string; // NEW: URL for payment receipt image
  cancellationReason?: string; // NEW: Reason for cancellation
  
  // Complaint Details
  complaint?: {
    reason: string;
    imageUrl?: string;
    date: string;
    status: 'Pending' | 'Resolved';
  };
}

export interface DesignRequest {
  id: string;
  customerName: string;
  description: string;
  budget: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  attachmentUrl?: string; // Added for sending catalog images
  timestamp: Date;
  isMe: boolean;
}

export interface ChatConversation {
  id: string;
  participantName: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  avatarUrl?: string;
}

export interface Transaction {
  id: string;
  merchantId?: string;
  customerId?: string;
  date: string;
  description: string;
  amount: number;
  status: 'Success' | 'Pending' | 'Failed';
  type: 'Payment' | 'Payout';
}

export interface Review {
  id: string;
  reviewerName: string;
  rating: number; // 1-5
  comment: string;
  date: string;
  imageUrl?: string;
}

export interface MerchantProfile {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  specialty: string;
  imageUrl: string;
  catalog: CatalogItem[];
}