import { initializeApp } from "firebase/app";
import { getAuth, updatePassword, updateEmail, User as FirebaseUser } from "firebase/auth";
import { 
  getFirestore, doc, setDoc, getDoc, collection, 
  query, where, onSnapshot, addDoc, updateDoc, 
  orderBy, getDocs, runTransaction
} from "firebase/firestore";
import { User, Order, ChatMessage, CatalogItem, UserRole, ChatConversation, Transaction, Review } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyDMdaa3ctUZBHQPBxbU7fQ-yPhWqtlqOkc",
  authDomain: "berryly-belle.firebaseapp.com",
  projectId: "berryly-belle",
  storageBucket: "berryly-belle.firebasestorage.app",
  messagingSenderId: "934116443498",
  appId: "1:934116443498:web:3ad67bc94f15d8d8575113",
  measurementId: "G-JR8NCXYZC8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- User Profile Functions ---

export const saveUserProfile = async (user: User) => {
  try {
    const userData = Object.fromEntries(
      Object.entries(user).filter(([_, v]) => v !== undefined)
    );
    // Initialize empty catalog for merchants if not present
    if(user.role === UserRole.MERCHANT && !user.catalog) {
        userData.catalog = [];
    }
    await setDoc(doc(db, "users", user.id), userData, { merge: true });
  } catch (error) {
    console.error("Error saving user profile:", error);
    throw error;
  }
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return { id: docSnap.id, ...data } as User;
    }
    return null;
  } catch (error: any) {
    console.error("Error fetching user profile:", error);
    // Rethrow permission errors so UI can handle them appropriately
    if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
        throw error;
    }
    return null;
  }
};

export const getAllMerchants = async (): Promise<User[]> => {
  try {
    const q = query(collection(db, "users"), where("role", "==", "MERCHANT"));
    const querySnapshot = await getDocs(q);
    
    const merchants = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data 
      } as User;
    });

    console.log(`Found ${merchants.length} merchants in database.`);
    return merchants;
  } catch (error) {
    console.error("Error fetching merchants:", error);
    return [];
  }
};

// --- Auth Management Functions ---

export const updateUserPassword = async (newPassword: string) => {
  const user = auth.currentUser;
  if (user) {
    await updatePassword(user, newPassword);
  } else {
    throw new Error("No authenticated user found");
  }
};

export const updateUserEmail = async (newEmail: string) => {
  const user = auth.currentUser;
  if (user) {
    await updateEmail(user, newEmail);
    await updateDoc(doc(db, "users", user.uid), { email: newEmail });
  } else {
    throw new Error("No authenticated user found");
  }
};

// --- Order Functions ---

export const subscribeToOrders = (
  userId: string, 
  role: UserRole, 
  callback: (orders: Order[]) => void
) => {
  const ordersRef = collection(db, "orders");
  
  let q;
  if (role === UserRole.CUSTOMER) {
      q = query(ordersRef, where("customerId", "==", userId));
  } else {
      q = query(ordersRef, where("merchantId", "==", userId)); 
  }

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    // Sort client-side
    orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    callback(orders);
  });
};

export const createOrder = async (orderData: Partial<Order>) => {
  try {
    const docRef = await addDoc(collection(db, "orders"), orderData);
    return docRef.id;
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
};

export const updateOrderStatus = async (orderId: string, updates: Partial<Order>) => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, updates);
  } catch (error) {
    console.error("Error updating order:", error);
    throw error;
  }
};

// --- Transaction Functions (NEW) ---

export const createTransaction = async (transactionData: Partial<Transaction>) => {
    try {
        await addDoc(collection(db, "transactions"), {
            ...transactionData,
            date: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error creating transaction:", error);
        throw error;
    }
};

export const subscribeToTransactions = (merchantId: string, callback: (transactions: Transaction[]) => void) => {
    const transRef = collection(db, "transactions");
    // Only query by merchantId, sort client side to avoid index issues
    const q = query(transRef, where("merchantId", "==", merchantId));
    
    return onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        // Client side sort desc
        transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        callback(transactions);
    });
};

export const subscribeToCustomerTransactions = (customerId: string, callback: (transactions: Transaction[]) => void) => {
    const transRef = collection(db, "transactions");
    const q = query(transRef, where("customerId", "==", customerId));
    
    return onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        callback(transactions);
    });
};

// --- Catalog Functions (Merchant) ---

export const updateMerchantCatalog = async (userId: string, catalog: CatalogItem[]) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { catalog });
  } catch (error) {
    console.error("Error updating catalog:", error);
    throw error;
  }
};

