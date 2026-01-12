import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  updatePassword, 
  updateEmail, 
  sendPasswordResetEmail, 
  sendEmailVerification 
} from "firebase/auth";
import { 
  getFirestore, doc, setDoc, getDoc, collection, 
  query, where, onSnapshot, addDoc, updateDoc, 
  orderBy, getDocs, runTransaction, Timestamp
} from "firebase/firestore";
import { User, Order, ChatMessage, CatalogItem, UserRole, ChatConversation, Transaction, Review } from "../types";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDMdaa3ctUZBHQPBxbU7fQ-yPhWqtlqOkc",
  authDomain: "berryly-belle.firebaseapp.com",
  projectId: "berryly-belle",
  storageBucket: "berryly-belle.firebasestorage.app",
  messagingSenderId: "934116443498",
  appId: "1:934116443498:web:3ad67bc94f15d8d8575113",
  measurementId: "G-JR8NCXYZC8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- User & Auth Services ---

export const getUserProfile = async (uid: string): Promise<User | null> => {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as User;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

export const saveUserProfile = async (user: User) => {
  try {
    const userRef = doc(db, "users", user.id);
    await setDoc(userRef, user, { merge: true });
  } catch (error) {
    console.error("Error saving user profile:", error);
    throw error;
  }
};

export const updateUserPassword = async (newPassword: string) => {
  if (auth.currentUser) {
    await updatePassword(auth.currentUser, newPassword);
  } else {
    throw new Error("No user logged in");
  }
};

export const updateUserEmail = async (newEmail: string) => {
  if (auth.currentUser) {
    await updateEmail(auth.currentUser, newEmail);
  } else {
    throw new Error("No user logged in");
  }
};

// --- Order Services ---

export const subscribeToOrders = (userId: string, role: UserRole, callback: (orders: Order[]) => void) => {
  const ordersRef = collection(db, "orders");
  let q;
  
  if (role === UserRole.MERCHANT) {
    q = query(ordersRef, where("merchantId", "==", userId));
  } else {
    q = query(ordersRef, where("customerId", "==", userId));
  }

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));
    // Sort orders by date descending (newest first)
    orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    callback(orders);
  });
};

export const createOrder = async (orderData: Partial<Order>) => {
  const ordersRef = collection(db, "orders");
  const newOrder = {
    ...orderData,
    date: new Date().toISOString()
  };
  await addDoc(ordersRef, newOrder);
};

export const updateOrderStatus = async (orderId: string, updates: Partial<Order>) => {
  const orderRef = doc(db, "orders", orderId);
  await updateDoc(orderRef, updates);
};

// --- Merchant Services ---

export const getAllMerchants = async (): Promise<User[]> => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("role", "==", UserRole.MERCHANT));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
  } catch (error) {
    console.error("Error fetching merchants:", error);
    return [];
  }
};

export const updateMerchantCatalog = async (userId: string, catalog: CatalogItem[]) => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { catalog });
};

// --- Chat Services ---

export const getChatId = (uid1: string, uid2: string) => {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
};

export const subscribeToChatList = (userId: string, callback: (chats: ChatConversation[]) => void) => {
  const conversationsRef = collection(db, "conversations");
  const q = query(conversationsRef, where("participants", "array-contains", userId));
  
  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map(d => {
      const data = d.data();
      // Find the name of the other participant
      const otherId = data.participants.find((p: string) => p !== userId);
      const otherName = data.participantNames?.[otherId] || "User";
      
      return {
        id: d.id,
        participantName: otherName,
        lastMessage: data.lastMessage,
        timestamp: data.lastMessageTimestamp?.toDate() || new Date(),
        unreadCount: 0 
      } as ChatConversation;
    });
    // Sort by latest message
    chats.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    callback(chats);
  });
};

export const subscribeToMessages = (chatId: string, callback: (messages: ChatMessage[]) => void) => {
  const messagesRef = collection(db, "conversations", chatId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(d => ({ 
      id: d.id, 
      ...d.data(),
      timestamp: d.data().timestamp?.toDate()
    } as ChatMessage));
    callback(messages);
  });
};