// --- Review Functions (NEW) ---

export const addReview = async (merchantId: string, orderId: string, reviewData: any) => {
    try {
        // Run as a single atomic transaction to ensure data consistency
        await runTransaction(db, async (transaction) => {
            // 1. Get Merchant Data first (Reads must come before writes)
            const merchantRef = doc(db, "users", merchantId);
            const merchantDoc = await transaction.get(merchantRef);
            
            if (!merchantDoc.exists()) {
                throw new Error("Merchant data not found");
            }

            const data = merchantDoc.data();
            const currentRating = data.rating || 0;
            const currentCount = data.reviewCount || 0;

            // Calculate new rating
            const newCount = currentCount + 1;
            const newRating = ((currentRating * currentCount) + reviewData.rating) / newCount;

            // 2. Write Review Doc (Generate ID first)
            const newReviewRef = doc(collection(db, "reviews"));
            transaction.set(newReviewRef, {
                merchantId,
                orderId,
                ...reviewData,
                date: new Date().toISOString()
            });

            // 3. Update Order Status
            const orderRef = doc(db, "orders", orderId);
            transaction.update(orderRef, { isReviewed: true });

            // 4. Update Merchant Rating
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

// --- Chat Functions ---

// 1. Subscribe to List of Conversations (Chats List)
export const subscribeToChatList = (userId: string, callback: (chats: ChatConversation[]) => void) => {
  const chatsRef = collection(db, "chats");
  
  // SIMPLE QUERY: No orderBy here to avoid index requirements
  const q = query(chatsRef, where("participants", "array-contains", userId));

  return onSnapshot(q, async (snapshot) => {
    // Process chats
    const chatsPromises = snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      const otherUserId = data.participants.find((id: string) => id !== userId);
      
      let otherName = "Chat Partner";
      let otherAvatar = "";

      if (otherUserId) {
          // Try to get name from participantNames first (fast)
          if (data.participantNames && data.participantNames[otherUserId]) {
              otherName = data.participantNames[otherUserId];
          }
          
          // Fetch user profile to get latest avatar (slow but necessary for avatar)
          try {
              const userDoc = await getDoc(doc(db, "users", otherUserId));
              if (userDoc.exists()) {
                  const userData = userDoc.data();
                  otherAvatar = userData.photoUrl || "";
                  // Also update name if not in chat doc
                  if (!data.participantNames) {
                      otherName = userData.brandName || userData.name;
                  }
              }
          } catch (e) {
              console.warn("Failed to fetch chat partner details", e);
          }
      }

      // Calculate pseudo-unread status: If the last sender was NOT me, it's 'unread'
      const isLastMessageFromOther = data.lastSenderId && data.lastSenderId !== userId;

      return {
        id: docSnap.id,
        participantName: otherName,
        lastMessage: data.lastMessage || "",
        timestamp: data.updatedAt?.toDate() || new Date(),
        unreadCount: isLastMessageFromOther ? 1 : 0,
        avatarUrl: otherAvatar,
        participantId: otherUserId
      } as ChatConversation;
    });

    const chats = await Promise.all(chatsPromises);

    // Client-side sorting (Newest first)
    chats.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    callback(chats);
  });
};

// 2. Subscribe to Messages inside a specific Chat
export const subscribeToMessages = (chatId: string, callback: (messages: ChatMessage[]) => void) => {
  if (!chatId) return () => {};
  
  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));
  
  return onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            timestamp: data.timestamp?.toDate() || new Date()
        } as ChatMessage;
    });
    callback(msgs);
  });
};

// 3. Send Message
export const sendMessage = async (
  chatId: string, 
  message: Partial<ChatMessage>, 
  participants?: string[],
  participantNames?: Record<string, string>
) => {
  try {
    const messagesRef = collection(db, "chats", chatId, "messages");
    await addDoc(messagesRef, {
        ...message,
        timestamp: new Date()
    });
    
    const chatRef = doc(db, "chats", chatId);
    const updateData: any = {
        lastMessage: message.text || (message.attachmentUrl ? "Mengirim gambar" : ""),
        updatedAt: new Date(),
        lastSenderId: message.senderId // Save who sent it to calculate unread status
    };

    if (participants && participants.length > 0) {
        updateData.participants = participants;
    }
    if (participantNames) {
        updateData.participantNames = participantNames;
    }

    await setDoc(chatRef, updateData, { merge: true });
    
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

export const getChatId = (user1Id: string, user2Id: string) => {
    return user1Id < user2Id ? `${user1Id}_${user2Id}` : `${user2Id}_${user1Id}`;
};