export const sendMessage = async (
    chatId: string, 
    message: Partial<ChatMessage>, 
    participants?: string[],
    participantNames?: Record<string, string>
) => {
  const conversationRef = doc(db, "conversations", chatId);
  const messagesRef = collection(conversationRef, "messages");
  
  const timestamp = Timestamp.now();
  
  // If participants are provided, create/update conversation metadata
  if (participants) {
     await setDoc(conversationRef, {
         participants,
         participantNames,
         lastMessage: message.text || (message.attachmentUrl ? "Image" : "New Message"),
         lastMessageTimestamp: timestamp
     }, { merge: true });
  } else {
    // Just update last message
    await updateDoc(conversationRef, {
      lastMessage: message.text || (message.attachmentUrl ? "Image" : "New Message"),
      lastMessageTimestamp: timestamp
    });
  }
  
  // Add message to subcollection
  await addDoc(messagesRef, {
      ...message,
      timestamp
  });
};

// --- Transaction Services ---

export const createTransaction = async (transaction: Partial<Transaction>) => {
  const transRef = collection(db, "transactions");
  await addDoc(transRef, transaction);
};

export const subscribeToCustomerTransactions = (userId: string, callback: (trans: Transaction[]) => void) => {
  const transRef = collection(db, "transactions");
  const q = query(transRef, where("customerId", "==", userId));
  return onSnapshot(q, (snapshot) => {
      const trans = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      trans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(trans);
  });
};

export const subscribeToTransactions = (userId: string, callback: (trans: Transaction[]) => void) => {
    // For merchant dashboard, filter by merchantId
    const transRef = collection(db, "transactions");
    const q = query(transRef, where("merchantId", "==", userId));
    return onSnapshot(q, (snapshot) => {
        const trans = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
        trans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        callback(trans);
    });
};

// --- Review Services ---

export const addReview = async (merchantId: string, orderId: string, reviewData: any) => {
    try {
        // Sanitize reviewData to remove undefined values which cause Firestore errors
        const sanitizedReviewData = Object.fromEntries(
            Object.entries(reviewData).filter(([_, v]) => v !== undefined)
        );

        // Run as a single atomic transaction to ensure data consistency
        await runTransaction(db, async (transaction) => {
            // 1. Get Merchant Data first (Reads must come before writes)
            const merchantRef = doc(db, "users", merchantId);
            const merchantDoc = await transaction.get(merchantRef);
            
            if (!merchantDoc.exists()) {
                throw new Error("Merchant data not found");
            }

            const data = merchantDoc.data();
            const currentRating = Number(data.rating || 0); // Ensure Number
            const currentCount = Number(data.reviewCount || 0); // Ensure Number
            const incomingRating = Number(reviewData.rating); // Ensure Number

            // Calculate new rating
            const newCount = currentCount + 1;
            const newRating = ((currentRating * currentCount) + incomingRating) / newCount;

            // 2. Write Review Doc (Generate ID first)
            const newReviewRef = doc(collection(db, "reviews"));
            transaction.set(newReviewRef, {
                merchantId,
                orderId,
                ...sanitizedReviewData,
                rating: incomingRating, // Ensure number stored
                date: new Date().toISOString()
            });

            // 3. Update Order Status
            const orderRef = doc(db, "orders", orderId);
            transaction.update(orderRef, { isReviewed: true });

            // 4. Update Merchant Rating
            // NOTE: Firestore Rules must allow updating 'rating' and 'reviewCount' by auth user
            transaction.update(merchantRef, {
                rating: newRating,
                reviewCount: newCount
            });
        });
    } catch (error) {
        console.error("Error adding review:", error);
        throw error;
    }
};

export const subscribeToMerchantReviews = (merchantId: string, callback: (reviews: Review[]) => void) => {
    const reviewsRef = collection(db, "reviews");
    const q = query(reviewsRef, where("merchantId", "==", merchantId)); // Client sort to avoid index issues

    return onSnapshot(q, (snapshot) => {
        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
        // Sort descending by date in client
        reviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        callback(reviews);
    });
};
