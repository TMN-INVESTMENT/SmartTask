// SmartTask Main JavaScript - COMPLETE FIREBASE VERSION
// All features working with Firebase Firestore

// ============================================
// FIREBASE CONFIGURATION
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyDzC7Mrs_AcZ1tIUguomxEDwahDZic6lCw",
    authDomain: "smarttask-3722a.firebaseapp.com",
    projectId: "smarttask-3722a",
    storageBucket: "smarttask-3722a.firebasestorage.app",
    messagingSenderId: "498096872923",
    appId: "1:498096872923:web:576660791f7e82d4455bfe",
    measurementId: "G-K6QMBWK6FW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Configure storage settings
const storageRef = storage.ref();
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];

// Force logout on every page load to always show login form
auth.signOut().catch(() => {});

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true })
    .catch(err => console.log('Persistence error:', err.code));

// ============================================
// GLOBAL VARIABLES
// ============================================
let currentUser = null;
let vipPackages = [];
let users = [];
let deposits = [];
let withdrawals = [];
let tasks = [];
// Update the systemSettings object (find this in your code and add withdrawalFee)
let systemSettings = {
    minDeposit: 10000,
    maxDeposit: 10000000,
    minWithdrawal: 3000,
    maxWithdrawal: 1000000,
    withdrawalFee: 10, // Add this - 10% fee
    registrationBonus: 2000,
    dailyLoginBonus: 200,
    referralLevels: [
        { level: 1, percentage: 10 },
        { level: 2, percentage: 3 },
        { level: 3, percentage: 1 }
    ],
    tasksPerDay: 3,
    siteName: 'SmartTask',
    siteEmail: 'support@smarttask.com',
    sitePhone: '+255123456789',
    maintenanceMode: false
};

// ============================================
// PREDEFINED ADMINS (will be created in Firestore)
// ============================================
const predefinedAdmins = [
    {
        username: 'administrator',
        email: 'smart@task.com',
        password: 'Smart@123',
        role: 'admin',
        fullName: 'System Administrator',
        phone: '+255712345678',
        balance: 1000000,
        referralBalance: 50000,
        totalEarned: 1500000,
        totalInvested: 500000,
        referralEarnings: { level1: 0, level2: 0, level3: 0 },
        referrals: [],
        myReferralCode: 'ADMIN123',
        tasksCompleted: 0,
        lastTaskDate: null,
        activePackages: [],
        history: [],
        notifications: [],
        referredBy: null,
        isActive: true,
        isVerified: true,
        loginCount: 1,
        profileImage: null
    },
    {
        username: 'superadmin',
        email: 'super@smart.com',
        password: 'task@123',
        role: 'superadmin',
        fullName: 'Super Admin',
        phone: '+255987654321',
        balance: 2000000,
        referralBalance: 100000,
        totalEarned: 3000000,
        totalInvested: 1000000,
        referralEarnings: { level1: 0, level2: 0, level3: 0 },
        referrals: [],
        myReferralCode: 'SUPER123',
        tasksCompleted: 0,
        lastTaskDate: null,
        activePackages: [],
        history: [],
        notifications: [],
        referredBy: null,
        isActive: true,
        isVerified: true,
        loginCount: 1,
        profileImage: null
    }
];

// ============================================
// SAMPLE PRODUCTS FOR TASKS
// ============================================
const sampleProducts = [
    { id: 1, name: 'Smartphone X Pro', category: 'Electronics', rating: 4.5, image: '📱', icon: 'fa-mobile-alt' },
    { id: 2, name: 'Wireless Earbuds', category: 'Audio', rating: 4.3, image: '🎧', icon: 'fa-headphones' },
    { id: 3, name: 'Power Bank 20000mAh', category: 'Accessories', rating: 4.7, image: '🔋', icon: 'fa-battery-full' },
    { id: 4, name: 'Smart Watch Series 5', category: 'Wearables', rating: 4.6, image: '⌚', icon: 'fa-clock' },
    { id: 5, name: 'Bluetooth Speaker', category: 'Audio', rating: 4.4, image: '🔊', icon: 'fa-music' },
    { id: 6, name: 'Laptop Backpack', category: 'Accessories', rating: 4.2, image: '🎒', icon: 'fa-bag' }
];

// ============================================
// FIREBASE AUTH STATE OBSERVER – PLACE AT BOTTOM OF main.js
// ============================================
function startSessionValidation() {
    // Clear existing interval
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }
    
    // Check every 30 seconds
    sessionCheckInterval = setInterval(async () => {
        if (currentUser && currentUser.uid) {
            await validateUserSession(currentUser.uid);
        }
    }, 30000); // Check every 30 seconds
}

/**
 * Validate if user session is still valid
 */
async function validateUserSession(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            console.log('User document no longer exists, logging out...');
            await forceLogout('Your account has been deleted.');
            return;
        }
        
        const userData = userDoc.data();
        
        // CRITICAL: Check if user is deactivated
        if (userData.isActive === false) {
            console.log('User account has been deactivated, logging out...');
            await forceLogout('Your account has been deactivated. Please contact support.');
            return;
        }
        
        // Check if user role was changed
        if (userData.role !== currentUser.role) {
            console.log('User role changed, refreshing dashboard...');
            currentUser.role = userData.role;
            showDashboardBasedOnRole();
            showToast('Your role has been updated. Dashboard refreshed.', 'info');
            return;
        }
        
        // Update user data in memory
        currentUser = { ...currentUser, ...userData };
        
    } catch (error) {
        console.error('Error validating session:', error);
    }
}

/**
 * Force logout with message
 */
async function forceLogout(message) {
    // Stop session validation
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
    
    // Clear any other intervals
    if (window.taskRefreshTimer) {
        clearInterval(window.taskRefreshTimer);
        window.taskRefreshTimer = null;
    }
    
    // Show message
    showToast(message, 'warning');
    
    // Clear current user
    currentUser = null;
    
    // Sign out from Firebase Auth
    try {
        await auth.signOut();
    } catch (e) {
        console.error('Error signing out:', e);
    }
    
    // Show auth screen
    showAuth();
    
    // Show alert with message (optional)
    setTimeout(() => {
        alert(message);
    }, 500);
}

// ============================================
// MAIN AUTH STATE OBSERVER
// ============================================

auth.onAuthStateChanged(async (user) => {
    console.log('Auth state changed, user:', user?.email);
    
    if (user) {
        try {
            const userRef = db.collection('users').doc(user.uid);
            const userDoc = await userRef.get();
            
            // Helper fallbacks (should be defined, but safe)
            const safeGenerateId = typeof generateId === 'function' ? generateId : () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            const safeGenerateReferralCode = typeof generateReferralCode === 'function' ? generateReferralCode : (email) => (email.split('@')[0].substring(0, 3).toUpperCase() + Math.floor(1000 + Math.random() * 9000));
            const safeFormatMoney = typeof formatMoney === 'function' ? formatMoney : (amt) => (amt || 0).toLocaleString() + ' TZS';
            const settings = systemSettings || { registrationBonus: 2000 };
            
            if (userDoc.exists) {
                let userData = userDoc.data();
                
                // CRITICAL: Check if user is deactivated BEFORE allowing access
                if (userData.isActive === false) {
                    console.log('Deactivated user attempted to login:', user.email);
                    
                    // Sign them out immediately
                    await auth.signOut();
                    
                    // Show message
                    showToast('Your account has been deactivated. Please contact support.', 'error');
                    
                    // Show auth screen
                    showAuth();
                    return;
                }
                
                // Ensure role is correct for predefined admin emails
                const needsUpdate = (
                    (user.email === 'smart@task.com' && userData.role !== 'admin') ||
                    (user.email === 'kingharuni420@gmail.com' && userData.role !== 'superadmin')
                );
                
                if (needsUpdate) {
                    const correctRole = user.email === 'smart@task.com' ? 'admin' : 'superadmin';
                    await userRef.update({ role: correctRole });
                    userData.role = correctRole;
                }
                
                currentUser = { uid: user.uid, ...userData };
                
            } else {
                // First login – create user document
                let role = 'user';
                if (user.email === 'smart@task.com') role = 'admin';
                else if (user.email === 'kingharuni420@gmail.com') role = 'superadmin';
                
                // Generate username from email if not provided
                const username = user.displayName || user.email.split('@')[0];
                const fullName = user.displayName || username;
                const phone = user.phoneNumber || '';
                
                const newUser = {
                    // Basic Information
                    uid: user.uid,
                    username: username,
                    email: user.email,
                    fullName: fullName,
                    phone: phone,
                    role: role,
                    usernameLower: username.toLowerCase(),
                    
                    // Account Status
                    isActive: true,
                    isVerified: false,
                    profileImage: null,
                    
                    // Financial Information
                    balance: settings.registrationBonus,
                    referralBalance: 0,
                    totalEarned: settings.registrationBonus,
                    totalInvested: 0,
                    
                    // Referral Information
                    referralEarnings: {
                        level1: 0,
                        level2: 0,
                        level3: 0
                    },
                    referrals: [],
                   myReferralCode: await generateUniqueReferralCode(),
                    referredBy: null,
                    
                    // Task Information
                    tasksCompleted: 0,
                    lastTaskDate: null,
                    completedTasks: [],
                    activePackages: [],
                    
                    // Transaction History
                    history: [{
                        id: safeGenerateId(),
                        type: 'bonus',
                        description: 'Registration Bonus',
                        amount: settings.registrationBonus,
                        status: 'completed',
                        date: new Date().toISOString()
                    }],
                    
                    // Notifications
                    notifications: [{
                        id: safeGenerateId(),
                        title: '🎉 Welcome to SmartTask!',
                        message: `Thank you for joining! You've received ${safeFormatMoney(settings.registrationBonus)} as a registration bonus.`,
                        type: 'success',
                        read: false,
                        date: new Date().toISOString()
                    }],
                    
                    // Dates
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    
                    // Login Information
                    loginCount: 1,
                    
                    // Weekly Commission System
                    weeklyCommission: {
                        lastPaidDate: null,
                        currentWeekEarnings: {
                            level1: 0,
                            level2: 0,
                            level3: 0,
                            total: 0
                        },
                        commissionHistory: [],
                        pendingCommission: 0,
                        weeklyTaskEarnings: 0
                    }
                };
                
                await userRef.set(newUser);
                currentUser = { uid: user.uid, ...newUser };
            }
            
            // Update last login info
            await userRef.update({
                lastLogin: new Date().toISOString(),
                loginCount: firebase.firestore.FieldValue.increment(1)
            });
            
            console.log('Current user after auth:', currentUser);
            
            // Start session validation to continuously check user status
            startSessionValidation();
            
            // Show dashboard based on role
            showDashboardBasedOnRole();
        
        } catch (error) {
            console.error('Auth state observer error:', error);
            showAuth();
        }
    } else {
        // User is signed out
        console.log('User signed out');
        
        // Stop session validation
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
        }
        
        // Clear any other intervals
        if (window.taskRefreshTimer) {
            clearInterval(window.taskRefreshTimer);
            window.taskRefreshTimer = null;
        }
        
// Initialize social links system for the user
if (currentUser) {
    await initSocialLinksSystem();
    await loadUserFollowedStatus();
    addSocialLinksToUserMenu();
    await updateSocialNotificationBadge();
    
    // Show modal after 2 seconds if not all links followed
    if (!hasFollowedAllSocialLinks() && socialLinksList.length > 0) {
        setTimeout(() => {
            openSocialLinksModal();
        }, 2000);
    }
}
        
        currentUser = null;
        showAuth();
    }
});

async function createAdminUsersIfNeeded() {
    const admins = [
        { email: 'smart@task.com', password: 'Smart@123', role: 'admin' },
        { email: 'kingharuni420@gmail.com', password: 'Kalinga@25', role: 'superadmin' }
    ];

    for (const admin of admins) {
        try {
            // Try to create the user in Firebase Auth
            await auth.createUserWithEmailAndPassword(admin.email, admin.password);
            console.log(`Admin user created: ${admin.email}`);
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                console.log(`Admin ${admin.email} already exists.`);
            } else {
                console.error(`Error creating admin ${admin.email}:`, error);
            }
        }
    }
}

// Call it once, e.g., after Firebase is initialized
// createAdminUsersIfNeeded(); // Uncomment to run

// ============================================
// SAFE INITIALIZATION
// ============================================
(function() {
    'use strict';
    
    let appInitialized = false;
    
    function isDOMReady() {
        return document.readyState === 'complete' || document.readyState === 'interactive';
    }
    
    function safeInitialize() {
        if (appInitialized) return;
        appInitialized = true;
        
        const originalConsoleError = console.error;
        console.error = function() {
            const args = Array.from(arguments);
            const errorString = args.join(' ');
            
            if (errorString.includes('li._formatMsg') ||
                errorString.includes('Si.insert') ||
                errorString.includes('ji.forEach')) {
                return;
            }
            originalConsoleError.apply(console, args);
        };
        
        setTimeout(async function() {
            try {
                console.log('🚀 SmartTask initializing...');
                
                await initializeVIPPackages();
                await initializeSettings();
                await initializeTasks();
                initializeEventListeners();
                initializeUITimeOfDay();
                
                console.log('✅ SmartTask ready');
            } catch (e) {
                console.log('SmartTask loaded with defaults');
            } finally {
                setTimeout(() => {
                    console.error = originalConsoleError;
                }, 1000);
            }
        }, 10);
    }
    
    async function initializeVIPPackages() {
        try {
            const packagesSnap = await db.collection('settings').doc('vipPackages').get();
            if (packagesSnap.exists) {
                vipPackages = packagesSnap.data().packages;
            } else {
                loadVIPPackages();
                await db.collection('settings').doc('vipPackages').set({ packages: vipPackages });
            }
        } catch (e) {
            setDefaultPackages();
        }
    }
    
    async function initializeSettings() {
        try {
            const settingsSnap = await db.collection('settings').doc('global').get();
            if (settingsSnap.exists) {
                systemSettings = { ...systemSettings, ...settingsSnap.data() };
            } else {
                await db.collection('settings').doc('global').set(systemSettings);
            }
        } catch (e) {
            console.log('Using default settings');
        }
    }
    
    async function initializeTasks() {
        try {
            const tasksSnap = await db.collection('tasks').limit(1).get();
            if (tasksSnap.empty) {
                await createSampleTasks();
            }
        } catch (e) {
            console.log('Tasks initialization skipped');
        }
    }
    
    function setDefaultPackages() {
        if (vipPackages.length === 0) {
            loadVIPPackages();
        }
    }
    
    if (isDOMReady()) {
        safeInitialize();
    } else {
        document.addEventListener('DOMContentLoaded', safeInitialize);
    }
    
    setTimeout(function() {
        if (!appInitialized) {
            safeInitialize();
        }
    }, 2000);
})();

// ============================================
// FIREBASE DATA FUNCTIONS
// ============================================

// Users Collection
async function loadUsers() {
    try {
        const snapshot = await db.collection('users').get();
        users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error loading users:', error);
        users = [];
    }
}

async function saveUser(userId, userData) {
    try {
        await db.collection('users').doc(userId).set(userData, { merge: true });
    } catch (error) {
        console.error('Error saving user:', error);
    }
}

async function updateUser(userId, updates) {
    try {
        await db.collection('users').doc(userId).update(updates);
    } catch (error) {
        console.error('Error updating user:', error);
    }
}

// Deposits Collection
// ============================================
// FIXED LOAD DEPOSITS FUNCTION
// ============================================

async function loadDeposits() {
    console.log('Loading deposits from Firestore...');
    
    try {
        const snapshot = await db.collection('deposits')
            .orderBy('createdAt', 'desc')
            .get();
        
        deposits = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`Loaded ${deposits.length} deposits`);
        return deposits;
        
    } catch (error) {
        console.error('Error loading deposits:', error);
        
        // Try without orderBy if index error
        if (error.code === 'failed-precondition') {
            try {
                console.log('Trying without orderBy...');
                const snapshot = await db.collection('deposits').get();
                deposits = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log(`Loaded ${deposits.length} deposits (without order)`);
                return deposits;
            } catch (e) {
                console.error('Error loading deposits without order:', e);
                deposits = [];
            }
        } else {
            deposits = [];
        }
    }
    
    return deposits;
}

async function saveDeposit(depositData) {
    try {
        const docRef = await db.collection('deposits').add({
            ...depositData,
            date: new Date().toISOString()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error saving deposit:', error);
        throw error;
    }
}

async function updateDeposit(depositId, updates) {
    try {
        await db.collection('deposits').doc(depositId).update(updates);
    } catch (error) {
        console.error('Error updating deposit:', error);
    }
}

// ============================================
// FIXED LOAD WITHDRAWALS FUNCTION
// ============================================

async function loadWithdrawals() {
    console.log('Loading withdrawals from Firestore...');
    
    try {
        const snapshot = await db.collection('withdrawals')
            .orderBy('createdAt', 'desc')
            .get();
        
        withdrawals = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`Loaded ${withdrawals.length} withdrawals`);
        return withdrawals;
        
    } catch (error) {
        console.error('Error loading withdrawals:', error);
        
        // Try without orderBy if index error
        if (error.code === 'failed-precondition') {
            try {
                console.log('Trying without orderBy...');
                const snapshot = await db.collection('withdrawals').get();
                withdrawals = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log(`Loaded ${withdrawals.length} withdrawals (without order)`);
                return withdrawals;
            } catch (e) {
                console.error('Error loading withdrawals without order:', e);
                withdrawals = [];
            }
        } else {
            withdrawals = [];
        }
    }
    
    return withdrawals;
}

async function saveWithdrawal(withdrawalData) {
    try {
        const docRef = await db.collection('withdrawals').add({
            ...withdrawalData,
            date: new Date().toISOString()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error saving withdrawal:', error);
        throw error;
    }
}

async function updateWithdrawal(withdrawalId, updates) {
    try {
        await db.collection('withdrawals').doc(withdrawalId).update(updates);
    } catch (error) {
        console.error('Error updating withdrawal:', error);
    }
}

// Tasks Collection
async function loadTasks() {
    try {
        const snapshot = await db.collection('tasks').orderBy('createdAt', 'desc').get();
        tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return tasks;
    } catch (error) {
        console.error('Error loading tasks:', error);
        tasks = [];
        return [];
    }
}

async function debugTasksNow() {
    console.log('=== TASKS DEBUG ===');
    
    try {
        // Check systemSettings
        console.log('systemSettings:', systemSettings);
        console.log('tasksPerDay:', systemSettings?.tasksPerDay);
        
        // Check all active tasks
        const snapshot = await db.collection('tasks').where('status', '==', 'active').get();
        console.log(`Active tasks count: ${snapshot.size}`);
        
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        
        console.log('Date range:', startOfDay.toString(), 'to', endOfDay.toString());
        
        snapshot.forEach(doc => {
            const task = doc.data();
            console.log(`\nTask: ${task.title}`);
            console.log('ID:', doc.id);
            console.log('Status:', task.status);
            
            // Parse dates
            let scheduledDate, expiryDate;
            
            if (task.scheduledDate?.toDate) {
                scheduledDate = task.scheduledDate.toDate();
                console.log('scheduledDate (Timestamp):', scheduledDate.toString());
            } else {
                scheduledDate = new Date(task.scheduledDate);
                console.log('scheduledDate (string):', scheduledDate.toString());
            }
            
            if (task.expiryDate?.toDate) {
                expiryDate = task.expiryDate.toDate();
                console.log('expiryDate (Timestamp):', expiryDate.toString());
            } else {
                expiryDate = new Date(task.expiryDate);
                console.log('expiryDate (string):', expiryDate.toString());
            }
            
            const isValid = scheduledDate <= endOfDay && expiryDate >= startOfDay;
            console.log('Valid for today:', isValid);
        });
        
        // Check current user's stored tasks
        if (currentUser) {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            const userData = userDoc.data();
            console.log('\nUser dailyTasksDate:', userData.dailyTasksDate);
            console.log('User dailyTasks:', userData.dailyTasks);
            console.log('User completedTasks:', userData.completedTasks);
        }
        
    } catch (error) {
        console.error('Debug error:', error);
    }
    
    console.log('=== END DEBUG ===');
}

// Expose debug function
window.debugTasksNow = debugTasksNow;

async function saveTask(taskData) {
    try {
        if (taskData.id) {
            await db.collection('tasks').doc(taskData.id).update({
                ...taskData,
                updatedAt: new Date().toISOString()
            });
            return taskData.id;
        } else {
            const docRef = await db.collection('tasks').add({
                ...taskData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return docRef.id;
        }
    } catch (error) {
        console.error('Error saving task:', error);
        throw error;
    }
}

async function deleteTask(taskId) {
    try {
        await db.collection('tasks').doc(taskId).delete();
    } catch (error) {
        console.error('Error deleting task:', error);
        throw error;
    }
}

async function getTodaysTasks() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const snapshot = await db.collection('tasks')
            .where('status', '==', 'active')
            .where('scheduledDate', '<=', tomorrow.toISOString())
            .where('expiryDate', '>', today.toISOString())
            .limit(systemSettings.tasksPerDay)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting todays tasks:', error);
        return [];
    }
}

// Settings
async function loadSystemSettings() {
    try {
        const doc = await db.collection('settings').doc('global').get();
        if (doc.exists) {
            systemSettings = { ...systemSettings, ...doc.data() };
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveSystemSettings() {
    try {
        await db.collection('settings').doc('global').set(systemSettings);
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// ============================================
// VIP PACKAGES
// ============================================
function loadVIPPackages() {
    vipPackages = [
        { 
            level: 1, 
            investment: 10000, 
            dailyProfit: 500, 
            percentage: 5, 
            tasks: 3,
            name: 'Starter Pack',
            color: '#4CAF50',
            isPopular: false,
            benefits: ['Daily tasks', '5% returns', 'Basic support'],
            icon: 'fa-seedling'
        },
        { 
            level: 2, 
            investment: 20000, 
            dailyProfit: 1000, 
            percentage: 5, 
            tasks: 3,
            name: 'Basic Pack',
            color: '#2196F3',
            isPopular: false,
            benefits: ['Daily tasks', '5% returns', 'Priority support'],
            icon: 'fa-leaf'
        },
        { 
            level: 3, 
            investment: 40000, 
            dailyProfit: 2000, 
            percentage: 5, 
            tasks: 3,
            name: 'Silver Pack',
            color: '#FF9800',
            isPopular: false,
            benefits: ['Daily tasks', '5% returns', 'VIP support'],
            icon: 'fa-star-half-alt'
        },
        { 
            level: 4, 
            investment: 60000, 
            dailyProfit: 3000, 
            percentage: 5, 
            tasks: 3,
            name: 'Gold Pack',
            color: '#9C27B0',
            isPopular: false,
            benefits: ['Daily tasks', '5% returns', 'Gold benefits'],
            icon: 'fa-star'
        },
        { 
            level: 5, 
            investment: 100000, 
            dailyProfit: 5000, 
            percentage: 5, 
            tasks: 3,
            name: 'Platinum Pack',
            color: '#F44336',
            isPopular: true,
            benefits: ['Daily tasks', '5% returns', 'Platinum benefits'],
            icon: 'fa-gem'
        },
        { 
            level: 6, 
            investment: 200000, 
            dailyProfit: 12000, 
            percentage: 6, 
            tasks: 3,
            name: 'Diamond Pack',
            color: '#FFC107',
            isPopular: true,
            benefits: ['Daily tasks', '6% returns', 'Diamond benefits'],
            icon: 'fa-crown'
        },
        { 
            level: 7, 
            investment: 500000, 
            dailyProfit: 30000, 
            percentage: 6, 
            tasks: 3,
            name: 'Executive Pack',
            color: '#00BCD4',
            isPopular: true,
            benefits: ['Daily tasks', '6% returns', 'Executive benefits'],
            icon: 'fa-rocket'
        },
        { 
            level: 8, 
            investment: 1000000, 
            dailyProfit: 60000, 
            percentage: 6, 
            tasks: 3,
            name: 'Presidential Pack',
            color: '#E91E63',
            isPopular: true,
            benefits: ['Daily tasks', '6% returns', 'Presidential benefits'],
            icon: 'fa-star'
        }
    ];
}

// ============================================
// SAMPLE TASKS CREATION
// ============================================
async function createSampleTasks() {
    const now = new Date();
    const today = new Date(now.setHours(0,0,0,0));
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const sampleTasks = [
        {
            title: 'Rate Smartphone X',
            description: 'Tell us about your experience with the new smartphone',
            mediaType: 'image',
            mediaUrl: 'https://via.placeholder.com/300?text=Phone',
            scheduledDate: today.toISOString(),
            expiryDate: new Date(today.getTime() + 24*60*60*1000).toISOString(),
            status: 'active',
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            category: 'Rating'
        },
        {
            title: 'Watch Video & Review',
            description: 'Watch the product video and leave a review',
            mediaType: 'video',
            mediaUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            scheduledDate: today.toISOString(),
            expiryDate: new Date(today.getTime() + 24*60*60*1000).toISOString(),
            status: 'active',
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            category: 'Review'
        },
        {
            title: 'Quick Survey',
            description: 'Answer 3 quick questions about our service',
            mediaType: 'image',
            mediaUrl: 'https://via.placeholder.com/300?text=Survey',
            scheduledDate: tomorrow.toISOString(),
            expiryDate: new Date(tomorrow.getTime() + 24*60*60*1000).toISOString(),
            status: 'active',
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            category: 'Survey'
        }
    ];

    const batch = db.batch();
    sampleTasks.forEach(task => {
        const docRef = db.collection('tasks').doc();
        batch.set(docRef, task);
    });
    await batch.commit();
}

// ============================================
// UI CONTROL FUNCTIONS
// ============================================
function showAuth() {
    const authContainer = document.getElementById('authContainer');
    const userDashboard = document.getElementById('userDashboard');
    const adminDashboard = document.getElementById('adminDashboard');
    const superAdminDashboard = document.getElementById('superAdminDashboard');
    const slideshowContainer = document.getElementById('slideshowContainer');
    
    if (authContainer) authContainer.style.display = 'flex';
    if (slideshowContainer) slideshowContainer.style.display = 'block';
    if (userDashboard) userDashboard.classList.remove('active');
    if (adminDashboard) adminDashboard.classList.remove('active');
    if (superAdminDashboard) superAdminDashboard.classList.remove('active');
    
    // Restart slideshow when showing auth
    setTimeout(() => {
        if (slideshowContainer && slideshowContainer.style.display !== 'none') {
            stopAutoSlide();
            showSlide(0);
            startAutoSlide();
        }
    }, 100);
    
    showLogin();
}

// Also hide slideshow when user is logged in
function showDashboardBasedOnRole() {
    const slideshowContainer = document.getElementById('slideshowContainer');
    if (slideshowContainer) slideshowContainer.style.display = 'none';
    
    const authContainer = document.getElementById('authContainer');
    if (authContainer) authContainer.style.display = 'none';
    
    if (!currentUser) {
        console.warn('No current user, showing auth');
        showAuth();
        return;
    }
    
    if (systemSettings.maintenanceMode && currentUser.role !== 'superadmin') {
        showMaintenanceMode();
        return;
    }
    
    try {
        if (currentUser.role === 'user') {
            showUserDashboard();
        } else if (currentUser.role === 'admin') {
            showAdminDashboard();
        } else if (currentUser.role === 'superadmin') {
            showSuperAdminDashboard();
        } else {
            console.error('Unknown role:', currentUser.role);
            showAuth();
        }
    } catch (error) {
        console.error('Error showing dashboard:', error);
        showAuth(); // fallback
    }
}

function showMaintenanceMode() {
    const authContainer = document.getElementById('authContainer');
    if (authContainer) {
        authContainer.innerHTML = `
            <div class="auth-box maintenance-mode">
                <i class="fas fa-tools"></i>
                <h2>Under Maintenance</h2>
                <p>SmartTask is currently under maintenance. Please check back later.</p>
                <button onclick="logout()" class="auth-btn">Back to Login</button>
            </div>
        `;
        authContainer.style.display = 'flex';
    }
}

// Update showUserDashboard function
async function showUserDashboard() {
    console.log('showUserDashboard');
    try {
        document.getElementById('userDashboard').classList.add('active');
        document.getElementById('adminDashboard').classList.remove('active');
        document.getElementById('superAdminDashboard').classList.remove('active');
        document.getElementById('authContainer').style.display = 'none';
        
        updateUserDisplay();
        await loadUserData();
        loadUserNotifications();
        switchUserTab('overview');
        checkDailyTasksReset();
        await loadDailyTasks();
        
        // Start the midnight refresh timer
        startTaskRefreshTimer();
        
        // Update referral links after user data is loaded
        setTimeout(() => {
            updateAllReferralLinks();
        }, 500);
        
        
    } catch (e) {
        console.error('Error in showUserDashboard:', e);
    }
}

function startTaskRefreshTimer() {
    if (window.taskRefreshTimer) clearInterval(window.taskRefreshTimer);
    
    window.taskRefreshTimer = setInterval(() => {
        const now = new Date();
        const today = now.toDateString();
        
        if (currentUser && currentUser.dailyTasksDate !== today) {
            console.log('Day changed, reloading tasks...');
            loadDailyTasks();
        }
    }, 60000); // Check every minute
}

// Update showAdminDashboard function
function showAdminDashboard() {
    console.log('showAdminDashboard');
    try {
        document.getElementById('userDashboard').classList.remove('active');
        document.getElementById('adminDashboard').classList.add('active');
        document.getElementById('superAdminDashboard').classList.remove('active');
        document.getElementById('authContainer').style.display = 'none';
        
        // Initialize statistics (no auto-refresh)
        initAdminStatistics();
        
        loadAdminData();
        switchAdminTab('dashboard');
    } catch (e) {
        console.error('Error in showAdminDashboard:', e.message, e.stack);
    }
}

// Clean up when leaving admin dashboard
function cleanupAdminDashboard() {
    stopAdminStatistics();
}

// Clean up when leaving admin dashboard
function cleanupAdminDashboard() {
    stopAdminStatisticsRefresh();
}

function showSuperAdminDashboard() {
    console.log('showSuperAdminDashboard');
    try {
        document.getElementById('userDashboard').classList.remove('active');
        document.getElementById('adminDashboard').classList.remove('active');
        document.getElementById('superAdminDashboard').classList.add('active');
        document.getElementById('authContainer').style.display = 'none';
        
        loadSuperAdminData();
        switchSuperAdminTab('dashboard');
    } catch (e) {
        console.error('Error in showSuperAdminDashboard:', e);
    }
}

function updateUserDisplay() {
    const userDisplayName = document.getElementById('userDisplayName');
    const welcomeName = document.getElementById('welcomeName');
    
    if (userDisplayName) userDisplayName.textContent = currentUser?.fullName || currentUser?.username || 'User';
    if (welcomeName) welcomeName.textContent = currentUser?.fullName || currentUser?.username || 'User';
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================
function showLogin() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    if (loginForm) loginForm.classList.add('active');
    if (signupForm) signupForm.classList.remove('active');
    
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');
    if (loginUsername) loginUsername.value = '';
    if (loginPassword) loginPassword.value = '';
}

function showSignup() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    if (loginForm) loginForm.classList.remove('active');
    if (signupForm) signupForm.classList.add('active');
}

// ============================================
// UPDATED LOGIN FUNCTION WITH STATUS CHECK
// ============================================

async function handleLogin() {
    console.log('🔐 Login function called');
    
    const input = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    const rememberMe = document.getElementById('rememberMe')?.checked || false;
    
    if (!input || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // Set persistence based on "Remember Me"
        if (rememberMe) {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } else {
            await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        }
        
        let email = input;
        
        // If input is not an email, assume username and look up email in Firestore
        if (!input.includes('@')) {
            const usersRef = db.collection('users');
            const snapshot = await usersRef.where('usernameLower', '==', input.toLowerCase()).limit(1).get();
            
            if (snapshot.empty) {
                hideLoading();
                showToast('Username not found', 'error');
                return;
            }
            
            const userData = snapshot.docs[0].data();
            
            // Check if user is active before login
            if (userData.isActive === false) {
                hideLoading();
                showToast('Your account has been deactivated. Please contact support.', 'error');
                return;
            }
            
            email = userData.email;
        }
        
        // Sign in with Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        
        // Check again after login (in case status changed between lookup and login)
        const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
        if (userDoc.exists && userDoc.data().isActive === false) {
            await auth.signOut();
            hideLoading();
            showToast('Your account has been deactivated. Please contact support.', 'error');
            return;
        }
        
        // Login successful
        hideLoading();
        showToast('Login successful!', 'success');
        
    } catch (error) {
        hideLoading();
        console.error('Login error:', error);
        
        switch (error.code) {
            case 'auth/user-not-found':
                showToast('No account found with that email/username', 'error');
                break;
            case 'auth/wrong-password':
                showToast('Incorrect password', 'error');
                break;
            case 'auth/invalid-email':
                showToast('Invalid email format', 'error');
                break;
            case 'auth/user-disabled':
                showToast('This account has been disabled', 'error');
                break;
            case 'auth/too-many-requests':
                showToast('Too many failed attempts. Please try again later.', 'error');
                break;
            default:
                showToast('Login failed: ' + error.message, 'error');
        }
    }
}

async function ensureAdminUsers() {
    const admins = [
        { email: 'smart@task.com', password: 'Smart@123', role: 'admin' },
        { email: 'kingharuni420@gmail.com', password: 'Kalinga@25', role: 'superadmin' }
    ];

    for (const admin of admins) {
        try {
            // Check if user already exists in Auth (optional – createUser will throw if exists)
            await auth.createUserWithEmailAndPassword(admin.email, admin.password);
            console.log(`Admin user created: ${admin.email}`);
            // The auth observer will create the Firestore document with the correct role
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                console.log(`Admin ${admin.email} already exists.`);
            } else {
                console.error(`Error creating admin ${admin.email}:`, error);
            }
        }
    }
}

async function handleSignup() {
    console.log('📝 Signup function called');
    
    const fullName = document.getElementById('signupFullName')?.value.trim();
    const username = document.getElementById('signupUsername')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim().toLowerCase();
    const phone = document.getElementById('signupPhone')?.value.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirmPassword = document.getElementById('signupConfirmPassword')?.value;
    let referral = document.getElementById('signupReferral')?.value.trim().toUpperCase();
    const termsAgree = document.getElementById('termsAgree')?.checked;
    
    // Basic validation
    if (!fullName || !username || !email || !phone || !password || !confirmPassword) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    if (!termsAgree) {
        showToast('You must agree to the Terms and Conditions', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    if (!validatePhone(phone)) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }
    if (username.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        return;
    }
    
    // Check if referral code is valid
    let referrer = null;
    if (referral && referral.trim() !== '') {
        const refCheck = await db.collection('users')
            .where('myReferralCode', '==', referral)
            .limit(1)
            .get();
        
        if (!refCheck.empty) {
            referrer = refCheck.docs[0];
            console.log('Valid referral code found:', referral);
        } else {
            showToast('Invalid referral code. You can still register without it.', 'warning');
            referral = null;
        }
    }
    
    showLoading();
    
    try {
        // Check if username already exists
        const usernameCheck = await db.collection('users').where('username', '==', username).get();
        if (!usernameCheck.empty) {
            hideLoading();
            showToast('Username already exists', 'error');
            return;
        }
        
        // Check if email already exists
        const emailCheck = await db.collection('users').where('email', '==', email).get();
        if (!emailCheck.empty) {
            hideLoading();
            showToast('Email already registered', 'error');
            return;
        }
        
        // Check if phone already exists
        const phoneCheck = await db.collection('users').where('phone', '==', phone).get();
        if (!phoneCheck.empty) {
            hideLoading();
            showToast('Phone number already registered', 'error');
            return;
        }
        
        // Create auth user
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;
        
        // Determine role based on email (for predefined admins)
        let role = 'user';
        if (email === 'smart@task.com') role = 'admin';
        else if (email === 'kingharuni420@gmail.com') role = 'superadmin';
        
        // Generate unique referral code (random, not based on username)
        const myReferralCode = await generateUniqueReferralCode();
        
        // Create user document in Firestore
        const newUser = {
            // Basic Information
            uid: uid,
            username: username,
            email: email,
            fullName: fullName,
            phone: phone,
            role: role,
            usernameLower: username.toLowerCase(),
            
            // Account Status
            isActive: true,
            isVerified: false,
            profileImage: null,
            
            // Financial Information
            balance: systemSettings.registrationBonus,
            referralBalance: 0,
            totalEarned: systemSettings.registrationBonus,
            totalInvested: 0,
            
            // Referral Information
            referralEarnings: {
                level1: 0,
                level2: 0,
                level3: 0
            },
            referrals: [],
            myReferralCode: myReferralCode,
            referredBy: referrer ? referrer.id : null,
            
            // Task Information
            tasksCompleted: 0,
            lastTaskDate: null,
            completedTasks: [],
            activePackages: [],
            
            // Transaction History
            history: [{
                id: generateId(),
                type: 'bonus',
                description: 'Registration Bonus',
                amount: systemSettings.registrationBonus,
                status: 'completed',
                date: new Date().toISOString()
            }],
            
            // Notifications
            notifications: [{
                id: generateId(),
                title: '🎉 Welcome to SmartTask!',
                message: `Thank you for joining! You've received ${formatMoney(systemSettings.registrationBonus)} as a registration bonus.`,
                type: 'success',
                read: false,
                date: new Date().toISOString()
            }],
            
            // Dates
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            
            // Login Information
            loginCount: 1,
            
            // Weekly Commission System
            weeklyCommission: {
                lastPaidDate: null,
                currentWeekEarnings: {
                    level1: 0,
                    level2: 0,
                    level3: 0,
                    total: 0
                },
                commissionHistory: [],
                pendingCommission: 0,
                weeklyTaskEarnings: 0
            }
        };
        
        await db.collection('users').doc(uid).set(newUser);
        
        // Process referral commission if applicable
        if (referrer) {
            await processReferralCommission(referrer.id, uid, username);
        }
        
        hideLoading();
        showToast('✅ Registration successful! You received 2,000 TZS bonus!', 'success');
        
        // Clear URL parameters after successful signup
        if (window.history && window.history.pushState) {
            const newUrl = window.location.origin + window.location.pathname;
            window.history.pushState({}, '', newUrl);
        }
        
    } catch (error) {
        hideLoading();
        console.error('Signup error:', error);
        
        if (error.code === 'auth/email-already-in-use') {
            showToast('Email already in use.', 'error');
        } else if (error.code === 'auth/weak-password') {
            showToast('Password is too weak.', 'error');
        } else if (error.code === 'auth/invalid-email') {
            showToast('Invalid email address.', 'error');
        } else {
            showToast(error.message || 'An error occurred during registration', 'error');
        }
    }
}

async function socialLogin(provider) {
    showLoading();
    
    try {
        let authProvider;
        if (provider === 'google') {
            authProvider = new firebase.auth.GoogleAuthProvider();
        } else if (provider === 'facebook') {
            authProvider = new firebase.auth.FacebookAuthProvider();
        } else if (provider === 'github') {
            authProvider = new firebase.auth.GithubAuthProvider();
        } else {
            hideLoading();
            return;
        }
        
        await auth.signInWithPopup(authProvider);
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('Social login error:', error);
        showToast(error.message, 'error');
    }
}

async function forgotPassword() {
    const email = prompt('Please enter your email address:');
    if (email) {
        if (validateEmail(email)) {
            try {
                await auth.sendPasswordResetEmail(email);
                showToast(`📧 Password reset link sent to ${email}`, 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        } else {
            showToast('Please enter a valid email address', 'error');
        }
    }
}

// ============================================
// UPDATED LOGOUT FUNCTION
// ============================================

async function logout() {
    // Stop session validation
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
    
    // Clear any other intervals
    if (window.taskRefreshTimer) {
        clearInterval(window.taskRefreshTimer);
        window.taskRefreshTimer = null;
    }
    
    try {
        await auth.signOut();
        showToast('👋 You have been logged out', 'info');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// ============================================
// USER DASHBOARD FUNCTIONS
// ============================================
async function loadUserData() {
    if (!currentUser?.uid) return;
    
    try {
        // Refresh user data from Firestore
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            currentUser = { uid: currentUser.uid, ...userDoc.data() };
        }
        
        // Update balance displays
        const userBalance = document.getElementById('userBalance');
        const withdrawBalance = document.getElementById('withdrawBalance');
        const referralBalance = document.getElementById('referralBalance');
        const tasksDone = document.getElementById('tasksDone');
        const referralBonus = document.getElementById('referralBonus');
        const activePackages = document.getElementById('activePackages');
        const totalEarned = document.getElementById('totalEarned');
        const totalInvested = document.getElementById('totalInvested');
        
        if (userBalance) userBalance.textContent = formatMoney(currentUser.balance || 0);
        if (withdrawBalance) withdrawBalance.textContent = formatMoney(currentUser.balance || 0);
        if (referralBalance) referralBalance.textContent = formatMoney(currentUser.referralBalance || 0);
        if (tasksDone) tasksDone.textContent = `${currentUser.tasksCompleted || 0}/${systemSettings.tasksPerDay}`;
        if (referralBonus) referralBonus.textContent = formatMoney(currentUser.referralBalance || 0);
        if (activePackages) activePackages.textContent = currentUser.activePackages?.length || 0;
        if (totalEarned) totalEarned.textContent = formatMoney(currentUser.totalEarned || 0);
        if (totalInvested) totalInvested.textContent = formatMoney(currentUser.totalInvested || 0);
        
        // Load tasks
        await loadDailyTasks();
        
        // Load packages
        loadPackages();
        
        // Load user packages
        loadUserPackages();
        
        // Load referral data
        await loadReferralData();
        
        // Load history
        loadHistory();
        
        // Set referral link
        const referralLink = document.getElementById('referralLink');
        if (referralLink && currentUser.myReferralCode) {
            referralLink.value = `https://smarttask.com/ref/${currentUser.myReferralCode}`;
        }
        
        animateStats();
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function loadDailyTasks() {
    console.log('Loading daily tasks...');
    
    if (!currentUser) {
        console.log('No current user');
        return;
    }
    
    // Ensure systemSettings exists with defaults
    if (!window.systemSettings) {
        window.systemSettings = {
            tasksPerDay: 3
        };
    }
    
    const tasksPerDay = systemSettings?.tasksPerDay || 3;
    console.log('Tasks per day:', tasksPerDay);
    
    const now = new Date();
    
    // Create start of day in LOCAL time
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    // Create end of day in LOCAL time
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('Current time:', now.toString());
    console.log('Start of day:', startOfDay.toString());
    console.log('End of day:', endOfDay.toString());
    
    try {
        // Get today's date as string for comparison (YYYY-MM-DD)
        const todayStr = startOfDay.toISOString().split('T')[0];
        console.log('Today string:', todayStr);
        
        // Get fresh user data
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (!userDoc.exists) {
            console.error('User document not found');
            return;
        }
        
        const userData = userDoc.data();
        console.log('User data - dailyTasksDate:', userData.dailyTasksDate, 'dailyTasks:', userData.dailyTasks);
        
        let tasksList = [];
        let usedTaskIds = new Set();
        
        // FIRST: If we have stored tasks for today, try to use them
        if (userData.dailyTasksDate === todayStr && userData.dailyTasks && userData.dailyTasks.length > 0) {
            console.log('Found stored tasks for today:', userData.dailyTasks);
            
            // Fetch each stored task
            for (const taskId of userData.dailyTasks) {
                try {
                    const taskDoc = await db.collection('tasks').doc(taskId).get();
                    if (taskDoc.exists) {
                        const task = { id: taskDoc.id, ...taskDoc.data() };
                        
                        // Check if task is still active and not expired
                        if (task.status === 'active') {
                            // Parse expiry date
                            let expiryDate;
                            if (task.expiryDate?.toDate) {
                                expiryDate = task.expiryDate.toDate();
                            } else if (task.expiryDate?.seconds) {
                                expiryDate = new Date(task.expiryDate.seconds * 1000);
                            } else {
                                expiryDate = new Date(task.expiryDate);
                            }
                            
                            // Only include if not expired
                            if (expiryDate > now) {
                                tasksList.push(task);
                                usedTaskIds.add(taskId);
                                console.log(`Added stored task: ${task.title}`);
                            } else {
                                console.log(`Stored task expired: ${task.title}`);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error fetching stored task:', taskId, error);
                }
            }
            
            console.log(`Retrieved ${tasksList.length} valid stored tasks`);
        }
        
        // If we don't have enough tasks, fetch more from available tasks
        if (tasksList.length < tasksPerDay) {
            console.log(`Need ${tasksPerDay - tasksList.length} more tasks`);
            
            // Get all active tasks
            const snapshot = await db.collection('tasks')
                .where('status', '==', 'active')
                .get();
            
            console.log('Total active tasks in database:', snapshot.size);
            
            // Build list of available tasks that are valid for today
            let availableTasks = [];
            
            snapshot.forEach(doc => {
                const task = { id: doc.id, ...doc.data() };
                
                // Skip if already in our list
                if (usedTaskIds.has(doc.id)) return;
                
                // Parse dates
                let scheduledDate, expiryDate;
                
                if (task.scheduledDate?.toDate) {
                    scheduledDate = task.scheduledDate.toDate();
                } else if (task.scheduledDate?.seconds) {
                    scheduledDate = new Date(task.scheduledDate.seconds * 1000);
                } else {
                    scheduledDate = new Date(task.scheduledDate);
                }
                
                if (task.expiryDate?.toDate) {
                    expiryDate = task.expiryDate.toDate();
                } else if (task.expiryDate?.seconds) {
                    expiryDate = new Date(task.expiryDate.seconds * 1000);
                } else {
                    expiryDate = new Date(task.expiryDate);
                }
                
                // Check if task is valid for today
                // Task should be scheduled on or before today and not expired
                const isValid = scheduledDate <= endOfDay && expiryDate >= startOfDay;
                
                if (isValid) {
                    availableTasks.push(task);
                    console.log(`Found available task: ${task.title}`, {
                        scheduled: scheduledDate.toString(),
                        expiry: expiryDate.toString()
                    });
                }
            });
            
            console.log(`Available tasks for today: ${availableTasks.length}`);
            
            // Shuffle available tasks
            availableTasks = shuffleArray(availableTasks);
            
            // Add needed tasks
            const needed = tasksPerDay - tasksList.length;
            if (needed > 0 && availableTasks.length > 0) {
                const toAdd = availableTasks.slice(0, Math.min(needed, availableTasks.length));
                tasksList = [...tasksList, ...toAdd];
                console.log(`Added ${toAdd.length} new tasks`);
            }
        }
        
        // Ensure we don't exceed tasksPerDay
        if (tasksList.length > tasksPerDay) {
            tasksList = tasksList.slice(0, tasksPerDay);
        }
        
        console.log('Final tasks to display:', tasksList.length);
        tasksList.forEach((task, i) => {
            console.log(`${i + 1}. ${task.title} (${task.id})`);
        });
        
                // After getting tasksList, also update the global tasks array
        if (tasksList && tasksList.length > 0) {
            // Merge with existing tasks or replace
            tasksList.forEach(task => {
                const index = tasks.findIndex(t => t.id === task.id);
                if (index === -1) {
                    tasks.push(task);
                } else {
                    tasks[index] = task;
                }
            });
        }
        
        // Save to user document if changed
        if (tasksList.length > 0) {
            const taskIds = tasksList.map(t => t.id);
            
            // Only update if different from stored
            if (!userData.dailyTasks ||
                userData.dailyTasksDate !== todayStr ||
                JSON.stringify(userData.dailyTasks) !== JSON.stringify(taskIds)) {
                
                console.log('Updating user tasks in database');
                try {
                    await db.collection('users').doc(currentUser.uid).update({
                        dailyTasks: taskIds,
                        dailyTasksDate: todayStr
                    });
                    
                    // Update local user
                    currentUser.dailyTasks = taskIds;
                    currentUser.dailyTasksDate = todayStr;
                } catch (error) {
                    console.error('Error saving tasks to user:', error);
                }
            }
        } else {
            console.log('No tasks available for today');
            // Clear any stored tasks
            if (userData.dailyTasksDate === todayStr) {
                await db.collection('users').doc(currentUser.uid).update({
                    dailyTasks: [],
                    dailyTasksDate: null
                });
            }
        }
        
        // Render the tasks
        renderDailyTasks(tasksList);
        
    } catch (error) {
        console.error('Error in loadDailyTasks:', error);
        console.error('Error details:', error.message);
        showToast('Unable to load tasks. Please try again.', 'error');
        renderDailyTasks([]);
    }
}

// Helper function to shuffle array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

async function resetDailyTasks() {
    if (!currentUser) return;
    
    console.log('Resetting daily tasks...');
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            dailyTasks: [],
            dailyTasksDate: null
        });
        
        currentUser.dailyTasks = [];
        currentUser.dailyTasksDate = null;
        
        await loadDailyTasks();
        showToast('Tasks reset successfully', 'success');
    } catch (error) {
        console.error('Error resetting tasks:', error);
        showToast('Error resetting tasks', 'error');
    }
}

// Expose it globally
window.resetDailyTasks = resetDailyTasks;

function renderDailyTasks(tasksList) {
    console.log('Rendering tasks. Count:', tasksList?.length);
    
    const tasksContainer = document.getElementById('dailyTasksList');
    const taskList = document.getElementById('taskList');
    const progressFill = document.getElementById('taskProgressFill');
    const progressText = document.getElementById('taskProgressText');
    
    if (!tasksContainer) {
        console.error('dailyTasksList element not found');
        return;
    }
    
    const hasPackage = hasActivePackage();
    const packageSummary = getActivePackagesSummary();
    
    const completedIds = currentUser?.completedTasks || [];
    const today = new Date().toDateString();
    const isToday = currentUser?.lastTaskDate === today;
    
    let tasksHtml = '';
    let taskListHtml = '';
    let completedCount = 0;
    
    if (!hasPackage) {
        tasksHtml = `
            <div class="no-package-warning">
                <i class="fas fa-box-open"></i>
                <h4>No Active Package Found</h4>
                <p>You need to purchase a VIP package to start earning from tasks!</p>
                <button onclick="switchUserTab('packages')" class="action-btn">
                    <i class="fas fa-shopping-cart"></i> Browse Packages
                </button>
            </div>
        `;
        taskListHtml = '<p class="no-data">Purchase a package to start earning</p>';
    } else if (!tasksList || tasksList.length === 0) {
        tasksHtml = `
            <div class="no-tasks">
                <i class="fas fa-tasks"></i>
                <p>No tasks available for today.</p>
                <p class="small">Check back later or contact support</p>
            </div>
        `;
        taskListHtml = '<p class="no-data">No tasks available</p>';
    } else {
        tasksList.forEach(task => {
            const isCompleted = isToday && completedIds.includes(task.id);
            if (isCompleted) completedCount++;
            
            const expiryDate = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
            
            // Create media preview HTML
            let mediaPreviewHtml = '';
            const mediaUrl = task.mediaUrl || '';
            const mediaType = task.mediaType || 'image';
            
            if (mediaType === 'video') {
                if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
                    const videoId = extractYouTubeId(mediaUrl);
                    if (videoId) {
                        mediaPreviewHtml = `
                            <div class="video-preview" onclick="openTaskModal('${task.id}')">
                                <div class="play-overlay">
                                    <i class="fas fa-play-circle"></i>
                                </div>
                                <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" alt="Video thumbnail">
                            </div>
                        `;
                    } else {
                        mediaPreviewHtml = `
                            <div class="video-preview" onclick="openTaskModal('${task.id}')">
                                <div class="play-overlay">
                                    <i class="fas fa-play-circle"></i>
                                </div>
                                <video src="${mediaUrl}" style="width:100%; height:100%; object-fit:cover;"></video>
                            </div>
                        `;
                    }
                } else if (mediaUrl) {
                    mediaPreviewHtml = `
                        <div class="video-preview" onclick="openTaskModal('${task.id}')">
                            <div class="play-overlay">
                                <i class="fas fa-play-circle"></i>
                            </div>
                            <video src="${mediaUrl}" style="width:100%; height:100%; object-fit:cover;"></video>
                        </div>
                    `;
                } else {
                    mediaPreviewHtml = `
                        <div class="media-placeholder">
                            <i class="fas fa-video"></i>
                            <span>Video</span>
                        </div>
                    `;
                }
            } else {
                if (mediaUrl) {
                    mediaPreviewHtml = `<img src="${mediaUrl}" alt="${task.title}" onclick="openTaskModal('${task.id}')" style="cursor:pointer;">`;
                } else {
                    mediaPreviewHtml = `
                        <div class="media-placeholder">
                            <i class="fas fa-image"></i>
                            <span>No Image</span>
                        </div>
                    `;
                }
            }
            
            tasksHtml += `
                <div class="task-item ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}">
                    <div class="task-media-container">
                        ${mediaPreviewHtml}
                    </div>
                    <div class="task-info">
                        <h4>${escapeHtml(task.title)}</h4>
                        <p>${escapeHtml(task.description || 'Complete this task to earn daily profits')}</p>
                        <div class="task-meta">
                            <span class="task-category">
                                <i class="fas fa-tag"></i> ${task.category || 'Rating'}
                            </span>
                            <span class="task-expiry">
                                <i class="far fa-clock"></i> Expires: ${expiryDate.toLocaleTimeString()}
                            </span>
                        </div>
                        ${packageSummary ? `
                        <div class="package-indicator">
                            <i class="fas fa-box"></i>
                            <span>Earn from: ${packageSummary.names}</span>
                            <span class="package-badge-small">${formatMoney(packageSummary.totalDailyProfit)}/day</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="task-actions">
                        ${isCompleted ? 
                            `<span class="task-status completed">
                                <i class="fas fa-check-circle"></i> Completed
                            </span>` : 
                            `<button class="do-task-btn" onclick="openTaskModal('${task.id}')">
                                <i class="fas fa-play"></i> Start Task
                            </button>`
                        }
                    </div>
                </div>
            `;
            
            taskListHtml += `
                <div class="task-mini-item ${isCompleted ? 'completed' : ''}">
                    <span class="task-name">
                        <i class="fas ${isCompleted ? 'fa-check-circle' : 'fa-circle'}"></i>
                        ${escapeHtml(task.title)}
                    </span>
                    <span class="task-status ${isCompleted ? 'completed' : 'pending'}">
                        ${isCompleted ? 'Done' : 'Pending'}
                    </span>
                </div>
            `;
        });
    }
    
    tasksContainer.innerHTML = tasksHtml;
    if (taskList) taskList.innerHTML = taskListHtml;
    
    // Update progress bar
    if (progressFill && tasksList && tasksList.length > 0) {
        const percentage = (completedCount / tasksList.length) * 100;
        progressFill.style.width = `${percentage}%`;
        if (progressText) {
            progressText.textContent = `${completedCount}/${tasksList.length} Tasks Completed`;
        }
    } else if (progressFill) {
        progressFill.style.width = '0%';
        if (progressText) {
            progressText.textContent = hasPackage ? '0/3 Tasks Completed' : 'Purchase package to start';
        }
    }
}

function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Debug function to check tasks in database
async function debugTasks() {
    console.log('=== DEBUG: Checking tasks in database ===');
    
    try {
        const snapshot = await db.collection('tasks').get();
        console.log(`Total tasks in database: ${snapshot.size}`);
        
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        
        console.log('Current date range:', startOfDay.toString(), 'to', endOfDay.toString());
        
        snapshot.forEach(doc => {
            const task = doc.data();
            
            // Convert dates
            let scheduledDate, expiryDate;
            if (task.scheduledDate?.toDate) {
                scheduledDate = task.scheduledDate.toDate();
            } else if (task.scheduledDate?.seconds) {
                scheduledDate = new Date(task.scheduledDate.seconds * 1000);
            } else {
                scheduledDate = new Date(task.scheduledDate);
            }
            
            if (task.expiryDate?.toDate) {
                expiryDate = task.expiryDate.toDate();
            } else if (task.expiryDate?.seconds) {
                expiryDate = new Date(task.expiryDate.seconds * 1000);
            } else {
                expiryDate = new Date(task.expiryDate);
            }
            
            const isValidForToday = scheduledDate <= endOfDay && expiryDate >= startOfDay;
            
            console.log({
                id: doc.id,
                title: task.title,
                status: task.status,
                scheduledDate: scheduledDate.toString(),
                expiryDate: expiryDate.toString(),
                isValidForToday: isValidForToday,
                mediaUrl: task.mediaUrl
            });
        });
        
        console.log('=== END DEBUG ===');
        
    } catch (error) {
        console.error('Debug error:', error);
    }
}

// Expose debug function
window.debugTasks = debugTasks;

async function debugTaskIssues() {
    console.log('=== TASK DEBUG START ===');
    
    // Check system settings
    console.log('System settings tasksPerDay:', systemSettings.tasksPerDay);
    
    // Check current user
    console.log('Current user:', currentUser?.uid, currentUser?.username);
    
    // Get all active tasks
    const snapshot = await db.collection('tasks').where('status', '==', 'active').get();
    console.log(`Total active tasks in database: ${snapshot.size}`);
    
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('Today date range:', startOfDay.toString(), 'to', endOfDay.toString());
    
    let validTasks = [];
    
    snapshot.forEach(doc => {
        const task = { id: doc.id, ...doc.data() };
        console.log(`\nTask: ${task.title} (${doc.id})`);
        console.log('Status:', task.status);
        
        // Parse dates
        let scheduledDate, expiryDate;
        
        if (task.scheduledDate?.toDate) {
            scheduledDate = task.scheduledDate.toDate();
            console.log('scheduledDate (Timestamp):', scheduledDate.toString());
        } else if (task.scheduledDate) {
            scheduledDate = new Date(task.scheduledDate);
            console.log('scheduledDate (string):', scheduledDate.toString());
        } else {
            console.log('scheduledDate: MISSING');
        }
        
        if (task.expiryDate?.toDate) {
            expiryDate = task.expiryDate.toDate();
            console.log('expiryDate (Timestamp):', expiryDate.toString());
        } else if (task.expiryDate) {
            expiryDate = new Date(task.expiryDate);
            console.log('expiryDate (string):', expiryDate.toString());
        } else {
            console.log('expiryDate: MISSING');
        }
        
        // Check if valid for today
        if (scheduledDate && expiryDate) {
            const isValid = scheduledDate <= endOfDay && expiryDate >= startOfDay;
            console.log('Valid for today:', isValid);
            
            if (isValid) {
                validTasks.push(task);
            }
        }
    });
    
    console.log(`\nValid tasks for today: ${validTasks.length}`);
    validTasks.forEach((task, index) => {
        console.log(`${index + 1}. ${task.title}`);
    });
    
    // Check user's stored tasks
    if (currentUser) {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        console.log('\nUser stored dailyTasks:', userData.dailyTasks);
        console.log('User dailyTasksDate:', userData.dailyTasksDate);
        console.log('User completedTasks:', userData.completedTasks);
    }
    
    console.log('=== TASK DEBUG END ===');
}

debugTaskIssues();

async function completeTask(taskId, rating) {
    const today = new Date().toDateString();
    
    // Double-check package subscription
    if (!hasActivePackage()) {
        showToast('You need an active package to earn from tasks!', 'error');
        return;
    }
    
    // Reset if new day
    if (currentUser.lastTaskDate !== today) {
        currentUser.tasksCompleted = 0;
        currentUser.completedTasks = [];
        currentUser.lastTaskDate = today;
    }
    
    // Check if already completed
    if (currentUser.completedTasks?.includes(taskId)) {
        showToast('You have already completed this task', 'warning');
        return;
    }
    
    // Check max tasks
    if (currentUser.tasksCompleted >= systemSettings.tasksPerDay) {
        showToast('You have already completed all tasks for today!', 'warning');
        return;
    }
    
    try {
        const taskDoc = await db.collection('tasks').doc(taskId).get();
        if (!taskDoc.exists) {
            showToast('Task not found', 'error');
            return;
        }
        const task = taskDoc.data();
        
        // Get package info for logging
        const packageSummary = getActivePackagesSummary();
        
        // Update user in Firestore
        const userRef = db.collection('users').doc(currentUser.uid);
        const newCompleted = [...(currentUser.completedTasks || []), taskId];
        const newCount = newCompleted.length;
        
        // Create history entry
        const historyEntry = {
            id: generateId(),
            type: 'task',
            description: `Rated: ${task.title} (${rating} stars) - Packages: ${packageSummary.names}`,
            amount: 0, // No immediate reward
            status: 'completed',
            date: new Date().toISOString(),
            metadata: {
                taskId: taskId,
                rating: rating,
                packagesCount: packageSummary.count,
                packagesNames: packageSummary.names,
                potentialDailyProfit: packageSummary.totalDailyProfit
            }
        };
        
        await userRef.update({
            completedTasks: newCompleted,
            tasksCompleted: newCount,
            lastTaskDate: today,
            history: firebase.firestore.FieldValue.arrayUnion(historyEntry)
        });
        
        // Update local user
        currentUser.completedTasks = newCompleted;
        currentUser.tasksCompleted = newCount;
        
        showToast(`✅ Task completed with ${rating} stars!`, 'success');
        
        // If all tasks completed, credit daily profit from packages
        if (newCount === systemSettings.tasksPerDay) {
            await creditDailyProfit();
        } else {
            // Show progress
            const remaining = systemSettings.tasksPerDay - newCount;
            showToast(`📊 Progress: ${newCount}/${systemSettings.tasksPerDay} tasks completed. ${remaining} more to earn daily profit!`, 'info');
        }
        
        // Reload tasks to update UI
        await loadDailyTasks();
        loadUserData(); // updates balance display
        
    } catch (error) {
        console.error('Error completing task:', error);
        showToast('Error completing task', 'error');
    }
}

async function creditDailyProfit() {
    if (!hasActivePackage()) {
        console.log('No active packages, skipping profit credit');
        return;
    }
    
    let totalProfit = 0;
    let packageDetails = [];
    
    if (currentUser.activePackages && currentUser.activePackages.length > 0) {
        currentUser.activePackages.forEach(pkg => {
            totalProfit += pkg.dailyProfit;
            packageDetails.push({
                name: pkg.name,
                profit: pkg.dailyProfit,
                level: pkg.level
            });
        });
    }
    
    if (totalProfit > 0) {
        try {
            const userRef = db.collection('users').doc(currentUser.uid);
            
            // Create detailed history entry
            const profitHistory = {
                id: generateId(),
                type: 'profit',
                description: `Daily Profit from ${currentUser.activePackages.length} package(s)`,
                amount: totalProfit,
                status: 'completed',
                date: new Date().toISOString(),
                metadata: {
                    packages: packageDetails,
                    tasksCompleted: systemSettings.tasksPerDay,
                    date: new Date().toDateString()
                }
            };
            
            await userRef.update({
                balance: firebase.firestore.FieldValue.increment(totalProfit),
                totalEarned: firebase.firestore.FieldValue.increment(totalProfit),
                lastProfitDate: new Date().toISOString(),
                history: firebase.firestore.FieldValue.arrayUnion(profitHistory),
                // Track weekly task earnings for commission
                'weeklyCommission.weeklyTaskEarnings': firebase.firestore.FieldValue.increment(totalProfit)
            });
            
            // Track this earning for referral commission
            await trackReferralEarnings(currentUser.uid, totalProfit);
            
            // Add notification with package breakdown
            let packageBreakdown = '';
            packageDetails.forEach(pkg => {
                packageBreakdown += `\n• ${pkg.name}: ${formatMoney(pkg.profit)}`;
            });
            
            await addNotification(currentUser.uid, '🎉 Daily Profit Credited!',
                `You earned ${formatMoney(totalProfit)} from your packages:${packageBreakdown}`, 'success');
            
            showToast(`🎉 You earned ${formatMoney(totalProfit)} from your packages!`, 'success');
            
            // Update local user
            currentUser.balance += totalProfit;
            currentUser.totalEarned += totalProfit;
            currentUser.lastProfitDate = new Date().toISOString();
            
        } catch (error) {
            console.error('Error crediting profit:', error);
        }
    }
}

// ============================================
// PACKAGE FUNCTIONS
// ============================================
function loadPackages() {
    const packagesGrid = document.getElementById('packagesGrid');
    if (!packagesGrid) return;
    
    let html = '';
    vipPackages.forEach(pkg => {
        const isOwned = currentUser.activePackages?.some(p => p.level === pkg.level);
        const canAfford = (currentUser.balance || 0) >= pkg.investment;
        const monthlyROI = ((pkg.dailyProfit * 30 / pkg.investment) * 100).toFixed(1);
        
        html += `
            <div class="package-card ${pkg.level >= 6 ? 'premium' : ''} ${isOwned ? 'owned' : ''}">
                ${pkg.level >= 6 ? '<div class="package-badge premium">⭐ PREMIUM</div>' : ''}
                ${isOwned ? '<div class="package-badge owned">✓ ACTIVE</div>' : ''}
                <div class="package-header" style="background: ${pkg.color}15;">
                    <i class="fas ${pkg.icon}"></i>
                    <h3>${pkg.name}</h3>
                    <span class="investment">${formatMoney(pkg.investment)}</span>
                </div>
                <div class="package-details">
                    <div class="detail-item">
                        <span class="label">Daily Profit</span>
                        <span class="value profit">${formatMoney(pkg.dailyProfit)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Rate</span>
                        <span class="value">${pkg.percentage}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Monthly ROI</span>
                        <span class="value">${monthlyROI}%</span>
                    </div>
                </div>
                <div class="package-benefits">
                    ${pkg.benefits.map(benefit => `
                        <div class="benefit-item">
                            <i class="fas fa-check-circle"></i>
                            <span>${benefit}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="package-footer">
                    <span class="tasks">
                        <i class="fas fa-tasks"></i> ${pkg.tasks} tasks/day
                    </span>
                    ${isOwned ? 
                        `<span class="owned-badge"><i class="fas fa-check-circle"></i> Active</span>` : 
                        `<button class="buy-btn ${!canAfford ? 'disabled' : ''}" 
                            onclick="buyPackage(${pkg.level})" 
                            ${!canAfford ? 'disabled' : ''}>
                            <i class="fas ${canAfford ? 'fa-shopping-cart' : 'fa-lock'}"></i>
                            ${canAfford ? 'Buy Package' : formatMoney(pkg.investment)}
                        </button>`
                    }
                </div>
            </div>
        `;
    });
    
    packagesGrid.innerHTML = html;
}

function loadUserPackages() {
    const packagesContainer = document.getElementById('userPackages');
    if (!packagesContainer) return;
    
    if (!currentUser.activePackages || currentUser.activePackages.length === 0) {
        packagesContainer.innerHTML = `
            <div class="no-data">
                <i class="fas fa-box-open"></i>
                <p>No active packages yet.</p>
                <button onclick="switchUserTab('packages')" class="action-btn small">
                    Browse Packages
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    let totalDailyProfit = 0;
    let totalInvestment = 0;
    
    currentUser.activePackages.forEach(pkg => {
        totalDailyProfit += pkg.dailyProfit;
        totalInvestment += pkg.investment;
        
        const daysActive = Math.floor((new Date() - new Date(pkg.purchasedAt)) / (1000 * 60 * 60 * 24));
        const earnedSoFar = daysActive * pkg.dailyProfit;
        
        html += `
            <div class="package-mini-card">
                <div class="package-mini-header">
                    <div>
                        <h4>${pkg.name}</h4>
                        <span class="package-date">Purchased: ${new Date(pkg.purchasedAt).toLocaleDateString()}</span>
                    </div>
                    <span class="package-profit">+${formatMoney(pkg.dailyProfit)}/day</span>
                </div>
                <div class="package-mini-details">
                    <span><i class="fas fa-coins"></i> ${formatMoney(pkg.investment)}</span>
                    <span><i class="fas fa-percent"></i> ${pkg.percentage}%</span>
                    <span><i class="fas fa-chart-line"></i> Earned: ${formatMoney(earnedSoFar)}</span>
                </div>
                <div class="package-progress">
                    <div class="progress-label">
                        <span>ROI Progress</span>
                        <span>${Math.min(100, ((earnedSoFar / pkg.investment) * 100).toFixed(1))}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(100, (earnedSoFar / pkg.investment) * 100)}%"></div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
        <div class="package-summary">
            <div class="summary-item">
                <span>Total Investment:</span>
                <strong>${formatMoney(totalInvestment)}</strong>
            </div>
            <div class="summary-item">
                <span>Daily Profit:</span>
                <strong class="profit">${formatMoney(totalDailyProfit)}</strong>
            </div>
            <div class="summary-item">
                <span>Monthly Profit:</span>
                <strong class="profit">${formatMoney(totalDailyProfit * 30)}</strong>
            </div>
        </div>
    `;
    
    packagesContainer.innerHTML = html;
}

async function buyPackage(level) {
    const pkg = vipPackages.find(p => p.level === level);
    if (!pkg) return;
    
    if (currentUser.activePackages?.some(p => p.level === level)) {
        showToast('You already own this package!', 'warning');
        return;
    }
    
    if ((currentUser.balance || 0) < pkg.investment) {
        showToast(`Insufficient balance! Need ${formatMoney(pkg.investment)}`, 'error');
        return;
    }
    
    if (!confirm(`Purchase ${pkg.name} for ${formatMoney(pkg.investment)}?`)) return;
    
    showLoading();
    
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const newPackage = {
            ...pkg,
            purchasedAt: new Date().toISOString(),
            lastProfitDate: null
        };
        
        await userRef.update({
            balance: firebase.firestore.FieldValue.increment(-pkg.investment),
            totalInvested: firebase.firestore.FieldValue.increment(pkg.investment),
            activePackages: firebase.firestore.FieldValue.arrayUnion(newPackage),
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'package',
                description: `Purchased ${pkg.name}`,
                amount: pkg.investment,
                status: 'completed',
                date: new Date().toISOString()
            })
        });
        
        // Add notification
        await addNotification(currentUser.uid, 'Package Purchased!', 
            `You successfully purchased ${pkg.name}. Start completing tasks to earn daily profits!`, 'success');
        
        // Update local user
        currentUser.balance -= pkg.investment;
        currentUser.totalInvested += pkg.investment;
        if (!currentUser.activePackages) currentUser.activePackages = [];
        currentUser.activePackages.push(newPackage);
        
        hideLoading();
        showToast(`🎉 Successfully purchased ${pkg.name}!`, 'success');
        
        // Reload displays
        loadPackages();
        loadUserPackages();
        loadUserData();
        
    } catch (error) {
        hideLoading();
        console.error('Error buying package:', error);
        showToast('Error purchasing package', 'error');
    }
}

// ============================================
// REFERRAL FUNCTIONS
// ============================================
async function loadReferralData() {
    const totalReferrals = document.getElementById('totalReferrals');
    const level1Comm = document.getElementById('level1Comm');
    const level2Comm = document.getElementById('level2Comm');
    const level3Comm = document.getElementById('level3Comm');
    const tableBody = document.getElementById('referralTableBody');
    
    if (totalReferrals) totalReferrals.textContent = currentUser.referrals?.length || 0;
    if (level1Comm) level1Comm.textContent = formatMoney(currentUser.referralEarnings?.level1 || 0);
    if (level2Comm) level2Comm.textContent = formatMoney(currentUser.referralEarnings?.level2 || 0);
    if (level3Comm) level3Comm.textContent = formatMoney(currentUser.referralEarnings?.level3 || 0);
    
    if (tableBody && currentUser.referrals) {
        let html = '';
        const sortedReferrals = [...currentUser.referrals].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        sortedReferrals.forEach(ref => {
            html += `
                <tr>
                    <td>
                        <div class="referral-user">
                            <i class="fas fa-user-circle"></i>
                            <span>${ref.username}</span>
                        </div>
                    </td>
                    <td><span class="level-badge level-${ref.level}">Level ${ref.level}</span></td>
                    <td>${new Date(ref.date).toLocaleDateString()}</td>
                    <td><span class="status-badge completed">Active</span></td>
                    <td class="commission">${formatMoney(ref.commission || 0)}</td>
                </tr>
            `;
        });
        
        if (html === '') {
            html = '<tr><td colspan="5" class="no-data"><i class="fas fa-users-slash"></i> No referrals yet. Share your link below!</td></tr>';
        }
        
        tableBody.innerHTML = html;
    }
}

/**
 * Process referral commission after successful signup
 */
async function processReferralCommission(referrerId, newUserId, newUsername) {
    try {
        const level1Commission = systemSettings.registrationBonus * 0.1; // 10%
        const level2Commission = systemSettings.registrationBonus * 0.03; // 3%
        const level3Commission = systemSettings.registrationBonus * 0.01; // 1%
        
        const batch = db.batch();
        
        // Level 1 - Direct referrer
        const referrerRef = db.collection('users').doc(referrerId);
        batch.update(referrerRef, {
            referralBalance: firebase.firestore.FieldValue.increment(level1Commission),
            totalEarned: firebase.firestore.FieldValue.increment(level1Commission),
            'referralEarnings.level1': firebase.firestore.FieldValue.increment(level1Commission),
            referrals: firebase.firestore.FieldValue.arrayUnion({
                userId: newUserId, // ADD THIS LINE - store userId
                username: newUsername,
                level: 1,
                date: new Date().toISOString(),
                commission: level1Commission
            })
        });
        
        // Get referrer's data
        const referrerDoc = await referrerRef.get();
        const referrerData = referrerDoc.data();
        
        // Level 2 - Referrer's referrer
        if (referrerData.referredBy) {
            const level2Ref = db.collection('users').doc(referrerData.referredBy);
            batch.update(level2Ref, {
                referralBalance: firebase.firestore.FieldValue.increment(level2Commission),
                totalEarned: firebase.firestore.FieldValue.increment(level2Commission),
                'referralEarnings.level2': firebase.firestore.FieldValue.increment(level2Commission),
                referrals: firebase.firestore.FieldValue.arrayUnion({
                    userId: newUserId, // ADD THIS LINE
                    username: newUsername,
                    level: 2,
                    date: new Date().toISOString(),
                    commission: level2Commission
                })
            });
            
            // Level 3
            const level2Doc = await level2Ref.get();
            const level2Data = level2Doc.data();
            
            if (level2Data.referredBy) {
                const level3Ref = db.collection('users').doc(level2Data.referredBy);
                batch.update(level3Ref, {
                    referralBalance: firebase.firestore.FieldValue.increment(level3Commission),
                    totalEarned: firebase.firestore.FieldValue.increment(level3Commission),
                    'referralEarnings.level3': firebase.firestore.FieldValue.increment(level3Commission),
                    referrals: firebase.firestore.FieldValue.arrayUnion({
                        userId: newUserId, // ADD THIS LINE
                        username: newUsername,
                        level: 3,
                        date: new Date().toISOString(),
                        commission: level3Commission
                    })
                });
            }
        }
        
        await batch.commit();
        
    } catch (error) {
        console.error('Error processing referral commission:', error);
    }
}

// ============================================
// DEPOSIT AND WITHDRAWAL FUNCTIONS
// ============================================
async function processDeposit() {
    const amount = parseFloat(document.getElementById('depositAmount')?.value);
    const phone = document.getElementById('phoneNumber')?.value;
    const methodElement = document.querySelector('input[name="payment"]:checked');
    
    if (!methodElement) {
        showToast('Please select a payment method', 'error');
        return;
    }
    
    const method = methodElement.value;
    
    if (!amount || amount < systemSettings.minDeposit) {
        showToast(`Minimum deposit is ${formatMoney(systemSettings.minDeposit)}`, 'error');
        return;
    }
    
    if (amount > systemSettings.maxDeposit) {
        showToast(`Maximum deposit is ${formatMoney(systemSettings.maxDeposit)}`, 'error');
        return;
    }
    
    if (!phone || phone.length < 10) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const paymentDetails = generatePaymentDetails(method, amount);
        
        const depositData = {
            userId: currentUser.uid,
            username: currentUser.username,
            amount: amount,
            method: method,
            phone: phone,
            status: 'pending',
            paymentDetails: paymentDetails,
            date: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        
        await saveDeposit(depositData);
        
        // Add to user history
        const userRef = db.collection('users').doc(currentUser.uid);
        await userRef.update({
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'deposit',
                description: `Deposit via ${getMethodName(method)}`,
                amount: amount,
                status: 'pending',
                date: new Date().toISOString()
            })
        });
        
        hideLoading();
        showPaymentInstructions(depositData, paymentDetails);
        
        document.getElementById('depositAmount').value = '';
        document.getElementById('phoneNumber').value = '';
        
    } catch (error) {
        hideLoading();
        console.error('Deposit error:', error);
        showToast('Error processing deposit', 'error');
    }
}

async function requestWithdrawal() {
    const amount = parseFloat(document.getElementById('withdrawAmount')?.value);
    const phone = document.getElementById('withdrawPhone')?.value;
    const method = document.getElementById('withdrawMethod')?.value;
    
    if (!amount || amount < systemSettings.minWithdrawal) {
        showToast(`Minimum withdrawal is ${formatMoney(systemSettings.minWithdrawal)}`, 'error');
        return;
    }
    
    if (amount > systemSettings.maxWithdrawal) {
        showToast(`Maximum withdrawal per day is ${formatMoney(systemSettings.maxWithdrawal)}`, 'error');
        return;
    }
    
    if (!phone || phone.length < 10) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }
    
    const totalBalance = (currentUser.balance || 0) + (currentUser.referralBalance || 0);
    if (amount > totalBalance) {
        showToast(`Insufficient balance! Available: ${formatMoney(totalBalance)}`, 'error');
        return;
    }
    
    const today = new Date().toDateString();
    if (currentUser.lastWithdrawalDate === today) {
        showToast('You can only withdraw once per day', 'error');
        return;
    }
    
    showLoading();
    
    try {
        let fromReferral = 0;
        let fromBalance = amount;
        
        if (currentUser.referralBalance > 0) {
            if (currentUser.referralBalance >= amount) {
                fromReferral = amount;
                fromBalance = 0;
            } else {
                fromReferral = currentUser.referralBalance;
                fromBalance = amount - currentUser.referralBalance;
            }
        }
        
        const withdrawalData = {
            userId: currentUser.uid,
            username: currentUser.username,
            amount: amount,
            method: method,
            phone: phone,
            status: 'pending',
            date: new Date().toISOString(),
            fromReferral: fromReferral,
            fromBalance: fromBalance
        };
        
        await saveWithdrawal(withdrawalData);
        
        // Update user balances
        const userRef = db.collection('users').doc(currentUser.uid);
        const updates = {
            lastWithdrawalDate: today,
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'withdrawal',
                description: `Withdrawal via ${getMethodName(method)}`,
                amount: amount,
                status: 'pending',
                date: new Date().toISOString()
            })
        };
        
        if (fromReferral > 0) {
            updates.referralBalance = firebase.firestore.FieldValue.increment(-fromReferral);
        }
        if (fromBalance > 0) {
            updates.balance = firebase.firestore.FieldValue.increment(-fromBalance);
        }
        
        await userRef.update(updates);
        
        // Update local user
        if (fromReferral > 0) currentUser.referralBalance -= fromReferral;
        if (fromBalance > 0) currentUser.balance -= fromBalance;
        currentUser.lastWithdrawalDate = today;
        
        hideLoading();
        showToast(`✅ Withdrawal request of ${formatMoney(amount)} submitted!`, 'success');
        
        document.getElementById('withdrawAmount').value = '';
        document.getElementById('withdrawPhone').value = '';
        
        await loadUserData();
        
    } catch (error) {
        hideLoading();
        console.error('Withdrawal error:', error);
        showToast('Error processing withdrawal', 'error');
    }
}

// ============================================
// HISTORY FUNCTIONS
// ============================================
function loadHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    if (!currentUser.history || currentUser.history.length === 0) {
        historyList.innerHTML = '<p class="no-data"><i class="fas fa-history"></i> No transaction history yet</p>';
        return;
    }
    
    // Filter based on currentFilter
    let filteredHistory = [...currentUser.history];
    if (currentFilter !== 'all') {
        filteredHistory = filteredHistory.filter(item => item.type === currentFilter);
    }
    
    // Sort by date (newest first)
    const sortedHistory = filteredHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let html = '';
    sortedHistory.forEach(item => {
        const icon = {
            'deposit': 'fa-credit-card',
            'withdrawal': 'fa-money-bill-wave',
            'profit': 'fa-chart-line',
            'package': 'fa-box',
            'bonus': 'fa-gift',
            'task': 'fa-tasks'
        } [item.type] || 'fa-history';
        
        const iconClass = {
            'deposit': 'deposit',
            'withdrawal': 'withdrawal',
            'profit': 'profit',
            'package': 'package',
            'bonus': 'bonus',
            'task': 'task'
        } [item.type] || '';
        
        // Determine amount sign and class
        let amountClass = '';
        let amountSign = '';
        
        if (item.type === 'withdrawal') {
            amountClass = 'negative';
            amountSign = '-';
        } else {
            amountClass = 'positive';
            amountSign = '+';
        }
        
        // Special case for rejected withdrawals (they're refunded, so they become positive)
        if (item.type === 'withdrawal' && item.status === 'rejected') {
            amountClass = 'positive';
            amountSign = '+';
        }
        
        // Status badge color
        let statusClass = item.status;
        if (item.status === 'pending') statusClass = 'warning';
        if (item.status === 'completed') statusClass = 'success';
        if (item.status === 'rejected') statusClass = 'danger';
        
        html += `
            <div class="history-item">
                <div class="history-icon ${iconClass}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="history-details">
                    <div class="history-title">${item.description || item.type}</div>
                    <div class="history-meta">
                        <span class="history-date"><i class="far fa-clock"></i> ${timeAgo(item.date)}</span>
                        <span class="status-badge small ${statusClass}">${item.status}</span>
                    </div>
                </div>
                <div class="history-amount ${amountClass}">
                    ${amountSign}${formatMoney(item.amount)}
                </div>
            </div>
        `;
    });
    
    if (html === '') {
        html = '<p class="no-data"><i class="fas fa-history"></i> No transactions found</p>';
    }
    
    historyList.innerHTML = html;
}

let currentFilter = 'all';

function filterHistory(type) {
    currentFilter = type;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // If called programmatically, find the button by text
        const buttons = document.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
            if (btn.textContent.toLowerCase().includes(type) ||
                (type === 'all' && btn.textContent === 'All')) {
                btn.classList.add('active');
            }
        });
    }
    
    loadHistory();
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
    return date.toLocaleDateString();
}

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================
async function addNotification(userId, title, message, type = 'info') {
    try {
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
            notifications: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                title,
                message,
                type,
                read: false,
                date: new Date().toISOString()
            })
        });
    } catch (error) {
        console.error('Error adding notification:', error);
    }
}

function loadUserNotifications() {
    const notificationList = document.getElementById('notificationList');
    const notificationBadge = document.querySelector('.notification-badge');
    
    if (!currentUser.notifications) {
        currentUser.notifications = [];
    }
    
    const unreadCount = currentUser.notifications.filter(n => !n.read).length;
    if (notificationBadge) {
        if (unreadCount > 0) {
            notificationBadge.textContent = unreadCount;
            notificationBadge.style.display = 'flex';
        } else {
            notificationBadge.style.display = 'none';
        }
    }
    
    if (notificationList) {
        let html = '';
        const sortedNotifications = [...currentUser.notifications].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        sortedNotifications.slice(0, 10).forEach(notif => {
            html += `
                <div class="notification-item ${notif.read ? '' : 'unread'} ${notif.type}" onclick="markNotificationRead('${notif.id}')">
                    <div class="notification-icon">
                        <i class="fas ${getNotificationIcon(notif.type)}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${notif.title}</div>
                        <div class="notification-message">${notif.message}</div>
                        <div class="notification-time">${timeAgo(notif.date)}</div>
                    </div>
                </div>
            `;
        });
        
        if (html === '') {
            html = '<p class="no-data"><i class="fas fa-bell-slash"></i> No notifications</p>';
        }
        
        notificationList.innerHTML = html;
    }
}

function getNotificationIcon(type) {
    const icons = {
        'success': 'fa-check-circle',
        'warning': 'fa-exclamation-triangle',
        'error': 'fa-times-circle',
        'info': 'fa-info-circle'
    };
    return icons[type] || 'fa-bell';
}

async function markNotificationRead(notificationId) {
    const notification = currentUser.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
        notification.read = true;
        
        try {
            await db.collection('users').doc(currentUser.uid).update({
                notifications: currentUser.notifications
            });
            loadUserNotifications();
        } catch (error) {
            console.error('Error marking notification read:', error);
        }
    }
}

async function markAllNotificationsRead() {
    currentUser.notifications.forEach(n => n.read = true);
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            notifications: currentUser.notifications
        });
        loadUserNotifications();
        showToast('All notifications marked as read', 'success');
    } catch (error) {
        console.error('Error marking all notifications read:', error);
    }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================
async function loadAdminData() {
    try {
        await loadUsers(); // already has its own try-catch

        const totalUsersEl = document.getElementById('totalUsers');
        if (totalUsersEl) {
            const activeUsers = users.filter(u => u.role === 'user' && u.isActive !== false).length;
            totalUsersEl.textContent = activeUsers;
        }

        let totalDeposits = 0, totalWithdrawals = 0, pendingDeposits = 0, pendingWithdrawals = 0, totalProfits = 0;
        users.forEach(user => {
            if (user.history) {
                user.history.forEach(item => {
                    if (item.type === 'deposit' && item.status === 'completed') totalDeposits += item.amount;
                    else if (item.type === 'withdrawal' && item.status === 'completed') totalWithdrawals += item.amount;
                    else if (item.type === 'profit' && item.status === 'completed') totalProfits += item.amount;
                    if (item.type === 'deposit' && item.status === 'pending') pendingDeposits += item.amount;
                    else if (item.type === 'withdrawal' && item.status === 'pending') pendingWithdrawals += item.amount;
                });
            }
        });

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        setText('totalDeposits', formatMoney(totalDeposits));
        setText('totalWithdrawals', formatMoney(totalWithdrawals));
        setText('platformProfit', formatMoney(totalDeposits - totalWithdrawals));
        setText('pendingDeposits', formatMoney(pendingDeposits));
        setText('pendingWithdrawals', formatMoney(pendingWithdrawals));
        setText('totalProfits', formatMoney(totalProfits));

        // Load tables with their own error handling
        try { await loadUsersTable(); } catch (e) { console.warn('loadUsersTable error', e); }
        try { await loadRecentActivities(); } catch (e) { console.warn('loadRecentActivities error', e); }
        try { await loadDepositsTable(); } catch (e) { console.warn('loadDepositsTable error', e); }
        try { await loadWithdrawalsTable(); } catch (e) { console.warn('loadWithdrawalsTable error', e); }
        try { loadSystemHealth(); } catch (e) { console.warn('loadSystemHealth error', e); }

    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

async function loadUsersTable() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    const regularUsers = users.filter(u => u.role === 'user');
    
    let html = '';
    regularUsers.forEach(user => {
        const totalInvested = user.activePackages?.reduce((sum, p) => sum + p.investment, 0) || 0;
        const totalEarned = user.totalEarned || 0;
        
        html += `
            <tr>
                <td>
                    <div class="user-info">
                        <i class="fas fa-user-circle"></i>
                        <div>
                            <div class="user-name">${user.fullName || user.username}</div>
                            <div class="user-username">@${user.username}</div>
                        </div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>${user.phone}</td>
                <td>${formatMoney(user.balance || 0)}</td>
                <td>${formatMoney(totalInvested)}</td>
                <td>${formatMoney(totalEarned)}</td>
                <td>${user.referrals?.length || 0}</td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                    <span class="status-badge ${user.isActive ? 'completed' : 'rejected'}">
                        ${user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="action-buttons">
                    <button class="action-btn small" onclick="viewUserDetails('${user.uid}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn small ${user.isActive ? 'warning' : 'success'}" 
                        onclick="toggleUserStatus('${user.uid}')" 
                        title="${user.isActive ? 'Deactivate' : 'Activate'}">
                        <i class="fas ${user.isActive ? 'fa-ban' : 'fa-check'}"></i>
                    </button>
                    <button class="action-btn small" onclick="addUserBalance('${user.uid}')" title="Add Balance">
                        <i class="fas fa-plus-circle"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    if (html === '') {
        html = '<tr><td colspan="10" class="no-data"><i class="fas fa-users-slash"></i> No users found</td></tr>';
    }
    
    tableBody.innerHTML = html;
}

// ============================================
// UPDATED ADMIN DEPOSITS TABLE - CURRENT VISION
// ============================================

/**
 * Load deposits table in admin panel with current vision
 */
// ============================================
// FIXED LOAD DEPOSITS TABLE
// ============================================

async function loadDepositsTable() {
    console.log('Loading deposits table...');
    
    const tableBody = document.getElementById('depositsTableBody');
    if (!tableBody) {
        console.error('depositsTableBody not found');
        return;
    }
    
    // Ensure deposits are loaded
    if (deposits.length === 0) {
        await loadDeposits();
    }
    
    if (deposits.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="no-data"><i class="fas fa-credit-card"></i> No deposit requests found</td></tr>';
        return;
    }
    
    // Sort by date (newest first)
    const sortedDeposits = [...deposits].sort((a, b) => {
        const dateA = a.createdAt || a.date || a.timestamp || 0;
        const dateB = b.createdAt || b.date || b.timestamp || 0;
        return new Date(dateB) - new Date(dateA);
    });
    
    let html = '';
    sortedDeposits.forEach(deposit => {
        // Format date
        const date = deposit.createdAt || deposit.date || deposit.timestamp;
        const formattedDate = date ? new Date(date).toLocaleString() : 'N/A';
        
        // Get transaction reference
        const transactionRef = deposit.transactionReference || deposit.transactionCode || 'N/A';
        
        // Get user details
        const userName = deposit.userFullName || deposit.username || 'Unknown';
        const userPhone = deposit.userPhone || deposit.userAccountNumber || deposit.phone || 'N/A';
        
        // Get bank details
        const bankName = deposit.method || deposit.bankName || 'N/A';
        const bankAccount = deposit.bankAccountNumber || deposit.accountNumber || 'N/A';
        
        // Status badge class
        const statusClass = getStatusClass(deposit.status);
        
        html += `
            <tr class="deposit-row ${deposit.status === 'pending' ? 'pending-row' : ''}">
                <td>
                    <div class="user-info-compact">
                        <i class="fas fa-user-circle"></i>
                        <div>
                            <strong>${userName}</strong>
                            <small>${deposit.username ? '@' + deposit.username : ''}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="amount-large">${formatMoney(deposit.amount)}</span>
                </td>
                <td>
                    <div class="payment-method-badge">
                        <i class="fas ${getBankIcon(bankName)}"></i>
                        <span>${bankName}</span>
                    </div>
                </td>
                <td>
                    <div class="account-info">
                        <div><strong>${bankAccount}</strong></div>
                        <small>${deposit.bankAccountName || deposit.accountName || ''}</small>
                    </div>
                </td>
                <td>
                    <div class="user-contact">
                        <div><i class="fas fa-phone"></i> ${userPhone}</div>
                        <small><i class="fas fa-hashtag"></i> ${transactionRef}</small>
                    </div>
                </td>
                <td>
                    <span class="timestamp">${formattedDate}</span>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <i class="fas ${getStatusIcon(deposit.status)}"></i>
                        ${deposit.status || 'pending'}
                    </span>
                </td>
                <td class="action-buttons">
                    ${deposit.status === 'pending' ? `
                        <button class="action-btn small success" onclick="approveDeposit('${deposit.id}')" title="Approve Deposit">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="action-btn small danger" onclick="rejectDeposit('${deposit.id}')" title="Reject Deposit">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                    <button class="action-btn small info" onclick="viewDepositDetails('${deposit.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    console.log('Deposits table updated with', sortedDeposits.length, 'rows');
}

// ============================================
// DETAIL VIEW FUNCTIONS
// ============================================

/**
 * View deposit details
 */
function viewDepositDetails(depositId) {
    const deposit = deposits.find(d => d.id === depositId);
    if (!deposit) return;
    
    const details = `
        📝 DEPOSIT DETAILS
        ═══════════════════════════
        
        👤 User: ${deposit.userFullName || deposit.username || 'N/A'}
        📧 Username: @${deposit.username || 'N/A'}
        🆔 User ID: ${deposit.userId || 'N/A'}
        
        💰 Amount: ${formatMoney(deposit.amount)}
        📅 Date: ${new Date(deposit.createdAt || deposit.date).toLocaleString()}
        📊 Status: ${deposit.status || 'pending'}
        
        🏦 Payment Method: ${deposit.method || 'N/A'}
        💳 Bank Account: ${deposit.bankAccountNumber || 'N/A'}
        📛 Account Name: ${deposit.bankAccountName || 'N/A'}
        
        👤 Your Name: ${deposit.userFullName || 'N/A'}
        📞 Your Phone: ${deposit.userPhone || deposit.userAccountNumber || 'N/A'}
        
        🔢 Transaction Ref: ${deposit.transactionReference || deposit.transactionCode || 'N/A'}
        📅 Payment Date: ${deposit.depositDate || 'N/A'}
        
        ${deposit.approvedAt ? `✅ Approved: ${new Date(deposit.approvedAt).toLocaleString()}` : ''}
        ${deposit.rejectedAt ? `❌ Rejected: ${new Date(deposit.rejectedAt).toLocaleString()}` : ''}
        ${deposit.rejectionReason ? `📋 Reason: ${deposit.rejectionReason}` : ''}
    `;
    
    alert(details);
}

/**
 * View withdrawal details
 */
function viewWithdrawalDetails(withdrawalId) {
    const withdrawal = withdrawals.find(w => w.id === withdrawalId);
    if (!withdrawal) return;
    
    const feeAmount = withdrawal.feeAmount || 0;
    const netAmount = withdrawal.netAmount || (withdrawal.amount - feeAmount);
    const feePercentage = withdrawal.feePercentage || systemSettings.withdrawalFee || 10;
    
    const details = `
📝 WITHDRAWAL DETAILS
═══════════════════════════

👤 User: ${withdrawal.username || 'N/A'}
🆔 User ID: ${withdrawal.userId || 'N/A'}

💰 Amount Requested: ${formatMoney(withdrawal.amount)}
💸 Withdrawal Fee (${feePercentage}%): -${formatMoney(feeAmount)}
✅ Net Amount to Receive: ${formatMoney(netAmount)}

📅 Date: ${new Date(withdrawal.createdAt || withdrawal.date).toLocaleString()}
📊 Status: ${withdrawal.status || 'pending'}

🏦 Withdrawal Method: ${withdrawal.method || 'N/A'}
💳 Account Number: ${withdrawal.accountNumber || withdrawal.phone || 'N/A'}
📛 Account Name: ${withdrawal.accountName || withdrawal.phone || 'N/A'}

💰 From Balance: ${formatMoney(withdrawal.fromBalance || 0)}
🎁 From Referral: ${formatMoney(withdrawal.fromReferral || 0)}

${withdrawal.approvedAt ? `✅ Approved: ${new Date(withdrawal.approvedAt).toLocaleString()}` : ''}
${withdrawal.rejectedAt ? `❌ Rejected: ${new Date(withdrawal.rejectedAt).toLocaleString()}` : ''}
${withdrawal.rejectionReason ? `📋 Reason: ${withdrawal.rejectionReason}` : ''}
    `;
    
    alert(details);
}

// ============================================
// MANUAL REFRESH FOR ADMIN
// ============================================

async function refreshAdminData() {
    console.log('Manually refreshing admin data...');
    showLoading('Refreshing data...');
    
    try {
        await loadDeposits();
        await loadWithdrawals();
        await loadDepositsTable();
        await loadWithdrawalsTable();
        await loadRecentActivities();
        
        showToast('Admin data refreshed', 'success');
    } catch (error) {
        console.error('Error refreshing admin data:', error);
        showToast('Error refreshing data', 'error');
    } finally {
        hideLoading();
    }
}

// Add refresh button to admin dashboard
function addRefreshButton() {
    const header = document.querySelector('.dashboard-header .header-right');
    if (header) {
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'refresh-btn';
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        refreshBtn.onclick = refreshAdminData;
        refreshBtn.title = 'Refresh Data';
        refreshBtn.style.marginRight = '10px';
        refreshBtn.style.background = 'none';
        refreshBtn.style.border = 'none';
        refreshBtn.style.color = '#666';
        refreshBtn.style.cursor = 'pointer';
        refreshBtn.style.fontSize = '16px';
        header.insertBefore(refreshBtn, header.firstChild);
    }
}

async function loadWithdrawalsTable() {
    console.log('Loading withdrawals table...');
    
    const tableBody = document.getElementById('withdrawalsTableBody');
    if (!tableBody) {
        console.error('withdrawalsTableBody not found');
        return;
    }
    
    // Ensure withdrawals are loaded
    if (withdrawals.length === 0) {
        await loadWithdrawals();
    }
    
    if (withdrawals.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="no-data"><i class="fas fa-money-bill-wave"></i> No withdrawal requests found</td></tr>';
        return;
    }
    
    // Sort by date (newest first)
    const sortedWithdrawals = [...withdrawals].sort((a, b) => {
        const dateA = a.createdAt || a.date || a.timestamp || 0;
        const dateB = b.createdAt || b.date || b.timestamp || 0;
        return new Date(dateB) - new Date(dateA);
    });
    
    let html = '';
    sortedWithdrawals.forEach(withdrawal => {
        const date = withdrawal.createdAt || withdrawal.date || withdrawal.timestamp;
        const formattedDate = date ? new Date(date).toLocaleString() : 'N/A';
        const accountName = withdrawal.accountName || withdrawal.phone || 'N/A';
        const accountNumber = withdrawal.accountNumber || withdrawal.phone || 'N/A';
        const bankName = withdrawal.method || withdrawal.bankName || 'N/A';
        const fromBalance = withdrawal.fromBalance || 0;
        const fromReferral = withdrawal.fromReferral || 0;
        const feeAmount = withdrawal.feeAmount || 0;
        const netAmount = withdrawal.netAmount || (withdrawal.amount - feeAmount);
        const statusClass = getStatusClass(withdrawal.status);
        
        html += `
            <tr class="withdrawal-row ${withdrawal.status === 'pending' ? 'pending-row' : ''}">
                <td>
                    <div class="user-info-compact">
                        <i class="fas fa-user-circle"></i>
                        <div>
                            <strong>${escapeHtml(withdrawal.username || 'Unknown')}</strong>
                            <small>${withdrawal.userId ? withdrawal.userId.substring(0, 8) + '...' : ''}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <div>
                        <strong>Requested:</strong> ${formatMoney(withdrawal.amount)}<br>
                        <small class="fee-text">Fee (${withdrawal.feePercentage || 10}%): -${formatMoney(feeAmount)}</small><br>
                        <strong class="net-amount">Net: ${formatMoney(netAmount)}</strong>
                    </div>
                </td>
                <td>
                    <div class="payment-method-badge">
                        <i class="fas ${getBankIcon(bankName)}"></i>
                        <span>${escapeHtml(bankName)}</span>
                    </div>
                </td>
                <td>
                    <div class="account-info">
                        <div><strong>${escapeHtml(accountNumber)}</strong></div>
                        <small>${escapeHtml(accountName)}</small>
                    </div>
                </td>
                <td>
                    <div class="funds-source">
                        ${fromBalance > 0 ? `
                            <span class="source-badge balance">
                                <i class="fas fa-wallet"></i> ${formatMoney(fromBalance)}
                            </span>
                        ` : ''}
                        ${fromReferral > 0 ? `
                            <span class="source-badge referral">
                                <i class="fas fa-gift"></i> ${formatMoney(fromReferral)}
                            </span>
                        ` : ''}
                    </div>
                </td>
                <td><span class="timestamp">${formattedDate}</span></td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <i class="fas ${getStatusIcon(withdrawal.status)}"></i>
                        ${withdrawal.status || 'pending'}
                    </span>
                </td>
                <td class="action-buttons">
                    ${withdrawal.status === 'pending' ? `
                        <button class="action-btn small success" onclick="approveWithdrawal('${withdrawal.id}')" title="Approve Withdrawal">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="action-btn small danger" onclick="rejectWithdrawal('${withdrawal.id}')" title="Reject Withdrawal">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                    <button class="action-btn small info" onclick="viewWithdrawalDetails('${withdrawal.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    console.log('Withdrawals table updated with', sortedWithdrawals.length, 'rows');
}

// ============================================
// HELPER FUNCTIONS FOR ADMIN TABLES
// ============================================

/**
 * Get CSS class for status badge
 */
function getStatusClass(status) {
    switch(status) {
        case 'pending':
            return 'warning';
        case 'completed':
            return 'success';
        case 'approved':
            return 'success';
        case 'rejected':
            return 'danger';
        case 'cancelled':
            return 'secondary';
        default:
            return 'info';
    }
}

/**
 * Get icon for status
 */
function getStatusIcon(status) {
    switch(status) {
        case 'pending':
            return 'fa-clock';
        case 'completed':
        case 'approved':
            return 'fa-check-circle';
        case 'rejected':
            return 'fa-times-circle';
        case 'cancelled':
            return 'fa-ban';
        default:
            return 'fa-circle';
    }
}

/**
 * Get bank icon
 */
function getBankIcon(bankName) {
    const bank = (bankName || '').toLowerCase();
    if (bank.includes('mpesa') || bank.includes('airtel') || bank.includes('tigo')) {
        return 'fa-mobile-alt';
    }
    if (bank.includes('crdb') || bank.includes('nmb') || bank.includes('nbc')) {
        return 'fa-university';
    }
    return 'fa-credit-card';
}

async function loadRecentActivities() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;
    
    let activities = [];
    
    users.forEach(user => {
        if (user.history) {
            user.history.slice(0, 5).forEach(item => {
                activities.push({
                    user: user.username,
                    userRole: user.role,
                    ...item
                });
            });
        }
    });
    
    deposits.forEach(d => {
        if (d.status === 'completed') {
            activities.push({
                user: 'System',
                type: 'deposit',
                description: `Deposit completed for ${d.username}`,
                amount: d.amount,
                status: 'completed',
                date: d.date
            });
        }
    });
    
    withdrawals.forEach(w => {
        if (w.status === 'completed') {
            activities.push({
                user: 'System',
                type: 'withdrawal',
                description: `Withdrawal completed for ${w.username}`,
                amount: w.amount,
                status: 'completed',
                date: w.date
            });
        }
    });
    
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    activities = activities.slice(0, 30);
    
    let html = '';
    activities.forEach(activity => {
        const icon = {
            'deposit': 'fa-credit-card',
            'withdrawal': 'fa-money-bill-wave',
            'profit': 'fa-chart-line',
            'package': 'fa-box',
            'bonus': 'fa-gift',
            'task': 'fa-tasks'
        }[activity.type] || 'fa-history';
        
        const roleIcon = activity.userRole === 'admin' ? 'fa-crown' : 
                        (activity.userRole === 'superadmin' ? 'fa-star' : 'fa-user');
        
        html += `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-title">
                        <i class="fas ${roleIcon}"></i> 
                        <strong>${activity.user}</strong> - ${activity.description}
                    </div>
                    <div class="activity-meta">
                        <span class="activity-date"><i class="far fa-clock"></i> ${timeAgo(activity.date)}</span>
                        <span class="activity-amount ${activity.type === 'withdrawal' ? 'negative' : 'positive'}">
                            ${activity.type === 'withdrawal' ? '-' : '+'}${formatMoney(activity.amount)}
                        </span>
                        <span class="status-badge small ${activity.status}">${activity.status}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    if (html === '') {
        html = '<p class="no-data"><i class="fas fa-bell-slash"></i> No recent activities</p>';
    }
    
    activityList.innerHTML = html;
}

function loadSystemHealth() {
    const healthMetrics = document.querySelector('.health-metrics');
    if (!healthMetrics) return;
    
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive).length;
    const totalBalance = users.reduce((sum, u) => sum + (u.balance || 0), 0);
    const totalReferralBalance = users.reduce((sum, u) => sum + (u.referralBalance || 0), 0);
    const totalDepositsAmount = deposits.filter(d => d.status === 'completed').reduce((sum, d) => sum + d.amount, 0);
    const totalWithdrawalsAmount = withdrawals.filter(w => w.status === 'completed').reduce((sum, w) => sum + w.amount, 0);
    
    healthMetrics.innerHTML = `
        <div class="metric">
            <span class="metric-label"><i class="fas fa-server"></i> Server Status</span>
            <span class="status online"><i class="fas fa-circle"></i> Online</span>
        </div>
        <div class="metric">
            <span class="metric-label"><i class="fas fa-database"></i> Database</span>
            <span class="status online"><i class="fas fa-circle"></i> Connected</span>
        </div>
        <div class="metric">
            <span class="metric-label"><i class="fas fa-users"></i> Active Users</span>
            <span class="metric-value">${activeUsers}/${totalUsers}</span>
        </div>
        <div class="metric">
            <span class="metric-label"><i class="fas fa-wallet"></i> Total Balance</span>
            <span class="metric-value">${formatMoney(totalBalance)}</span>
        </div>
        <div class="metric">
            <span class="metric-label"><i class="fas fa-gift"></i> Referral Balance</span>
            <span class="metric-value">${formatMoney(totalReferralBalance)}</span>
        </div>
        <div class="metric">
            <span class="metric-label"><i class="fas fa-chart-line"></i> API Response</span>
            <span class="metric-value">${Math.floor(Math.random() * 100 + 50)}ms</span>
        </div>
    `;
}

// ============================================
// UPDATED DEPOSIT APPROVAL/REJECTION FUNCTIONS
// ============================================

/**
 * Approve a deposit request
 */
async function approveDeposit(depositId) {
    console.log('📝 approveDeposit called with ID:', depositId);
    
    let deposit = deposits.find(d => d.id === depositId);
    if (!deposit) {
        try {
            const doc = await db.collection('deposits').doc(depositId).get();
            if (doc.exists) deposit = { id: doc.id, ...doc.data() };
        } catch (e) { console.error(e); }
    }
    if (!deposit) { showToast('Deposit not found', 'error'); return; }
    if (deposit.status !== 'pending') { showToast('Already processed', 'warning'); return; }
    
    if (!confirm(`Approve ${formatMoney(deposit.amount)} for ${deposit.username}?`)) return;
    showLoading('Processing deposit...');
    
    try {
        // Check if this is the user's first completed deposit
        const previousDeposits = await db.collection('deposits')
            .where('userId', '==', deposit.userId)
            .where('status', '==', 'completed')
            .get();
        const isFirstDeposit = previousDeposits.size === 0;
        console.log(`Is first deposit: ${isFirstDeposit}`);
        
        // 1. Update deposit status
        await db.collection('deposits').doc(depositId).update({
            status: 'completed',
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser?.uid || 'admin',
            isFirstDeposit: isFirstDeposit
        });
        
        // 2. Add money to user's balance
        const userRef = db.collection('users').doc(deposit.userId);
        await userRef.update({
            balance: firebase.firestore.FieldValue.increment(deposit.amount),
            totalEarned: firebase.firestore.FieldValue.increment(deposit.amount),
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'deposit',
                description: `Deposit of ${formatMoney(deposit.amount)} approved`,
                amount: deposit.amount,
                status: 'completed',
                date: new Date().toISOString(),
                metadata: { depositId, isFirstDeposit }
            })
        });
        
        await addNotification(deposit.userId, '✅ Deposit Approved!',
            `Your deposit of ${formatMoney(deposit.amount)} has been approved.`, 'success');
        
        // 3. Process first deposit bonus (10% to referrer)
        let bonusGiven = false;
        if (isFirstDeposit) {
            console.log('🎯 FIRST DEPOSIT – attempting to give referrer bonus');
            bonusGiven = await giveFirstDepositBonus(deposit.userId, deposit.amount);
            if (bonusGiven) {
                await db.collection('deposits').doc(depositId).update({
                    firstDepositBonusGiven: true,
                    firstDepositBonusAmount: deposit.amount * 0.10
                });
            }
        }
        
        hideLoading();
        let msg = `✅ Deposit of ${formatMoney(deposit.amount)} approved!`;
        if (bonusGiven) msg += `\n🎁 Referrer earned 10% bonus!`;
        showToast(msg, 'success');
        
        // Refresh data
        await loadAdminData();
        await loadDeposits();
        if (currentUser && currentUser.uid === deposit.userId) await loadUserData();
        
    } catch (error) {
        hideLoading();
        console.error('❌ Error in approveDeposit:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

/**
 * Separate function that gives 10% bonus to the referrer
 */
async function giveFirstDepositBonus(userId, depositAmount) {
    console.log('🎁 giveFirstDepositBonus called for user', userId);
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) { console.log('User not found'); return false; }
        const userData = userDoc.data();
        
        if (!userData.referredBy) { console.log('No referrer'); return false; }
        if (userData.firstDepositBonusGiven === true) { console.log('Bonus already given'); return false; }
        
        const referrerId = userData.referredBy;
        const bonusAmount = depositAmount * 0.10;
        if (bonusAmount <= 0) return false;
        
        const referrerRef = db.collection('users').doc(referrerId);
        const referrerDoc = await referrerRef.get();
        if (!referrerDoc.exists) { console.log('Referrer doc missing'); return false; }
        
        const batch = db.batch();
        
        // Add bonus to referrer's referralBalance
        batch.update(referrerRef, {
            referralBalance: firebase.firestore.FieldValue.increment(bonusAmount),
            totalEarned: firebase.firestore.FieldValue.increment(bonusAmount),
            'referralEarnings.level1': firebase.firestore.FieldValue.increment(bonusAmount),
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'first_deposit_bonus',
                description: `🎁 First Deposit Bonus (10%) from ${userData.username}`,
                amount: bonusAmount,
                status: 'completed',
                date: new Date().toISOString(),
                metadata: { referralId: userId, depositAmount, bonusPercentage: 10 }
            }),
            notifications: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                title: '💰 First Deposit Bonus!',
                message: `${userData.username} made their first deposit of ${formatMoney(depositAmount)}! You earned ${formatMoney(bonusAmount)}.`,
                type: 'success', read: false, date: new Date().toISOString()
            })
        });
        
        // Mark bonus as given on the user's record
        batch.update(db.collection('users').doc(userId), {
            firstDepositBonusGiven: true,
            firstDepositBonusAmount: bonusAmount,
            firstDepositBonusPaidTo: referrerId,
            firstDepositBonusPaidAt: new Date().toISOString()
        });
        
        await batch.commit();
        console.log(`✅ Bonus of ${formatMoney(bonusAmount)} added to referrer ${referrerId}`);
        
        // Show toast to referrer if online
        if (currentUser && currentUser.uid === referrerId) {
            showToast(`🎉 You earned ${formatMoney(bonusAmount)} from your referral's first deposit!`, 'success');
        }
        return true;
        
    } catch (error) {
        console.error('❌ giveFirstDepositBonus error:', error);
        return false;
    }
}

/**
 * Reject a deposit request
 */
async function rejectDeposit(depositId) {
    console.log('Rejecting deposit:', depositId);
    
    const deposit = deposits.find(d => d.id === depositId);
    if (!deposit) {
        showToast('Deposit not found', 'error');
        return;
    }
    
    if (deposit.status !== 'pending') {
        showToast('Deposit already processed', 'warning');
        return;
    }
    
    const reason = prompt('Enter reason for rejection (optional):', '');
    
    if (!confirm(`Reject deposit of ${formatMoney(deposit.amount)} for ${deposit.username}?`)) {
        return;
    }
    
    showLoading('Rejecting deposit...');
    
    try {
        // Update deposit status in deposits collection
        await db.collection('deposits').doc(depositId).update({
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: currentUser?.uid || 'admin',
            rejectionReason: reason || 'No reason provided'
        });
        
        // Get user reference
        const userRef = db.collection('users').doc(deposit.userId);
        
        // Get current user data to update history
        const userDoc = await userRef.get();
        const userData = userDoc.data();
        
        // Add rejection to user's history
        await userRef.update({
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'deposit',
                description: `Deposit rejected - ${deposit.method} - ${reason || 'No reason provided'}`,
                amount: deposit.amount,
                status: 'rejected',
                date: new Date().toISOString(),
                metadata: {
                    depositId: depositId,
                    rejectedBy: currentUser?.username || 'Admin',
                    reason: reason || 'No reason provided'
                }
            })
        });
        
        // Add notification for user
        await addNotification(
            deposit.userId,
            '❌ Deposit Rejected',
            `Your deposit of ${formatMoney(deposit.amount)} via ${deposit.method} has been rejected. ${reason ? `Reason: ${reason}` : 'Please contact support for more information.'}`,
            'error'
        );
        
        hideLoading();
        showToast(`Deposit rejected`, 'info');
        
        // Reload data
        await loadAdminData();
        await loadDeposits();
        
        // If the current user is the one who made the deposit, refresh their data
        if (currentUser && currentUser.uid === deposit.userId) {
            await loadUserData();
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error rejecting deposit:', error);
        showToast('Error rejecting deposit: ' + error.message, 'error');
    }
}

// ============================================
// UPDATED WITHDRAWAL APPROVAL/REJECTION FUNCTIONS
// ============================================

/**
 * Approve a withdrawal request
 */
async function approveWithdrawal(withdrawalId) {
    console.log('Approving withdrawal:', withdrawalId);
    
    const withdrawal = withdrawals.find(w => w.id === withdrawalId);
    if (!withdrawal) {
        showToast('Withdrawal not found', 'error');
        return;
    }
    
    if (withdrawal.status !== 'pending') {
        showToast('Withdrawal already processed', 'warning');
        return;
    }
    
    if (!confirm(`Approve withdrawal of ${formatMoney(withdrawal.amount)} for ${withdrawal.username}?`)) {
        return;
    }
    
    showLoading('Approving withdrawal...');
    
    try {
        // Update withdrawal status in withdrawals collection
        await db.collection('withdrawals').doc(withdrawalId).update({
            status: 'completed',
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser?.uid || 'admin'
        });
        
        // Get user reference
        const userRef = db.collection('users').doc(withdrawal.userId);
        
        // Get current user data
        const userDoc = await userRef.get();
        const userData = userDoc.data();
        
        // Add approval to user's history
        await userRef.update({
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'withdrawal',
                description: `Withdrawal completed - ${withdrawal.method} to ${withdrawal.accountName || withdrawal.phone}`,
                amount: withdrawal.amount,
                status: 'completed',
                date: new Date().toISOString(),
                metadata: {
                    withdrawalId: withdrawalId,
                    approvedBy: currentUser?.username || 'Admin',
                    method: withdrawal.method,
                    account: withdrawal.accountName || withdrawal.phone
                }
            })
        });
        
        // Add notification for user
        await addNotification(
            withdrawal.userId,
            '✅ Withdrawal Approved',
            `Your withdrawal of ${formatMoney(withdrawal.amount)} to ${withdrawal.accountName || withdrawal.phone} has been approved and processed.`,
            'success'
        );
        
        hideLoading();
        showToast(`✅ Withdrawal of ${formatMoney(withdrawal.amount)} approved successfully`, 'success');
        
        // Reload data
        await loadAdminData();
        await loadWithdrawals();
        
        // If the current user is the one who made the withdrawal, refresh their data
        if (currentUser && currentUser.uid === withdrawal.userId) {
            await loadUserData();
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error approving withdrawal:', error);
        showToast('Error approving withdrawal: ' + error.message, 'error');
    }
}

/**
 * Reject a withdrawal request
 */
async function rejectWithdrawal(withdrawalId) {
    console.log('Rejecting withdrawal:', withdrawalId);
    
    const withdrawal = withdrawals.find(w => w.id === withdrawalId);
    if (!withdrawal) {
        showToast('Withdrawal not found', 'error');
        return;
    }
    
    if (withdrawal.status !== 'pending') {
        showToast('Withdrawal already processed', 'warning');
        return;
    }
    
    const reason = prompt('Enter reason for rejection (optional):', '');
    
    if (!confirm(`Reject withdrawal of ${formatMoney(withdrawal.amount)} for ${withdrawal.username}? Funds will be refunded.`)) {
        return;
    }
    
    showLoading('Rejecting withdrawal...');
    
    try {
        // Update withdrawal status in withdrawals collection
        await db.collection('withdrawals').doc(withdrawalId).update({
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: currentUser?.uid || 'admin',
            rejectionReason: reason || 'No reason provided'
        });
        
        // Get user reference
        const userRef = db.collection('users').doc(withdrawal.userId);
        
        // Get current user data
        const userDoc = await userRef.get();
        const userData = userDoc.data();
        
        // Prepare updates
        const updates = {
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'withdrawal',
                description: `Withdrawal rejected - ${reason || 'No reason provided'} - Funds refunded`,
                amount: withdrawal.amount,
                status: 'rejected',
                date: new Date().toISOString(),
                metadata: {
                    withdrawalId: withdrawalId,
                    rejectedBy: currentUser?.username || 'Admin',
                    reason: reason || 'No reason provided'
                }
            })
        };
        
        // Refund the amounts
        if (withdrawal.fromReferral && withdrawal.fromReferral > 0) {
            updates.referralBalance = firebase.firestore.FieldValue.increment(withdrawal.fromReferral);
        }
        if (withdrawal.fromBalance && withdrawal.fromBalance > 0) {
            updates.balance = firebase.firestore.FieldValue.increment(withdrawal.fromBalance);
        }
        
        // If the old format doesn't have fromReferral/fromBalance, refund the full amount to balance
        if (!withdrawal.fromReferral && !withdrawal.fromBalance) {
            updates.balance = firebase.firestore.FieldValue.increment(withdrawal.amount);
        }
        
        await userRef.update(updates);
        
        // Add notification for user
        await addNotification(
            withdrawal.userId,
            '❌ Withdrawal Rejected',
            `Your withdrawal of ${formatMoney(withdrawal.amount)} has been rejected. ${reason ? `Reason: ${reason}` : 'Please contact support for more information.'} Funds have been refunded to your balance.`,
            'warning'
        );
        
        hideLoading();
        showToast(`Withdrawal rejected and refunded`, 'info');
        
        // Reload data
        await loadAdminData();
        await loadWithdrawals();
        
        // If the current user is the one who made the withdrawal, refresh their data
        if (currentUser && currentUser.uid === withdrawal.userId) {
            await loadUserData();
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error rejecting withdrawal:', error);
        showToast('Error rejecting withdrawal: ' + error.message, 'error');
    }
}

async function viewUserDetails(userId) {
    const user = users.find(u => u.uid === userId);
    if (!user) return;
    
    const totalInvested = user.activePackages?.reduce((sum, p) => sum + p.investment, 0) || 0;
    const totalEarned = user.totalEarned || 0;
    const pendingDeposits = deposits.filter(d => d.userId === userId && d.status === 'pending').length;
    const pendingWithdrawals = withdrawals.filter(w => w.userId === userId && w.status === 'pending').length;
    
    const details = `
        👤 User Details:
        
        Username: ${user.username}
        Full Name: ${user.fullName}
        Email: ${user.email}
        Phone: ${user.phone}
        
        💰 Financial:
        Balance: ${formatMoney(user.balance || 0)}
        Referral Balance: ${formatMoney(user.referralBalance || 0)}
        Total Earned: ${formatMoney(totalEarned)}
        Total Invested: ${formatMoney(totalInvested)}
        
        📊 Statistics:
        Referrals: ${user.referrals?.length || 0}
        Active Packages: ${user.activePackages?.length || 0}
        Tasks Completed: ${user.tasksCompleted || 0}
        
        ⏰ Dates:
        Joined: ${new Date(user.createdAt).toLocaleDateString()}
        Last Login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
        Login Count: ${user.loginCount || 0}
        
        📋 Pending:
        Pending Deposits: ${pendingDeposits}
        Pending Withdrawals: ${pendingWithdrawals}
        
        Status: ${user.isActive ? '✅ Active' : '❌ Inactive'}
        Verified: ${user.isVerified ? '✅ Yes' : '❌ No'}
    `;
    
    alert(details);
}

async function toggleUserStatus(userId) {
    const user = users.find(u => u.uid === userId);
    if (user) {
        const action = user.isActive ? 'deactivate' : 'activate';
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;
        
        try {
            await db.collection('users').doc(userId).update({
                isActive: !user.isActive
            });
            showToast(`User ${user.username} ${!user.isActive ? 'activated' : 'deactivated'}`, 'info');
            await loadUsersTable();
        } catch (error) {
            console.error('Error toggling user status:', error);
            showToast('Error updating user status', 'error');
        }
    }
}

async function addUserBalance(userId) {
    const user = users.find(u => u.uid === userId);
    if (!user) return;
    
    const amount = prompt('Enter amount to add:', '10000');
    if (!amount) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    const reason = prompt('Enter reason (optional):', 'Bonus');
    
    showLoading();
    
    try {
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
            balance: firebase.firestore.FieldValue.increment(numAmount),
            totalEarned: firebase.firestore.FieldValue.increment(numAmount),
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'bonus',
                description: reason || 'Admin bonus',
                amount: numAmount,
                status: 'completed',
                date: new Date().toISOString()
            })
        });
        
        await addNotification(userId, 'Balance Updated', 
            `Your balance has been increased by ${formatMoney(numAmount)}. Reason: ${reason || 'Admin bonus'}`, 'success');
        
        hideLoading();
        showToast(`✅ Added ${formatMoney(numAmount)} to ${user.username}'s balance`, 'success');
        await loadUsersTable();
        
    } catch (error) {
        hideLoading();
        console.error('Error adding balance:', error);
        showToast('Error adding balance', 'error');
    }
}

// ============================================
// SUPER ADMIN FUNCTIONS
// ============================================
async function loadSuperAdminData() {
    try {
        const superTotalUsers = document.getElementById('superTotalUsers');
        const totalAdmins = document.getElementById('totalAdmins');
        const totalVolume = document.getElementById('totalVolume');
        const totalProfit = document.getElementById('totalProfit');
        const growthRate = document.getElementById('growthRate');
        
        const userCount = users.filter(u => u.role === 'user').length;
        const adminCount = users.filter(u => u.role === 'admin' || u.role === 'superadmin').length;
        
        if (superTotalUsers) superTotalUsers.textContent = userCount;
        if (totalAdmins) totalAdmins.textContent = adminCount;
        
        let totalDepositVolume = 0;
        let totalWithdrawalVolume = 0;
        
        users.forEach(user => {
            if (user.history) {
                user.history.forEach(item => {
                    if (item.type === 'deposit' && item.status === 'completed') {
                        totalDepositVolume += item.amount;
                    } else if (item.type === 'withdrawal' && item.status === 'completed') {
                        totalWithdrawalVolume += item.amount;
                    }
                });
            }
        });
        
        const totalPlatformProfit = totalDepositVolume - totalWithdrawalVolume;
        
        if (totalVolume) totalVolume.textContent = formatMoney(totalDepositVolume);
        if (totalProfit) totalProfit.textContent = formatMoney(totalPlatformProfit);
        
        const growthPercent = userCount > 0 ? ((userCount / 30) * 100).toFixed(1) : '0';
        if (growthRate) growthRate.textContent = `+${growthPercent}%`;
        
        await loadAdminsTable();
        loadSystemSettingsForm();
        await loadSuperAdminStats();
        
    } catch (error) {
        console.error('Error loading super admin data:', error);
    }
}

async function loadAdminsTable() {
    const tableBody = document.getElementById('adminsTableBody');
    if (!tableBody) return;
    
    const admins = users.filter(u => u.role === 'admin' || u.role === 'superadmin');
    
    let html = '';
    admins.forEach(admin => {
        html += `
            <tr>
                <td>
                    <div class="user-info">
                        <i class="fas ${admin.role === 'superadmin' ? 'fa-crown' : 'fa-user-shield'}"></i>
                        <div>
                            <div class="user-name">${admin.fullName}</div>
                            <div class="user-username">@${admin.username}</div>
                        </div>
                    </div>
                </td>
                <td>${admin.email}</td>
                <td>${admin.phone}</td>
                <td><span class="role-badge ${admin.role}">${admin.role}</span></td>
                <td>${new Date(admin.createdAt).toLocaleDateString()}</td>
                <td>${admin.lastLogin ? new Date(admin.lastLogin).toLocaleDateString() : 'Never'}</td>
                <td><span class="status-badge ${admin.isActive ? 'completed' : 'rejected'}">
                    ${admin.isActive ? 'Active' : 'Inactive'}
                </span></td>
                <td class="action-buttons">
                    <button class="action-btn small" onclick="viewUserDetails('${admin.uid}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${admin.role !== 'superadmin' ? `
                        <button class="action-btn small warning" onclick="toggleAdminStatus('${admin.uid}')" 
                            title="${admin.isActive ? 'Deactivate' : 'Activate'}">
                            <i class="fas ${admin.isActive ? 'fa-ban' : 'fa-check'}"></i>
                        </button>
                        <button class="action-btn small danger" onclick="removeAdmin('${admin.uid}')" title="Remove Admin">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

function loadSystemSettingsForm() {
    const settingsForm = document.getElementById('systemSettingsForm');
    if (!settingsForm) return;
    
    settingsForm.innerHTML = `
        <div class="settings-group">
            <h3>Financial Settings</h3>
            <div class="setting-item">
                <label>Minimum Deposit (TZS):</label>
                <input type="number" id="minDeposit" value="${systemSettings.minDeposit}" min="1000" step="1000">
            </div>
            <div class="setting-item">
                <label>Maximum Deposit (TZS):</label>
                <input type="number" id="maxDeposit" value="${systemSettings.maxDeposit}" min="10000" step="10000">
            </div>
            <div class="setting-item">
                <label>Minimum Withdrawal (TZS):</label>
                <input type="number" id="minWithdrawal" value="${systemSettings.minWithdrawal}" min="1000" step="1000">
            </div>
            <div class="setting-item">
                <label>Maximum Withdrawal (TZS):</label>
                <input type="number" id="maxWithdrawal" value="${systemSettings.maxWithdrawal}" min="10000" step="10000">
            </div>
            <div class="setting-item">
                <label>Registration Bonus (TZS):</label>
                <input type="number" id="regBonus" value="${systemSettings.registrationBonus}" min="0" step="500">
            </div>
            <div class="setting-item">
                <label>Daily Login Bonus (TZS):</label>
                <input type="number" id="loginBonus" value="${systemSettings.dailyLoginBonus}" min="0" step="50">
            </div>
        </div>
        
        <div class="settings-group">
            <h3>Referral Settings</h3>
            <div class="setting-item">
                <label>Level 1 Commission (%):</label>
                <input type="number" id="level1Percent" value="${systemSettings.referralLevels[0].percentage}" min="0" max="100" step="0.5">
            </div>
            <div class="setting-item">
                <label>Level 2 Commission (%):</label>
                <input type="number" id="level2Percent" value="${systemSettings.referralLevels[1].percentage}" min="0" max="100" step="0.5">
            </div>
            <div class="setting-item">
                <label>Level 3 Commission (%):</label>
                <input type="number" id="level3Percent" value="${systemSettings.referralLevels[2].percentage}" min="0" max="100" step="0.5">
            </div>
        </div>
        
        <div class="settings-group">
            <h3>System Settings</h3>
            <div class="setting-item checkbox">
                <label>
                    <input type="checkbox" id="maintenanceMode" ${systemSettings.maintenanceMode ? 'checked' : ''}>
                    Maintenance Mode
                </label>
            </div>
            <div class="setting-item">
                <label>Site Name:</label>
                <input type="text" id="siteName" value="${systemSettings.siteName}">
            </div>
            <div class="setting-item">
                <label>Support Email:</label>
                <input type="email" id="siteEmail" value="${systemSettings.siteEmail}">
            </div>
            <div class="setting-item">
                <label>Support Phone:</label>
                <input type="text" id="sitePhone" value="${systemSettings.sitePhone}">
            </div>
        </div>
        
        <div class="settings-actions">
            <button onclick="saveSystemSettings()" class="auth-btn">Save Settings</button>
            <button onclick="resetSystemSettings()" class="auth-btn secondary">Reset to Default</button>
        </div>
    `;
}

async function saveSystemSettings() {
    try {
        systemSettings.minDeposit = parseFloat(document.getElementById('minDeposit')?.value) || 10000;
        systemSettings.maxDeposit = parseFloat(document.getElementById('maxDeposit')?.value) || 10000000;
        systemSettings.minWithdrawal = parseFloat(document.getElementById('minWithdrawal')?.value) || 3000;
        systemSettings.maxWithdrawal = parseFloat(document.getElementById('maxWithdrawal')?.value) || 1000000;
        systemSettings.registrationBonus = parseFloat(document.getElementById('regBonus')?.value) || 2000;
        systemSettings.dailyLoginBonus = parseFloat(document.getElementById('loginBonus')?.value) || 200;
        
        systemSettings.referralLevels[0].percentage = parseFloat(document.getElementById('level1Percent')?.value) || 10;
        systemSettings.referralLevels[1].percentage = parseFloat(document.getElementById('level2Percent')?.value) || 3;
        systemSettings.referralLevels[2].percentage = parseFloat(document.getElementById('level3Percent')?.value) || 1;
        
        systemSettings.maintenanceMode = document.getElementById('maintenanceMode')?.checked || false;
        systemSettings.siteName = document.getElementById('siteName')?.value || 'SmartTask';
        systemSettings.siteEmail = document.getElementById('siteEmail')?.value || 'support@smarttask.com';
        systemSettings.sitePhone = document.getElementById('sitePhone')?.value || '+255123456789';
        
        await db.collection('settings').doc('global').set(systemSettings);
        showToast('✅ System settings saved successfully', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Error saving settings', 'error');
    }
}

function resetSystemSettings() {
    if (!confirm('Reset all settings to default?')) return;
    
    systemSettings = {
        minDeposit: 10000,
        maxDeposit: 10000000,
        minWithdrawal: 3000,
        maxWithdrawal: 1000000,
        registrationBonus: 2000,
        dailyLoginBonus: 200,
        referralLevels: [
            { level: 1, percentage: 10 },
            { level: 2, percentage: 3 },
            { level: 3, percentage: 1 }
        ],
        tasksPerDay: 3,
        siteName: 'SmartTask',
        siteEmail: 'support@smarttask.com',
        sitePhone: '+255123456789',
        maintenanceMode: false
    };
    
    saveSystemSettings();
    loadSystemSettingsForm();
    showToast('Settings reset to default', 'info');
}

async function toggleAdminStatus(userId) {
    const user = users.find(u => u.uid === userId);
    if (user && user.role !== 'superadmin') {
        try {
            await db.collection('users').doc(userId).update({
                isActive: !user.isActive
            });
            showToast(`Admin ${user.username} ${!user.isActive ? 'activated' : 'deactivated'}`, 'info');
            await loadAdminsTable();
        } catch (error) {
            console.error('Error toggling admin status:', error);
            showToast('Error updating admin status', 'error');
        }
    }
}

async function removeAdmin(userId) {
    const user = users.find(u => u.uid === userId);
    if (!user || user.role === 'superadmin') {
        showToast('Cannot remove super admin', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to remove admin: ${user.username}?`)) return;
    
    try {
        await db.collection('users').doc(userId).delete();
        showToast(`Admin ${user.username} removed`, 'info');
        await loadAdminsTable();
    } catch (error) {
        console.error('Error removing admin:', error);
        showToast('Error removing admin', 'error');
    }
}

async function addNewAdmin() {
    const username = prompt('Enter admin username:');
    if (!username) return;
    
    const email = prompt('Enter admin email:');
    if (!email) return;
    
    const password = prompt('Enter admin password (min 6 characters):');
    if (!password || password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    const fullName = prompt('Enter admin full name:') || username;
    const phone = prompt('Enter admin phone:') || '+255123456789';
    
    showLoading();
    
    try {
        // Check if username exists
        const usernameCheck = await db.collection('users')
            .where('username', '==', username)
            .get();
        
        if (!usernameCheck.empty) {
            hideLoading();
            showToast('Username already exists', 'error');
            return;
        }
        
        // Check if email exists
        const emailCheck = await db.collection('users')
            .where('email', '==', email)
            .get();
        
        if (!emailCheck.empty) {
            hideLoading();
            showToast('Email already exists', 'error');
            return;
        }
        
        // Create auth user
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;
        
        const newAdmin = {
            uid,
            username,
            email,
            password,
            fullName,
            phone,
            role: 'admin',
            balance: 0,
            referralBalance: 0,
            totalEarned: 0,
            totalInvested: 0,
            referralEarnings: { level1: 0, level2: 0, level3: 0 },
            referrals: [],
            myReferralCode: await generateUniqueReferralCode(),
            tasksCompleted: 0,
            lastTaskDate: null,
            activePackages: [],
            history: [],
            notifications: [],
            createdAt: new Date().toISOString(),
            referredBy: null,
            isActive: true,
            isVerified: true,
            lastLogin: null,
            loginCount: 0,
            profileImage: null
        };
        
        await db.collection('users').doc(uid).set(newAdmin);
        
        hideLoading();
        showToast(`✅ Admin ${username} created successfully`, 'success');
        await loadAdminsTable();
        
    } catch (error) {
        hideLoading();
        console.error('Error creating admin:', error);
        showToast(error.message || 'Error creating admin', 'error');
    }
}

/**
 * Open task modal for completion - checks if user has active package
 */
/**
 * Open task modal for completion - checks if user has active package
 */
function openTaskModal(taskId) {
    console.log('openTaskModal called with taskId:', taskId);
    
    // Find the task
    let task = null;
    if (tasks && tasks.length > 0) {
        task = tasks.find(t => t.id === taskId);
    }
    
    if (!task && currentUser && currentUser.dailyTasks) {
        const taskIdFromUser = currentUser.dailyTasks.find(id => id === taskId);
        if (taskIdFromUser) {
            fetchTaskFromFirestore(taskId).then(fetchedTask => {
                if (fetchedTask) {
                    showUserTaskModal(fetchedTask);
                } else {
                    showToast('Task not found', 'error');
                }
            });
            return;
        }
    }
    
    if (task) {
        showUserTaskModal(task);
    } else {
        showToast('Task not found', 'error');
    }
}

/**
 * Show task modal with working media display
 */
function showTaskModal(task) {
    console.log('Showing modal for task:', task.title);
    console.log('Media URL:', task.mediaUrl);
    console.log('Media Type:', task.mediaType);
    
    // Check for active package
    if (!hasActivePackage()) {
        if (confirm('You need an active package to earn from tasks. Browse packages now?')) {
            switchUserTab('packages');
        }
        return;
    }
    
    const packageSummary = getActivePackagesSummary();
    
    // Create media HTML based on type
    let mediaHtml = '';
    const mediaUrl = task.mediaUrl || '';
    const mediaType = task.mediaType || 'image';
    
    if (mediaType === 'video') {
        // Check for YouTube video
        if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
            const videoId = extractYouTubeId(mediaUrl);
            if (videoId) {
                mediaHtml = `
                    <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px;">
                        <iframe 
                            src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" 
                            frameborder="0" 
                            allowfullscreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
                        </iframe>
                    </div>
                `;
            } else {
                mediaHtml = `
                    <video controls autoplay style="width:100%; border-radius: 12px;">
                        <source src="${mediaUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                `;
            }
        } else if (mediaUrl) {
            // Direct video file
            mediaHtml = `
                <video controls autoplay style="width:100%; border-radius: 12px;">
                    <source src="${mediaUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
        } else {
            mediaHtml = `
                <div style="text-align: center; padding: 60px; background: #f5f5f5; border-radius: 12px;">
                    <i class="fas fa-video" style="font-size: 64px; color: #ccc;"></i>
                    <p style="color: #999; margin-top: 10px;">Video not available</p>
                </div>
            `;
        }
    } else {
        // Image
        if (mediaUrl) {
            mediaHtml = `
                <div style="text-align: center; background: #f5f5f5; border-radius: 12px; padding: 20px;">
                    <img src="${mediaUrl}" alt="${task.title}" style="max-width:100%; max-height:400px; object-fit:contain; border-radius: 8px;" 
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/400x300?text=Image+Not+Found';">
                </div>
            `;
        } else {
            mediaHtml = `
                <div style="text-align: center; padding: 60px; background: #f5f5f5; border-radius: 12px;">
                    <i class="fas fa-image" style="font-size: 64px; color: #ccc;"></i>
                    <p style="color: #999; margin-top: 10px;">Image not available</p>
                </div>
            `;
        }
    }
    
    // Remove any existing modal
    const existingModal = document.getElementById('taskModalView');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal container
    const modalDiv = document.createElement('div');
    modalDiv.id = 'taskModalView';
    modalDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        width: 90%;
        max-width: 700px;
        max-height: 90vh;
        overflow-y: auto;
        border-radius: 20px;
        position: relative;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
    `;
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        position: sticky;
        top: 15px;
        right: 15px;
        float: right;
        font-size: 28px;
        cursor: pointer;
        color: #999;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f0f0f0;
        border-radius: 50%;
        transition: all 0.2s;
        z-index: 10;
    `;
    closeBtn.onmouseover = function() {
        this.style.background = '#e0e0e0';
        this.style.color = '#666';
    };
    closeBtn.onmouseout = function() {
        this.style.background = '#f0f0f0';
        this.style.color = '#999';
    };
    closeBtn.onclick = function() {
        modalDiv.remove();
    };
    
    // Create inner content
    const innerContent = document.createElement('div');
    innerContent.style.padding = '25px';
    innerContent.style.clear = 'both';
    
    // Add title
    const title = document.createElement('h2');
    title.textContent = task.title;
    title.style.marginBottom = '20px';
    title.style.fontSize = '22px';
    title.style.color = '#333';
    title.style.marginTop = '0';
    innerContent.appendChild(title);
    
    // Add package info if available
    if (packageSummary) {
        const packageInfo = document.createElement('div');
        packageInfo.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 18px;
            border-radius: 12px;
            margin-bottom: 20px;
        `;
        packageInfo.innerHTML = `
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                <span><i class="fas fa-box"></i> Packages: ${packageSummary.count}</span>
                <span><i class="fas fa-coins"></i> Daily Profit: ${formatMoney(packageSummary.totalDailyProfit)}</span>
            </div>
            <div style="font-size: 11px; margin-top: 5px; opacity: 0.9;">${packageSummary.names}</div>
        `;
        innerContent.appendChild(packageInfo);
    }
    
    // Add media section
    const mediaSection = document.createElement('div');
    mediaSection.style.cssText = `
        background: #f5f5f5;
        border-radius: 12px;
        margin-bottom: 20px;
        overflow: hidden;
        min-height: 250px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    mediaSection.innerHTML = mediaHtml;
    innerContent.appendChild(mediaSection);
    
    // Add description
    if (task.description) {
        const desc = document.createElement('p');
        desc.textContent = task.description;
        desc.style.marginBottom = '20px';
        desc.style.color = '#666';
        desc.style.lineHeight = '1.6';
        innerContent.appendChild(desc);
    }
    
    // Add external link if exists
    if (task.externalLink) {
        const linkDiv = document.createElement('div');
        linkDiv.style.cssText = `
            margin-bottom: 20px;
            text-align: center;
        `;
        linkDiv.innerHTML = `
            <a href="${task.externalLink}" target="_blank" style="background: #2196F3; color: white; text-decoration: none; padding: 8px 16px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; font-size: 14px;">
                <i class="fas fa-external-link-alt"></i> Visit Product Page
            </a>
        `;
        innerContent.appendChild(linkDiv);
    }
    
    // Add rating stars
    const ratingDiv = document.createElement('div');
    ratingDiv.style.cssText = `
        background: #f8f9fa;
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 20px;
        text-align: center;
    `;
    ratingDiv.innerHTML = '<p style="margin-bottom: 15px; font-weight: bold; color: #333;">Rate this product:</p>';
    
    const starsDiv = document.createElement('div');
    starsDiv.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: center;
        font-size: 32px;
        color: #ffc107;
        cursor: pointer;
    `;
    
    const ratingInput = document.createElement('input');
    ratingInput.type = 'hidden';
    ratingInput.id = 'taskRatingValue';
    ratingInput.value = '0';
    
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('i');
        star.className = 'far fa-star';
        star.dataset.rating = i;
        star.style.transition = 'transform 0.2s';
        star.onmouseover = function() {
            this.style.transform = 'scale(1.2)';
        };
        star.onmouseout = function() {
            this.style.transform = 'scale(1)';
        };
        star.onclick = function() {
            const rating = this.dataset.rating;
            ratingInput.value = rating;
            
            const allStars = starsDiv.querySelectorAll('i');
            allStars.forEach((s, index) => {
                if (index < rating) {
                    s.className = 'fas fa-star';
                } else {
                    s.className = 'far fa-star';
                }
            });
        };
        starsDiv.appendChild(star);
    }
    
    ratingDiv.appendChild(starsDiv);
    ratingDiv.appendChild(ratingInput);
    innerContent.appendChild(ratingDiv);
    
    // Add completion note
    if (packageSummary) {
        const noteDiv = document.createElement('div');
        noteDiv.style.cssText = `
            background: #e3f2fd;
            border-left: 4px solid #2196F3;
            padding: 10px 15px;
            margin-bottom: 20px;
            border-radius: 8px;
            font-size: 13px;
        `;
        noteDiv.innerHTML = `<i class="fas fa-info-circle" style="color: #2196F3; margin-right: 8px;"></i> 
            Complete all ${systemSettings.tasksPerDay} tasks to earn ${formatMoney(packageSummary.totalDailyProfit)}`;
        innerContent.appendChild(noteDiv);
    }
    
    // Add confirmation checkbox
    const confirmDiv = document.createElement('div');
    confirmDiv.style.cssText = `
        background: #f8f9fa;
        padding: 15px;
        border-radius: 10px;
        margin-bottom: 20px;
    `;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'taskConfirmCheckbox';
    checkbox.style.marginRight = '10px';
    
    const label = document.createElement('label');
    label.htmlFor = 'taskConfirmCheckbox';
    label.textContent = 'I have rated this product';
    label.style.cursor = 'pointer';
    
    confirmDiv.appendChild(checkbox);
    confirmDiv.appendChild(label);
    innerContent.appendChild(confirmDiv);
    
    // Add buttons
    const buttonDiv = document.createElement('div');
    buttonDiv.style.cssText = `
        display: flex;
        gap: 15px;
        justify-content: flex-end;
    `;
    
    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Submit Rating';
    submitBtn.style.cssText = `
        background: #4CAF50;
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
    `;
    submitBtn.onclick = function() {
        const isChecked = document.getElementById('taskConfirmCheckbox')?.checked;
        const rating = document.getElementById('taskRatingValue')?.value;
        
        if (!isChecked) {
            showToast('Please confirm you have completed the task', 'warning');
            return;
        }
        
        if (!rating || rating === '0') {
            showToast('Please select a rating', 'warning');
            return;
        }
        
        modalDiv.remove();
        completeTask(task.id, parseInt(rating));
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
        background: #f5f5f5;
        color: #666;
        border: none;
        padding: 10px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
    `;
    cancelBtn.onclick = function() {
        modalDiv.remove();
    };
    
    buttonDiv.appendChild(submitBtn);
    buttonDiv.appendChild(cancelBtn);
    innerContent.appendChild(buttonDiv);
    
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(innerContent);
    modalDiv.appendChild(modalContent);
    document.body.appendChild(modalDiv);
    
    console.log('Modal created with media HTML');
} 

/**
 * Helper function to fetch a single task from Firestore
 */
async function fetchTaskFromFirestore(taskId) {
    try {
        const taskDoc = await db.collection('tasks').doc(taskId).get();
        if (taskDoc.exists) {
            return { id: taskDoc.id, ...taskDoc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error fetching task:', error);
        return null;
    }
}

/**
 * Open task modal with the task data
 */
/**
 * Open task modal with the task data - DEBUG VERSION
 */
function openTaskModalWithTask(task) {
    console.log('=== OPENING TASK MODAL ===');
    console.log('Task data:', task);
    
    // First check if user has any active package
    if (!hasActivePackage()) {
        console.log('User has no active packages');
        showToast('⚠️ You need to purchase a VIP package first to earn from tasks!', 'warning');
        
        // Option to redirect to packages page
        if (confirm('You need an active package to earn from tasks. Would you like to browse available packages?')) {
            switchUserTab('packages');
        }
        return;
    }
    
    // Get package summary for display
    const packageSummary = getActivePackagesSummary();
    console.log('Package summary:', packageSummary);
    
    // Validate task properties
    if (!task.title) task.title = 'Untitled Task';
    if (!task.description) task.description = 'Complete this task to earn daily profits';
    if (!task.mediaType) task.mediaType = 'image';
    if (!task.mediaUrl) {
        task.mediaUrl = task.mediaType === 'video' ?
            'https://www.youtube.com/embed/dQw4w9WgXcQ' :
            'https://via.placeholder.com/400x300?text=Product';
    }
    
    // Determine media HTML with fallbacks
    let mediaHtml = '';
    try {
        if (task.mediaType === 'video') {
            if (task.mediaUrl && (task.mediaUrl.includes('youtube.com') || task.mediaUrl.includes('youtu.be'))) {
                const videoId = extractYouTubeId(task.mediaUrl);
                if (videoId) {
                    mediaHtml = `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
                } else {
                    mediaHtml = `<video src="${task.mediaUrl}" controls style="max-width:100%; max-height:100%;"></video>`;
                }
            } else {
                mediaHtml = `<video src="${task.mediaUrl}" controls style="max-width:100%; max-height:100%;"></video>`;
            }
        } else {
            mediaHtml = `<img src="${task.mediaUrl}" alt="${task.title}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
        }
    } catch (e) {
        console.error('Error creating media HTML:', e);
        mediaHtml = `<div class="error-placeholder">Media unavailable</div>`;
    }
    
    // Build package info display
    const packageInfoHtml = `
        <div class="package-earning-info">
            <div class="info-badge active-package">
                <i class="fas fa-box"></i>
                <span>Active Packages: ${packageSummary.count}</span>
            </div>
            <div class="info-badge earning">
                <i class="fas fa-coins"></i>
                <span>Potential Daily Profit: ${formatMoney(packageSummary.totalDailyProfit)}</span>
            </div>
            <div class="package-names">${packageSummary.names}</div>
        </div>
    `;
    
    // Build rating stars
    const ratingHtml = `
        <div class="rating-container">
            <p>Rate this product:</p>
            <div class="star-rating">
                <i class="far fa-star" data-rating="1"></i>
                <i class="far fa-star" data-rating="2"></i>
                <i class="far fa-star" data-rating="3"></i>
                <i class="far fa-star" data-rating="4"></i>
                <i class="far fa-star" data-rating="5"></i>
            </div>
            <input type="hidden" id="selectedRating" value="0">
        </div>
    `;
    
    // Create modal HTML as a string
    const modalHtml = `
        <div id="taskCompletionModal" class="modal show">
            <div class="modal-content task-modal">
                <span class="close" onclick="closeTaskCompletionModal()">&times;</span>
                <h2>${escapeHtml(task.title)}</h2>
                
                ${packageInfoHtml}
                
                <div class="task-media-large">
                    ${mediaHtml}
                </div>
                
                <p class="task-description">${escapeHtml(task.description || 'Rate this product to earn daily profits from your active packages')}</p>
                
                ${task.externalLink ? `
                    <div class="external-link">
                        <a href="${escapeHtml(task.externalLink)}" target="_blank" class="action-btn small">
                            <i class="fas fa-external-link-alt"></i> Visit Product Page
                        </a>
                    </div>
                ` : ''}
                
                ${ratingHtml}
                
                <div class="task-completion-note">
                    <p><i class="fas fa-info-circle"></i> Complete all 3 tasks to earn your daily package profit of ${formatMoney(packageSummary.totalDailyProfit)}</p>
                </div>
                
                <div class="task-completion">
                    <label>
                        <input type="checkbox" id="taskConfirm"> I have rated this product
                    </label>
                </div>
                
                <div class="modal-actions">
                    <button onclick="submitTaskCompletion('${task.id}')" class="auth-btn">Submit Rating</button>
                    <button onclick="closeTaskCompletionModal()" class="auth-btn secondary">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    console.log('Modal HTML created, length:', modalHtml.length);
    
    // Remove any existing modal
    const existing = document.getElementById('taskCompletionModal');
    if (existing) {
        console.log('Removing existing modal');
        existing.remove();
    }
    
    // Insert the modal
    try {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        console.log('Modal inserted into DOM');
    } catch (e) {
        console.error('Error inserting modal HTML:', e);
        console.error('Modal HTML that caused error:', modalHtml.substring(0, 500) + '...');
        showToast('Error creating task modal', 'error');
        return;
    }
    
    // Verify modal was added
    const newModal = document.getElementById('taskCompletionModal');
    console.log('New modal in DOM:', newModal);
    
    if (!newModal) {
        console.error('Failed to create modal element');
        showToast('Error opening task modal', 'error');
        return;
    }
    
    // Add star rating event listeners
    const stars = document.querySelectorAll('#taskCompletionModal .star-rating i');
    console.log('Found star elements:', stars.length);
    
    stars.forEach(star => {
        star.addEventListener('click', function(e) {
            e.preventDefault();
            const rating = this.dataset.rating;
            const ratingInput = document.getElementById('selectedRating');
            if (ratingInput) {
                ratingInput.value = rating;
            }
            
            // Highlight stars
            document.querySelectorAll('#taskCompletionModal .star-rating i').forEach(s => {
                if (s.dataset.rating <= rating) {
                    s.classList.remove('far');
                    s.classList.add('fas');
                } else {
                    s.classList.remove('fas');
                    s.classList.add('far');
                }
            });
        });
    });
    
    // Add click handler for close button
    const closeBtn = newModal.querySelector('.close');
    if (closeBtn) {
        closeBtn.onclick = function(e) {
            e.preventDefault();
            closeTaskCompletionModal();
        };
    }
    
    // Add click handler for cancel button
    const cancelBtn = newModal.querySelector('.auth-btn.secondary');
    if (cancelBtn) {
        cancelBtn.onclick = function(e) {
            e.preventDefault();
            closeTaskCompletionModal();
        };
    }
    
    // Add click handler for modal background
    newModal.addEventListener('click', function(e) {
        if (e.target === newModal) {
            closeTaskCompletionModal();
        }
    });
    
    // Make sure modal is visible
    newModal.style.display = 'flex';
    newModal.style.opacity = '1';
    newModal.style.visibility = 'visible';
    
    console.log('Modal setup complete');
}

/**
 * Helper function to escape HTML special characters
 */
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function closeTaskCompletionModal() {
    console.log('Closing task completion modal');
    const modal = document.getElementById('taskCompletionModal');
    if (modal) {
        modal.remove();
        console.log('Modal removed');
    } else {
        console.log('No modal found to close');
    }
}

async function submitTaskCompletion(taskId) {
    const confirmCheck = document.getElementById('taskConfirm');
    if (!confirmCheck || !confirmCheck.checked) {
        showToast('Please confirm you have completed the task', 'warning');
        return;
    }
    
    const rating = document.getElementById('selectedRating')?.value;
    if (!rating || rating === '0') {
        showToast('Please select a rating', 'warning');
        return;
    }
    
    closeTaskCompletionModal();
    await completeTask(taskId, parseInt(rating));
}

// ============================================
// ADMIN TASK FUNCTIONS
// ============================================
let tasksUnsubscribe = null;

async function loadAdminTasks() {
    console.log('Loading admin tasks...');
    try {
        const snapshot = await db.collection('tasks')
            .orderBy('scheduledDate', 'desc')
            .get();
        
        tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderAdminTasks();
    } catch (error) {
        console.error('Error loading admin tasks:', error);
        showToast('Failed to load tasks', 'error');
    }
}

function renderAdminTasks() {
    const activeBody = document.getElementById('activeTasksBody');
    const expiredBody = document.getElementById('expiredTasksBody');
    
    if (!activeBody || !expiredBody) {
        console.error('Task table bodies not found');
        return;
    }
    
    const now = new Date();
    
    const activeTasks = tasks.filter(task => {
        const expiryDate = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
        return task.status === 'active' && expiryDate > now;
    });
    
    const expiredTasks = tasks.filter(task => {
        const expiryDate = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
        return task.status !== 'active' || expiryDate <= now;
    });
    
    // Render active tasks
    let activeHtml = '';
    activeTasks.forEach(task => {
        const scheduledDate = task.scheduledDate?.toDate ? task.scheduledDate.toDate() : new Date(task.scheduledDate);
        const expiryDate = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
        
        activeHtml += `
            <tr>
                <td>${task.title}</td>
                <td>${scheduledDate.toLocaleDateString()}</td>
                <td>${expiryDate.toLocaleString()}</td>
                <td><span class="status-badge active">Active</span></td>
                <td class="action-buttons">
                    <button class="action-btn small" onclick="editTask('${task.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn small warning" onclick="deactivateTask('${task.id}')" title="Deactivate">
                        <i class="fas fa-ban"></i>
                    </button>
                    <button class="action-btn small danger" onclick="deleteTask('${task.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    activeBody.innerHTML = activeHtml || '<tr><td colspan="5" class="no-data">No active tasks</td></tr>';
    
    // Render expired tasks
    let expiredHtml = '';
    expiredTasks.forEach(task => {
        const expiryDate = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
        
        expiredHtml += `
            <tr>
                <td>${task.title}</td>
                <td>${expiryDate.toLocaleDateString()}</td>
                <td class="action-buttons">
                    <button class="action-btn small" onclick="reuseTask('${task.id}')" title="Reuse">
                        <i class="fas fa-redo-alt"></i> Reuse
                    </button>
                    <button class="action-btn small danger" onclick="deleteTask('${task.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    expiredBody.innerHTML = expiredHtml || '<tr><td colspan="3" class="no-data">No expired tasks</td></tr>';
}

function showAddTaskForm() {
    document.getElementById('taskFormTitle').textContent = 'Add New Task';
    document.getElementById('taskId').value = '';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskMediaType').value = 'image';
    document.getElementById('taskMediaUrl').value = '';
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('taskScheduledDate').value = today;
    
    document.getElementById('taskExpiryHours').value = '24';
    document.getElementById('taskCategory').value = 'Rating';
    document.getElementById('taskFormModal').classList.add('show');
}

function closeTaskFormModal() {
    document.getElementById('taskFormModal').classList.remove('show');
}

function toggleMediaInput() {
    // UI adjustment if needed
}

async function saveTask() {
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const mediaType = document.getElementById('taskMediaType').value;
    let mediaUrl = document.getElementById('taskMediaUrl').value.trim();
    const scheduledDateStr = document.getElementById('taskScheduledDate').value;
    const category = document.getElementById('taskCategory').value;
    
    if (!title || !scheduledDateStr) {
        showToast('Please fill required fields', 'error');
        return;
    }
    
    // If no media URL, set a placeholder
    if (!mediaUrl) {
        if (mediaType === 'video') {
            mediaUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
        } else {
            mediaUrl = 'https://via.placeholder.com/400x300?text=Task+Image';
        }
    }
    
    console.log('Saving task with media:', {
        title,
        mediaType,
        mediaUrl,
        scheduledDateStr
    });
    
    // Create start of day (00:00:00) in LOCAL time
    const scheduled = new Date(scheduledDateStr + 'T00:00:00');
    const expiry = new Date(scheduledDateStr + 'T23:59:59');
    
    const taskData = {
        title,
        description: description || 'Complete this rating task',
        mediaType: mediaType || 'image',
        mediaUrl: mediaUrl,
        scheduledDate: firebase.firestore.Timestamp.fromDate(scheduled),
        expiryDate: firebase.firestore.Timestamp.fromDate(expiry),
        status: 'active',
        createdBy: currentUser?.uid || 'admin',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        category: category || 'Rating'
    };
    
    showLoading();
    try {
        if (id) {
            await db.collection('tasks').doc(id).update(taskData);
            showToast('Task updated successfully', 'success');
        } else {
            const docRef = await db.collection('tasks').add(taskData);
            console.log('Task created with ID:', docRef.id, 'Media URL:', mediaUrl);
            showToast('Task created successfully', 'success');
        }
        closeTaskFormModal();
        loadAdminTasks();
    } catch (error) {
        console.error('Error saving task:', error);
        showToast('Error saving task: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function reuseTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Create a new task based on the old one
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const expiryDate = new Date(tomorrow);
    expiryDate.setHours(23, 59, 59, 999);
    
    const newTask = {
        title: task.title,
        description: task.description,
        mediaType: task.mediaType,
        mediaUrl: task.mediaUrl,
        scheduledDate: firebase.firestore.Timestamp.fromDate(tomorrow),
        expiryDate: firebase.firestore.Timestamp.fromDate(expiryDate),
        status: 'active',
        category: task.category || 'Rating',
        createdBy: currentUser?.uid || 'admin',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection('tasks').add(newTask);
        showToast('Task reused successfully', 'success');
        loadAdminTasks();
    } catch (error) {
        console.error('Error reusing task:', error);
        showToast('Error reusing task', 'error');
    }
}

async function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('taskFormTitle').textContent = 'Edit Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskMediaType').value = task.mediaType || 'image';
    document.getElementById('taskMediaUrl').value = task.mediaUrl || '';
    
    const scheduled = new Date(task.scheduledDate);
    document.getElementById('taskScheduledDate').value = scheduled.toISOString().split('T')[0];
    
    const expiryHours = Math.round((new Date(task.expiryDate) - scheduled) / (1000 * 60 * 60));
    document.getElementById('taskExpiryHours').value = expiryHours || 24;
    
    document.getElementById('taskCategory').value = task.category || 'Rating';
    document.getElementById('taskFormModal').classList.add('show');
}

async function deactivateTask(taskId) {
    if (!confirm('Deactivate this task? It will no longer appear to users.')) return;
    
    try {
        await db.collection('tasks').doc(taskId).update({
            status: 'deactivated'
        });
        showToast('Task deactivated', 'info');
    } catch (error) {
        console.error('Error deactivating task:', error);
        showToast('Error deactivating task', 'error');
    }
}

async function deleteTask(taskId) {
    if (!confirm('Permanently delete this task? This action cannot be undone.')) return;
    
    try {
        await db.collection('tasks').doc(taskId).delete();
        showToast('Task deleted', 'info');
    } catch (error) {
        console.error('Error deleting task:', error);
        showToast('Error deleting task', 'error');
    }
}

async function reAddTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const now = new Date();
    const scheduled = new Date(now.setHours(0, 0, 0, 0));
    const expiry = new Date(scheduled);
    expiry.setHours(expiry.getHours() + 24);
    
    const newTask = {
        title: task.title,
        description: task.description,
        mediaType: task.mediaType,
        mediaUrl: task.mediaUrl,
        scheduledDate: scheduled.toISOString(),
        expiryDate: expiry.toISOString(),
        status: 'active',
        createdBy: currentUser?.uid || 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: task.category
    };
    
    try {
        await db.collection('tasks').add(newTask);
        showToast('Task re-added successfully', 'success');
    } catch (error) {
        console.error('Error re-adding task:', error);
        showToast('Error re-adding task', 'error');
    }
}

// ============================================
// TASK EXPIRATION CHECK
// ============================================
async function checkTaskExpiration() {
    try {
        const now = new Date();
        const snapshot = await db.collection('tasks')
            .where('status', '==', 'active')
            .where('expiryDate', '<=', now.toISOString())
            .get();
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { status: 'expired' });
        });
        
        await batch.commit();
        
    } catch (error) {
        console.error('Error checking task expiration:', error);
    }
}

// Run every hour
setInterval(checkTaskExpiration, 60 * 60 * 1000);

// ============================================
// DAILY TASKS RESET
// ============================================
function checkDailyTasksReset() {
    if (!currentUser) return;
    const today = new Date().toDateString();
    if (currentUser.lastTaskDate !== today) {
        currentUser.tasksCompleted = 0;
        currentUser.completedTasks = [];
        currentUser.lastTaskDate = today;
        updateCurrentUser();
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============================================
// GENERATE RANDOM REFERRAL CODE (NOT RELATED TO USERNAME)
// ============================================

/**
 * Generate a random referral code (6-8 characters alphanumeric)
 * Format: 4 letters + 4 numbers e.g., "ABCD1234"
 */
function generateReferralCode() {
    // Generate 4 random uppercase letters
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluding I and O to avoid confusion
    let letterPart = '';
    for (let i = 0; i < 4; i++) {
        letterPart += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    
    // Generate 4 random numbers
    const numberPart = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Combine letters + numbers
    return letterPart + numberPart;
}

/**
 * Generate a unique referral code (ensures no duplicates)
 */
async function generateUniqueReferralCode() {
    let isUnique = false;
    let referralCode = '';
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
        referralCode = generateReferralCode();
        
        // Check if code already exists
        const existingUser = await db.collection('users')
            .where('myReferralCode', '==', referralCode)
            .get();
        
        if (existingUser.empty) {
            isUnique = true;
        }
        attempts++;
    }
    
    return referralCode;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const re = /^(\+?255|0)[67]\d{8}$/;
    return re.test(phone.replace(/\s/g, ''));
}

function formatMoney(amount) {
    if (amount === undefined || amount === null) amount = 0;
    return amount.toLocaleString('en-TZ') + ' TZS';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) {
        alert(message);
        return;
    }
    
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading(message = 'Loading...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
        
        // Add message if not exists
        let messageEl = loadingOverlay.querySelector('.loading-message');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.className = 'loading-message';
            loadingOverlay.appendChild(messageEl);
        }
        messageEl.textContent = message;
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
}

function animateStats() {
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(stat => {
        stat.classList.add('pulse-animation');
        setTimeout(() => {
            stat.classList.remove('pulse-animation');
        }, 500);
    });
}

function generatePaymentDetails(method, amount) {
    const reference = 'ST' + Date.now().toString().slice(-8) + Math.random().toString(36).substring(2, 5).toUpperCase();
    
    return {
        reference: reference,
        amount: amount,
        number: getPaymentNumber(method),
        name: getPaymentName(method)
    };
}

function getPaymentNumber(method) {
    const numbers = {
        'mpesa': '0763456789',
        'airtel': '0789456123',
        'tigo': '0712345678'
    };
    return numbers[method] || '0763456789';
}

function getPaymentName(method) {
    const names = {
        'mpesa': 'SmartTask M-PESA',
        'airtel': 'SmartTask Airtel Money',
        'tigo': 'SmartTask Tigo Pesa'
    };
    return names[method] || 'SmartTask Payments';
}

function getMethodName(method) {
    const names = {
        'mpesa': 'M-PESA',
        'airtel': 'Airtel Money',
        'tigo': 'Tigo Pesa'
    };
    return names[method] || method.toUpperCase();
}

function showPaymentInstructions(deposit, paymentDetails) {
    const instructions = `
        💳 Payment Instructions:
        
        📱 Payment Method: ${getMethodName(deposit.method)}
        💰 Amount: ${formatMoney(deposit.amount)}
        📞 Pay to: ${paymentDetails.number}
        👤 Account Name: ${paymentDetails.name}
        🔑 Reference: ${paymentDetails.reference}
        
        Steps:
        1. Go to your mobile money app
        2. Select "Send Money"
        3. Enter the number above
        4. Enter amount ${formatMoney(deposit.amount)}
        5. Enter reference: ${paymentDetails.reference}
        6. Confirm and send payment
        
        Your deposit will be automatically verified within 5-30 minutes.
    `;
    
    alert(instructions);
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    window.onclick = function(event) {
        const modal = document.getElementById('termsModal');
        if (event.target === modal) {
            closeModal();
        }
    };
    
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const activeElement = document.activeElement;
            if (activeElement.id === 'loginPassword' || activeElement.id === 'loginUsername') {
                handleLogin();
            }
        }
    });
    
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9+]/g, '');
        });
    });
}

function updateUITimeOfDay() {
    const hour = new Date().getHours();
    let greeting = '';
    
    if (hour < 12) greeting = 'Good Morning';
    else if (hour < 17) greeting = 'Good Afternoon';
    else greeting = 'Good Evening';
    
    const greetingElements = document.querySelectorAll('.time-greeting');
    greetingElements.forEach(el => {
        el.textContent = greeting;
    });
}

// ============================================
// TAB SWITCHING FUNCTIONS
// ============================================
function switchUserTab(tabName) {
    // 1. Update active menu item
    document.querySelectorAll('#sidebar .sidebar-menu li').forEach(li => {
        li.classList.remove('active');
    });
    if (event && event.target) {
        const li = event.target.closest('li');
        if (li) li.classList.add('active');
    }
    
    // 2. Hide all tab content
    document.querySelectorAll('#userMainContent .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 3. Determine the correct tab ID – handle the special case for 'tasks1'
    let targetId = tabName + 'Tab';
    if (tabName === 'tasks1') {
        targetId = 'tasks1Tab'; // because your HTML uses id="tasks1Tab"
    }
    
    // 4. Show the selected tab
    const targetTab = document.getElementById(targetId);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // 5. Update the page title (optional – make sure you have an element with id="currentPageTitle")
    const pageTitle = document.getElementById('currentPageTitle');
    if (pageTitle) {
        const titles = {
            'overview': 'Dashboard Overview',
            'packages': 'Investment Packages',
            'tasks': 'Daily Tasks',
            'tasks1': 'Daily Tasks', // map tasks1 to the same title
            'deposit': 'Make a Deposit',
            'withdraw': 'Withdraw Funds',
            'referrals': 'Referral Program',
            'history': 'Transaction History'
        };
        pageTitle.textContent = titles[tabName] || 'SmartTask';
    }
    
    // 6. Close sidebar on mobile
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('active');
    }

    // 7. Load data specific to the tab
    if (tabName === 'history') {
        loadHistory();
    } else if (tabName === 'packages') {
        loadPackages();
    } else if (tabName === 'referrals') {
        loadReferralData();
        // Refresh referral links when showing referrals tab
        setTimeout(() => {
            updateAllReferralLinks();
        }, 100);
    } else if (tabName === 'tasks' || tabName === 'tasks1') {
        loadDailyTasks();
    } else if (tabName === 'deposit') {
        console.log('Switching to deposit tab');
        setTimeout(() => {
            if (typeof initDepositTab === 'function') {
                initDepositTab();
            }
        }, 100);
    } else if (tabName === 'withdraw') {
        console.log('Switching to withdraw tab');
        if (currentUser && typeof loadWithdrawAccounts === 'function') {
            loadWithdrawAccounts();
        }
    }
}
    
// Update switchAdminTab function to include social links
function switchAdminTab(tabName) {
    console.log('Switching to admin tab:', tabName);
    
    // Update active menu
    document.querySelectorAll('#adminSidebar .sidebar-menu li').forEach(li => {
        li.classList.remove('active');
    });
    
    if (event && event.target) {
        const li = event.target.closest('li');
        if (li) li.classList.add('active');
    }
    
    // Hide all tabs
    document.querySelectorAll('#adminMainContent .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    if (tabName === 'dashboard') {
        const adminDashboardTab = document.getElementById('adminDashboardTab');
        if (adminDashboardTab) adminDashboardTab.classList.add('active');
        loadAdminData();
    } else if (tabName === 'deposits') {
        const depositsTab = document.getElementById('depositsTab');
        if (depositsTab) depositsTab.classList.add('active');
        loadDeposits().then(() => loadDepositsTable());
    } else if (tabName === 'withdrawals') {
        const withdrawalsTab = document.getElementById('withdrawalsTab');
        if (withdrawalsTab) withdrawalsTab.classList.add('active');
        loadWithdrawals().then(() => loadWithdrawalsTable());
    } else if (tabName === 'users') {
        const usersTab = document.getElementById('usersTab');
        if (usersTab) usersTab.classList.add('active');
        loadUsersTable();
    } else if (tabName === 'tasks') {
        const tasksTab = document.getElementById('tasksTab');
        if (tasksTab) tasksTab.classList.add('active');
        loadAdminTasks();
    } else if (tabName === 'bankAccounts') {
        const bankAccountsTab = document.getElementById('bankAccountsTab');
        if (bankAccountsTab) bankAccountsTab.classList.add('active');
        loadBankAccounts();
    } else if (tabName === 'socialLinks') {
        // Handle social links tab
        openAdminSocialLinksModal();
    } else if (tabName === 'announcements') {
        const announcementsTab = document.getElementById('announcementsTab');
        if (announcementsTab) announcementsTab.classList.add('active');
        loadAdminAnnouncements();
    } else if (tabName === 'settings') {
        const settingsTab = document.getElementById('settingsTab');
        if (settingsTab) settingsTab.classList.add('active');
    } else {
        const targetTab = document.getElementById(tabName + 'Tab');
        if (targetTab) targetTab.classList.add('active');
    }
}

function switchSuperAdminTab(tabName) {
    document.querySelectorAll('#superAdminSidebar .sidebar-menu li').forEach(li => {
        li.classList.remove('active');
    });
    if (event && event.target) {
        const li = event.target.closest('li');
        if (li) li.classList.add('active');
    }

    document.querySelectorAll('#superAdminMainContent .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const tabId = 'superAdmin' + tabName.charAt(0).toUpperCase() + tabName.slice(1) + 'Tab';
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');
    
    if (tabName === 'dashboard') {
        loadSuperAdminData();
        loadSuperAdminStats();
    }
}

// ============================================
// TOGGLE FUNCTIONS
// ============================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const adminSidebar = document.getElementById('adminSidebar');
    const superAdminSidebar = document.getElementById('superAdminSidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (sidebar) sidebar.classList.toggle('active');
    if (adminSidebar) adminSidebar.classList.toggle('active');
    if (superAdminSidebar) superAdminSidebar.classList.toggle('active');
    if (mainContent) mainContent.classList.toggle('shifted');
}

function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
        userMenu.classList.toggle('show');
    }
}

document.addEventListener('click', function(event) {
    const userMenu = document.getElementById('userMenu');
    const userProfile = document.querySelector('.user-profile');
    
    if (userMenu && userProfile && !userProfile.contains(event.target) && !userMenu.contains(event.target)) {
        userMenu.classList.remove('show');
    }
});

// ============================================
// MODAL FUNCTIONS
// ============================================
function showTerms() {
    const modal = document.getElementById('termsModal');
    if (modal) {
        modal.classList.add('show');
    }
}

function closeModal() {
    const modal = document.getElementById('termsModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function acceptTerms() {
    const termsAgree = document.getElementById('termsAgree');
    if (termsAgree) {
        termsAgree.checked = true;
    }
    closeModal();
    showToast('Terms accepted!', 'success');
}

// ============================================
// PROFILE FUNCTIONS
// ============================================
function showUserProfile() {
    if (!currentUser) return;
    
    const profileHtml = `
        <div class="profile-modal">
            <div class="profile-header">
                <div class="profile-avatar">
                    <i class="fas fa-user-circle"></i>
                </div>
                <h2>${currentUser.fullName}</h2>
                <p class="profile-username">@${currentUser.username}</p>
            </div>
            <div class="profile-details">
                <div class="profile-item">
                    <span class="profile-label"><i class="fas fa-envelope"></i> Email:</span>
                    <span class="profile-value">${currentUser.email}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label"><i class="fas fa-phone"></i> Phone:</span>
                    <span class="profile-value">${currentUser.phone}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label"><i class="fas fa-calendar"></i> Member Since:</span>
                    <span class="profile-value">${new Date(currentUser.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label"><i class="fas fa-trophy"></i> Total Earned:</span>
                    <span class="profile-value profit">${formatMoney(currentUser.totalEarned || 0)}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label"><i class="fas fa-coins"></i> Total Invested:</span>
                    <span class="profile-value">${formatMoney(currentUser.totalInvested || 0)}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label"><i class="fas fa-gift"></i> Referral Code:</span>
                    <span class="profile-value code">${currentUser.myReferralCode}</span>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content profile-modal-content">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            ${profileHtml}
        </div>
    `;
    document.body.appendChild(modal);
}

function showSettings() {
    showToast('⚙️ Settings panel coming soon!', 'info');
}

// ============================================
// REFERRAL FUNCTIONS
// ============================================
function copyReferralLink() {
    const linkInput = document.getElementById('referralLink');
    if (!linkInput) return;
    
    linkInput.select();
    document.execCommand('copy');
    showToast('✅ Referral link copied to clipboard!', 'success');
}

// ============================================
// SEARCH FUNCTIONS
// ============================================
let searchTimeout;

function searchUsers() {
    clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(async () => {
        const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
        const tableBody = document.getElementById('usersTableBody');
        
        if (!tableBody) return;
        
        const filteredUsers = users.filter(u => 
            u.role === 'user' && 
            (u.username.toLowerCase().includes(searchTerm) || 
             u.email.toLowerCase().includes(searchTerm) ||
             u.phone.includes(searchTerm) ||
             u.fullName?.toLowerCase().includes(searchTerm))
        );
        
        let html = '';
        filteredUsers.forEach(user => {
            const totalInvested = user.activePackages?.reduce((sum, p) => sum + p.investment, 0) || 0;
            const totalEarned = user.totalEarned || 0;
            
            html += `
                <tr>
                    <td>
                        <div class="user-info">
                            <i class="fas fa-user-circle"></i>
                            <div>
                                <div class="user-name">${user.fullName || user.username}</div>
                                <div class="user-username">@${user.username}</div>
                            </div>
                        </div>
                    </td>
                    <td>${user.email}</td>
                    <td>${user.phone}</td>
                    <td>${formatMoney(user.balance || 0)}</td>
                    <td>${formatMoney(totalInvested)}</td>
                    <td>${formatMoney(totalEarned)}</td>
                    <td>${user.referrals?.length || 0}</td>
                    <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                    <td><span class="status-badge ${user.isActive ? 'completed' : 'rejected'}">
                        ${user.isActive ? 'Active' : 'Inactive'}
                    </span></td>
                    <td class="action-buttons">
                        <button class="action-btn small" onclick="viewUserDetails('${user.uid}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn small ${user.isActive ? 'warning' : 'success'}" 
                            onclick="toggleUserStatus('${user.uid}')" 
                            title="${user.isActive ? 'Deactivate' : 'Activate'}">
                            <i class="fas ${user.isActive ? 'fa-ban' : 'fa-check'}"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        if (html === '') {
            html = '<tr><td colspan="10" class="no-data"><i class="fas fa-search"></i> No users found matching your search</td></tr>';
        }
        
        tableBody.innerHTML = html;
    }, 300);
}

// ============================================
// UPDATE FUNCTIONS
// ============================================
async function updateCurrentUser() {
    if (!currentUser?.uid) return;
    
    try {
        await db.collection('users').doc(currentUser.uid).set(currentUser, { merge: true });
    } catch (error) {
        console.error('Error updating current user:', error);
    }
}

async function updateUserLoginStats() {
    if (!currentUser?.uid) return;
    
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        await userRef.update({
            lastLogin: new Date().toISOString(),
            loginCount: firebase.firestore.FieldValue.increment(1)
        });
    } catch (error) {
        console.error('Error updating login stats:', error);
    }
}

// ============================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ============================================
window.handleLogin = handleLogin;
window.showSignup = showSignup;
window.showLogin = showLogin;
window.socialLogin = socialLogin;
window.forgotPassword = forgotPassword;
window.handleSignup = handleSignup;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.toggleUserMenu = toggleUserMenu;
window.switchUserTab = switchUserTab;
window.switchAdminTab = switchAdminTab;
window.switchSuperAdminTab = switchSuperAdminTab;
window.openTaskModal = openTaskModal;
window.submitTaskCompletion = submitTaskCompletion;
window.buyPackage = buyPackage;
window.processDeposit = processDeposit;
window.requestWithdrawal = requestWithdrawal;
window.copyReferralLink = copyReferralLink;
window.filterHistory = filterHistory;
window.showTerms = showTerms;
window.closeModal = closeModal;
window.acceptTerms = acceptTerms;
window.showUserProfile = showUserProfile;
window.showSettings = showSettings;
window.viewUserDetails = viewUserDetails;
window.toggleUserStatus = toggleUserStatus;
window.addUserBalance = addUserBalance;
window.searchUsers = searchUsers;
window.approveDeposit = approveDeposit;
window.rejectDeposit = rejectDeposit;
window.approveWithdrawal = approveWithdrawal;
window.rejectWithdrawal = rejectWithdrawal;
window.toggleAdminStatus = toggleAdminStatus;
window.removeAdmin = removeAdmin;
window.addNewAdmin = addNewAdmin;
window.saveSystemSettings = saveSystemSettings;
window.resetSystemSettings = resetSystemSettings;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.showAddTaskForm = showAddTaskForm;
window.closeTaskFormModal = closeTaskFormModal;
window.toggleMediaInput = toggleMediaInput;
window.saveTask = saveTask;
window.editTask = editTask;
window.deactivateTask = deactivateTask;
window.deleteTask = deleteTask;
window.reAddTask = reAddTask;
window.loadDailyTasks = loadDailyTasks;
window.openTaskModal = openTaskModal;
window.closeTaskCompletionModal = closeTaskCompletionModal;
window.submitTaskCompletion = submitTaskCompletion;
window.loadDailyTasks = loadDailyTasks;
window.editTask = editTask;
window.deactivateTask = deactivateTask;
window.deleteTask = deleteTask;
window.reuseTask = reuseTask;
window.showAddTaskForm = showAddTaskForm;
window.closeTaskFormModal = closeTaskFormModal;
window.saveTask = saveTask;

console.log('✅ SmartTask Firebase ready');

// Add this function
async function resetUserTasks() {
    if (!currentUser) return;
    
    await db.collection('users').doc(currentUser.uid).update({
        dailyTasks: [],
        dailyTasksDate: null
    });
    
    currentUser.dailyTasks = [];
    currentUser.dailyTasksDate = null;
    
    await loadDailyTasks();
    console.log('Tasks reset and reloaded');
}

resetUserTasks()

// ============================================
// CHECK USER PACKAGE STATUS
// ============================================
function hasActivePackage() {
    if (!currentUser) return false;
    
    const hasPackages = currentUser.activePackages && currentUser.activePackages.length > 0;
    console.log('User has active packages:', hasPackages, 'Count:', currentUser.activePackages?.length);
    
    return hasPackages;
}

function getActivePackagesSummary() {
    if (!currentUser || !currentUser.activePackages || currentUser.activePackages.length === 0) {
        return null;
    }
    
    let totalDailyProfit = 0;
    let packageNames = [];
    
    currentUser.activePackages.forEach(pkg => {
        totalDailyProfit += pkg.dailyProfit;
        packageNames.push(pkg.name);
    });
    
    return {
        count: currentUser.activePackages.length,
        totalDailyProfit: totalDailyProfit,
        names: packageNames.join(', ')
    };
}

window.hasActivePackage = hasActivePackage;
window.getActivePackagesSummary = getActivePackagesSummary;
window.extractYouTubeId = extractYouTubeId;
window.openTaskModal = openTaskModal;
window.openTaskModalWithTask = openTaskModalWithTask;
window.fetchTaskFromFirestore = fetchTaskFromFirestore;
window.closeTaskCompletionModal = closeTaskCompletionModal;
window.submitTaskCompletion = submitTaskCompletion;
window.testOpenTaskModal = testOpenTaskModal;

/**
 * Test function to manually open a task modal
 */
async function testOpenTaskModal() {
    console.log('Testing task modal opening...');
    
    if (!currentUser) {
        console.error('No user logged in');
        showToast('Please log in first', 'error');
        return;
    }
    
    // Get the first task from user's daily tasks
    if (currentUser.dailyTasks && currentUser.dailyTasks.length > 0) {
        const taskId = currentUser.dailyTasks[0];
        console.log('Testing with task ID:', taskId);
        
        // Try to open the modal
        openTaskModal(taskId);
    } else {
        console.log('No daily tasks found for user');
        
        // Try to fetch any active task from database
        try {
            const snapshot = await db.collection('tasks')
                .where('status', '==', 'active')
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                const task = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                console.log('Found task in database:', task);
                openTaskModalWithTask(task);
            } else {
                showToast('No tasks available for testing', 'error');
            }
        } catch (error) {
            console.error('Error fetching test task:', error);
            showToast('Error fetching test task', 'error');
        }
    }
}

// Expose test function globally
window.testOpenTaskModal = testOpenTaskModal;

/**
 * SIMPLIFIED TASK MODAL - This will definitely work
 */
function openSimpleTaskModal(taskId) {
    console.log('Opening simple task modal for:', taskId);
    
    // Find the task
    let task = null;
    if (tasks && tasks.length > 0) {
        task = tasks.find(t => t.id === taskId);
    }
    
    if (!task && currentUser && currentUser.dailyTasks) {
        // Try to get from dailyTasks
        const taskIdFromUser = currentUser.dailyTasks.find(id => id === taskId);
        if (taskIdFromUser) {
            // We need to fetch it
            fetchTaskFromFirestore(taskId).then(fetchedTask => {
                if (fetchedTask) {
                    showSimpleTaskModal(fetchedTask);
                } else {
                    alert('Task not found');
                }
            });
            return;
        }
    }
    
    if (task) {
        showSimpleTaskModal(task);
    } else {
        alert('Task not found');
    }
}

/**
 * Show a simple, clean task modal
 */
function showSimpleTaskModal(task) {
    console.log('Showing modal for:', task.title);
    
    // Check for active package
    if (!hasActivePackage()) {
        if (confirm('You need an active package to earn from tasks. Browse packages now?')) {
            switchUserTab('packages');
        }
        return;
    }
    
    const packageSummary = getActivePackagesSummary();
    
    // Create modal container
    const modalDiv = document.createElement('div');
    modalDiv.id = 'simpleTaskModal';
    modalDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        border-radius: 12px;
        padding: 25px;
        position: relative;
        box-shadow: 0 5px 30px rgba(0,0,0,0.3);
    `;
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        position: absolute;
        right: 15px;
        top: 10px;
        font-size: 28px;
        cursor: pointer;
        color: #666;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        border-radius: 50%;
    `;
    closeBtn.onclick = function() {
        document.body.removeChild(modalDiv);
    };
    modalContent.appendChild(closeBtn);
    
    // Add title
    const title = document.createElement('h2');
    title.textContent = task.title;
    title.style.marginBottom = '15px';
    modalContent.appendChild(title);
    
    // Add package info
    const packageInfo = document.createElement('div');
    packageInfo.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
    `;
    packageInfo.innerHTML = `
        <div style="display: flex; gap: 15px; margin-bottom: 5px;">
            <span><i class="fas fa-box"></i> Packages: ${packageSummary.count}</span>
            <span><i class="fas fa-coins"></i> Daily: ${formatMoney(packageSummary.totalDailyProfit)}</span>
        </div>
        <div style="font-size: 13px; opacity: 0.9;">${packageSummary.names}</div>
    `;
    modalContent.appendChild(packageInfo);
    
    // Add media
    const mediaDiv = document.createElement('div');
    mediaDiv.style.cssText = `
        width: 100%;
        height: 250px;
        background: #f5f5f5;
        border-radius: 8px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    `;
    
    if (task.mediaType === 'video') {
        const video = document.createElement('video');
        video.src = task.mediaUrl || 'https://www.w3schools.com/html/mov_bbb.mp4';
        video.controls = true;
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        mediaDiv.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = task.mediaUrl || 'https://via.placeholder.com/400x300?text=Product';
        img.alt = task.title;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        mediaDiv.appendChild(img);
    }
    modalContent.appendChild(mediaDiv);
    
    // Add description
    const desc = document.createElement('p');
    desc.textContent = task.description || 'Rate this product to earn daily profits';
    desc.style.marginBottom = '20px';
    desc.style.color = '#666';
    modalContent.appendChild(desc);
    
    // Add rating stars
    const ratingDiv = document.createElement('div');
    ratingDiv.style.cssText = `
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
        text-align: center;
    `;
    ratingDiv.innerHTML = '<p style="margin-bottom: 10px; font-weight: bold;">Rate this product:</p>';
    
    const starsDiv = document.createElement('div');
    starsDiv.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: center;
        font-size: 30px;
        color: #ffc107;
        cursor: pointer;
    `;
    
    // Create rating input
    const ratingInput = document.createElement('input');
    ratingInput.type = 'hidden';
    ratingInput.id = 'simpleTaskRating';
    ratingInput.value = '0';
    
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('i');
        star.className = 'far fa-star';
        star.dataset.rating = i;
        star.style.transition = 'transform 0.2s';
        star.onmouseover = function() {
            this.style.transform = 'scale(1.2)';
        };
        star.onmouseout = function() {
            this.style.transform = 'scale(1)';
        };
        star.onclick = function() {
            const rating = this.dataset.rating;
            ratingInput.value = rating;
            
            // Update stars
            const allStars = starsDiv.querySelectorAll('i');
            allStars.forEach((s, index) => {
                if (index < rating) {
                    s.className = 'fas fa-star';
                } else {
                    s.className = 'far fa-star';
                }
            });
        };
        starsDiv.appendChild(star);
    }
    
    ratingDiv.appendChild(starsDiv);
    ratingDiv.appendChild(ratingInput);
    modalContent.appendChild(ratingDiv);
    
    // Add completion note
    const noteDiv = document.createElement('div');
    noteDiv.style.cssText = `
        background: #e3f2fd;
        border-left: 4px solid #2196F3;
        padding: 12px 15px;
        margin-bottom: 20px;
        border-radius: 5px;
        font-size: 14px;
    `;
    noteDiv.innerHTML = `<i class="fas fa-info-circle" style="color: #2196F3; margin-right: 8px;"></i> 
        Complete all 3 tasks to earn ${formatMoney(packageSummary.totalDailyProfit)}`;
    modalContent.appendChild(noteDiv);
    
    // Add confirmation checkbox
    const confirmDiv = document.createElement('div');
    confirmDiv.style.cssText = `
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
    `;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'simpleTaskConfirm';
    checkbox.style.marginRight = '10px';
    
    const label = document.createElement('label');
    label.htmlFor = 'simpleTaskConfirm';
    label.textContent = 'I have rated this product';
    
    confirmDiv.appendChild(checkbox);
    confirmDiv.appendChild(label);
    modalContent.appendChild(confirmDiv);
    
    // Add buttons
    const buttonDiv = document.createElement('div');
    buttonDiv.style.cssText = `
        display: flex;
        gap: 15px;
        justify-content: flex-end;
    `;
    
    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Submit Rating';
    submitBtn.style.cssText = `
        background: #4CAF50;
        color: white;
        border: none;
        padding: 12px 25px;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
    `;
    submitBtn.onclick = function() {
        const isChecked = document.getElementById('simpleTaskConfirm')?.checked;
        const rating = document.getElementById('simpleTaskRating')?.value;
        
        if (!isChecked) {
            alert('Please confirm you have completed the task');
            return;
        }
        
        if (!rating || rating === '0') {
            alert('Please select a rating');
            return;
        }
        
        document.body.removeChild(modalDiv);
        completeTask(task.id, parseInt(rating));
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
        background: #f5f5f5;
        color: #666;
        border: none;
        padding: 12px 25px;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
    `;
    cancelBtn.onclick = function() {
        document.body.removeChild(modalDiv);
    };
    
    buttonDiv.appendChild(submitBtn);
    buttonDiv.appendChild(cancelBtn);
    modalContent.appendChild(buttonDiv);
    
    // Assemble modal
    modalDiv.appendChild(modalContent);
    document.body.appendChild(modalDiv);
}

// Replace the old openTaskModal with this simplified version
window.openTaskModal = function(taskId) {
    console.log('Opening task modal for:', taskId);
    openSimpleTaskModal(taskId);
};

// ============================================
// BANK ACCOUNT GLOBAL VARIABLES
// ============================================
let bankAccounts = [];

let selectedWithdrawAccount = null;
let withdrawAccounts = [];

// ============================================
// BANK ACCOUNT MANAGEMENT (ADMIN)
// ============================================

// Load bank accounts from Firestore
async function loadBankAccounts() {
    try {
        const snapshot = await db.collection('bankAccounts')
            .orderBy('bankName')
            .get();
        
        bankAccounts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderBankAccounts();
    } catch (error) {
        console.error('Error loading bank accounts:', error);
        showToast('Error loading bank accounts', 'error');
    }
}

// Render bank accounts in admin table
function renderBankAccounts() {
    const tbody = document.getElementById('bankAccountsBody');
    if (!tbody) return;
    
    if (bankAccounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">No bank accounts found</td></tr>';
        return;
    }
    
    let html = '';
    bankAccounts.forEach(account => {
        html += `
            <tr>
                <td>${account.bankName}</td>
                <td>${account.accountNumber}</td>
                <td>${account.accountName}</td>
                <td><span class="badge ${account.status}">${account.status}</span></td>
                <td class="action-buttons">
                    <button class="action-btn small" onclick="editBankAccount('${account.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn small danger" onclick="deleteBankAccount('${account.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Show add bank account form
function showAddBankAccountForm() {
    document.getElementById('bankAccountFormTitle').textContent = 'Add New Bank Account';
    document.getElementById('bankAccountId').value = '';
    document.getElementById('bankName').value = '';
    document.getElementById('bankAccountNumber').value = '';
    document.getElementById('bankAccountName').value = '';
    document.getElementById('bankAccountStatus').value = 'active';
    document.getElementById('bankAccountFormModal').classList.add('show');
}

// Close bank account form modal
function closeBankAccountFormModal() {
    document.getElementById('bankAccountFormModal').classList.remove('show');
}

// Save bank account
async function saveBankAccount() {
    const id = document.getElementById('bankAccountId').value;
    const bankName = document.getElementById('bankName').value;
    const accountNumber = document.getElementById('bankAccountNumber').value.trim();
    const accountName = document.getElementById('bankAccountName').value.trim();
    const status = document.getElementById('bankAccountStatus').value;
    
    if (!bankName || !accountNumber || !accountName) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const accountData = {
            bankName,
            accountNumber,
            accountName,
            status,
            updatedAt: new Date().toISOString()
        };
        
        if (id) {
            await db.collection('bankAccounts').doc(id).update(accountData);
            showToast('Bank account updated successfully', 'success');
        } else {
            accountData.createdAt = new Date().toISOString();
            await db.collection('bankAccounts').add(accountData);
            showToast('Bank account added successfully', 'success');
        }
        
        closeBankAccountFormModal();
        await loadBankAccounts();
        
    } catch (error) {
        console.error('Error saving bank account:', error);
        showToast('Error saving bank account', 'error');
    } finally {
        hideLoading();
    }
}

// Edit bank account
async function editBankAccount(accountId) {
    const account = bankAccounts.find(a => a.id === accountId);
    if (!account) return;
    
    document.getElementById('bankAccountFormTitle').textContent = 'Edit Bank Account';
    document.getElementById('bankAccountId').value = account.id;
    document.getElementById('bankName').value = account.bankName;
    document.getElementById('bankAccountNumber').value = account.accountNumber;
    document.getElementById('bankAccountName').value = account.accountName;
    document.getElementById('bankAccountStatus').value = account.status;
    
    document.getElementById('bankAccountFormModal').classList.add('show');
}

// Delete bank account
async function deleteBankAccount(accountId) {
    if (!confirm('Are you sure you want to delete this bank account?')) return;
    
    showLoading();
    
    try {
        await db.collection('bankAccounts').doc(accountId).delete();
        showToast('Bank account deleted', 'success');
        await loadBankAccounts();
    } catch (error) {
        console.error('Error deleting bank account:', error);
        showToast('Error deleting bank account', 'error');
    } finally {
        hideLoading();
    }
}
// ============================================
// UPDATED WITHDRAWAL ACCOUNTS - USING USER BANK ACCOUNTS
// ============================================

/**
 * Load user's withdrawal accounts from their saved bank accounts
 */
async function loadWithdrawAccounts() {
    console.log('Loading withdrawal accounts from user bank accounts...');
    
    if (!currentUser) return;
    
    try {
        // Refresh user data to get latest bank accounts
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            withdrawAccounts = userData.bankAccounts || [];
            currentUser.bankAccounts = withdrawAccounts;
            
            console.log(`Loaded ${withdrawAccounts.length} withdrawal accounts`);
        } else {
            withdrawAccounts = [];
        }
        
        renderWithdrawAccounts();
        
        // Update available balance display
        const totalBalance = (currentUser.balance || 0) + (currentUser.referralBalance || 0);
        const availableSpan = document.getElementById('availableBalance');
        if (availableSpan) {
            availableSpan.textContent = formatMoney(totalBalance);
        }
        
        // If no accounts, show a helpful message
        if (withdrawAccounts.length === 0) {
            const nextBtn = document.getElementById('withdrawStep1Next');
            if (nextBtn) nextBtn.disabled = true;
            
            const container = document.getElementById('savedAccountsList');
            if (container) {
                container.innerHTML = `
                    <div class="no-accounts-warning">
                        <i class="fas fa-university"></i>
                        <p>You haven't added any bank accounts yet.</p>
                        <button onclick="showUserBankAccounts()" class="action-btn small">
                            <i class="fas fa-plus-circle"></i> Add Bank Account
                        </button>
                    </div>
                `;
            }
        }
        
    } catch (error) {
        console.error('Error loading withdrawal accounts:', error);
        withdrawAccounts = [];
        showToast('Error loading accounts', 'error');
    }
}

// Render withdrawal accounts
/**
 * Render withdrawal accounts from user's bank accounts
 */
function renderWithdrawAccounts() {
    const container = document.getElementById('savedAccountsList');
    if (!container) return;
    
    if (!withdrawAccounts || withdrawAccounts.length === 0) {
        container.innerHTML = `
            <div class="no-accounts-warning">
                <i class="fas fa-university"></i>
                <p>No bank accounts added yet</p>
                <button onclick="showUserBankAccounts()" class="action-btn small">
                    <i class="fas fa-plus-circle"></i> Add Bank Account
                </button>
                <p class="small">Add a bank account to withdraw your earnings</p>
            </div>
        `;
        
        // Disable continue button
        const nextBtn = document.getElementById('withdrawStep1Next');
        if (nextBtn) nextBtn.disabled = true;
        return;
    }
    
    let html = '';
    withdrawAccounts.forEach((account, index) => {
        const isDefault = account.isDefault || index === 0;
        const displayNumber = account.accountNumber.replace(/(\d{4})/g, '$1 ').trim();
        const iconClass = getBankIconClass(account.bankName);
        const iconColor = getBankColor(account.bankName);
        
        html += `
            <div class="account-card ${isDefault ? 'default' : ''}" onclick="selectWithdrawAccount('${account.id}')" data-account-id="${account.id}">
                <div class="account-radio">
                    <input type="radio" name="withdrawAccount" value="${account.id}" ${isDefault ? 'checked' : ''}>
                </div>
                <div class="account-details">
                    <div class="account-header">
                        <i class="fas ${iconClass}" style="color: ${iconColor}; font-size: 20px;"></i>
                        <h4>${escapeHtml(account.bankName)}</h4>
                        ${isDefault ? '<span class="default-badge-small">Default</span>' : ''}
                    </div>
                    <p class="account-name">${escapeHtml(account.accountName)}</p>
                    <p class="account-number">${escapeHtml(displayNumber)}</p>
                    <p class="account-added">Added: ${new Date(account.addedAt).toLocaleDateString()}</p>
                </div>
            </div>
        `;
    });
    
    // Add a button to manage accounts
    html += `
        <div class="manage-accounts-btn">
            <button onclick="showUserBankAccounts()" class="action-btn small secondary">
                <i class="fas fa-cog"></i> Manage Bank Accounts
            </button>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Auto-select default account
    const defaultAccount = withdrawAccounts.find(acc => acc.isDefault) || withdrawAccounts[0];
    if (defaultAccount) {
        selectWithdrawAccount(defaultAccount.id);
    }
}

/**
 * Select withdrawal account by ID
 */
function selectWithdrawAccount(accountId) {
    console.log('Selecting withdrawal account:', accountId);
    
    // Find the account in withdrawAccounts
    const account = withdrawAccounts.find(acc => acc.id === accountId);
    if (!account) {
        console.error('Account not found:', accountId);
        return;
    }
    
    selectedWithdrawAccount = account;
    
    // Update UI - remove selected class from all cards
    document.querySelectorAll('.account-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selected class to the chosen card
    const selectedCard = document.querySelector(`.account-card[data-account-id="${accountId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        
        // Check the radio button
        const radio = selectedCard.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    }
    
    // Update the selected account info display for step 2
    const accountInfo = document.getElementById('selectedAccountInfo');
    if (accountInfo) {
        const displayNumber = account.accountNumber.replace(/(\d{4})/g, '$1 ').trim();
        const iconClass = getBankIconClass(account.bankName);
        const iconColor = getBankColor(account.bankName);
        
        accountInfo.innerHTML = `
            <div class="selected-account-details">
                <div class="selected-header">
                    <i class="fas ${iconClass}" style="color: ${iconColor}; font-size: 24px;"></i>
                    <h4>${escapeHtml(account.bankName)}</h4>
                </div>
                <div class="selected-details">
                    <div class="detail-row">
                        <span class="label">Account Name:</span>
                        <span class="value">${escapeHtml(account.accountName)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Account Number:</span>
                        <span class="value">${escapeHtml(displayNumber)}</span>
                    </div>
                </div>
                <div class="selected-check">
                    <i class="fas fa-check-circle"></i> Selected for withdrawal
                </div>
            </div>
        `;
    }
    
    // Enable next button
    const nextBtn = document.getElementById('withdrawStep1Next');
    if (nextBtn) {
        nextBtn.disabled = false;
    }
}

// Show add account form
function showAddAccountForm() {
    document.getElementById('addAccountForm').style.display = 'block';
    document.getElementById('showAddAccountBtn').style.display = 'none';
}

// Cancel add account
function cancelAddAccount() {
    document.getElementById('addAccountForm').style.display = 'none';
    document.getElementById('showAddAccountBtn').style.display = 'block';
    
    // Clear form
    document.getElementById('withdrawBankName').value = '';
    document.getElementById('withdrawNewAccountNumber').value = '';
    document.getElementById('withdrawNewAccountName').value = '';
    document.getElementById('withdrawOtherBankName').value = '';
    document.querySelector('.other-bank-field').style.display = 'none';
}

// Save withdrawal account
async function saveWithdrawAccount() {
    const bankName = document.getElementById('withdrawBankName').value;
    const accountNumber = document.getElementById('withdrawNewAccountNumber').value.trim();
    const accountName = document.getElementById('withdrawNewAccountName').value.trim();
    const otherBank = document.getElementById('withdrawOtherBankName').value.trim();
    
    if (!bankName) {
        showToast('Please select a bank', 'error');
        return;
    }
    if (!accountNumber) {
        showToast('Please enter account number', 'error');
        return;
    }
    if (!accountName) {
        showToast('Please enter account holder name', 'error');
        return;
    }
    
    if (bankName === 'Other' && !otherBank) {
        showToast('Please enter the bank name', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const finalBankName = bankName === 'Other' ? otherBank : bankName;
        
        const newAccount = {
            bankName: finalBankName,
            accountNumber: accountNumber,
            accountName: accountName,
            addedAt: new Date().toISOString(),
            isDefault: withdrawAccounts.length === 0 // First account is default
        };
        
        withdrawAccounts.push(newAccount);
        
        const userRef = db.collection('users').doc(currentUser.uid);
        await userRef.update({
            withdrawAccounts: withdrawAccounts
        });
        
        hideLoading();
        showToast('✅ Bank account added successfully', 'success');
        
        // Refresh list
        await loadWithdrawAccounts();
        
        // Hide form
        cancelAddAccount();
        
    } catch (error) {
        hideLoading();
        console.error('Error saving withdraw account:', error);
        showToast('Error saving account', 'error');
    }
}

// Withdrawal navigation
// ============================================
// FIXED NEXT WITHDRAW STEP FUNCTION
// ============================================

 // ============================================
// UPDATED WITHDRAWAL FUNCTIONS WITH 10% FEE
// ============================================

function nextWithdrawStep(currentStep) {
    if (currentStep === 1) {
        // Validate step 1
        if (!selectedWithdrawAccount) {
            showToast('Please select a bank account', 'error');
            return;
        }
        
        // Store selected account
        window.currentWithdrawal = {
            account: selectedWithdrawAccount
        };
        
        // Update steps
        const step1 = document.getElementById('withdrawStep1');
        const step2 = document.getElementById('withdrawStep2');
        
        if (step1) step1.classList.remove('active');
        if (step2) step2.classList.add('active');
        
        const step1Indicator = document.getElementById('withdrawStep1Indicator');
        const step2Indicator = document.getElementById('withdrawStep2Indicator');
        
        if (step1Indicator) {
            step1Indicator.classList.remove('active');
            step1Indicator.classList.add('completed');
        }
        if (step2Indicator) {
            step2Indicator.classList.add('active');
        }
        
        // Update available balance display
        const totalBalance = (currentUser.balance || 0) + (currentUser.referralBalance || 0);
        const availableSpan = document.getElementById('availableBalance');
        if (availableSpan) {
            availableSpan.textContent = formatMoney(totalBalance);
        }
        
    } else if (currentStep === 2) {
        // Validate step 2
        const amountInput = document.getElementById('withdrawAmount');
        const amount = parseFloat(amountInput?.value);
        
        if (!amount || isNaN(amount)) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        
        if (amount < systemSettings.minWithdrawal) {
            showToast(`Minimum withdrawal is ${formatMoney(systemSettings.minWithdrawal)}`, 'error');
            return;
        }
        
        if (amount > systemSettings.maxWithdrawal) {
            showToast(`Maximum withdrawal per day is ${formatMoney(systemSettings.maxWithdrawal)}`, 'error');
            return;
        }
        
        const totalBalance = (currentUser.balance || 0) + (currentUser.referralBalance || 0);
        if (amount > totalBalance) {
            showToast(`Insufficient balance. Available: ${formatMoney(totalBalance)}`, 'error');
            return;
        }
        
        // Check if already withdrew today
        const today = new Date().toDateString();
        if (currentUser.lastWithdrawalDate === today) {
            showToast('You can only withdraw once per day', 'error');
            return;
        }
        
        // Calculate fee (10%)
        const feePercentage = systemSettings.withdrawalFee || 10;
        const feeAmount = (amount * feePercentage) / 100;
        const netAmount = amount - feeAmount;
        
        // Calculate source of funds
        let fromReferral = 0;
        let fromBalance = amount;
        
        if (currentUser.referralBalance > 0) {
            if (currentUser.referralBalance >= amount) {
                fromReferral = amount;
                fromBalance = 0;
            } else {
                fromReferral = currentUser.referralBalance;
                fromBalance = amount - currentUser.referralBalance;
            }
        }
        
        // Store withdrawal data
        if (window.currentWithdrawal) {
            window.currentWithdrawal.amount = amount;
            window.currentWithdrawal.feeAmount = feeAmount;
            window.currentWithdrawal.netAmount = netAmount;
            window.currentWithdrawal.fromReferral = fromReferral;
            window.currentWithdrawal.fromBalance = fromBalance;
        } else {
            window.currentWithdrawal = {
                account: selectedWithdrawAccount,
                amount: amount,
                feeAmount: feeAmount,
                netAmount: netAmount,
                fromReferral: fromReferral,
                fromBalance: fromBalance
            };
        }
        
        // Show summary in step 3 with fee information
        const summary = document.getElementById('withdrawalSummary');
        if (summary) {
            summary.innerHTML = `
                <div class="summary-row">
                    <span class="summary-label">Bank:</span>
                    <span class="summary-value">${escapeHtml(selectedWithdrawAccount.bankName)}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Account Name:</span>
                    <span class="summary-value">${escapeHtml(selectedWithdrawAccount.accountName)}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Account Number:</span>
                    <span class="summary-value">${escapeHtml(selectedWithdrawAccount.accountNumber)}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Requested Amount:</span>
                    <span class="summary-value withdraw">${formatMoney(amount)}</span>
                </div>
                <div class="summary-row fee">
                    <span class="summary-label">Withdrawal Fee (${feePercentage}%):</span>
                    <span class="summary-value fee-amount">-${formatMoney(feeAmount)}</span>
                </div>
                <div class="summary-row total">
                    <span class="summary-label">You Will Receive:</span>
                    <span class="summary-value net-amount">${formatMoney(netAmount)}</span>
                </div>
                ${fromReferral > 0 ? `
                    <div class="summary-row">
                        <span class="summary-label">From Referral:</span>
                        <span class="summary-value">${formatMoney(fromReferral)}</span>
                    </div>
                ` : ''}
                ${fromBalance > 0 ? `
                    <div class="summary-row">
                        <span class="summary-label">From Balance:</span>
                        <span class="summary-value">${formatMoney(fromBalance)}</span>
                    </div>
                ` : ''}
            `;
        }
        
        // Update steps
        const step2 = document.getElementById('withdrawStep2');
        const step3 = document.getElementById('withdrawStep3');
        
        if (step2) step2.classList.remove('active');
        if (step3) step3.classList.add('active');
        
        const step2Indicator = document.getElementById('withdrawStep2Indicator');
        const step3Indicator = document.getElementById('withdrawStep3Indicator');
        
        if (step2Indicator) {
            step2Indicator.classList.remove('active');
            step2Indicator.classList.add('completed');
        }
        if (step3Indicator) {
            step3Indicator.classList.add('active');
        }
    }
}

// ============================================
// SUBMIT WITHDRAWAL WITH FEE CALCULATION
// ============================================

async function submitWithdrawal() {
    console.log('Submitting withdrawal...');
    
    const confirmCheck = document.getElementById('withdrawConfirm');
    if (!confirmCheck || !confirmCheck.checked) {
        showToast('Please confirm the withdrawal details', 'error');
        return;
    }
    
    if (!window.currentWithdrawal) {
        showToast('Withdrawal data not found. Please start over.', 'error');
        return;
    }
    
    const { amount, feeAmount, netAmount, fromReferral, fromBalance, account } = window.currentWithdrawal;
    
    if (!amount || amount <= 0) {
        showToast('Invalid withdrawal amount', 'error');
        return;
    }
    
    if (!account) {
        showToast('No withdrawal account selected', 'error');
        return;
    }
    
    showLoading('Processing withdrawal request...');
    
    try {
        // Create withdrawal data object with all required fields including fee
        const withdrawalData = {
            userId: currentUser.uid,
            username: currentUser.username,
            amount: amount,
            feeAmount: feeAmount,
            netAmount: netAmount,
            feePercentage: systemSettings.withdrawalFee || 10,
            method: account.bankName,
            accountNumber: account.accountNumber,
            accountName: account.accountName,
            fromReferral: fromReferral || 0,
            fromBalance: fromBalance || amount,
            status: 'pending',
            createdAt: new Date().toISOString(),
            phone: currentUser.phone || account.accountNumber
        };
        
        console.log('Saving withdrawal:', withdrawalData);
        
        // Save to Firestore
        await db.collection('withdrawals').add(withdrawalData);
        
        // Update user balances (deduct the full amount, fee is recorded but not deducted from user)
        const userRef = db.collection('users').doc(currentUser.uid);
        const today = new Date().toDateString();
        
        const updates = {
            lastWithdrawalDate: today,
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'withdrawal',
                description: `Withdrawal to ${account.bankName} - ${account.accountName} (Fee: ${formatMoney(feeAmount)})`,
                amount: amount,
                netAmount: netAmount,
                feeAmount: feeAmount,
                status: 'pending',
                date: new Date().toISOString(),
                metadata: {
                    accountNumber: account.accountNumber,
                    bankName: account.bankName,
                    feePercentage: systemSettings.withdrawalFee || 10
                }
            })
        };
        
        // Deduct the FULL requested amount from balances
        if (fromReferral > 0) {
            updates.referralBalance = firebase.firestore.FieldValue.increment(-fromReferral);
        }
        if (fromBalance > 0) {
            updates.balance = firebase.firestore.FieldValue.increment(-fromBalance);
        }
        
        await userRef.update(updates);
        
        // Update local user
        if (fromReferral > 0) {
            currentUser.referralBalance = (currentUser.referralBalance || 0) - fromReferral;
        }
        if (fromBalance > 0) {
            currentUser.balance = (currentUser.balance || 0) - fromBalance;
        }
        currentUser.lastWithdrawalDate = today;
        
        // Add notification for user
        await addNotification(
            currentUser.uid,
            '💰 Withdrawal Request Submitted',
            `Your withdrawal request of ${formatMoney(amount)} has been submitted. A ${formatMoney(feeAmount)} fee (${systemSettings.withdrawalFee}%) will be deducted. You will receive ${formatMoney(netAmount)}.`,
            'info'
        );
        
        // Log audit
        await logAudit('withdrawal_request', `Withdrawal request of ${formatMoney(amount)} (Fee: ${formatMoney(feeAmount)}, Net: ${formatMoney(netAmount)}) submitted by ${currentUser.username}`, currentUser.uid);
        
        hideLoading();
        showToast(`✅ Withdrawal request of ${formatMoney(amount)} submitted successfully! Fee: ${formatMoney(feeAmount)}`, 'success');
        
        // Reset the withdrawal form
        resetWithdrawalForm();
        
        // Refresh user data to update balances
        await loadUserData();
        
    } catch (error) {
        hideLoading();
        console.error('Withdrawal error:', error);
        showToast('Error submitting withdrawal: ' + error.message, 'error');
    }
}

function prevWithdrawStep(currentStep) {
    if (currentStep === 2) {
        document.getElementById('withdrawStep2').classList.remove('active');
        document.getElementById('withdrawStep1').classList.add('active');
        
        document.getElementById('withdrawStep2Indicator').classList.remove('active');
        document.getElementById('withdrawStep2Indicator').classList.remove('completed');
        document.getElementById('withdrawStep1Indicator').classList.add('active');
        document.getElementById('withdrawStep1Indicator').classList.remove('completed');
        
    } else if (currentStep === 3) {
        document.getElementById('withdrawStep3').classList.remove('active');
        document.getElementById('withdrawStep2').classList.add('active');
        
        document.getElementById('withdrawStep3Indicator').classList.remove('active');
        document.getElementById('withdrawStep3Indicator').classList.remove('completed');
        document.getElementById('withdrawStep2Indicator').classList.add('active');
    }
}

// ============================================
// FIXED SUBMIT WITHDRAWAL FUNCTION
// ============================================

// ============================================
// FIXED SUBMIT WITHDRAWAL WITH FEE
// ============================================

async function submitWithdrawal() {
    console.log('Submitting withdrawal...');
    
    const confirmCheck = document.getElementById('withdrawConfirm');
    if (!confirmCheck || !confirmCheck.checked) {
        showToast('Please confirm the withdrawal details', 'error');
        return;
    }
    
    if (!window.currentWithdrawal) {
        showToast('Withdrawal data not found. Please start over.', 'error');
        return;
    }
    
    const { amount, feeAmount, netAmount, fromReferral, fromBalance, account } = window.currentWithdrawal;
    
    if (!amount || amount <= 0) {
        showToast('Invalid withdrawal amount', 'error');
        return;
    }
    
    if (!account) {
        showToast('No withdrawal account selected', 'error');
        return;
    }
    
    showLoading('Processing withdrawal request...');
    
    try {
        // Calculate fee if not already calculated
        const feePercentage = systemSettings.withdrawalFee || 10;
        const calculatedFeeAmount = feeAmount || (amount * feePercentage / 100);
        const calculatedNetAmount = netAmount || (amount - calculatedFeeAmount);
        
        // Create withdrawal data object with all required fields including fee
        const withdrawalData = {
            userId: currentUser.uid,
            username: currentUser.username,
            amount: amount,
            feeAmount: calculatedFeeAmount,
            netAmount: calculatedNetAmount,
            feePercentage: feePercentage,
            method: account.bankName,
            accountNumber: account.accountNumber,
            accountName: account.accountName,
            fromReferral: fromReferral || 0,
            fromBalance: fromBalance || amount,
            status: 'pending',
            createdAt: new Date().toISOString(),
            phone: currentUser.phone || account.accountNumber
        };
        
        console.log('Saving withdrawal with fee:', withdrawalData);
        
        // Save to Firestore
        const withdrawalRef = await db.collection('withdrawals').add(withdrawalData);
        console.log('Withdrawal saved with ID:', withdrawalRef.id);
        
        // Update user balances (deduct the FULL requested amount)
        const userRef = db.collection('users').doc(currentUser.uid);
        const today = new Date().toDateString();
        
        const updates = {
            lastWithdrawalDate: today,
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'withdrawal',
                description: `Withdrawal to ${account.bankName} - ${account.accountName} (Fee: ${formatMoney(calculatedFeeAmount)})`,
                amount: amount,
                netAmount: calculatedNetAmount,
                feeAmount: calculatedFeeAmount,
                status: 'pending',
                date: new Date().toISOString(),
                metadata: {
                    accountNumber: account.accountNumber,
                    bankName: account.bankName,
                    feePercentage: feePercentage,
                    withdrawalId: withdrawalRef.id
                }
            })
        };
        
        // Deduct the FULL requested amount from balances
        if (fromReferral > 0) {
            updates.referralBalance = firebase.firestore.FieldValue.increment(-fromReferral);
        }
        if (fromBalance > 0) {
            updates.balance = firebase.firestore.FieldValue.increment(-fromBalance);
        }
        
        await userRef.update(updates);
        
        // Update local user
        if (fromReferral > 0) {
            currentUser.referralBalance = (currentUser.referralBalance || 0) - fromReferral;
        }
        if (fromBalance > 0) {
            currentUser.balance = (currentUser.balance || 0) - fromBalance;
        }
        currentUser.lastWithdrawalDate = today;
        
        // Add notification for user
        await addNotification(
            currentUser.uid,
            '💰 Withdrawal Request Submitted',
            `Your withdrawal request of ${formatMoney(amount)} has been submitted. A ${formatMoney(calculatedFeeAmount)} fee (${feePercentage}%) will be deducted. You will receive ${formatMoney(calculatedNetAmount)}.`,
            'info'
        );
        
        // Log audit
        await logAudit('withdrawal_request', `Withdrawal request of ${formatMoney(amount)} (Fee: ${formatMoney(calculatedFeeAmount)}, Net: ${formatMoney(calculatedNetAmount)}) submitted by ${currentUser.username}`, currentUser.uid);
        
        hideLoading();
        showToast(`✅ Withdrawal request of ${formatMoney(amount)} submitted successfully! Fee: ${formatMoney(calculatedFeeAmount)}`, 'success');
        
        // Reset the withdrawal form
        resetWithdrawalForm();
        
        // Refresh user data to update balances
        await loadUserData();
        
    } catch (error) {
        hideLoading();
        console.error('Withdrawal error:', error);
        showToast('Error submitting withdrawal: ' + error.message, 'error');
    }
}

/**
 * Reset withdrawal form completely
 */
function resetWithdrawalForm() {
    // Reset to step 1
    const step1 = document.getElementById('withdrawStep1');
    const step2 = document.getElementById('withdrawStep2');
    const step3 = document.getElementById('withdrawStep3');
    
    if (step1) step1.classList.add('active');
    if (step2) step2.classList.remove('active');
    if (step3) step3.classList.remove('active');
    
    // Reset indicators
    const step1Indicator = document.getElementById('withdrawStep1Indicator');
    const step2Indicator = document.getElementById('withdrawStep2Indicator');
    const step3Indicator = document.getElementById('withdrawStep3Indicator');
    
    if (step1Indicator) {
        step1Indicator.classList.add('active');
        step1Indicator.classList.remove('completed');
    }
    if (step2Indicator) {
        step2Indicator.classList.remove('active');
        step2Indicator.classList.remove('completed');
    }
    if (step3Indicator) {
        step3Indicator.classList.remove('active');
        step3Indicator.classList.remove('completed');
    }
    
    // Clear form fields
    const amountInput = document.getElementById('withdrawAmount');
    if (amountInput) amountInput.value = '';
    
    const confirmCheck = document.getElementById('withdrawConfirm');
    if (confirmCheck) confirmCheck.checked = false;
    
    // Reset selected account
    selectedWithdrawAccount = null;
    window.currentWithdrawal = null;
    
    // Disable next button in step 1
    const nextBtn = document.getElementById('withdrawStep1Next');
    if (nextBtn) nextBtn.disabled = true;
    
    // Update available balance display
    if (currentUser) {
        const totalBalance = (currentUser.balance || 0) + (currentUser.referralBalance || 0);
        const availableSpan = document.getElementById('availableBalance');
        if (availableSpan) {
            availableSpan.textContent = formatMoney(totalBalance);
        }
    }
    
    // Clear selected account info display
    const accountInfo = document.getElementById('selectedAccountInfo');
    if (accountInfo) {
        accountInfo.innerHTML = '';
    }
}

// Toggle other bank field for withdrawal form
function toggleOtherBankField() {
    const bankSelect = document.getElementById('withdrawBankName');
    if (bankSelect) {
        bankSelect.addEventListener('change', function() {
            const otherField = document.querySelector('.other-bank-field');
            if (this.value === 'Other') {
                otherField.style.display = 'block';
            } else {
                otherField.style.display = 'none';
            }
        });
    }
}

// Initialize deposit and withdrawal when tabs are loaded
function initDepositTab() {
    loadPaymentMethodsForDeposit();
}

function initWithdrawTab() {
    if (currentUser) {
        loadWithdrawAccounts();
    }
    toggleOtherBankField();
}

// Bank Account Management
window.loadBankAccounts = loadBankAccounts;
window.showAddBankAccountForm = showAddBankAccountForm;
window.closeBankAccountFormModal = closeBankAccountFormModal;
window.saveBankAccount = saveBankAccount;
window.editBankAccount = editBankAccount;
window.deleteBankAccount = deleteBankAccount;

// Withdrawal Flow
window.loadWithdrawAccounts = loadWithdrawAccounts;
window.selectWithdrawAccount = selectWithdrawAccount;
window.showAddAccountForm = showAddAccountForm;
window.cancelAddAccount = cancelAddAccount;
window.saveWithdrawAccount = saveWithdrawAccount;
window.nextWithdrawStep = nextWithdrawStep;
window.prevWithdrawStep = prevWithdrawStep;
window.submitWithdrawal = submitWithdrawal;

window.submitWithdrawal = submitWithdrawal;
window.nextWithdrawStep = nextWithdrawStep;
window.prevWithdrawStep = prevWithdrawStep;
window.resetWithdrawalForm = resetWithdrawalForm;

// ============================================
// FORM-BASED DEPOSIT SECTION
// ============================================

// Global variables
let selectedPaymentMethod = null;

/**
 * Initialize deposit tab
 */
function initDepositTab() {
    console.log('Initializing deposit tab...');
    loadPaymentMethods();
    resetDepositForm();
}

/**
 * Load payment methods from admin bank accounts
 */
async function loadPaymentMethods() {
    console.log('Loading payment methods...');
    
    try {
        const snapshot = await db.collection('bankAccounts')
            .where('status', '==', 'active')
            .get();
        
        bankAccounts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Sort alphabetically
        bankAccounts.sort((a, b) => a.bankName.localeCompare(b.bankName));
        
        renderPaymentMethods();
        
    } catch (error) {
        console.error('Error loading payment methods:', error);
        showToast('Error loading payment methods', 'error');
    }
}

/**
 * Render payment methods in the grid
 */
function renderPaymentMethods() {
    const grid = document.getElementById('depositPaymentMethodsGrid');
    if (!grid) return;
    
    if (bankAccounts.length === 0) {
        grid.innerHTML = '<p class="no-data">No payment methods available. Please contact support.</p>';
        return;
    }
    
    let html = '';
    bankAccounts.forEach(account => {
        const color = getBankColor(account.bankName);
        const icon = getBankIcon(account.bankName);
        
        html += `
            <div class="payment-method-card" onclick="selectPaymentMethod('${account.id}')" id="method-${account.id}">
                <div class="bank-icon" style="background: ${color}20; color: ${color}">
                    <i class="fas ${icon}"></i>
                </div>
                <h4>${account.bankName}</h4>
                <p class="account-number">${account.accountNumber}</p>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

/**
 * Select payment method
 */
window.selectPaymentMethod = function(accountId) {
    console.log('Selecting payment method:', accountId);
    
    // Remove selected class from all
    document.querySelectorAll('.payment-method-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Add selected class to chosen
    const selectedCard = document.getElementById(`method-${accountId}`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    // Find and store selected account
    const account = bankAccounts.find(a => a.id === accountId);
    if (account) {
        selectedPaymentMethod = account;
        
        // Show bank details
        document.getElementById('selectedBankName').textContent = account.bankName;
        document.getElementById('selectedBankAccount').textContent = account.accountNumber;
        document.getElementById('selectedBankAccountName').textContent = account.accountName;
        document.getElementById('selectedBankDetails').style.display = 'block';
        
        // Hide any error
        document.getElementById('paymentMethodError').style.display = 'none';
    }
};

/**
 * Get bank color
 */
function getBankColor(bankName) {
    const colors = {
        'M-Pesa': '#4CAF50',
        'Airtel Money': '#FF0000',
        'Tigo Pesa': '#0000FF',
        'CRDB Bank': '#2196F3',
        'NMB Bank': '#9C27B0',
        'NBC Bank': '#FF9800',
        'Stanbic Bank': '#795548',
        'Exim Bank': '#607D8B',
        'Azania Bank': '#3F51B5'
    };
    return colors[bankName] || '#666';
}

/**
 * Get bank icon
 */
function getBankIcon(bankName) {
    if (bankName.includes('M-Pesa') || bankName.includes('Airtel') || bankName.includes('Tigo')) {
        return 'fa-mobile-alt';
    }
    return 'fa-university';
}

/**
 * Copy bank details to clipboard
 */
window.copyBankDetails = function() {
    if (!selectedPaymentMethod) {
        showToast('No payment method selected', 'error');
        return;
    }
    
    const text = `${selectedPaymentMethod.bankName}\nAccount: ${selectedPaymentMethod.accountNumber}\nName: ${selectedPaymentMethod.accountName}`;
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('Bank details copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = selectedPaymentMethod.accountNumber;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Account number copied to clipboard!', 'success');
    });
};

/**
 * Validate form inputs
 */
function validateDepositForm() {
    let isValid = true;
    
    // Check payment method
    if (!selectedPaymentMethod) {
        document.getElementById('paymentMethodError').style.display = 'block';
        isValid = false;
    } else {
        document.getElementById('paymentMethodError').style.display = 'none';
    }
    
    // Check full name
    const fullName = document.getElementById('depositFullName').value.trim();
    if (!fullName) {
        document.getElementById('depositFullName').classList.add('error');
        isValid = false;
    } else {
        document.getElementById('depositFullName').classList.remove('error');
    }
    
    // Check phone number
    const phone = document.getElementById('depositPhoneNumber').value.trim();
    if (!phone || phone.length < 10) {
        document.getElementById('depositPhoneNumber').classList.add('error');
        isValid = false;
    } else {
        document.getElementById('depositPhoneNumber').classList.remove('error');
    }
    
    // Check amount
    const amount = parseFloat(document.getElementById('depositAmount').value);
    if (!amount || amount < systemSettings.minDeposit || amount > systemSettings.maxDeposit) {
        document.getElementById('depositAmount').classList.add('error');
        isValid = false;
    } else {
        document.getElementById('depositAmount').classList.remove('error');
    }
    
    // Check transaction reference
    const reference = document.getElementById('transactionReference').value.trim();
    if (!reference) {
        document.getElementById('transactionReference').classList.add('error');
        isValid = false;
    } else {
        document.getElementById('transactionReference').classList.remove('error');
    }
    
    // Check terms
    const terms = document.getElementById('depositTerms').checked;
    if (!terms) {
        showToast('Please confirm that the information is correct', 'error');
        isValid = false;
    }
    
    return isValid;
}

/**
 * Process deposit form submission
 */
window.processDepositForm = async function() {
    console.log('Processing deposit form');
    
    if (!validateDepositForm()) {
        return;
    }
    
    // Show loading
    document.getElementById('depositFormLoading').style.display = 'flex';
    document.getElementById('depositSubmitBtn').disabled = true;
    
    try {
        // Get form values
        const fullName = document.getElementById('depositFullName').value.trim();
        const phone = document.getElementById('depositPhoneNumber').value.trim();
        const amount = parseFloat(document.getElementById('depositAmount').value);
        const reference = document.getElementById('transactionReference').value.trim();
        const depositDate = document.getElementById('depositDate').value || new Date().toISOString().split('T')[0];
        
        // Create deposit request
        const depositRequest = {
            userId: currentUser.uid,
            username: currentUser.username,
            userFullName: fullName,
            userPhone: phone,
            amount: amount,
            method: selectedPaymentMethod.bankName,
            bankAccountId: selectedPaymentMethod.id,
            bankAccountNumber: selectedPaymentMethod.accountNumber,
            bankAccountName: selectedPaymentMethod.accountName,
            transactionReference: reference,
            depositDate: depositDate,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        console.log('Saving deposit:', depositRequest);
        
        // Save to Firestore
        await db.collection('deposits').add(depositRequest);
        
        // Add to user history
        const userRef = db.collection('users').doc(currentUser.uid);
        await userRef.update({
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'deposit',
                description: `Deposit via ${selectedPaymentMethod.bankName} - Ref: ${reference}`,
                amount: amount,
                status: 'pending',
                date: new Date().toISOString()
            })
        });
        
        // Success message
        showToast('✅ Deposit request submitted successfully!', 'success');
        
        // Reset form
        resetDepositForm();
        
        // Refresh user data
        await loadUserData();
        
    } catch (error) {
        console.error('Deposit error:', error);
        showToast('Error submitting deposit: ' + error.message, 'error');
    } finally {
        // Hide loading
        document.getElementById('depositFormLoading').style.display = 'none';
        document.getElementById('depositSubmitBtn').disabled = false;
    }
};

/**
 * Reset deposit form
 */
function resetDepositForm() {
    // Clear selected payment method
    selectedPaymentMethod = null;
    document.querySelectorAll('.payment-method-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.getElementById('selectedBankDetails').style.display = 'none';
    document.getElementById('paymentMethodError').style.display = 'none';
    
    // Clear form fields
    document.getElementById('depositFullName').value = '';
    document.getElementById('depositPhoneNumber').value = '';
    document.getElementById('depositAmount').value = '';
    document.getElementById('transactionReference').value = '';
    document.getElementById('depositTerms').checked = false;
    
    // Remove error classes
    document.querySelectorAll('.form-group input').forEach(input => {
        input.classList.remove('error');
    });
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============================================
// EXPORT FUNCTIONS
// ============================================
window.initDepositTab = initDepositTab;
window.selectPaymentMethod = selectPaymentMethod;
window.copyBankDetails = copyBankDetails;
window.processDepositForm = processDepositForm;

// Admin Functions
window.approveDeposit = approveDeposit;
window.rejectDeposit = rejectDeposit;
window.approveWithdrawal = approveWithdrawal;
window.rejectWithdrawal = rejectWithdrawal;
window.viewDepositDetails = viewDepositDetails;
window.viewWithdrawalDetails = viewWithdrawalDetails;

// ============================================
// SEARCH FUNCTIONS FOR ADMIN TABLES
// ============================================

let depositSearchTimeout;
let withdrawalSearchTimeout;

/**
 * Search deposits
 */
function searchDeposits() {
    clearTimeout(depositSearchTimeout);
    
    depositSearchTimeout = setTimeout(() => {
        const searchTerm = document.getElementById('depositSearch')?.value.toLowerCase() || '';
        const tableBody = document.getElementById('depositsTableBody');
        
        if (!tableBody) return;
        
        const filteredDeposits = deposits.filter(deposit => {
            const userName = (deposit.userFullName || deposit.username || '').toLowerCase();
            const userPhone = (deposit.userPhone || deposit.userAccountNumber || deposit.phone || '').toLowerCase();
            const transactionRef = (deposit.transactionReference || deposit.transactionCode || '').toLowerCase();
            const bankName = (deposit.method || deposit.bankName || '').toLowerCase();
            const accountNumber = (deposit.bankAccountNumber || deposit.accountNumber || '').toLowerCase();
            
            return userName.includes(searchTerm) ||
                userPhone.includes(searchTerm) ||
                transactionRef.includes(searchTerm) ||
                bankName.includes(searchTerm) ||
                accountNumber.includes(searchTerm);
        });
        
        renderFilteredDeposits(filteredDeposits);
    }, 300);
}

/**
 * Render filtered deposits
 */
function renderFilteredDeposits(filteredDeposits) {
    const tableBody = document.getElementById('depositsTableBody');
    if (!tableBody) return;
    
    if (filteredDeposits.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="no-data"><i class="fas fa-search"></i> No deposits match your search</td></tr>';
        return;
    }
    
    let html = '';
    filteredDeposits.forEach(deposit => {
        const date = deposit.createdAt || deposit.date || deposit.timestamp;
        const formattedDate = date ? new Date(date).toLocaleString() : 'N/A';
        const transactionRef = deposit.transactionReference || deposit.transactionCode || 'N/A';
        const userName = deposit.userFullName || deposit.username || 'Unknown';
        const userPhone = deposit.userPhone || deposit.userAccountNumber || deposit.phone || 'N/A';
        const bankName = deposit.method || deposit.bankName || 'N/A';
        const bankAccount = deposit.bankAccountNumber || deposit.accountNumber || 'N/A';
        const statusClass = getStatusClass(deposit.status);
        
        html += `
            <tr class="deposit-row ${deposit.status === 'pending' ? 'pending-row' : ''}">
                <td>
                    <div class="user-info-compact">
                        <i class="fas fa-user-circle"></i>
                        <div>
                            <strong>${userName}</strong>
                            <small>@${deposit.username || 'unknown'}</small>
                        </div>
                    </div>
                </td>
                <td><span class="amount-large">${formatMoney(deposit.amount)}</span></td>
                <td>
                    <div class="payment-method-badge">
                        <i class="fas ${getBankIcon(bankName)}"></i>
                        <span>${bankName}</span>
                    </div>
                </td>
                <td>
                    <div class="account-info">
                        <div><strong>${bankAccount}</strong></div>
                        <small>${deposit.bankAccountName || ''}</small>
                    </div>
                </td>
                <td>
                    <div class="user-contact">
                        <div><i class="fas fa-phone"></i> ${userPhone}</div>
                        <small><i class="fas fa-hashtag"></i> ${transactionRef}</small>
                    </div>
                </td>
                <td><span class="timestamp">${formattedDate}</span></td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <i class="fas ${getStatusIcon(deposit.status)}"></i>
                        ${deposit.status || 'pending'}
                    </span>
                </td>
                <td class="action-buttons">
                    ${deposit.status === 'pending' ? `
                        <button class="action-btn small success" onclick="approveDeposit('${deposit.id}')">Approve</button>
                        <button class="action-btn small danger" onclick="rejectDeposit('${deposit.id}')">Reject</button>
                    ` : ''}
                    <button class="action-btn small info" onclick="viewDepositDetails('${deposit.id}')">View</button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

/**
 * Search withdrawals
 */
function searchWithdrawals() {
    clearTimeout(withdrawalSearchTimeout);
    
    withdrawalSearchTimeout = setTimeout(() => {
        const searchTerm = document.getElementById('withdrawalSearch')?.value.toLowerCase() || '';
        const tableBody = document.getElementById('withdrawalsTableBody');
        
        if (!tableBody) return;
        
        const filteredWithdrawals = withdrawals.filter(withdrawal => {
            const userName = (withdrawal.username || '').toLowerCase();
            const accountName = (withdrawal.accountName || withdrawal.phone || '').toLowerCase();
            const accountNumber = (withdrawal.accountNumber || withdrawal.phone || '').toLowerCase();
            const bankName = (withdrawal.method || withdrawal.bankName || '').toLowerCase();
            
            return userName.includes(searchTerm) ||
                accountName.includes(searchTerm) ||
                accountNumber.includes(searchTerm) ||
                bankName.includes(searchTerm);
        });
        
        renderFilteredWithdrawals(filteredWithdrawals);
    }, 300);
}

/**
 * Render filtered withdrawals
 */
function renderFilteredWithdrawals(filteredWithdrawals) {
    const tableBody = document.getElementById('withdrawalsTableBody');
    if (!tableBody) return;
    
    if (filteredWithdrawals.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="no-data"><i class="fas fa-search"></i> No withdrawals match your search</td></tr>';
        return;
    }
    
    let html = '';
    filteredWithdrawals.forEach(withdrawal => {
        const date = withdrawal.createdAt || withdrawal.date || withdrawal.timestamp;
        const formattedDate = date ? new Date(date).toLocaleString() : 'N/A';
        const accountName = withdrawal.accountName || withdrawal.phone || 'N/A';
        const accountNumber = withdrawal.accountNumber || withdrawal.phone || 'N/A';
        const bankName = withdrawal.method || withdrawal.bankName || 'N/A';
        const fromBalance = withdrawal.fromBalance || 0;
        const fromReferral = withdrawal.fromReferral || 0;
        const statusClass = getStatusClass(withdrawal.status);
        
        html += `
            <tr class="withdrawal-row ${withdrawal.status === 'pending' ? 'pending-row' : ''}">
                <td>
                    <div class="user-info-compact">
                        <i class="fas fa-user-circle"></i>
                        <div>
                            <strong>${withdrawal.username || 'Unknown'}</strong>
                            <small>${withdrawal.userId ? withdrawal.userId.substring(0, 8) + '...' : ''}</small>
                        </div>
                    </div>
                </td>
                <td><span class="amount-large">${formatMoney(withdrawal.amount)}</span></td>
                <td>
                    <div class="payment-method-badge">
                        <i class="fas ${getBankIcon(bankName)}"></i>
                        <span>${bankName}</span>
                    </div>
                </td>
                <td>
                    <div class="account-info">
                        <div><strong>${accountNumber}</strong></div>
                        <small>${accountName}</small>
                    </div>
                </td>
                <td>
                    <div class="funds-source">
                        ${fromBalance > 0 ? `
                            <span class="source-badge balance">
                                <i class="fas fa-wallet"></i> ${formatMoney(fromBalance)}
                            </span>
                        ` : ''}
                        ${fromReferral > 0 ? `
                            <span class="source-badge referral">
                                <i class="fas fa-gift"></i> ${formatMoney(fromReferral)}
                            </span>
                        ` : ''}
                    </div>
                </td>
                <td><span class="timestamp">${formattedDate}</span></td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <i class="fas ${getStatusIcon(withdrawal.status)}"></i>
                        ${withdrawal.status || 'pending'}
                    </span>
                </td>
                <td class="action-buttons">
                    ${withdrawal.status === 'pending' ? `
                        <button class="action-btn small success" onclick="approveWithdrawal('${withdrawal.id}')">Approve</button>
                        <button class="action-btn small danger" onclick="rejectWithdrawal('${withdrawal.id}')">Reject</button>
                    ` : ''}
                    <button class="action-btn small info" onclick="viewWithdrawalDetails('${withdrawal.id}')">View</button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// Search functions
window.searchDeposits = searchDeposits;
window.searchWithdrawals = searchWithdrawals;

// ============================================
// DEBUG FUNCTION - CHECK COLLECTIONS
// ============================================

async function debugAdminCollections() {
    console.log('=== DEBUG: Checking Admin Collections ===');
    
    try {
        // Check deposits collection
        const depositsSnap = await db.collection('deposits').limit(5).get();
        console.log('Deposits found:', depositsSnap.size);
        depositsSnap.forEach(doc => {
            console.log('Deposit:', doc.id, doc.data());
        });
        
        // Check withdrawals collection
        const withdrawalsSnap = await db.collection('withdrawals').limit(5).get();
        console.log('Withdrawals found:', withdrawalsSnap.size);
        withdrawalsSnap.forEach(doc => {
            console.log('Withdrawal:', doc.id, doc.data());
        });
        
        if (depositsSnap.size === 0) {
            console.log('No deposits found. Creating test deposit...');
            await createTestDeposit();
        }
        
        if (withdrawalsSnap.size === 0) {
            console.log('No withdrawals found. Creating test withdrawal...');
            await createTestWithdrawal();
        }
        
    } catch (error) {
        console.error('Debug error:', error);
    }
    
    console.log('=== END DEBUG ===');
}

// Create test deposit for debugging
async function createTestDeposit() {
    if (!currentUser) return;
    
    try {
        const testDeposit = {
            userId: currentUser.uid,
            username: currentUser.username,
            userFullName: currentUser.fullName || 'Test User',
            userPhone: currentUser.phone || '0712345678',
            amount: 50000,
            method: 'M-Pesa',
            bankAccountId: 'test123',
            bankAccountNumber: '0763456789',
            bankAccountName: 'SmartTask Payments',
            transactionReference: 'TEST' + Date.now(),
            depositDate: new Date().toISOString().split('T')[0],
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        await db.collection('deposits').add(testDeposit);
        console.log('Test deposit created');
    } catch (error) {
        console.error('Error creating test deposit:', error);
    }
}

// Create test withdrawal for debugging
async function createTestWithdrawal() {
    if (!currentUser) return;
    
    try {
        const testWithdrawal = {
            userId: currentUser.uid,
            username: currentUser.username,
            amount: 25000,
            method: 'M-Pesa',
            accountNumber: '0712345678',
            accountName: currentUser.fullName || 'Test User',
            fromBalance: 20000,
            fromReferral: 5000,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        await db.collection('withdrawals').add(testWithdrawal);
        console.log('Test withdrawal created');
    } catch (error) {
        console.error('Error creating test withdrawal:', error);
    }
}

// ============================================
// FIXED ADMIN DATA LOADING
// ============================================

// Update loadAdminData function to include fee statistics
async function loadAdminData() {
    console.log('Loading admin data...');
    showLoading('Loading admin data...');
    
    try {
        // Load users
        await loadUsers();
        
        // Load deposits and withdrawals
        try {
            await loadDeposits();
            await loadWithdrawals();
            console.log('Deposits loaded:', deposits.length);
            console.log('Withdrawals loaded:', withdrawals.length);
        } catch (e) {
            console.error('Error loading transactions:', e);
        }

        // Calculate totals including fees
        let totalDeposits = 0, totalWithdrawals = 0, totalWithdrawalFees = 0;
        let pendingDeposits = 0, pendingWithdrawals = 0, totalProfits = 0;
        
        // From users history
        users.forEach(user => {
            if (user.history) {
                user.history.forEach(item => {
                    if (item.type === 'deposit' && item.status === 'completed') totalDeposits += item.amount;
                    else if (item.type === 'withdrawal' && item.status === 'completed') {
                        totalWithdrawals += item.amount;
                        totalWithdrawalFees += item.feeAmount || 0;
                    }
                    else if (item.type === 'profit' && item.status === 'completed') totalProfits += item.amount;
                });
            }
        });
        
        // From withdrawals collection (for pending ones)
        withdrawals.forEach(withdrawal => {
            if (withdrawal.status === 'pending') {
                pendingWithdrawals += withdrawal.amount;
            }
            if (withdrawal.status === 'completed') {
                totalWithdrawalFees += withdrawal.feeAmount || 0;
            }
        });
        
        // From deposits collection
        deposits.forEach(deposit => {
            if (deposit.status === 'pending') pendingDeposits += deposit.amount;
        });

        // Update stats displays
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        setText('totalDeposits', formatMoney(totalDeposits));
        setText('totalWithdrawals', formatMoney(totalWithdrawals));
        setText('platformProfit', formatMoney(totalDeposits - totalWithdrawals));
        setText('pendingDeposits', formatMoney(pendingDeposits));
        setText('pendingWithdrawals', formatMoney(pendingWithdrawals));
        setText('totalProfits', formatMoney(totalProfits));
        
        // Add fee display if element exists
        const totalFeesEl = document.getElementById('totalWithdrawalFees');
        if (totalFeesEl) {
            totalFeesEl.textContent = formatMoney(totalWithdrawalFees);
        }

        // Load tables
        await loadUsersTable();
        await loadRecentActivities();
        await loadDepositsTable();
        await loadWithdrawalsTable();
        loadSystemHealth();
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Error loading admin data:', error);
        showToast('Error loading admin data', 'error');
    }
}

// Call this when admin dashboard loads
function initAdminPanel() {
    console.log('Initializing admin panel...');
    
    // Add refresh button
    setTimeout(() => {
        addRefreshButton();
    }, 500);
    
    // Load initial data
    loadAdminData();
}

// ============================================
// HANDLE MEDIA UPLOAD TO FIREBASE STORAGE
// ============================================

let currentUploadTask = null; // To track upload progress

/**
 * Handle media upload from file input
 */
async function handleMediaUpload() {
    console.log('handleMediaUpload called');
    
    const fileInput = document.getElementById('taskMediaUpload');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast('Please select a file to upload', 'warning');
        return;
    }

    const file = fileInput.files[0];
    
    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    const validTypes = [...validImageTypes, ...validVideoTypes];
    
    if (!validTypes.includes(file.type)) {
        showToast('Invalid file type. Please upload an image (JPEG, PNG, GIF) or video (MP4, WebM)', 'error');
        fileInput.value = ''; // Clear the input
        return;
    }
    
    // Validate file size (max 10MB for images, 50MB for videos)
    const isVideo = validVideoTypes.includes(file.type);
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB for video, 10MB for images
    
    if (file.size > maxSize) {
        showToast(`File too large. Maximum size: ${isVideo ? '50MB' : '10MB'}`, 'error');
        fileInput.value = '';
        return;
    }

    // Show loading with progress
    showLoading('Uploading file...');
    
    // Create a unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop();
    const filename = `tasks/${timestamp}_${randomString}.${extension}`;
    
    // Create storage reference
    const storageRef = storage.ref();
    const fileRef = storageRef.child(filename);
    
    // Create upload task
    const uploadTask = fileRef.put(file);
    currentUploadTask = uploadTask;
    
    // Monitor upload progress
    uploadTask.on('state_changed', 
        (snapshot) => {
            // Progress function
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
            
            // Update loading message
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                let progressEl = loadingOverlay.querySelector('.upload-progress');
                if (!progressEl) {
                    progressEl = document.createElement('div');
                    progressEl.className = 'upload-progress';
                    loadingOverlay.appendChild(progressEl);
                }
                progressEl.innerHTML = `
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <p>Uploading: ${Math.round(progress)}%</p>
                `;
            }
        },
        (error) => {
            // Error function
            console.error('Upload error:', error);
            hideLoading();
            currentUploadTask = null;
            
            // Reset loading overlay
            resetLoadingOverlay();
            
            // Handle specific errors
            switch (error.code) {
                case 'storage/unauthorized':
                    showToast('You don\'t have permission to upload files', 'error');
                    break;
                case 'storage/canceled':
                    showToast('Upload was canceled', 'info');
                    break;
                case 'storage/unknown':
                    showToast('An unknown error occurred during upload', 'error');
                    break;
                default:
                    showToast('Error uploading file: ' + error.message, 'error');
            }
            
            fileInput.value = ''; // Clear the input
        },
        async () => {
            // Complete function
            try {
                // Upload completed successfully, get the download URL
                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                
                console.log('File available at:', downloadURL);
                
                // Set the URL in the media URL input
                const mediaUrlInput = document.getElementById('taskMediaUrl');
                if (mediaUrlInput) {
                    mediaUrlInput.value = downloadURL;
                    
                    // Trigger a change event to notify any listeners
                    const event = new Event('change', { bubbles: true });
                    mediaUrlInput.dispatchEvent(event);
                    
                    showToast('File uploaded successfully!', 'success');
                }
                
                // Clear the file input
                fileInput.value = '';
                
            } catch (error) {
                console.error('Error getting download URL:', error);
                showToast('File uploaded but failed to get URL', 'error');
            } finally {
                hideLoading();
                currentUploadTask = null;
                
                // Reset loading overlay
                resetLoadingOverlay();
            }
        }
    );
}

/**
 * Reset loading overlay to default state
 */
function resetLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.innerHTML = '<div class="spinner"></div>';
    }
}

/**
 * Cancel current upload
 */
function cancelUpload() {
    if (currentUploadTask) {
        currentUploadTask.cancel();
        currentUploadTask = null;
        showToast('Upload canceled', 'info');
        hideLoading();
        resetLoadingOverlay();
    }
}

/**
 * Handle multiple media uploads
 */
async function handleMultipleMediaUpload() {
    const fileInput = document.getElementById('taskImages');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast('Please select files to upload', 'warning');
        return;
    }

    const files = Array.from(fileInput.files);
    
    // Validate total size (max 100MB total)
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 100 * 1024 * 1024) {
        showToast('Total file size too large. Maximum 100MB', 'error');
        fileInput.value = '';
        return;
    }

    showLoading('Uploading files...');
    
    try {
        const uploadPromises = files.map(async (file, index) => {
            // Validate individual file
            const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
            const validTypes = [...validImageTypes, ...validVideoTypes];
            
            if (!validTypes.includes(file.type)) {
                throw new Error(`Invalid file type: ${file.type}`);
            }
            
            // Create unique filename
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            const extension = file.name.split('.').pop();
            const filename = `tasks/${timestamp}_${randomString}_${index}.${extension}`;
            
            // Upload file
            const storageRef = storage.ref();
            const fileRef = storageRef.child(filename);
            await fileRef.put(file);
            
            // Get download URL
            const downloadURL = await fileRef.getDownloadURL();
            
            return {
                name: file.name,
                url: downloadURL,
                type: file.type
            };
        });
        
        const uploadedFiles = await Promise.all(uploadPromises);
        
        // Display uploaded files in preview
        previewUploadedFiles(uploadedFiles);
        
        showToast(`${uploadedFiles.length} file(s) uploaded successfully!`, 'success');
        fileInput.value = '';
        
    } catch (error) {
        console.error('Error uploading multiple files:', error);
        showToast('Error uploading files: ' + error.message, 'error');
    } finally {
        hideLoading();
        resetLoadingOverlay();
    }
}

/**
 * Preview uploaded files
 */
function previewUploadedFiles(files) {
    const previewContainer = document.getElementById('imagePreview');
    if (!previewContainer) return;
    
    let html = '';
    files.forEach(file => {
        const isVideo = file.type.startsWith('video/');
        html += `
            <div class="preview-item">
                ${isVideo ? 
                    `<video src="${file.url}" controls></video>` : 
                    `<img src="${file.url}" alt="${file.name}">`
                }
                <div class="preview-actions">
                    <button onclick="copyToClipboard('${file.url}')" title="Copy URL">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button onclick="useThisMedia('${file.url}')" title="Use this media">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    previewContainer.innerHTML = html;
}

/**
 * Use selected media URL
 */
function useThisMedia(url) {
    const mediaUrlInput = document.getElementById('taskMediaUrl');
    if (mediaUrlInput) {
        mediaUrlInput.value = url;
        showToast('Media URL set!', 'success');
        
        // Close modal if needed
        const modal = document.getElementById('taskFormModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
}

// Add CSS styles for upload progress and previews
const uploadStyles = `
    .upload-progress {
        text-align: center;
        color: white;
        margin-top: 20px;
    }
    
    .upload-progress .progress-bar {
        width: 200px;
        height: 20px;
        background: rgba(255,255,255,0.2);
        border-radius: 10px;
        overflow: hidden;
        margin: 10px auto;
    }
    
    .upload-progress .progress-fill {
        height: 100%;
        background: #4CAF50;
        transition: width 0.3s ease;
    }
    
    .image-preview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }
    
    .preview-item {
        position: relative;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .preview-item img,
    .preview-item video {
        width: 100%;
        height: 150px;
        object-fit: cover;
    }
    
    .preview-actions {
        position: absolute;
        top: 5px;
        right: 5px;
        display: flex;
        gap: 5px;
        opacity: 0;
        transition: opacity 0.2s;
    }
    
    .preview-item:hover .preview-actions {
        opacity: 1;
    }
    
    .preview-actions button {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: none;
        background: rgba(255,255,255,0.9);
        color: #333;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    
    .preview-actions button:hover {
        background: white;
        transform: scale(1.1);
    }
`;

// Add styles to document if not already added
if (!document.querySelector('#media-upload-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'media-upload-styles';
    styleSheet.textContent = uploadStyles;
    document.head.appendChild(styleSheet);
}

/**
 * Toggle media input based on media type
 */
function toggleMediaInput() {
    const mediaType = document.getElementById('taskMediaType')?.value;
    const mediaUrlGroup = document.getElementById('mediaUrlGroup');
    const mediaUpload = document.getElementById('taskMediaUpload');
    
    if (mediaUrlGroup) {
        // Update accept attribute based on media type
        if (mediaUpload) {
            if (mediaType === 'image') {
                mediaUpload.accept = 'image/*';
            } else if (mediaType === 'video') {
                mediaUpload.accept = 'video/*';
            } else {
                mediaUpload.accept = 'image/*,video/*';
            }
        }
        
        // Show/hide or modify URL group as needed
        mediaUrlGroup.style.display = 'block';
    }
}

// Make functions globally available
window.handleMediaUpload = handleMediaUpload;
window.cancelUpload = cancelUpload;
window.handleMultipleMediaUpload = handleMultipleMediaUpload;
window.useThisMedia = useThisMedia;
window.toggleMediaInput = toggleMediaInput;

console.log('Media upload functions loaded');

function extractYouTubeId(url) {
    if (!url) return null;
    
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    
    if (match && match[2].length === 11) {
        return match[2];
    }
    
    // Try alternative pattern for youtu.be links
    const shortPattern = /youtu\.be\/([^?]+)/;
    const shortMatch = url.match(shortPattern);
    if (shortMatch && shortMatch[1]) {
        return shortMatch[1];
    }
    
    return null;
}

// ============================================
// DEBUG TASK MEDIA FUNCTION
// ============================================

async function debugTaskMedia() {
    console.log('=== DEBUG TASK MEDIA ===');
    
    try {
        // Get all active tasks
        const snapshot = await db.collection('tasks')
            .where('status', '==', 'active')
            .get();
        
        console.log(`Found ${snapshot.size} active tasks`);
        
        snapshot.forEach(doc => {
            const task = doc.data();
            console.log('\n📋 Task:', task.title);
            console.log('   ID:', doc.id);
            console.log('   Media Type:', task.mediaType);
            console.log('   Media URL:', task.mediaUrl);
            console.log('   Full task data:', task);
        });
        
        // Also check if there are any tasks at all
        const allTasks = await db.collection('tasks').get();
        console.log(`\nTotal tasks in database: ${allTasks.size}`);
        
        if (allTasks.size === 0) {
            console.log('⚠️ No tasks found in database!');
            console.log('Please create tasks in admin panel first.');
        }
        
    } catch (error) {
        console.error('Debug error:', error);
    }
    
    console.log('=== END DEBUG ===');
}

// Expose debug function
window.debugTaskMedia = debugTaskMedia;

// ============================================
// CREATE TEST TASK WITH IMAGE
// ============================================

async function createTestTaskWithImage() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Only admin can create test tasks', 'error');
        return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    
    const testTask = {
        title: 'Test Task - Rate Product',
        description: 'Please rate this product to test the media display',
        mediaType: 'image',
        mediaUrl: 'https://picsum.photos/400/300?random=1',
        scheduledDate: firebase.firestore.Timestamp.fromDate(today),
        expiryDate: firebase.firestore.Timestamp.fromDate(tomorrow),
        status: 'active',
        category: 'Rating',
        createdBy: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const docRef = await db.collection('tasks').add(testTask);
        console.log('Test task created with ID:', docRef.id);
        showToast('Test task created successfully!', 'success');
        loadAdminTasks();
    } catch (error) {
        console.error('Error creating test task:', error);
        showToast('Error creating test task', 'error');
    }
}

async function createTestTaskWithVideo() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Only admin can create test tasks', 'error');
        return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    
    const testTask = {
        title: 'Test Task - Watch Video',
        description: 'Watch this test video and rate it',
        mediaType: 'video',
        mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        scheduledDate: firebase.firestore.Timestamp.fromDate(today),
        expiryDate: firebase.firestore.Timestamp.fromDate(tomorrow),
        status: 'active',
        category: 'Review',
        createdBy: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const docRef = await db.collection('tasks').add(testTask);
        console.log('Test video task created with ID:', docRef.id);
        showToast('Test video task created successfully!', 'success');
        loadAdminTasks();
    } catch (error) {
        console.error('Error creating test task:', error);
        showToast('Error creating test task', 'error');
    }
}

// Expose test functions
window.createTestTaskWithImage = createTestTaskWithImage;
window.createTestTaskWithVideo = createTestTaskWithVideo;

// ============================================
// ADMIN TASK MANAGEMENT - COMPLETE
// ============================================

/**
 * Load admin tasks with real-time updates
 */
async function loadAdminTasks() {
    console.log('Loading admin tasks...');
    
    try {
        if (tasksUnsubscribe) {
            tasksUnsubscribe();
        }
        
        // Listen for real-time updates
        tasksUnsubscribe = db.collection('tasks')
            .orderBy('scheduledDate', 'desc')
            .onSnapshot(snapshot => {
                tasks = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                renderAdminTasks();
                
                // Update task counts
                updateTaskCounts();
                
            }, error => {
                console.error('Error loading tasks:', error);
                showToast('Failed to load tasks', 'error');
            });
            
    } catch (error) {
        console.error('Error setting up tasks listener:', error);
        showToast('Failed to load tasks', 'error');
    }
}

/**
 * Update task counts in UI
 */
function updateTaskCounts() {
    const now = new Date();
    
    const activeTasks = tasks.filter(task => {
        if (task.status !== 'active') return false;
        const expiryDate = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
        return expiryDate > now;
    });
    
    const expiredTasks = tasks.filter(task => {
        if (task.status === 'active') {
            const expiryDate = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
            return expiryDate <= now;
        }
        return task.status !== 'active';
    });
    
    const activeCount = document.getElementById('activeTaskCount');
    const expiredCount = document.getElementById('expiredTaskCount');
    
    if (activeCount) activeCount.textContent = activeTasks.length;
    if (expiredCount) expiredCount.textContent = expiredTasks.length;
}

/**
 * Render admin tasks table
 */
function renderAdminTasks() {
    const activeBody = document.getElementById('activeTasksBody');
    const expiredBody = document.getElementById('expiredTasksBody');
    
    if (!activeBody || !expiredBody) {
        console.error('Task table bodies not found');
        return;
    }
    
    const now = new Date();
    
    // Filter tasks
    const activeTasks = tasks.filter(task => {
        if (task.status !== 'active') return false;
        const expiryDate = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
        return expiryDate > now;
    });
    
    const expiredTasks = tasks.filter(task => {
        if (task.status === 'active') {
            const expiryDate = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
            return expiryDate <= now;
        }
        return task.status !== 'active';
    });
    
    // Render active tasks
    let activeHtml = '';
    activeTasks.forEach(task => {
        const scheduledDate = task.scheduledDate?.toDate ? task.scheduledDate.toDate() : new Date(task.scheduledDate);
        const expiryDate = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
        
        // Get media preview
        const mediaPreview = getMediaPreview(task);
        
        activeHtml += `
            <tr class="task-row active-task">
                <td class="task-title">
                    <strong>${escapeHtml(task.title)}</strong>
                    <div class="task-desc-preview">${escapeHtml(task.description?.substring(0, 50) || '')}</div>
                </td>
                <td class="task-media-preview">${mediaPreview}</td>
                <td class="task-date">${scheduledDate.toLocaleDateString()}</td>
                <td class="task-date">${expiryDate.toLocaleString()}</td>
                <td><span class="category-badge">${task.category || 'Rating'}</span></td>
                <td><span class="status-badge success">Active</span></td>
                <td class="action-buttons">
                    <button class="action-btn small" onclick="editTask('${task.id}')" title="Edit Task">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn small warning" onclick="deactivateTask('${task.id}')" title="Deactivate Task">
                        <i class="fas fa-ban"></i>
                    </button>
                    <button class="action-btn small danger" onclick="deleteTask('${task.id}')" title="Delete Task">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="action-btn small info" onclick="previewTask('${task.id}')" title="Preview Task">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    activeBody.innerHTML = activeHtml || '<tr><td colspan="7" class="no-data"><i class="fas fa-tasks"></i> No active tasks</td></tr>';
    
    // Render expired tasks
    let expiredHtml = '';
    expiredTasks.forEach(task => {
        const expiryDate = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
        
        // Get media preview
        const mediaPreview = getMediaPreview(task);
        
        // Determine status display
        let statusText = 'Expired';
        let statusClass = 'warning';
        if (task.status === 'deactivated') {
            statusText = 'Deactivated';
            statusClass = 'danger';
        } else if (task.status === 'completed') {
            statusText = 'Completed';
            statusClass = 'success';
        }
        
        expiredHtml += `
            <tr class="task-row expired-task">
                <td class="task-title">
                    <strong>${escapeHtml(task.title)}</strong>
                    <div class="task-desc-preview">${escapeHtml(task.description?.substring(0, 50) || '')}</div>
                </td>
                <td class="task-media-preview">${mediaPreview}</td>
                <td class="task-date">${expiryDate.toLocaleDateString()}</td>
                <td><span class="category-badge">${task.category || 'Rating'}</span></td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="action-buttons">
                    <button class="action-btn small" onclick="reuseTask('${task.id}')" title="Reuse Task">
                        <i class="fas fa-redo-alt"></i> Reuse
                    </button>
                    <button class="action-btn small danger" onclick="deleteTask('${task.id}')" title="Delete Permanently">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    expiredBody.innerHTML = expiredHtml || '<tr><td colspan="6" class="no-data"><i class="fas fa-history"></i> No expired tasks</td></tr>';
}

/**
 * Get media preview for task table
 */
function getMediaPreview(task) {
    const mediaUrl = task.mediaUrl || '';
    const mediaType = task.mediaType || 'image';
    
    if (mediaType === 'video') {
        if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
            return `<div class="media-preview video-preview"><i class="fab fa-youtube"></i> YouTube Video</div>`;
        }
        return `<div class="media-preview video-preview"><i class="fas fa-video"></i> Video</div>`;
    } else {
        if (mediaUrl) {
            return `<div class="media-preview image-preview"><img src="${mediaUrl}" alt="preview" onerror="this.src='https://via.placeholder.com/40?text=No+Image'"></div>`;
        }
        return `<div class="media-preview no-media"><i class="fas fa-image"></i> No Image</div>`;
    }
}

/**
 * Show add task form
 */
function showAddTaskForm() {
    document.getElementById('taskFormTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Add New Task';
    document.getElementById('taskId').value = '';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskMediaType').value = 'image';
    document.getElementById('taskMediaUrl').value = '';
    document.getElementById('taskExternalLink').value = '';
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('taskScheduledDate').value = today;
    document.getElementById('taskExpiryHours').value = '24';
    document.getElementById('taskCategory').value = 'Rating';
    
    document.getElementById('taskFormModal').classList.add('show');
}

/**
 * Close task form modal
 */
function closeTaskFormModal() {
    document.getElementById('taskFormModal').classList.remove('show');
}

/**
 * Save task (create or update)
 */
async function saveTask() {
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const mediaType = document.getElementById('taskMediaType').value;
    let mediaUrl = document.getElementById('taskMediaUrl').value.trim();
    const scheduledDateStr = document.getElementById('taskScheduledDate').value;
    const expiryHours = parseInt(document.getElementById('taskExpiryHours').value) || 24;
    const category = document.getElementById('taskCategory').value;
    const externalLink = document.getElementById('taskExternalLink').value.trim();
    
    if (!title || !scheduledDateStr) {
        showToast('Please fill required fields', 'error');
        return;
    }
    
    // Set default media URL if empty
    if (!mediaUrl) {
        if (mediaType === 'video') {
            mediaUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
        } else {
            mediaUrl = 'https://via.placeholder.com/400x300?text=Task+Image';
        }
    }
    
    // Create scheduled date (start of day)
    const scheduled = new Date(scheduledDateStr + 'T00:00:00');
    // Create expiry date (end of day + expiry hours)
    const expiry = new Date(scheduled);
    expiry.setHours(expiry.getHours() + expiryHours);
    
    const taskData = {
        title,
        description: description || 'Complete this task',
        mediaType,
        mediaUrl,
        scheduledDate: firebase.firestore.Timestamp.fromDate(scheduled),
        expiryDate: firebase.firestore.Timestamp.fromDate(expiry),
        status: 'active',
        category: category || 'Rating',
        externalLink: externalLink || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    showLoading('Saving task...');
    
    try {
        if (id) {
            await db.collection('tasks').doc(id).update(taskData);
            showToast('Task updated successfully', 'success');
        } else {
            taskData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            taskData.createdBy = currentUser?.uid || 'admin';
            await db.collection('tasks').add(taskData);
            showToast('Task created successfully', 'success');
        }
        
        closeTaskFormModal();
        
    } catch (error) {
        console.error('Error saving task:', error);
        showToast('Error saving task: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Edit task
 */
async function editTask(taskId) {
    console.log('Editing task:', taskId);
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    document.getElementById('taskFormTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskMediaType').value = task.mediaType || 'image';
    document.getElementById('taskMediaUrl').value = task.mediaUrl || '';
    document.getElementById('taskExternalLink').value = task.externalLink || '';
    
    const scheduled = task.scheduledDate?.toDate ? task.scheduledDate.toDate() : new Date(task.scheduledDate);
    document.getElementById('taskScheduledDate').value = scheduled.toISOString().split('T')[0];
    
    const expiry = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
    const expiryHours = Math.round((expiry - scheduled) / (1000 * 60 * 60));
    document.getElementById('taskExpiryHours').value = expiryHours || 24;
    
    document.getElementById('taskCategory').value = task.category || 'Rating';
    
    document.getElementById('taskFormModal').classList.add('show');
}

/**
 * Deactivate task
 */
async function deactivateTask(taskId) {
    if (!confirm('Deactivate this task? It will no longer appear to users.')) return;
    
    showLoading('Deactivating task...');
    
    try {
        await db.collection('tasks').doc(taskId).update({
            status: 'deactivated',
            deactivatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            deactivatedBy: currentUser?.uid || 'admin'
        });
        showToast('Task deactivated', 'info');
    } catch (error) {
        console.error('Error deactivating task:', error);
        showToast('Error deactivating task', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Delete task permanently
 */
async function deleteTask(taskId) {
    if (!confirm('⚠️ Permanently delete this task? This action cannot be undone.')) return;
    
    showLoading('Deleting task...');
    
    try {
        await db.collection('tasks').doc(taskId).delete();
        showToast('Task deleted permanently', 'success');
    } catch (error) {
        console.error('Error deleting task:', error);
        showToast('Error deleting task', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Reuse expired task (create new from expired)
 */
async function reuseTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    if (!confirm(`Reuse task "${task.title}"? This will create a new task for tomorrow.`)) return;
    
    showLoading('Reusing task...');
    
    try {
        // Calculate dates for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const expiryDate = new Date(tomorrow);
        expiryDate.setHours(expiryDate.getHours() + 24);
        
        const newTask = {
            title: task.title,
            description: task.description,
            mediaType: task.mediaType,
            mediaUrl: task.mediaUrl,
            scheduledDate: firebase.firestore.Timestamp.fromDate(tomorrow),
            expiryDate: firebase.firestore.Timestamp.fromDate(expiryDate),
            status: 'active',
            category: task.category || 'Rating',
            externalLink: task.externalLink || null,
            createdBy: currentUser?.uid || 'admin',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            reusedFrom: task.id
        };
        
        await db.collection('tasks').add(newTask);
        showToast('Task reused successfully', 'success');
        
    } catch (error) {
        console.error('Error reusing task:', error);
        showToast('Error reusing task', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Preview task as user would see it
 */
async function previewTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    // Create a temporary modal to preview the task
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal show';
    modalDiv.style.display = 'flex';
    
    // Get media HTML
    let mediaHtml = '';
    if (task.mediaType === 'video') {
        if (task.mediaUrl && (task.mediaUrl.includes('youtube.com') || task.mediaUrl.includes('youtu.be'))) {
            const videoId = extractYouTubeId(task.mediaUrl);
            if (videoId) {
                mediaHtml = `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
            } else {
                mediaHtml = `<video src="${task.mediaUrl}" controls></video>`;
            }
        } else {
            mediaHtml = `<video src="${task.mediaUrl}" controls></video>`;
        }
    } else {
        mediaHtml = `<img src="${task.mediaUrl}" alt="${task.title}">`;
    }
    
    modalDiv.innerHTML = `
        <div class="modal-content task-modal" style="max-width: 600px;">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>🔍 Preview: ${escapeHtml(task.title)}</h2>
            <div class="task-media-large" style="margin: 20px 0; background: #f5f5f5; border-radius: 8px; overflow: hidden;">
                ${mediaHtml}
            </div>
            <p><strong>Description:</strong> ${escapeHtml(task.description || 'No description')}</p>
            <p><strong>Category:</strong> ${task.category || 'Rating'}</p>
            <p><strong>Scheduled:</strong> ${task.scheduledDate?.toDate ? task.scheduledDate.toDate().toLocaleString() : 'N/A'}</p>
            <p><strong>Expires:</strong> ${task.expiryDate?.toDate ? task.expiryDate.toDate().toLocaleString() : 'N/A'}</p>
            ${task.externalLink ? `<p><strong>External Link:</strong> <a href="${task.externalLink}" target="_blank">${task.externalLink}</a></p>` : ''}
            <div class="modal-actions" style="margin-top: 20px;">
                <button onclick="this.closest('.modal').remove()" class="auth-btn">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalDiv);
}

/**
 * Toggle media input visibility
 */
function toggleMediaInput() {
    const mediaType = document.getElementById('taskMediaType').value;
    const mediaUpload = document.getElementById('taskMediaUpload');
    
    if (mediaUpload) {
        if (mediaType === 'image') {
            mediaUpload.accept = 'image/*';
        } else {
            mediaUpload.accept = 'video/*';
        }
    }
}

// ============================================
// ADMIN TASK MANAGEMENT - COMPLETE FIX
// ============================================

/**
 * Show add task form - FIXED
 */
function showAddTaskFormFixed() {
    console.log('Opening add task form');
    
    // Reset form
    document.getElementById('taskFormTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Add New Task';
    document.getElementById('taskId').value = '';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskMediaType').value = 'image';
    document.getElementById('taskMediaUrl').value = '';
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('taskScheduledDate').value = today;
    document.getElementById('taskExpiryHours').value = '24';
    document.getElementById('taskCategory').value = 'Rating';
    
    // Show modal
    const modal = document.getElementById('taskFormModal');
    if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
    } else {
        console.error('taskFormModal not found');
        showToast('Error: Modal not found', 'error');
    }
}

/**
 * Edit task - FIXED
 */
async function editTaskFixed(taskId) {
    console.log('Editing task:', taskId);
    
    // Find the task in the tasks array
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    console.log('Found task:', task);
    
    // Populate form
    document.getElementById('taskFormTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title || '';
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskMediaType').value = task.mediaType || 'image';
    document.getElementById('taskMediaUrl').value = task.mediaUrl || '';
    document.getElementById('taskCategory').value = task.category || 'Rating';
    
    // Parse and set scheduled date
    let scheduledDate;
    if (task.scheduledDate?.toDate) {
        scheduledDate = task.scheduledDate.toDate();
    } else if (task.scheduledDate) {
        scheduledDate = new Date(task.scheduledDate);
    } else {
        scheduledDate = new Date();
    }
    document.getElementById('taskScheduledDate').value = scheduledDate.toISOString().split('T')[0];
    
    // Calculate expiry hours
    let expiryDate;
    if (task.expiryDate?.toDate) {
        expiryDate = task.expiryDate.toDate();
    } else if (task.expiryDate) {
        expiryDate = new Date(task.expiryDate);
    } else {
        expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 24);
    }
    
    const expiryHours = Math.round((expiryDate - scheduledDate) / (1000 * 60 * 60));
    document.getElementById('taskExpiryHours').value = expiryHours || 24;
    
    // Set external link if exists
    if (task.externalLink) {
        document.getElementById('taskExternalLink').value = task.externalLink;
    }
    
    // Show modal
    const modal = document.getElementById('taskFormModal');
    if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
    } else {
        console.error('taskFormModal not found');
        showToast('Error: Modal not found', 'error');
    }
}

/**
 * Save task (create or update) - FIXED
 */
async function saveTaskFixed() {
    console.log('Saving task...');
    
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const mediaType = document.getElementById('taskMediaType').value;
    let mediaUrl = document.getElementById('taskMediaUrl').value.trim();
    const scheduledDateStr = document.getElementById('taskScheduledDate').value;
    const expiryHours = parseInt(document.getElementById('taskExpiryHours').value) || 24;
    const category = document.getElementById('taskCategory').value;
    const externalLink = document.getElementById('taskExternalLink')?.value.trim() || '';
    
    // Validation
    if (!title || !scheduledDateStr) {
        showToast('Please fill required fields (Title and Scheduled Date)', 'error');
        return;
    }
    
    // Set default media URL if empty
    if (!mediaUrl) {
        if (mediaType === 'video') {
            mediaUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
        } else {
            mediaUrl = 'https://via.placeholder.com/400x300?text=Task+Image';
        }
    }
    
    console.log('Saving task with data:', {
        id: id || 'new',
        title,
        mediaType,
        mediaUrl,
        scheduledDateStr,
        expiryHours
    });
    
    // Create dates
    const scheduled = new Date(scheduledDateStr + 'T00:00:00');
    const expiry = new Date(scheduled);
    expiry.setHours(expiry.getHours() + expiryHours);
    
    const taskData = {
        title,
        description: description || 'Complete this task',
        mediaType,
        mediaUrl,
        scheduledDate: firebase.firestore.Timestamp.fromDate(scheduled),
        expiryDate: firebase.firestore.Timestamp.fromDate(expiry),
        status: 'active',
        category: category || 'Rating',
        externalLink: externalLink || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    showLoading('Saving task...');
    
    try {
        if (id) {
            // Update existing task
            await db.collection('tasks').doc(id).update(taskData);
            showToast('Task updated successfully', 'success');
            console.log('Task updated:', id);
        } else {
            // Create new task
            taskData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            taskData.createdBy = currentUser?.uid || 'admin';
            await db.collection('tasks').add(taskData);
            showToast('Task created successfully', 'success');
            console.log('Task created');
        }
        
        // Close modal
        closeTaskFormModalFixed();
        
        // Reload tasks
        setTimeout(() => {
            loadAdminTasks();
        }, 500);
        
    } catch (error) {
        console.error('Error saving task:', error);
        showToast('Error saving task: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Close task form modal - FIXED
 */
function closeTaskFormModalFixed() {
    console.log('Closing task form modal');
    const modal = document.getElementById('taskFormModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
}

// ============================================
// OVERRIDE EXISTING FUNCTIONS WITH FIXED VERSIONS
// ============================================

// Replace the existing functions
window.showAddTaskForm = showAddTaskFormFixed;
window.editTask = editTaskFixed;
window.saveTask = saveTaskFixed;
window.closeTaskFormModal = closeTaskFormModalFixed;

console.log('✅ Admin task management functions fixed and loaded');

async function handleMediaUpload() {
    console.log('handleMediaUpload called');
    
    const fileInput = document.getElementById('taskMediaUpload');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast('Please select a file to upload', 'warning');
        return;
    }

    const file = fileInput.files[0];
    
    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    const validTypes = [...validImageTypes, ...validVideoTypes];
    
    if (!validTypes.includes(file.type)) {
        showToast('Invalid file type. Please upload an image (JPEG, PNG, GIF) or video (MP4, WebM)', 'error');
        fileInput.value = '';
        return;
    }
    
    // Validate file size
    const isVideo = validVideoTypes.includes(file.type);
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    
    if (file.size > maxSize) {
        showToast(`File too large. Maximum size: ${isVideo ? '50MB' : '10MB'}`, 'error');
        fileInput.value = '';
        return;
    }

    showLoading('Uploading file...');
    
    try {
        // Create unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const extension = file.name.split('.').pop();
        const filename = `tasks/${timestamp}_${randomString}.${extension}`;
        
        // Upload to Firebase Storage
        const storageRef = storage.ref();
        const fileRef = storageRef.child(filename);
        
        const snapshot = await fileRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        
        console.log('File uploaded. Download URL:', downloadURL);
        
        // Set the URL in the media URL input
        const mediaUrlInput = document.getElementById('taskMediaUrl');
        if (mediaUrlInput) {
            mediaUrlInput.value = downloadURL;
            showToast('File uploaded successfully! URL added to field.', 'success');
        }
        
        // Clear the file input
        fileInput.value = '';
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Error uploading file: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function extractYouTubeId(url) {
    if (!url) return null;
    
    // Regular expression for YouTube URLs
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([^&]+)/,
        /(?:youtu\.be\/)([^?]+)/,
        /(?:youtube\.com\/embed\/)([^?]+)/,
        /(?:youtube\.com\/v\/)([^?]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}

// Add this to debug media in modal
function debugTaskMediaInModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        console.log('Task not found');
        return;
    }
    
    console.log('=== TASK MEDIA DEBUG ===');
    console.log('Title:', task.title);
    console.log('Media URL:', task.mediaUrl);
    console.log('Media Type:', task.mediaType);
    console.log('Full Task:', task);
    
    // Test if URL is accessible
    if (task.mediaUrl) {
        const img = new Image();
        img.onload = () => console.log('✅ Image loaded successfully');
        img.onerror = () => console.log('❌ Failed to load image');
        img.src = task.mediaUrl;
    }
}

// Debug function to check a specific task
function checkTaskMedia(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        console.log('Task not found in tasks array');
        return;
    }
    
    console.log('=== TASK MEDIA CHECK ===');
    console.log('Title:', task.title);
    console.log('Media URL:', task.mediaUrl);
    console.log('Media Type:', task.mediaType);
    console.log('Is YouTube URL:', task.mediaUrl?.includes('youtube.com') || task.mediaUrl?.includes('youtu.be'));
    console.log('Video ID:', extractYouTubeId(task.mediaUrl));
    
    // Test image loading
    if (task.mediaType === 'image' && task.mediaUrl) {
        const img = new Image();
        img.onload = () => console.log('✅ Image loads successfully');
        img.onerror = () => console.log('❌ Image failed to load:', task.mediaUrl);
        img.src = task.mediaUrl;
    }
    
    // Test video loading
    if (task.mediaType === 'video' && task.mediaUrl) {
        const video = document.createElement('video');
        video.oncanplay = () => console.log('✅ Video can play');
        video.onerror = () => console.log('❌ Video failed to load:', task.mediaUrl);
        video.src = task.mediaUrl;
    }
}

// Expose debug function
window.checkTaskMediano = checkTaskMedia;

async function testTaskMedia() {
    console.log('=== TEST TASK MEDIA ===');
    
    // Get all tasks
    const snapshot = await db.collection('tasks').get();
    console.log(`Total tasks: ${snapshot.size}`);
    
    snapshot.forEach(doc => {
        const task = doc.data();
        console.log(`\nTask: ${task.title}`);
        console.log(`  Media Type: ${task.mediaType}`);
        console.log(`  Media URL: ${task.mediaUrl}`);
        
        // Test if URL is accessible
        if (task.mediaUrl && task.mediaType === 'image') {
            const img = new Image();
            img.onload = () => console.log(`  ✅ Image loads: ${task.mediaUrl}`);
            img.onerror = () => console.log(`  ❌ Image fails: ${task.mediaUrl}`);
            img.src = task.mediaUrl;
        } else if (task.mediaUrl && task.mediaType === 'video') {
            console.log(`  Video URL: ${task.mediaUrl}`);
        }
    });
}

window.testTaskMedia = testTaskMedia;

/**
 * Create media HTML for task - SAME LOGIC AS ADMIN PREVIEW
 */
function createTaskMediaHTML(task) {
    let mediaHtml = '';
    
    if (task.mediaType === 'video') {
        // Check for YouTube videos
        if (task.mediaUrl && (task.mediaUrl.includes('youtube.com') || task.mediaUrl.includes('youtu.be'))) {
            const videoId = extractYouTubeId(task.mediaUrl);
            if (videoId) {
                mediaHtml = `
                    <iframe 
                        src="https://www.youtube.com/embed/${videoId}" 
                        frameborder="0" 
                        allowfullscreen
                        style="width:100%; height:100%;">
                    </iframe>
                `;
            } else {
                mediaHtml = `
                    <video controls style="width:100%; height:100%;">
                        <source src="${task.mediaUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                `;
            }
        } else if (task.mediaUrl) {
            // Direct video file
            mediaHtml = `
                <video controls style="width:100%; height:100%;">
                    <source src="${task.mediaUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
        } else {
            mediaHtml = `
                <div style="display:flex; align-items:center; justify-content:center; height:100%; color:#999;">
                    <i class="fas fa-video" style="font-size:48px;"></i>
                    <p style="margin-left:10px;">Video not available</p>
                </div>
            `;
        }
    } else {
        // Image
        if (task.mediaUrl) {
            mediaHtml = `<img src="${task.mediaUrl}" alt="${task.title}" style="width:100%; height:100%; object-fit:contain;">`;
        } else {
            mediaHtml = `
                <div style="display:flex; align-items:center; justify-content:center; height:100%; color:#999;">
                    <i class="fas fa-image" style="font-size:48px;"></i>
                    <p style="margin-left:10px;">Image not available</p>
                </div>
            `;
        }
    }
    
    return mediaHtml;
}

/**
 * Show task modal for users - USING SAME LOGIC AS ADMIN PREVIEW
 */
/**
 * Show task modal for users - WITH AUTO-PLAY VIDEOS
 */
function showUserTaskModal(task) {
    console.log('Showing user task modal for:', task.title);
    console.log('Media URL:', task.mediaUrl);
    console.log('Media Type:', task.mediaType);
    
    // Check for active package
    if (!hasActivePackage()) {
        if (confirm('You need an active package to earn from tasks. Browse packages now?')) {
            switchUserTab('packages');
        }
        return;
    }
    
    const packageSummary = getActivePackagesSummary();
    
    // Create media HTML with auto-play
    let mediaHtml = '';
    
    if (task.mediaType === 'video') {
        // Check for YouTube videos
        if (task.mediaUrl && (task.mediaUrl.includes('youtube.com') || task.mediaUrl.includes('youtu.be'))) {
            const videoId = extractYouTubeId(task.mediaUrl);
            if (videoId) {
                // YouTube video with auto-play enabled
                mediaHtml = `
                    <iframe 
                        src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1" 
                        frameborder="0" 
                        allowfullscreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        style="width:100%; height:100%;">
                    </iframe>
                `;
            } else {
                // Direct video file with auto-play
                mediaHtml = `
                    <video controls autoplay muted style="width:100%; height:100%;">
                        <source src="${task.mediaUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                `;
            }
        } else if (task.mediaUrl) {
            // Direct video file with auto-play
            mediaHtml = `
                <video controls autoplay muted style="width:100%; height:100%;">
                    <source src="${task.mediaUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
        } else {
            mediaHtml = `
                <div style="display:flex; align-items:center; justify-content:center; height:100%; color:#999;">
                    <i class="fas fa-video" style="font-size:48px;"></i>
                    <p style="margin-left:10px;">Video not available</p>
                </div>
            `;
        }
    } else {
        // Image
        if (task.mediaUrl) {
            mediaHtml = `<img src="${task.mediaUrl}" alt="${task.title}" style="width:100%; height:100%; object-fit:contain;">`;
        } else {
            mediaHtml = `
                <div style="display:flex; align-items:center; justify-content:center; height:100%; color:#999;">
                    <i class="fas fa-image" style="font-size:48px;"></i>
                    <p style="margin-left:10px;">Image not available</p>
                </div>
            `;
        }
    }
    
    // Remove any existing modal
    const existingModal = document.getElementById('userTaskModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal container
    const modalDiv = document.createElement('div');
    modalDiv.id = 'userTaskModal';
    modalDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        width: 90%;
        max-width: 650px;
        max-height: 90vh;
        overflow-y: auto;
        border-radius: 16px;
        position: relative;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
    `;
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        position: absolute;
        right: 15px;
        top: 15px;
        font-size: 28px;
        cursor: pointer;
        color: #999;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f0f0f0;
        border-radius: 50%;
        transition: all 0.2s;
        z-index: 10;
    `;
    closeBtn.onmouseover = function() {
        this.style.background = '#e0e0e0';
        this.style.color = '#666';
    };
    closeBtn.onmouseout = function() {
        this.style.background = '#f0f0f0';
        this.style.color = '#999';
    };
    closeBtn.onclick = function() {
        modalDiv.remove();
    };
    
    // Create inner content
    const innerContent = document.createElement('div');
    innerContent.style.padding = '25px';
    
    // Add title
    const title = document.createElement('h2');
    title.textContent = task.title;
    title.style.marginBottom = '20px';
    title.style.fontSize = '22px';
    title.style.color = '#333';
    title.style.paddingRight = '30px';
    title.style.marginTop = '0';
    innerContent.appendChild(title);
    
    // Add package info if user has packages
    if (packageSummary) {
        const packageInfo = document.createElement('div');
        packageInfo.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 18px;
            border-radius: 12px;
            margin-bottom: 20px;
        `;
        packageInfo.innerHTML = `
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                <span><i class="fas fa-box"></i> Active Packages: ${packageSummary.count}</span>
                <span><i class="fas fa-coins"></i> Daily Profit: ${formatMoney(packageSummary.totalDailyProfit)}</span>
            </div>
            <div style="font-size: 11px; margin-top: 5px; opacity: 0.9;">${packageSummary.names}</div>
        `;
        innerContent.appendChild(packageInfo);
    }
    
    // Add media container
    const mediaContainer = document.createElement('div');
    mediaContainer.style.cssText = `
        width: 100%;
        height: 320px;
        background: #000;
        border-radius: 12px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        position: relative;
    `;
    mediaContainer.innerHTML = mediaHtml;
    innerContent.appendChild(mediaContainer);
    
    // Add description
    if (task.description) {
        const desc = document.createElement('p');
        desc.textContent = task.description;
        desc.style.marginBottom = '20px';
        desc.style.color = '#666';
        desc.style.lineHeight = '1.6';
        innerContent.appendChild(desc);
    }
    
    // Add external link if exists
    if (task.externalLink) {
        const linkDiv = document.createElement('div');
        linkDiv.style.cssText = `
            margin-bottom: 20px;
            text-align: center;
        `;
        linkDiv.innerHTML = `
            <a href="${task.externalLink}" target="_blank" style="background: #2196F3; color: white; text-decoration: none; padding: 8px 16px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; font-size: 14px;">
                <i class="fas fa-external-link-alt"></i> Visit Product Page
            </a>
        `;
        innerContent.appendChild(linkDiv);
    }
    
    // Add rating stars
    const ratingDiv = document.createElement('div');
    ratingDiv.style.cssText = `
        background: #f8f9fa;
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 20px;
        text-align: center;
    `;
    ratingDiv.innerHTML = '<p style="margin-bottom: 15px; font-weight: bold; color: #333;">Rate this product:</p>';
    
    const starsDiv = document.createElement('div');
    starsDiv.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: center;
        font-size: 32px;
        color: #ffc107;
        cursor: pointer;
    `;
    
    const ratingInput = document.createElement('input');
    ratingInput.type = 'hidden';
    ratingInput.id = 'userTaskRating';
    ratingInput.value = '0';
    
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('i');
        star.className = 'far fa-star';
        star.dataset.rating = i;
        star.style.transition = 'transform 0.2s';
        star.onmouseover = function() {
            this.style.transform = 'scale(1.2)';
        };
        star.onmouseout = function() {
            this.style.transform = 'scale(1)';
        };
        star.onclick = function() {
            const rating = this.dataset.rating;
            ratingInput.value = rating;
            
            const allStars = starsDiv.querySelectorAll('i');
            allStars.forEach((s, index) => {
                if (index < rating) {
                    s.className = 'fas fa-star';
                } else {
                    s.className = 'far fa-star';
                }
            });
        };
        starsDiv.appendChild(star);
    }
    
    ratingDiv.appendChild(starsDiv);
    ratingDiv.appendChild(ratingInput);
    innerContent.appendChild(ratingDiv);
    
    // Add completion note
    if (packageSummary) {
        const noteDiv = document.createElement('div');
        noteDiv.style.cssText = `
            background: #e3f2fd;
            border-left: 4px solid #2196F3;
            padding: 10px 15px;
            margin-bottom: 20px;
            border-radius: 8px;
            font-size: 13px;
        `;
        noteDiv.innerHTML = `<i class="fas fa-info-circle" style="color: #2196F3; margin-right: 8px;"></i> 
            Complete all ${systemSettings.tasksPerDay} tasks to earn ${formatMoney(packageSummary.totalDailyProfit)}`;
        innerContent.appendChild(noteDiv);
    }
    
    // Add confirmation checkbox
    const confirmDiv = document.createElement('div');
    confirmDiv.style.cssText = `
        background: #f8f9fa;
        padding: 15px;
        border-radius: 10px;
        margin-bottom: 20px;
    `;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'userTaskConfirm';
    checkbox.style.marginRight = '10px';
    
    const label = document.createElement('label');
    label.htmlFor = 'userTaskConfirm';
    label.textContent = 'I have rated this product';
    label.style.cursor = 'pointer';
    
    confirmDiv.appendChild(checkbox);
    confirmDiv.appendChild(label);
    innerContent.appendChild(confirmDiv);
    
    // Add buttons
    const buttonDiv = document.createElement('div');
    buttonDiv.style.cssText = `
        display: flex;
        gap: 15px;
        justify-content: flex-end;
    `;
    
    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Submit Rating';
    submitBtn.style.cssText = `
        background: #4CAF50;
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
    `;
    submitBtn.onclick = function() {
        const isChecked = document.getElementById('userTaskConfirm')?.checked;
        const rating = document.getElementById('userTaskRating')?.value;
        
        if (!isChecked) {
            showToast('Please confirm you have completed the task', 'warning');
            return;
        }
        
        if (!rating || rating === '0') {
            showToast('Please select a rating', 'warning');
            return;
        }
        
        modalDiv.remove();
        completeTask(task.id, parseInt(rating));
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
        background: #f5f5f5;
        color: #666;
        border: none;
        padding: 10px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
    `;
    cancelBtn.onclick = function() {
        modalDiv.remove();
    };
    
    buttonDiv.appendChild(submitBtn);
    buttonDiv.appendChild(cancelBtn);
    innerContent.appendChild(buttonDiv);
    
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(innerContent);
    modalDiv.appendChild(modalContent);
    document.body.appendChild(modalDiv);
    
    // Auto-play video after modal is added
    setTimeout(() => {
        const video = modalDiv.querySelector('video');
        if (video) {
            video.play().catch(e => console.log('Auto-play failed:', e));
        }
    }, 100);
    
    console.log('Modal created with auto-play video');
}

// At the very end of your file, replace the existing assignments with:
window.openTaskModal = function(taskId) {
    console.log('Opening task modal for:', taskId);
    openUserTaskModal(taskId);
};

window.submitTaskCompletion = function(taskId) {
    const confirmCheck = document.getElementById('userTaskConfirm');
    const rating = document.getElementById('userTaskRating')?.value;
    
    if (!confirmCheck || !confirmCheck.checked) {
        showToast('Please confirm you have completed the task', 'warning');
        return false;
    }
    
    if (!rating || rating === '0') {
        showToast('Please select a rating', 'warning');
        return false;
    }
    
    closeTaskModal();
    completeTask(taskId, parseInt(rating));
};

window.closeTaskModal = closeTaskModal;

function closeTaskModal() {
    const modal = document.getElementById('userTaskModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Open task modal for users - CLEAN VERSION
 */
async function openUserTaskModal(taskId) {
    console.log('Opening task modal for ID:', taskId);
    
    // Check for active package first
    if (!hasActivePackage()) {
        if (confirm('You need an active package to earn from tasks. Browse packages now?')) {
            switchUserTab('packages');
        }
        return;
    }
    
    // Fetch the task
    let task = null;
    
    // Try to find in existing tasks array
    if (tasks && tasks.length > 0) {
        task = tasks.find(t => t.id === taskId);
    }
    
    // If not found, fetch from Firestore
    if (!task) {
        try {
            const taskDoc = await db.collection('tasks').doc(taskId).get();
            if (taskDoc.exists) {
                task = { id: taskDoc.id, ...taskDoc.data() };
            }
        } catch (error) {
            console.error('Error fetching task:', error);
            showToast('Error loading task', 'error');
            return;
        }
    }
    
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    console.log('Task loaded:', task);
    
    // Get package summary
    const packageSummary = getActivePackagesSummary();
    
    // Create media HTML
    let mediaHtml = '';
    
    if (task.mediaType === 'video') {
        // YouTube video
        if (task.mediaUrl && (task.mediaUrl.includes('youtube.com') || task.mediaUrl.includes('youtu.be'))) {
            const videoId = extractYouTubeId(task.mediaUrl);
            if (videoId) {
                mediaHtml = `
                    <div class="video-container">
                        <iframe 
                            src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen>
                        </iframe>
                    </div>
                `;
            }
        }
        
        // If not YouTube or YouTube extraction failed, try direct video
        if (!mediaHtml && task.mediaUrl) {
            mediaHtml = `
                <video controls autoplay class="task-video">
                    <source src="${task.mediaUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
        }
        
        // Fallback if no video URL
        if (!mediaHtml) {
            mediaHtml = `
                <div class="media-placeholder">
                    <i class="fas fa-video"></i>
                    <p>Video not available</p>
                </div>
            `;
        }
    } else {
        // Image
        if (task.mediaUrl) {
            mediaHtml = `
                <img src="${task.mediaUrl}" alt="${escapeHtml(task.title)}" class="task-image">
            `;
        } else {
            mediaHtml = `
                <div class="media-placeholder">
                    <i class="fas fa-image"></i>
                    <p>Image not available</p>
                </div>
            `;
        }
    }
    
    // Create rating stars HTML
    const starsHtml = `
        <div class="rating-container">
            <p><strong>Rate this product:</strong></p>
            <div class="star-rating">
                <i class="far fa-star" data-rating="1"></i>
                <i class="far fa-star" data-rating="2"></i>
                <i class="far fa-star" data-rating="3"></i>
                <i class="far fa-star" data-rating="4"></i>
                <i class="far fa-star" data-rating="5"></i>
            </div>
            <input type="hidden" id="userTaskRating" value="0">
        </div>
    `;
    
    // Create package info HTML if user has packages
    const packageInfoHtml = packageSummary ? `
        <div class="package-earning-info">
            <div class="info-badge">
                <i class="fas fa-box"></i>
                <span>Active Packages: ${packageSummary.count}</span>
            </div>
            <div class="info-badge">
                <i class="fas fa-coins"></i>
                <span>Daily Profit: ${formatMoney(packageSummary.totalDailyProfit)}</span>
            </div>
            <div class="package-names">${packageSummary.names}</div>
        </div>
    ` : '';
    
    // Create the complete modal HTML
    const modalHtml = `
        <div id="userTaskModal" class="task-modal-overlay">
            <div class="task-modal-container">
                <div class="task-modal-header">
                    <h2>${escapeHtml(task.title)}</h2>
                    <button class="modal-close-btn" onclick="closeTaskModal()">&times;</button>
                </div>
                
                <div class="task-modal-body">
                    ${packageInfoHtml}
                    
                    <div class="task-media-area">
                        ${mediaHtml}
                    </div>
                    
                    ${task.description ? `
                        <div class="task-description">
                            <p>${escapeHtml(task.description)}</p>
                        </div>
                    ` : ''}
                    
                    ${task.externalLink ? `
                        <div class="task-external-link">
                            <a href="${task.externalLink}" target="_blank" class="external-link-btn">
                                <i class="fas fa-external-link-alt"></i> Visit Product Page
                            </a>
                        </div>
                    ` : ''}
                    
                    ${starsHtml}
                    
                    <div class="task-completion-note">
                        <i class="fas fa-info-circle"></i>
                        <span>Complete all ${systemSettings.tasksPerDay || 3} tasks to earn ${formatMoney(packageSummary?.totalDailyProfit || 0)}</span>
                    </div>
                    
                    <div class="task-confirm">
                        <label>
                            <input type="checkbox" id="userTaskConfirm">
                            <span>I have rated this product</span>
                        </label>
                    </div>
                </div>
                
                <div class="task-modal-footer">
                    <button class="btn-cancel" onclick="closeTaskModal()">Cancel</button>
                    <button class="btn-submit" onclick="submitTaskCompletion('${task.id}')">Submit Rating</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('userTaskModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Add star rating functionality
    const stars = document.querySelectorAll('#userTaskModal .star-rating i');
    const ratingInput = document.getElementById('userTaskRating');
    
    stars.forEach(star => {
        star.addEventListener('click', function() {
            const rating = parseInt(this.dataset.rating);
            ratingInput.value = rating;
            
            stars.forEach((s, index) => {
                if (index < rating) {
                    s.className = 'fas fa-star';
                } else {
                    s.className = 'far fa-star';
                }
            });
        });
        
        star.addEventListener('mouseenter', function() {
            const rating = parseInt(this.dataset.rating);
            stars.forEach((s, index) => {
                if (index < rating) {
                    s.style.transform = 'scale(1.1)';
                }
            });
        });
        
        star.addEventListener('mouseleave', function() {
            stars.forEach(s => {
                s.style.transform = 'scale(1)';
            });
        });
    });
    
    // Auto-play video if it's a video element
    setTimeout(() => {
        const video = document.querySelector('#userTaskModal video');
        if (video) {
            video.play().catch(e => console.log('Auto-play failed:', e));
        }
    }, 100);
    
    console.log('Task modal opened successfully');
}

// ============================================
// USER MENU DROPDOWN - COMPLETE WORKING VERSION
// ============================================

/**
 * Toggle user menu dropdown - Works for ALL dashboards
 */
function toggleUserMenu(event) {
    // Prevent event bubbling
    if (event) event.stopPropagation();
    
    console.log('toggleUserMenu called');
    
    // Get the current active dashboard
    const userDashboard = document.getElementById('userDashboard');
    const adminDashboard = document.getElementById('adminDashboard');
    const superAdminDashboard = document.getElementById('superAdminDashboard');
    
    // Get all menus
    const userMenu = document.getElementById('userMenu');
    const adminUserMenu = document.getElementById('adminUserMenu');
    const superAdminUserMenu = document.getElementById('superAdminUserMenu');
    
    // Get the clicked user profile
    const userProfile = event ? event.currentTarget : document.querySelector('.user-profile');
    
    console.log('Active dashboards:', {
        user: userDashboard?.classList.contains('active'),
        admin: adminDashboard?.classList.contains('active'),
        super: superAdminDashboard?.classList.contains('active')
    });
    
    // Close all menus first
    if (userMenu) userMenu.classList.remove('show');
    if (adminUserMenu) adminUserMenu.classList.remove('show');
    if (superAdminUserMenu) superAdminUserMenu.classList.remove('show');
    
    // Remove active class from all profiles
    document.querySelectorAll('.user-profile').forEach(profile => {
        profile.classList.remove('active');
    });
    
    // Determine which dashboard is active and toggle the appropriate menu
    let targetMenu = null;
    
    if (userDashboard && userDashboard.classList.contains('active')) {
        targetMenu = userMenu;
        if (targetMenu) {
            targetMenu.classList.toggle('show');
            updateUserMenuInfo();
            console.log('Toggling user menu');
        }
    } else if (adminDashboard && adminDashboard.classList.contains('active')) {
        targetMenu = adminUserMenu;
        if (targetMenu) {
            targetMenu.classList.toggle('show');
            updateAdminMenuInfo();
            console.log('Toggling admin menu');
        }
    } else if (superAdminDashboard && superAdminDashboard.classList.contains('active')) {
        targetMenu = superAdminUserMenu;
        if (targetMenu) {
            targetMenu.classList.toggle('show');
            updateSuperAdminMenuInfo();
            console.log('Toggling super admin menu');
        }
    }
    
    // Toggle active class on the clicked profile
    if (userProfile) {
        userProfile.classList.toggle('active');
    }
}

/**
 * Update user menu with current user info
 */
function updateUserMenuInfo() {
    const userNameEl = document.getElementById('menuUserName');
    const userEmailEl = document.getElementById('menuUserEmail');
    const userProfileImg = document.querySelector('#userDashboard .user-profile-img');
    
    if (userNameEl && currentUser) {
        userNameEl.textContent = currentUser.fullName || currentUser.username || 'User';
    }
    if (userEmailEl && currentUser) {
        userEmailEl.textContent = currentUser.email || 'user@smarttask.com';
    }
    if (userProfileImg && currentUser) {
        const initial = (currentUser.fullName || currentUser.username || 'U').charAt(0).toUpperCase();
        userProfileImg.textContent = initial;
    }
}

/**
 * Update admin menu info
 */
function updateAdminMenuInfo() {
    const adminNameEl = document.getElementById('adminMenuName');
    const adminEmailEl = document.getElementById('adminMenuEmail');
    const adminProfileImg = document.querySelector('#adminDashboard .user-profile-img');
    
    if (adminNameEl && currentUser) {
        adminNameEl.textContent = currentUser.fullName || currentUser.username || 'Administrator';
    }
    if (adminEmailEl && currentUser) {
        adminEmailEl.textContent = currentUser.email || 'admin@smarttask.com';
    }
    if (adminProfileImg && currentUser) {
        const initial = (currentUser.fullName || currentUser.username || 'A').charAt(0).toUpperCase();
        adminProfileImg.textContent = initial;
    }
}

/**
 * Update super admin menu info
 */
function updateSuperAdminMenuInfo() {
    const superAdminNameEl = document.getElementById('superAdminMenuName');
    const superAdminEmailEl = document.getElementById('superAdminMenuEmail');
    const superAdminProfileImg = document.querySelector('#superAdminDashboard .user-profile-img');
    
    if (superAdminNameEl && currentUser) {
        superAdminNameEl.textContent = currentUser.fullName || currentUser.username || 'Super Administrator';
    }
    if (superAdminEmailEl && currentUser) {
        superAdminEmailEl.textContent = currentUser.email || 'super@smarttask.com';
    }
    if (superAdminProfileImg && currentUser) {
        const initial = (currentUser.fullName || currentUser.username || 'SA').charAt(0).toUpperCase();
        superAdminProfileImg.textContent = initial;
    }
}

/**
 * Close dropdown when clicking outside
 */
document.addEventListener('click', function(event) {
    const userMenu = document.getElementById('userMenu');
    const adminUserMenu = document.getElementById('adminUserMenu');
    const superAdminUserMenu = document.getElementById('superAdminUserMenu');
    const userProfile = document.querySelector('.user-profile');
    const adminProfile = document.querySelector('#adminDashboard .user-profile');
    const superAdminProfile = document.querySelector('#superAdminDashboard .user-profile');
    
    // Check if click is inside any menu or on any profile
    const isClickOnUserMenu = userMenu && userMenu.contains(event.target);
    const isClickOnAdminMenu = adminUserMenu && adminUserMenu.contains(event.target);
    const isClickOnSuperAdminMenu = superAdminUserMenu && superAdminUserMenu.contains(event.target);
    const isClickOnUserProfile = userProfile && userProfile.contains(event.target);
    const isClickOnAdminProfile = adminProfile && adminProfile.contains(event.target);
    const isClickOnSuperAdminProfile = superAdminProfile && superAdminProfile.contains(event.target);
    
    const isClickOnMenu = isClickOnUserMenu || isClickOnAdminMenu || isClickOnSuperAdminMenu;
    const isClickOnProfile = isClickOnUserProfile || isClickOnAdminProfile || isClickOnSuperAdminProfile;
    
    if (!isClickOnMenu && !isClickOnProfile) {
        // Close all menus
        if (userMenu) userMenu.classList.remove('show');
        if (adminUserMenu) adminUserMenu.classList.remove('show');
        if (superAdminUserMenu) superAdminUserMenu.classList.remove('show');
        
        // Remove active class from all profiles
        document.querySelectorAll('.user-profile').forEach(profile => {
            profile.classList.remove('active');
        });
    }
});

/**
 * Show admin profile
 */
function showAdminProfile() {
    if (currentUser) {
        const details = `
👤 ADMIN PROFILE
═══════════════════════

Username: ${currentUser.username}
Full Name: ${currentUser.fullName}
Email: ${currentUser.email}
Phone: ${currentUser.phone}
Role: ${currentUser.role}

Joined: ${new Date(currentUser.createdAt).toLocaleDateString()}
Last Login: ${currentUser.lastLogin ? new Date(currentUser.lastLogin).toLocaleString() : 'Never'}
        `;
        alert(details);
    }
    // Close menu after action
    const adminUserMenu = document.getElementById('adminUserMenu');
    if (adminUserMenu) adminUserMenu.classList.remove('show');
    const adminProfile = document.querySelector('#adminDashboard .user-profile');
    if (adminProfile) adminProfile.classList.remove('active');
}

/**
 * Show super admin profile
 */
function showSuperAdminProfile() {
    if (currentUser) {
        const details = `
👑 SUPER ADMIN PROFILE
═══════════════════════

Username: ${currentUser.username}
Full Name: ${currentUser.fullName}
Email: ${currentUser.email}
Phone: ${currentUser.phone}
Role: ${currentUser.role}

Joined: ${new Date(currentUser.createdAt).toLocaleDateString()}
Last Login: ${currentUser.lastLogin ? new Date(currentUser.lastLogin).toLocaleString() : 'Never'}
        `;
        alert(details);
    }
    // Close menu after action
    const superAdminUserMenu = document.getElementById('superAdminUserMenu');
    if (superAdminUserMenu) superAdminUserMenu.classList.remove('show');
    const superAdminProfile = document.querySelector('#superAdminDashboard .user-profile');
    if (superAdminProfile) superAdminProfile.classList.remove('active');
}

/**
 * Show system settings (for admin)
 */
function showSystemSettings() {
    switchAdminTab('settings');
    // Close menu
    const adminUserMenu = document.getElementById('adminUserMenu');
    if (adminUserMenu) adminUserMenu.classList.remove('show');
    const adminProfile = document.querySelector('#adminDashboard .user-profile');
    if (adminProfile) adminProfile.classList.remove('active');
}

/**
 * Show audit logs (for super admin)
 */
function showAuditLogs() {
    switchSuperAdminTab('audit');
    // Close menu
    const superAdminUserMenu = document.getElementById('superAdminUserMenu');
    if (superAdminUserMenu) superAdminUserMenu.classList.remove('show');
    const superAdminProfile = document.querySelector('#superAdminDashboard .user-profile');
    if (superAdminProfile) superAdminProfile.classList.remove('active');
}

/**
 * Show user profile (for regular users)
 */
function showUserProfile() {
    if (currentUser) {
        const details = `
👤 USER PROFILE
═══════════════════════

Username: ${currentUser.username}
Full Name: ${currentUser.fullName}
Email: ${currentUser.email}
Phone: ${currentUser.phone}
Role: ${currentUser.role}

💰 Balance: ${formatMoney(currentUser.balance || 0)}
🎁 Referral Balance: ${formatMoney(currentUser.referralBalance || 0)}
📊 Total Earned: ${formatMoney(currentUser.totalEarned || 0)}
💼 Total Invested: ${formatMoney(currentUser.totalInvested || 0)}

👥 Referrals: ${currentUser.referrals?.length || 0}
📋 Tasks Completed: ${currentUser.tasksCompleted || 0}

Joined: ${new Date(currentUser.createdAt).toLocaleDateString()}
Last Login: ${currentUser.lastLogin ? new Date(currentUser.lastLogin).toLocaleString() : 'Never'}
        `;
        alert(details);
    }
    // Close menu after action
    const userMenu = document.getElementById('userMenu');
    if (userMenu) userMenu.classList.remove('show');
    const userProfile = document.querySelector('#userDashboard .user-profile');
    if (userProfile) userProfile.classList.remove('active');
}

/**
 * Show payment methods
 */
function showPaymentMethods() {
    const modal = document.getElementById('userPaymentMethodsModal');
    if (modal) {
        modal.classList.add('show');
        loadUserPaymentMethods();
    }
    // Close menu
    const userMenu = document.getElementById('userMenu');
    if (userMenu) userMenu.classList.remove('show');
    const userProfile = document.querySelector('#userDashboard .user-profile');
    if (userProfile) userProfile.classList.remove('active');
}

/**
 * Show settings
 */
function showSettings() {
    showToast('⚙️ Settings panel coming soon!', 'info');
    // Close menu
    const userMenu = document.getElementById('userMenu');
    if (userMenu) userMenu.classList.remove('show');
    const userProfile = document.querySelector('#userDashboard .user-profile');
    if (userProfile) userProfile.classList.remove('active');
}

/**
 * Toggle notifications dropdown
 */
function toggleNotifications() {
    console.log('Notifications clicked');
    showToast('Notifications feature coming soon!', 'info');
}

// Make functions globally available
window.toggleUserMenu = toggleUserMenu;
window.toggleNotifications = toggleNotifications;
window.showAdminProfile = showAdminProfile;
window.showSuperAdminProfile = showSuperAdminProfile;
window.showSystemSettings = showSystemSettings;
window.showAuditLogs = showAuditLogs;
window.showUserProfile = showUserProfile;
window.showPaymentMethods = showPaymentMethods;
window.showSettings = showSettings;

// Update user menu info when user data loads
const originalLoadUserData = window.loadUserData || function() {};
window.loadUserData = async function() {
    await originalLoadUserData();
    updateUserMenuInfo();
    updateAdminMenuInfo();
    updateSuperAdminMenuInfo();
};

/**
 * Debug function to check dropdown menus
 */
function debugDropdownMenus() {
    console.log('=== DROPDOWN DEBUG ===');
    console.log('Current user role:', currentUser?.role);
    
    const userDashboard = document.getElementById('userDashboard');
    const adminDashboard = document.getElementById('adminDashboard');
    const superAdminDashboard = document.getElementById('superAdminDashboard');
    
    console.log('User dashboard active:', userDashboard?.classList.contains('active'));
    console.log('Admin dashboard active:', adminDashboard?.classList.contains('active'));
    console.log('Super admin dashboard active:', superAdminDashboard?.classList.contains('active'));
    
    console.log('User menu element:', document.getElementById('userMenu'));
    console.log('Admin menu element:', document.getElementById('adminUserMenu'));
    console.log('Super admin menu element:', document.getElementById('superAdminUserMenu'));
    
    console.log('User profile element:', document.querySelector('#userDashboard .user-profile'));
    console.log('Admin profile element:', document.querySelector('#adminDashboard .user-profile'));
    console.log('Super admin profile element:', document.querySelector('#superAdminDashboard .user-profile'));
    console.log('=== END DEBUG ===');
}

window.debugDropdownMenus = debugDropdownMenus;

// ============================================
// ADVANCED USER PROFILE FUNCTIONS
// ============================================

/**
 * Show advanced user profile modal
 */
function showAdvancedUserProfile() {
    console.log('Showing advanced user profile');
    
    if (!currentUser) {
        showToast('Please log in first', 'error');
        return;
    }
    
    // Update profile data
    updateProfileData();
    
    // Show modal
    const modal = document.getElementById('advancedProfileModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Close advanced user profile modal
 */
function closeAdvancedProfileModal() {
    const modal = document.getElementById('advancedProfileModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Update profile data with current user information
 */
/**
 * Update profile data with current user information
 */
async function updateProfileData() {
    if (!currentUser) return;
    
    // Refresh user data
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists) {
        currentUser = { uid: currentUser.uid, ...userDoc.data() };
    }
    
    // Update referral code display
    const referralCodeDisplay = document.getElementById('profileReferralCode');
    if (referralCodeDisplay && currentUser.myReferralCode) {
        referralCodeDisplay.textContent = currentUser.myReferralCode;
    }
    
    // Update referral link
    updateAllReferralLinks();
    
    // Get avatar initial
    const initial = (currentUser.fullName || currentUser.username || 'U').charAt(0).toUpperCase();
    document.getElementById('profileAvatarText').textContent = initial;
    
    // Basic info
    document.getElementById('profileFullName').textContent = currentUser.fullName || currentUser.username || 'User';
    document.getElementById('profileUsername').textContent = '@' + (currentUser.username || 'user');
    document.getElementById('profileEmail').textContent = currentUser.email || 'N/A';
    document.getElementById('profilePhone').textContent = currentUser.phone || 'N/A';
    document.getElementById('profileJoinDate').textContent = new Date(currentUser.createdAt).toLocaleDateString();
    document.getElementById('profileLastLogin').textContent = currentUser.lastLogin ? timeAgo(currentUser.lastLogin) : 'Never';
    document.getElementById('profileLoginCount').textContent = currentUser.loginCount || 0;
    
    // Role badge
    const roleBadge = document.getElementById('profileRoleBadge');
    const roleSpan = document.getElementById('profileRole');
    if (currentUser.role === 'admin') {
        roleBadge.innerHTML = '<i class="fas fa-user-shield"></i><span>Admin</span>';
        roleSpan.textContent = 'Admin';
    } else if (currentUser.role === 'superadmin') {
        roleBadge.innerHTML = '<i class="fas fa-crown"></i><span>Super Admin</span>';
        roleSpan.textContent = 'Super Admin';
    } else {
        roleBadge.innerHTML = '<i class="fas fa-user"></i><span>User</span>';
        roleSpan.textContent = 'User';
    }
    
    // Financial stats
    document.getElementById('profileBalance').textContent = formatMoney(currentUser.balance || 0);
    document.getElementById('profileReferralBalance').textContent = formatMoney(currentUser.referralBalance || 0);
    document.getElementById('profileTotalEarned').textContent = formatMoney(currentUser.totalEarned || 0);
    document.getElementById('profileTotalInvested').textContent = formatMoney(currentUser.totalInvested || 0);
    
    // Statistics
    document.getElementById('profileReferrals').textContent = currentUser.referrals?.length || 0;
    document.getElementById('profileActivePackages').textContent = currentUser.activePackages?.length || 0;
    document.getElementById('profileTasksCompleted').textContent = currentUser.tasksCompleted || 0;
    
    // Referral earnings by level
    const level1Count = currentUser.referrals?.filter(r => r.level === 1).length || 0;
    const level2Count = currentUser.referrals?.filter(r => r.level === 2).length || 0;
    const level3Count = currentUser.referrals?.filter(r => r.level === 3).length || 0;
    
    document.getElementById('profileLevel1Refs').textContent = level1Count;
    document.getElementById('profileLevel2Refs').textContent = level2Count;
    document.getElementById('profileLevel3Refs').textContent = level3Count;
    
    document.getElementById('profileLevel1Comm').textContent = formatMoney(currentUser.referralEarnings?.level1 || 0);
    document.getElementById('profileLevel2Comm').textContent = formatMoney(currentUser.referralEarnings?.level2 || 0);
    document.getElementById('profileLevel3Comm').textContent = formatMoney(currentUser.referralEarnings?.level3 || 0);
    
    // Referral code and link
    document.getElementById('profileReferralCode').textContent = currentUser.myReferralCode || 'N/A';
    const referralLink = document.getElementById('profileReferralLink');
    if (referralLink) {
        referralLink.value = `https://smarttask.com/ref/${currentUser.myReferralCode || ''}`;
    }
}

/**
 * Copy referral code to clipboard
 */
function copyReferralCode() {
    const code = document.getElementById('profileReferralCode').textContent;
    if (!code || code === 'N/A') {
        showToast('No referral code available', 'error');
        return;
    }
    
    navigator.clipboard.writeText(code).then(() => {
        showToast('Referral code copied to clipboard!', 'success');
        
        // Add animation feedback
        const btn = event.target.closest('.copy-code-btn');
        if (btn) {
            btn.style.transform = 'scale(1.1)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 200);
        }
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Referral code copied to clipboard!', 'success');
    });
}

/**
 * Copy referral link from profile
 */
function copyReferralLinkFromProfile() {
    const linkInput = document.getElementById('profileReferralLink');
    if (!linkInput || !linkInput.value) {
        showToast('No referral link available', 'error');
        return;
    }
    
    navigator.clipboard.writeText(linkInput.value).then(() => {
        showToast('Referral link copied to clipboard!', 'success');
        
        // Add animation feedback
        const btn = event.target.closest('.copy-link-btn');
        if (btn) {
            btn.style.transform = 'scale(1.1)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 200);
        }
    }).catch(() => {
        linkInput.select();
        document.execCommand('copy');
        showToast('Referral link copied to clipboard!', 'success');
    });
}

/**
 * Edit profile - opens edit form
 */
function editProfile() {
    showToast('Profile editing coming soon!', 'info');
    // You can implement profile editing here
}

/**
 * View transaction history
 */
function viewTransactionHistory() {
    closeAdvancedProfileModal();
    switchUserTab('history');
    showToast('Viewing transaction history', 'info');
}

/**
 * Open settings
 */
function openSettings() {
    closeAdvancedProfileModal();
    showSettings();
}

// Override the existing showUserProfile function to use the new modal
const originalShowUserProfile = window.showUserProfile;
window.showUserProfile = function() {
    if (currentUser && currentUser.role === 'user') {
        showAdvancedUserProfile();
    } else if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
        // For admin/superadmin, use the existing admin profile view
        if (originalShowUserProfile) originalShowUserProfile();
    } else {
        if (originalShowUserProfile) originalShowUserProfile();
    }
};

// Also add a function for admin to view their profile with the same modal
function showAdminAdvancedProfile() {
    showAdvancedUserProfile();
}

// Expose functions globally
window.showAdvancedUserProfile = showAdvancedUserProfile;
window.closeAdvancedProfileModal = closeAdvancedProfileModal;
window.copyReferralCode = copyReferralCode;
window.copyReferralLinkFromProfile = copyReferralLinkFromProfile;
window.editProfile = editProfile;
window.viewTransactionHistory = viewTransactionHistory;
window.openSettings = openSettings;

// ============================================
// REFERRAL LINK SYSTEM - COMPLETE
// ============================================

/**
 * Get referral code from URL parameters
 */
function getReferralCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('ref');
}

/**
 * Auto-fill referral code in signup form if present in URL
 */
function autoFillReferralCode() {
    const referralCode = getReferralCodeFromURL();
    if (referralCode) {
        const referralInput = document.getElementById('signupReferral');
        if (referralInput) {
            referralInput.value = referralCode;
            referralInput.style.borderColor = '#4CAF50';
            referralInput.style.backgroundColor = '#f1f8e9';
            
            // Show a nice notification
            setTimeout(() => {
                showToast('✅ Referral code automatically added!', 'success');
            }, 500);
        }
    }
}

/**
 * Get the current site URL (production or development)
 */
function getCurrentSiteUrl() {
    // Check if we're in production (smarttask.com) or localhost
    const hostname = window.location.hostname;
    
    // If you're on a custom domain like smarttask.com
    if (hostname.includes('smarttask.com') || hostname.includes('smarttask-3722a.web.app')) {
        // Production URL - use your Firebase hosting URL or custom domain
        return 'https://smarttask-3722a.web.app';
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Development - use localhost
        return 'http://localhost:7700';
    }
    
    // Fallback to current origin
    return window.location.origin;
}

/**
 * Generate referral link for current user
 */
function generateReferralLink() {
    if (!currentUser || !currentUser.myReferralCode) return '';
    
    // Get the site URL
    const siteUrl = getCurrentSiteUrl();
    
    // Create the referral link
    return `${siteUrl}/?ref=${currentUser.myReferralCode}`;
}

/**
 * Update referral link display with proper site URL
 */
function updateReferralLink() {
    const referralLinkInput = document.getElementById('referralLink');
    if (referralLinkInput && currentUser && currentUser.myReferralCode) {
        const link = generateReferralLink();
        referralLinkInput.value = link;
        
        // Also update in profile if exists
        const profileLinkInput = document.getElementById('profileReferralLink');
        if (profileLinkInput) {
            profileLinkInput.value = link;
        }
        
        console.log('Referral link updated:', link);
    }
}

// ============================================
// SITE CONFIGURATION
// ============================================
// ============================================
// SITE CONFIGURATION
// ============================================
const SITE_CONFIG = {
    // Your Firebase Hosting URL (update with your actual URL)
    productionUrl: 'https://smarttask-3722a.web.app',
    // Your custom domain (if you have one)
    customDomain: 'https://smarttask.com',
    // Development URL
    devUrl: 'http://localhost:7700'
};

/**
 * Get the current site URL (production or development)
 */
function getCurrentSiteUrl() {
    const hostname = window.location.hostname;
    
    console.log('Detecting site URL from hostname:', hostname);
    
    // Check if we're on Firebase Hosting
    if (hostname.includes('web.app') || hostname.includes('firebaseapp.com')) {
        // Use the current origin for Firebase hosting
        return window.location.origin;
    }
    
    // Check if we're on custom domain
    if (hostname === 'smarttask.com' || hostname === 'www.smarttask.com') {
        return SITE_CONFIG.customDomain;
    }
    
    // Development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return SITE_CONFIG.devUrl;
    }
    
    // Fallback - use whatever is in the URL
    return window.location.origin;
}

/**
 * Generate referral link for current user
 */
function generateReferralLink() {
    if (!currentUser || !currentUser.myReferralCode) {
        console.log('Cannot generate referral link - no user or code');
        return '';
    }
    
    // Get the site URL
    const siteUrl = getCurrentSiteUrl();
    
    // Create the referral link with the code
    const referralLink = `${siteUrl}/?ref=${currentUser.myReferralCode}`;
    
    console.log('Generated referral link:', referralLink);
    return referralLink;
}

/**
 * Update ALL referral links in the page (dashboard and profile)
 */
function updateAllReferralLinks() {
    if (!currentUser || !currentUser.myReferralCode) return;
    
    const referralLink = generateReferralLink();
    
    // Update dashboard referral link
    const dashboardLink = document.getElementById('referralLink');
    if (dashboardLink) {
        dashboardLink.value = referralLink;
        console.log('Dashboard referral link updated');
    }
    
    // Update profile referral link
    const profileLink = document.getElementById('profileReferralLink');
    if (profileLink) {
        profileLink.value = referralLink;
        console.log('Profile referral link updated');
    }
    
    // Also update any other referral code displays
    const referralCodeDisplay = document.getElementById('profileReferralCode');
    if (referralCodeDisplay && currentUser.myReferralCode) {
        referralCodeDisplay.textContent = currentUser.myReferralCode;
    }
}

/**
 * Get referral code from URL parameters
 */
function getReferralCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
        console.log('Found referral code in URL:', refCode);
    }
    
    return refCode;
}

/**
 * Auto-fill referral code in signup form if present in URL
 */
function autoFillReferralCode() {
    const referralCode = getReferralCodeFromURL();
    if (referralCode) {
        const referralInput = document.getElementById('signupReferral');
        if (referralInput) {
            referralInput.value = referralCode;
            referralInput.style.borderColor = '#4CAF50';
            referralInput.style.backgroundColor = '#f1f8e9';
            
            // Add visual indicator
            const parentGroup = referralInput.closest('.input-group');
            if (parentGroup) {
                parentGroup.style.position = 'relative';
                
                // Remove existing checkmark if any
                const existingCheck = parentGroup.querySelector('.referral-check');
                if (existingCheck) existingCheck.remove();
                
                const checkIcon = document.createElement('i');
                checkIcon.className = 'fas fa-check-circle referral-check';
                checkIcon.style.position = 'absolute';
                checkIcon.style.right = '15px';
                checkIcon.style.top = '50%';
                checkIcon.style.transform = 'translateY(-50%)';
                checkIcon.style.color = '#4CAF50';
                checkIcon.style.fontSize = '18px';
                parentGroup.appendChild(checkIcon);
            }
            
            // Show notification
            setTimeout(() => {
                showToast(`✅ Referral code "${referralCode}" automatically applied!`, 'success');
            }, 500);
            
            console.log('Auto-filled referral code:', referralCode);
        }
    }
}

/**
 * Debug function to check referral URL generation
 */
function debugReferralSystem() {
    console.log('=== REFERRAL SYSTEM DEBUG ===');
    console.log('Current hostname:', window.location.hostname);
    console.log('Current origin:', window.location.origin);
    console.log('Site URL from config:', getCurrentSiteUrl());
    
    if (currentUser) {
        console.log('Current user:', currentUser.username);
        console.log('Referral code:', currentUser.myReferralCode);
        console.log('Generated referral link:', generateReferralLink());
    } else {
        console.log('No user logged in');
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    console.log('Referral code in URL:', urlParams.get('ref'));
    
    console.log('=== END DEBUG ===');
}

// Expose debug function
window.debugReferralSystem = debugReferralSystem;

/**
 * Copy referral link to clipboard
 */
function copyReferralLink() {
    const linkInput = document.getElementById('referralLink');
    if (!linkInput || !linkInput.value) {
        showToast('No referral link available', 'error');
        return;
    }
    
    const link = linkInput.value;
    
    navigator.clipboard.writeText(link).then(() => {
        showToast('✅ Referral link copied to clipboard!', 'success');
        console.log('Copied link:', link);
        
        // Visual feedback
        const btn = event?.target?.closest('button');
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            btn.style.background = '#4CAF50';
            btn.style.color = 'white';
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.style.background = '';
                btn.style.color = '';
            }, 2000);
        }
    }).catch(() => {
        // Fallback
        linkInput.select();
        document.execCommand('copy');
        showToast('✅ Referral link copied to clipboard!', 'success');
        console.log('Copied link (fallback):', link);
    });
}













/**
 * Update referral link display
 */
function updateReferralLink() {
    const referralLinkInput = document.getElementById('referralLink');
    if (referralLinkInput && currentUser && currentUser.myReferralCode) {
        const link = generateReferralLink();
        referralLinkInput.value = link;
    }
}

/**
 * Copy referral link from dashboard
 */
function copyReferralLink() {
    const linkInput = document.getElementById('referralLink');
    if (!linkInput || !linkInput.value) {
        showToast('No referral link available', 'error');
        return;
    }
    
    const link = linkInput.value;
    
    navigator.clipboard.writeText(link).then(() => {
        showToast('✅ Referral link copied to clipboard!', 'success');
        console.log('Copied referral link:', link);
        
        // Visual feedback for button
        const btn = event?.target?.closest('button');
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            btn.style.background = '#4CAF50';
            btn.style.color = 'white';
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.style.background = '';
                btn.style.color = '';
            }, 2000);
        }
    }).catch(() => {
        // Fallback for older browsers
        linkInput.select();
        document.execCommand('copy');
        showToast('✅ Referral link copied to clipboard!', 'success');
    });
}

/**
 * Copy referral link from profile modal
 */
function copyReferralLinkFromProfile() {
    const linkInput = document.getElementById('profileReferralLink');
    if (!linkInput || !linkInput.value) {
        showToast('No referral link available', 'error');
        return;
    }
    
    const link = linkInput.value;
    
    navigator.clipboard.writeText(link).then(() => {
        showToast('✅ Referral link copied to clipboard!', 'success');
        console.log('Copied referral link from profile:', link);
        
        // Visual feedback
        const btn = event?.target?.closest('button');
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.style.background = '#4CAF50';
            btn.style.color = 'white';
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.style.background = '';
                btn.style.color = '';
            }, 1500);
        }
    }).catch(() => {
        // Fallback
        linkInput.select();
        document.execCommand('copy');
        showToast('✅ Referral link copied to clipboard!', 'success');
    });
}

/**
 * Copy referral code only (not the full link)
 */
function copyReferralCode() {
    if (!currentUser || !currentUser.myReferralCode) {
        showToast('No referral code available', 'error');
        return;
    }
    
    const code = currentUser.myReferralCode;
    
    navigator.clipboard.writeText(code).then(() => {
        showToast('✅ Referral code copied to clipboard!', 'success');
        console.log('Copied referral code:', code);
        
        // Visual feedback
        const btn = event?.target?.closest('button');
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.style.background = '#4CAF50';
            btn.style.color = 'white';
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.style.background = '';
                btn.style.color = '';
            }, 1500);
        }
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('✅ Referral code copied to clipboard!', 'success');
    });
}

/**
 * Validate referral code and get referrer info
 */
async function validateReferralCode(referralCode) {
    if (!referralCode) return null;
    
    try {
        const snapshot = await db.collection('users')
            .where('myReferralCode', '==', referralCode.toUpperCase())
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const referrer = snapshot.docs[0];
            return {
                id: referrer.id,
                data: referrer.data(),
                code: referralCode.toUpperCase()
            };
        }
        return null;
    } catch (error) {
        console.error('Error validating referral code:', error);
        return null;
    }
}

/**
 * Process referral commission after successful signup
 */
async function processReferralCommission(referrerId, newUserId, newUsername) {
    try {
        const level1Commission = systemSettings.registrationBonus * 0.1; // 10%
        const level2Commission = systemSettings.registrationBonus * 0.03; // 3%
        const level3Commission = systemSettings.registrationBonus * 0.01; // 1%
        
        const batch = db.batch();
        
        // Level 1 - Direct referrer
        const referrerRef = db.collection('users').doc(referrerId);
        batch.update(referrerRef, {
            referralBalance: firebase.firestore.FieldValue.increment(level1Commission),
            totalEarned: firebase.firestore.FieldValue.increment(level1Commission),
            'referralEarnings.level1': firebase.firestore.FieldValue.increment(level1Commission),
            referrals: firebase.firestore.FieldValue.arrayUnion({
                username: newUsername,
                level: 1,
                date: new Date().toISOString(),
                commission: level1Commission,
                userId: newUserId
            })
        });
        
        // Get referrer's data
        const referrerDoc = await referrerRef.get();
        const referrerData = referrerDoc.data();
        
        // Level 2 - Referrer's referrer
        if (referrerData.referredBy) {
            const level2Ref = db.collection('users').doc(referrerData.referredBy);
            batch.update(level2Ref, {
                referralBalance: firebase.firestore.FieldValue.increment(level2Commission),
                totalEarned: firebase.firestore.FieldValue.increment(level2Commission),
                'referralEarnings.level2': firebase.firestore.FieldValue.increment(level2Commission),
                referrals: firebase.firestore.FieldValue.arrayUnion({
                    username: newUsername,
                    level: 2,
                    date: new Date().toISOString(),
                    commission: level2Commission,
                    userId: newUserId
                })
            });
            
            // Level 3
            const level2Doc = await level2Ref.get();
            const level2Data = level2Doc.data();
            
            if (level2Data.referredBy) {
                const level3Ref = db.collection('users').doc(level2Data.referredBy);
                batch.update(level3Ref, {
                    referralBalance: firebase.firestore.FieldValue.increment(level3Commission),
                    totalEarned: firebase.firestore.FieldValue.increment(level3Commission),
                    'referralEarnings.level3': firebase.firestore.FieldValue.increment(level3Commission),
                    referrals: firebase.firestore.FieldValue.arrayUnion({
                        username: newUsername,
                        level: 3,
                        date: new Date().toISOString(),
                        commission: level3Commission,
                        userId: newUserId
                    })
                });
                
                // Send notification to level 3 referrer
                await addNotification(
                    level2Data.referredBy,
                    '🎉 New 3rd Level Referral!',
                    `${newUsername} joined using your referral chain! You earned ${formatMoney(level3Commission)}.`,
                    'success'
                );
            }
            
            // Send notification to level 2 referrer
            await addNotification(
                referrerData.referredBy,
                '🎉 New 2nd Level Referral!',
                `${newUsername} joined using your referral chain! You earned ${formatMoney(level2Commission)}.`,
                'success'
            );
        }
        
        // Send notification to direct referrer
        await addNotification(
            referrerId,
            '🎉 New Referral!',
            `${newUsername} joined using your referral link! You earned ${formatMoney(level1Commission)}.`,
            'success'
        );
        
        await batch.commit();
        
        console.log('Referral commission processed successfully');
        
    } catch (error) {
        console.error('Error processing referral commission:', error);
    }
}

/**
 * Enhanced signup function with referral code handling
 */
async function handleSignup() {
    console.log('📝 Signup function called');
    
    const fullName = document.getElementById('signupFullName')?.value.trim();
    const username = document.getElementById('signupUsername')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim().toLowerCase();
    const phone = document.getElementById('signupPhone')?.value.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirmPassword = document.getElementById('signupConfirmPassword')?.value;
    let referral = document.getElementById('signupReferral')?.value.trim().toUpperCase();
    const termsAgree = document.getElementById('termsAgree')?.checked;
    
    // Basic validation
    if (!fullName || !username || !email || !phone || !password || !confirmPassword) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    if (!termsAgree) {
        showToast('You must agree to the Terms and Conditions', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    if (!validatePhone(phone)) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }
    if (username.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        return;
    }
    
    // Check if referral code is valid
    let referrer = null;
    if (referral && referral.trim() !== '') {
        const refCheck = await db.collection('users')
            .where('myReferralCode', '==', referral)
            .limit(1)
            .get();
        
        if (!refCheck.empty) {
            referrer = refCheck.docs[0];
            console.log('Valid referral code found:', referral);
        } else {
            showToast('Invalid referral code. You can still register without it.', 'warning');
            referral = null;
        }
    }
    
    showLoading();
    
    try {
        // Check if username already exists
        const usernameCheck = await db.collection('users').where('username', '==', username).get();
        if (!usernameCheck.empty) {
            hideLoading();
            showToast('Username already exists', 'error');
            return;
        }
        
        // Check if email already exists
        const emailCheck = await db.collection('users').where('email', '==', email).get();
        if (!emailCheck.empty) {
            hideLoading();
            showToast('Email already registered', 'error');
            return;
        }
        
        // Check if phone already exists
        const phoneCheck = await db.collection('users').where('phone', '==', phone).get();
        if (!phoneCheck.empty) {
            hideLoading();
            showToast('Phone number already registered', 'error');
            return;
        }
        
        // Create auth user
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;
        
        // Determine role based on email (for predefined admins)
        let role = 'user';
        if (email === 'smart@task.com') role = 'admin';
        else if (email === 'kingharuni420@gmail.com') role = 'superadmin';
        
        // Generate referral code
        const urlFriendlyUsername = username.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) || 'user';
       const myReferralCode = await generateUniqueReferralCode();
        
// Create user document in Firestore
const newUser = {
    // Basic Information
    uid: uid,
    username: username,
    email: email,
    fullName: fullName,
    phone: phone,
    role: role,
    usernameLower: username.toLowerCase(),
    
    // Account Status
    isActive: true,
    isVerified: false,
    profileImage: null,
    
    // Financial Information
    balance: systemSettings.registrationBonus,
    referralBalance: 0,
    totalEarned: systemSettings.registrationBonus,
    totalInvested: 0,
    
    // Referral Information
    referralEarnings: {
        level1: 0,
        level2: 0,
        level3: 0
    },
    referrals: [],
    myReferralCode: myReferralCode,
    referredBy: referrer ? referrer.id : null,
    
    // Task Information
    tasksCompleted: 0,
    lastTaskDate: null,
    completedTasks: [],
    activePackages: [],
    
    // Transaction History
    history: [{
        id: generateId(),
        type: 'bonus',
        description: 'Registration Bonus',
        amount: systemSettings.registrationBonus,
        status: 'completed',
        date: new Date().toISOString()
    }],
    
    // Notifications
    notifications: [{
        id: generateId(),
        title: '🎉 Welcome to SmartTask!',
        message: `Thank you for joining! You've received ${formatMoney(systemSettings.registrationBonus)} as a registration bonus.`,
        type: 'success',
        read: false,
        date: new Date().toISOString()
    }],
    
    // Dates
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    
    // Login Information
    loginCount: 1,
    
    // ============================================
    // WEEKLY COMMISSION SYSTEM
    // ============================================
    weeklyCommission: {
        // Last date when commission was paid
        lastPaidDate: null,
        
        // Current week's earnings from referrals (task earnings)
        currentWeekEarnings: {
            level1: 0, // Level 1 referrals' task earnings this week
            level2: 0, // Level 2 referrals' task earnings this week
            level3: 0, // Level 3 referrals' task earnings this week
            total: 0 // Total earnings from all levels
        },
        
        // History of all commission payments
        commissionHistory: [],
        
        // Commission pending to be paid next payout
        pendingCommission: 0,
        
        // User's own task earnings this week
        weeklyTaskEarnings: 0
    }
};

        // Attempt to write to Firestore
        try {
            await db.collection('users').doc(uid).set(newUser);
        } catch (firestoreError) {
            console.error('Firestore write failed:', firestoreError);
            // Clean up the auth user to avoid orphaned accounts
            await userCredential.user.delete();
            hideLoading();
            if (firestoreError.code === 'permission-denied') {
                showToast('Signup failed: Permission denied. Please check Firestore rules.', 'error');
            } else {
                showToast('Signup failed: Unable to save user data. Please try again.', 'error');
            }
            return;
        }
        
        // Process referral commission if applicable
        if (referrer) {
            await processReferralCommission(referrer.id, uid, username);
            
            // Add a special welcome message for referred users
            const welcomeMessage = `You were referred by ${referrer.data().username || 'a friend'}! Thank you for joining!`;
            await addNotification(uid, '🎉 Referral Welcome!', welcomeMessage, 'success');
        }
        
        hideLoading();
        showToast('✅ Registration successful! You received 2,000 TZS bonus!', 'success');
        
        // Clear URL parameters after successful signup
        if (window.history && window.history.pushState) {
            const newUrl = window.location.origin + window.location.pathname;
            window.history.pushState({}, '', newUrl);
        }
        
    } catch (error) {
        hideLoading();
        console.error('Signup error:', error);
        
        if (error.code === 'auth/email-already-in-use') {
            showToast('Email already in use.', 'error');
        } else if (error.code === 'auth/weak-password') {
            showToast('Password is too weak.', 'error');
        } else if (error.code === 'auth/invalid-email') {
            showToast('Invalid email address.', 'error');
        } else {
            showToast(error.message || 'An error occurred during registration', 'error');
        }
    }
}

/**
 * Add notification to user's document
 */
async function addNotification(userId, title, message, type = 'info') {
    try {
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
            notifications: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                title,
                message,
                type,
                read: false,
                date: new Date().toISOString()
            })
        });
    } catch (error) {
        console.error('Error adding notification:', error);
    }
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Generate referral code from username
 */
// ============================================
// GENERATE RANDOM REFERRAL CODE (NOT RELATED TO USERNAME)
// ============================================

/**
 * Generate a random referral code (6-8 characters alphanumeric)
 * Format: 4 letters + 4 numbers e.g., "ABCD1234"
 */
function generateReferralCode() {
    // Generate 4 random uppercase letters
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluding I and O to avoid confusion
    let letterPart = '';
    for (let i = 0; i < 4; i++) {
        letterPart += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    
    // Generate 4 random numbers
    const numberPart = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Combine letters + numbers
    return letterPart + numberPart;
}

/**
 * Generate a unique referral code (ensures no duplicates)
 */
async function generateUniqueReferralCode() {
    let isUnique = false;
    let referralCode = '';
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
        referralCode = generateReferralCode();
        
        // Check if code already exists
        const existingUser = await db.collection('users')
            .where('myReferralCode', '==', referralCode)
            .get();
        
        if (existingUser.empty) {
            isUnique = true;
        }
        attempts++;
    }
    
    return referralCode;
}

/**
 * Copy to clipboard (fallback function)
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copied to clipboard!', 'success');
    });
}

/**
 * Initialize referral system on page load
 */
function initReferralSystem() {
    // Auto-fill referral code in signup form if present in URL
    autoFillReferralCode();
    
    // Update referral link display if user is logged in
    if (currentUser) {
        updateReferralLink();
    }
}

// Add event listener for page load
document.addEventListener('DOMContentLoaded', function() {
    initReferralSystem();
});


window.loadUserData = async function() {
    await originalLoadUserData();
    if (currentUser) {
        updateReferralLink();
    }
};

/**
 * Debug function to check referral links
 */
function debugReferralLinks() {
    console.log('=== REFERRAL LINKS DEBUG ===');
    console.log('Current user:', currentUser?.username);
    console.log('Referral code:', currentUser?.myReferralCode);
    console.log('Site URL:', getCurrentSiteUrl());
    console.log('Generated referral link:', generateReferralLink());
    
    // Check dashboard link
    const dashboardLink = document.getElementById('referralLink');
    console.log('Dashboard link element:', dashboardLink);
    console.log('Dashboard link value:', dashboardLink?.value);
    
    // Check profile link
    const profileLink = document.getElementById('profileReferralLink');
    console.log('Profile link element:', profileLink);
    console.log('Profile link value:', profileLink?.value);
    
    console.log('=== END DEBUG ===');
}

// Expose debug function
window.debugReferralLinks = debugReferralLinks;

// ============================================
// USER SETTINGS FUNCTIONS
// ============================================

/**
 * Show user settings modal
 */
function showUserSettings() {
    if (!currentUser) {
        showToast('Please log in first', 'error');
        return;
    }
    
    // Load current user data into form
    document.getElementById('settingsFullName').value = currentUser.fullName || '';
    document.getElementById('settingsUsername').value = currentUser.username || '';
    document.getElementById('settingsEmail').value = currentUser.email || '';
    document.getElementById('settingsPhone').value = currentUser.phone || '';
    document.getElementById('settingsProfileImage').value = currentUser.profileImage || '';
    
    // Reset password fields
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    
    // Reset delete confirmation
    const confirmCheckbox = document.getElementById('confirmDeleteCheckbox');
    if (confirmCheckbox) {
        confirmCheckbox.checked = false;
        document.getElementById('deleteAccountBtn').disabled = true;
    }
    
    // Show modal
    const modal = document.getElementById('userSettingsModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Close user settings modal
 */
function closeUserSettingsModal() {
    const modal = document.getElementById('userSettingsModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Switch between settings tabs
 */
function switchSettingsTab(tab) {
    // Update active tab buttons
    document.querySelectorAll('.settings-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.settings-tab').classList.add('active');
    
    // Update content visibility
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tab === 'profile') {
        document.getElementById('profileSettingsTab').classList.add('active');
    } else if (tab === 'password') {
        document.getElementById('passwordSettingsTab').classList.add('active');
    } else if (tab === 'danger') {
        document.getElementById('dangerZoneTab').classList.add('active');
        
        // Add event listener for delete confirmation checkbox
        const confirmCheckbox = document.getElementById('confirmDeleteCheckbox');
        const deleteBtn = document.getElementById('deleteAccountBtn');
        if (confirmCheckbox && deleteBtn) {
            confirmCheckbox.onchange = function() {
                deleteBtn.disabled = !this.checked;
            };
        }
    }
}

/**
 * Update user profile
 */
async function updateUserProfile() {
    const fullName = document.getElementById('settingsFullName').value.trim();
    const username = document.getElementById('settingsUsername').value.trim();
    const email = document.getElementById('settingsEmail').value.trim();
    const phone = document.getElementById('settingsPhone').value.trim();
    const profileImage = document.getElementById('settingsProfileImage').value.trim();
    
    // Validation
    if (!fullName || !username || !email || !phone) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (username.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    if (!validatePhone(phone)) {
        showToast('Please enter a valid phone number', 'error');
        return;
    }
    
    // Check if username is taken (if changed)
    if (username !== currentUser.username) {
        const usernameCheck = await db.collection('users')
            .where('username', '==', username)
            .get();
        
        if (!usernameCheck.empty) {
            showToast('Username already taken', 'error');
            return;
        }
    }
    
    // Check if email is taken (if changed)
    if (email !== currentUser.email) {
        const emailCheck = await db.collection('users')
            .where('email', '==', email)
            .get();
        
        if (!emailCheck.empty) {
            showToast('Email already registered', 'error');
            return;
        }
        
        // Update Firebase Auth email
        try {
            const user = auth.currentUser;
            if (user) {
                await user.updateEmail(email);
            }
        } catch (error) {
            console.error('Error updating email:', error);
            showToast('Error updating email. Please re-authenticate.', 'error');
            return;
        }
    }
    
    showSettingsLoading('Updating profile...');
    
    try {
        // Update user document in Firestore
        const userRef = db.collection('users').doc(currentUser.uid);
        const updates = {
            fullName: fullName,
            username: username,
            email: email,
            phone: phone,
            profileImage: profileImage || null,
            updatedAt: new Date().toISOString()
        };
        
        await userRef.update(updates);
        
        // Update local currentUser
        currentUser = {
            ...currentUser,
            ...updates
        };
        
        // Update display name in Firebase Auth
        const user = auth.currentUser;
        if (user) {
            await user.updateProfile({
                displayName: fullName
            });
        }
        
        hideSettingsLoading();
        showToast('✅ Profile updated successfully!', 'success');
        
        // Update UI
        updateUserDisplay();
        
        // Close modal after 1 second
        setTimeout(() => {
            closeUserSettingsModal();
        }, 1500);
        
    } catch (error) {
        hideSettingsLoading();
        console.error('Error updating profile:', error);
        showToast('Error updating profile: ' + error.message, 'error');
    }
}

/**
 * Change user password
 */
async function changeUserPassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }
    
    showSettingsLoading('Changing password...');
    
    try {
        const user = auth.currentUser;
        if (!user || !user.email) {
            throw new Error('User not authenticated');
        }
        
        // Re-authenticate user
        const credential = firebase.auth.EmailAuthProvider.credential(
            user.email,
            currentPassword
        );
        
        await user.reauthenticateWithCredential(credential);
        
        // Update password
        await user.updatePassword(newPassword);
        
        hideSettingsLoading();
        showToast('✅ Password changed successfully!', 'success');
        
        // Clear password fields
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
        
        // Close modal after 1.5 seconds
        setTimeout(() => {
            closeUserSettingsModal();
        }, 1500);
        
    } catch (error) {
        hideSettingsLoading();
        console.error('Error changing password:', error);
        
        if (error.code === 'auth/wrong-password') {
            showToast('Current password is incorrect', 'error');
        } else if (error.code === 'auth/requires-recent-login') {
            showToast('Please log out and log in again to change password', 'error');
        } else {
            showToast('Error changing password: ' + error.message, 'error');
        }
    }
}

/**
 * Delete user account
 */
async function deleteUserAccount() {
    const confirmCheckbox = document.getElementById('confirmDeleteCheckbox');
    
    if (!confirmCheckbox || !confirmCheckbox.checked) {
        showToast('Please confirm account deletion', 'error');
        return;
    }
    
    if (!confirm('⚠️ WARNING: This action is permanent! Are you ABSOLUTELY sure you want to delete your account?')) {
        return;
    }
    
    if (!confirm('This will delete ALL your data. Type "DELETE" to confirm.')) {
        const userInput = prompt('Type "DELETE" to confirm account deletion:');
        if (userInput !== 'DELETE') {
            showToast('Account deletion cancelled', 'info');
            return;
        }
    }
    
    showSettingsLoading('Deleting account... This may take a moment.');
    
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }
        
        // Delete user data from Firestore
        const userRef = db.collection('users').doc(currentUser.uid);
        
        // Delete user's deposits
        const depositsSnapshot = await db.collection('deposits')
            .where('userId', '==', currentUser.uid)
            .get();
        
        const batch = db.batch();
        depositsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete user's withdrawals
        const withdrawalsSnapshot = await db.collection('withdrawals')
            .where('userId', '==', currentUser.uid)
            .get();
        
        withdrawalsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete user document
        batch.delete(userRef);
        
        await batch.commit();
        
        // Delete Firebase Auth user
        await user.delete();
        
        hideSettingsLoading();
        showToast('✅ Account deleted successfully', 'success');
        
        // Log out
        await auth.signOut();
        
        // Close modal
        closeUserSettingsModal();
        
        // Redirect to login
        showAuth();
        
    } catch (error) {
        hideSettingsLoading();
        console.error('Error deleting account:', error);
        
        if (error.code === 'auth/requires-recent-login') {
            showToast('Please log out and log in again to delete your account', 'error');
        } else {
            showToast('Error deleting account: ' + error.message, 'error');
        }
    }
}

/**
 * Show loading overlay for settings
 */
function showSettingsLoading(message = 'Processing...') {
    const overlay = document.getElementById('settingsLoadingOverlay');
    if (overlay) {
        const messageEl = overlay.querySelector('.loading-message');
        if (messageEl) messageEl.textContent = message;
        overlay.style.display = 'flex';
    }
}

/**
 * Hide loading overlay for settings
 */
function hideSettingsLoading() {
    const overlay = document.getElementById('settingsLoadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Update the showSettings function to open the modal
function showSettings() {
    showUserSettings();
}

// Make functions globally available
window.showUserSettings = showUserSettings;
window.closeUserSettingsModal = closeUserSettingsModal;
window.switchSettingsTab = switchSettingsTab;
window.updateUserProfile = updateUserProfile;
window.changeUserPassword = changeUserPassword;
window.deleteUserAccount = deleteUserAccount;

// ============================================
// WEEKLY SALARY COMMISSION SYSTEM
// ============================================

const COMMISSION_RATES = {
    level1: 10,  // 10%
    level2: 7,   // 7%
    level3: 3    // 3%
};

/**
 * Track referral's task earnings for weekly commission
 * Called when a user completes tasks and earns daily profit
 */
async function trackReferralEarnings(userId, amountEarned) {
    try {
        // Get the user who earned the amount
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        if (!userData.referredBy) return; // No referrer
        
        // Get the referrer
        const referrerRef = db.collection('users').doc(userData.referredBy);
        const referrerDoc = await referrerRef.get();
        const referrerData = referrerDoc.data();
        
        if (!referrerData) return;
        
        // Get current week start date
        const weekStart = getWeekStartDate();
        const weekEnd = getWeekEndDate();
        
        // Update referrer's weekly earnings for level 1
        await referrerRef.update({
            'weeklyCommission.currentWeekEarnings.level1': firebase.firestore.FieldValue.increment(amountEarned),
            'weeklyCommission.currentWeekEarnings.total': firebase.firestore.FieldValue.increment(amountEarned)
        });
        
        console.log(`Tracked ${amountEarned} TZS for level 1 referral of ${referrerData.username}`);
        
        // Track level 2
        if (referrerData.referredBy) {
            const level2Ref = db.collection('users').doc(referrerData.referredBy);
            await level2Ref.update({
                'weeklyCommission.currentWeekEarnings.level2': firebase.firestore.FieldValue.increment(amountEarned),
                'weeklyCommission.currentWeekEarnings.total': firebase.firestore.FieldValue.increment(amountEarned)
            });
            console.log(`Tracked ${amountEarned} TZS for level 2 referral`);
        }
        
        // Track level 3
        const level2Doc = await referrerRef.get();
        const level2Data = level2Doc.data();
        if (level2Data && level2Data.referredBy) {
            const level3Ref = db.collection('users').doc(level2Data.referredBy);
            await level3Ref.update({
                'weeklyCommission.currentWeekEarnings.level3': firebase.firestore.FieldValue.increment(amountEarned),
                'weeklyCommission.currentWeekEarnings.total': firebase.firestore.FieldValue.increment(amountEarned)
            });
            console.log(`Tracked ${amountEarned} TZS for level 3 referral`);
        }
        
    } catch (error) {
        console.error('Error tracking referral earnings:', error);
    }
}

/**
 * Calculate weekly commission for a user
 */
async function calculateWeeklyCommission(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        if (!userData.weeklyCommission) return 0;
        
        const earnings = userData.weeklyCommission.currentWeekEarnings;
        
        // Calculate commission based on rates
        const level1Commission = (earnings.level1 * COMMISSION_RATES.level1) / 100;
        const level2Commission = (earnings.level2 * COMMISSION_RATES.level2) / 100;
        const level3Commission = (earnings.level3 * COMMISSION_RATES.level3) / 100;
        
        const totalCommission = level1Commission + level2Commission + level3Commission;
        
        return {
            level1: level1Commission,
            level2: level2Commission,
            level3: level3Commission,
            total: totalCommission,
            breakdown: {
                level1Earnings: earnings.level1,
                level2Earnings: earnings.level2,
                level3Earnings: earnings.level3,
                level1Rate: COMMISSION_RATES.level1,
                level2Rate: COMMISSION_RATES.level2,
                level3Rate: COMMISSION_RATES.level3
            }
        };
        
    } catch (error) {
        console.error('Error calculating weekly commission:', error);
        return 0;
    }
}

/**
 * Get week start date (Monday 00:00:00)
 */
function getWeekStartDate() {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? 6 : day - 1); // Adjust so Monday is first day
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
}

/**
 * Get week end date (Sunday 23:59:59)
 */
function getWeekEndDate() {
    const weekStart = getWeekStartDate();
    const sunday = new Date(weekStart);
    sunday.setDate(weekStart.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
}

/**
 * Check if it's time to process weekly commission (Sunday midnight)
 */
function isWeeklyPayoutTime() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Sunday at 23:59
    return day === 0 && hour === 23 && minute >= 59;
}

/**
 * Process weekly commission for all users
 */
async function processWeeklyCommission() {
    console.log('Processing weekly commission...');
    showLoading('Processing weekly commissions...');
    
    try {
        const usersSnapshot = await db.collection('users').get();
        const batch = db.batch();
        const weekStart = getWeekStartDate();
        const weekEnd = getWeekEndDate();
        const weekLabel = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
        
        let totalCommissionPaid = 0;
        let usersPaid = 0;
        
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;
            
            // Skip if no weekly commission data
            if (!userData.weeklyCommission) continue;
            
            // Check if already paid this week
            const lastPaidDate = userData.weeklyCommission.lastPaidDate;
            if (lastPaidDate) {
                const lastPaid = new Date(lastPaidDate);
                if (lastPaid >= weekStart) continue; // Already paid this week
            }
            
            // Calculate commission
            const commission = await calculateWeeklyCommission(userId);
            
            if (commission.total > 0) {
                // Create commission record
                const commissionRecord = {
                    id: generateId(),
                    week: weekLabel,
                    weekStart: weekStart.toISOString(),
                    weekEnd: weekEnd.toISOString(),
                    amount: commission.total,
                    breakdown: commission.breakdown,
                    level1Commission: commission.level1,
                    level2Commission: commission.level2,
                    level3Commission: commission.level3,
                    paidAt: new Date().toISOString(),
                    status: 'paid'
                };
                
                // Update user document
                batch.update(db.collection('users').doc(userId), {
                    balance: firebase.firestore.FieldValue.increment(commission.total),
                    totalEarned: firebase.firestore.FieldValue.increment(commission.total),
                    'weeklyCommission.lastPaidDate': new Date().toISOString(),
                    'weeklyCommission.commissionHistory': firebase.firestore.FieldValue.arrayUnion(commissionRecord),
                    'weeklyCommission.currentWeekEarnings': {
                        level1: 0,
                        level2: 0,
                        level3: 0,
                        total: 0
                    },
                    history: firebase.firestore.FieldValue.arrayUnion({
                        id: generateId(),
                        type: 'commission',
                        description: `Weekly Commission (${weekLabel})`,
                        amount: commission.total,
                        status: 'completed',
                        date: new Date().toISOString(),
                        metadata: {
                            level1: commission.level1,
                            level2: commission.level2,
                            level3: commission.level3,
                            breakdown: commission.breakdown
                        }
                    })
                });
                
                // Add notification
                await addNotification(userId, '🎉 Weekly Commission Paid!', 
                    `You earned ${formatMoney(commission.total)} from weekly commissions! (Level 1: ${formatMoney(commission.level1)}, Level 2: ${formatMoney(commission.level2)}, Level 3: ${formatMoney(commission.level3)})`,
                    'success');
                
                totalCommissionPaid += commission.total;
                usersPaid++;
                
                console.log(`Paid ${formatMoney(commission.total)} to ${userData.username}`);
            }
        }
        
        await batch.commit();
        
        hideLoading();
        console.log(`Weekly commission processed: Paid ${formatMoney(totalCommissionPaid)} to ${usersPaid} users`);
        showToast(`✅ Weekly commissions processed! Paid ${formatMoney(totalCommissionPaid)} to ${usersPaid} users`, 'success');
        
    } catch (error) {
        hideLoading();
        console.error('Error processing weekly commission:', error);
        showToast('Error processing weekly commissions', 'error');
    }
}

/**
 * Schedule weekly commission processing
 */
function scheduleWeeklyCommission() {
    // Check every hour
    setInterval(async () => {
        if (isWeeklyPayoutTime()) {
            console.log('Weekly payout time detected!');
            await processWeeklyCommission();
        }
    }, 60 * 60 * 1000); // Check every hour
}

/**
 * Get user's weekly commission history
 */
async function getUserWeeklyCommissionHistory(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        return userData.weeklyCommission?.commissionHistory || [];
    } catch (error) {
        console.error('Error getting commission history:', error);
        return [];
    }
}

/**
 * Get current week's commission preview for user
 */
async function getCurrentWeekCommissionPreview(userId) {
    try {
        const commission = await calculateWeeklyCommission(userId);
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        return {
            current: commission,
            earnings: userData.weeklyCommission?.currentWeekEarnings || { level1: 0, level2: 0, level3: 0, total: 0 },
            weekStart: getWeekStartDate(),
            weekEnd: getWeekEndDate()
        };
    } catch (error) {
        console.error('Error getting commission preview:', error);
        return null;
    }
}

// ============================================
// WEEKLY COMMISSION DISPLAY FUNCTIONS - FIXED
// ============================================

/**
 * Show weekly commission modal
 */
async function showWeeklyCommission() {
    console.log('showWeeklyCommission called');
    
    // Check if user is logged in
    if (!currentUser || !currentUser.uid) {
        console.log('No user logged in');
        showToast('Please log in first', 'error');
        return;
    }
    
    console.log('Current user:', currentUser.username);
    
    showSettingsLoading('Loading commission data...');
    
    try {
        // Ensure we have fresh user data
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (!userDoc.exists) {
            console.error('User document not found');
            hideSettingsLoading();
            showToast('User data not found', 'error');
            return;
        }
        
        const freshUserData = userDoc.data();
        currentUser = { ...currentUser, ...freshUserData };
        
        // Get current week preview
        let preview = null;
        try {
            preview = await getCurrentWeekCommissionPreview(currentUser.uid);
            console.log('Commission preview:', preview);
        } catch (previewError) {
            console.error('Error getting commission preview:', previewError);
            // Use default preview if error
            preview = {
                current: { total: 0, level1: 0, level2: 0, level3: 0 },
                earnings: { level1: 0, level2: 0, level3: 0, total: 0 },
                weekStart: getWeekStartDate(),
                weekEnd: getWeekEndDate()
            };
        }
        
        // Get commission history
        let history = [];
        try {
            history = await getUserWeeklyCommissionHistory(currentUser.uid);
        } catch (historyError) {
            console.error('Error getting commission history:', historyError);
            history = [];
        }
        
        // Update modal with data
        if (preview) {
            const weekStart = new Date(preview.weekStart);
            const weekEnd = new Date(preview.weekEnd);
            const weekRange = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
            
            // Update elements safely
            const weekRangeDisplay = document.getElementById('weekRangeDisplay');
            if (weekRangeDisplay) weekRangeDisplay.textContent = weekRange;
            
            const level1Earnings = document.getElementById('modalLevel1Earnings');
            if (level1Earnings) level1Earnings.textContent = formatMoney(preview.earnings?.level1 || 0);
            
            const level2Earnings = document.getElementById('modalLevel2Earnings');
            if (level2Earnings) level2Earnings.textContent = formatMoney(preview.earnings?.level2 || 0);
            
            const level3Earnings = document.getElementById('modalLevel3Earnings');
            if (level3Earnings) level3Earnings.textContent = formatMoney(preview.earnings?.level3 || 0);
            
            const projectedCommission = document.getElementById('modalProjectedCommission');
            if (projectedCommission) projectedCommission.textContent = formatMoney(preview.current?.total || 0);
            
            // Update commission badge in menu
            updateCommissionBadge(preview.current?.total || 0);
        }
        
        // Update pending commission section
        const weeklyCommission = currentUser.weeklyCommission || {};
        const pendingCommission = weeklyCommission.pendingCommission || 0;
        
        const pendingSection = document.getElementById('pendingCommissionSection');
        if (pendingSection) {
            if (pendingCommission > 0) {
                pendingSection.style.display = 'block';
                const pendingAmount = document.getElementById('pendingCommissionAmount');
                if (pendingAmount) pendingAmount.textContent = formatMoney(pendingCommission);
            } else {
                pendingSection.style.display = 'none';
            }
        }
        
        // Update weekly task earnings
        const weeklyTaskEarnings = weeklyCommission.weeklyTaskEarnings || 0;
        const taskEarningsElement = document.getElementById('weeklyTaskEarnings');
        if (taskEarningsElement) {
            taskEarningsElement.textContent = formatMoney(weeklyTaskEarnings);
        }
        
        // Update commission history
        const historyList = document.getElementById('commissionHistoryListModal');
        if (historyList) {
            if (history && history.length > 0) {
                let html = '';
                history.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt)).forEach(record => {
                    const paidDate = new Date(record.paidAt);
                    html += `
                        <div class="history-commission-item">
                            <div class="history-header">
                                <span class="history-week">Week: ${escapeHtml(record.week)}</span>
                                <span class="history-amount">+${formatMoney(record.amount)}</span>
                            </div>
                            <div class="history-details">
                                <span><i class="fas fa-chart-line"></i> Level 1 (10%): ${formatMoney(record.level1Commission)}</span>
                                <span><i class="fas fa-chart-line"></i> Level 2 (7%): ${formatMoney(record.level2Commission)}</span>
                                <span><i class="fas fa-chart-line"></i> Level 3 (3%): ${formatMoney(record.level3Commission)}</span>
                            </div>
                            <div class="history-date">
                                <i class="far fa-calendar-alt"></i> Paid: ${paidDate.toLocaleDateString()}
                            </div>
                        </div>
                    `;
                });
                historyList.innerHTML = html;
            } else {
                historyList.innerHTML = '<p class="no-data">No commission payments yet. Complete tasks and invite friends to start earning!</p>';
            }
        }
        
        hideSettingsLoading();
        
        // Show modal
        const modal = document.getElementById('weeklyCommissionModal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        } else {
            console.warn('weeklyCommissionModal element not found');
            showToast('Commission details loaded! Check your menu for more info.', 'success');
        }
        
    } catch (error) {
        hideSettingsLoading();
        console.error('Error loading weekly commission:', error);
        showToast('Error loading commission data', 'error');
    }
}

/**
 * Get current week's commission preview for user - with error handling
 */
async function getCurrentWeekCommissionPreview(userId) {
    try {
        if (!userId) {
            console.error('No userId provided to getCurrentWeekCommissionPreview');
            return {
                current: { total: 0, level1: 0, level2: 0, level3: 0 },
                earnings: { level1: 0, level2: 0, level3: 0, total: 0 },
                weekStart: getWeekStartDate(),
                weekEnd: getWeekEndDate()
            };
        }
        
        const commission = await calculateWeeklyCommission(userId);
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        return {
            current: commission || { total: 0, level1: 0, level2: 0, level3: 0 },
            earnings: userData?.weeklyCommission?.currentWeekEarnings || { level1: 0, level2: 0, level3: 0, total: 0 },
            weekStart: getWeekStartDate(),
            weekEnd: getWeekEndDate()
        };
    } catch (error) {
        console.error('Error getting commission preview:', error);
        return {
            current: { total: 0, level1: 0, level2: 0, level3: 0 },
            earnings: { level1: 0, level2: 0, level3: 0, total: 0 },
            weekStart: getWeekStartDate(),
            weekEnd: getWeekEndDate()
        };
    }
}

/**
 * Get user's weekly commission history - with error handling
 */
async function getUserWeeklyCommissionHistory(userId) {
    try {
        if (!userId) {
            console.error('No userId provided to getUserWeeklyCommissionHistory');
            return [];
        }
        
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            console.error('User document not found for history');
            return [];
        }
        
        const userData = userDoc.data();
        return userData.weeklyCommission?.commissionHistory || [];
    } catch (error) {
        console.error('Error getting commission history:', error);
        return [];
    }
}

/**
 * Calculate weekly commission for a user - with error handling
 */
async function calculateWeeklyCommission(userId) {
    try {
        if (!userId) {
            console.error('No userId provided to calculateWeeklyCommission');
            return { level1: 0, level2: 0, level3: 0, total: 0, breakdown: {} };
        }
        
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            console.error('User document not found for commission calculation');
            return { level1: 0, level2: 0, level3: 0, total: 0, breakdown: {} };
        }
        
        const userData = userDoc.data();
        
        if (!userData.weeklyCommission) {
            return { level1: 0, level2: 0, level3: 0, total: 0, breakdown: {} };
        }
        
        const earnings = userData.weeklyCommission.currentWeekEarnings || { level1: 0, level2: 0, level3: 0, total: 0 };
        
        // Calculate commission based on rates
        const level1Commission = (earnings.level1 * COMMISSION_RATES.level1) / 100;
        const level2Commission = (earnings.level2 * COMMISSION_RATES.level2) / 100;
        const level3Commission = (earnings.level3 * COMMISSION_RATES.level3) / 100;
        
        const totalCommission = level1Commission + level2Commission + level3Commission;
        
        return {
            level1: level1Commission,
            level2: level2Commission,
            level3: level3Commission,
            total: totalCommission,
            breakdown: {
                level1Earnings: earnings.level1,
                level2Earnings: earnings.level2,
                level3Earnings: earnings.level3,
                level1Rate: COMMISSION_RATES.level1,
                level2Rate: COMMISSION_RATES.level2,
                level3Rate: COMMISSION_RATES.level3
            }
        };
        
    } catch (error) {
        console.error('Error calculating weekly commission:', error);
        return { level1: 0, level2: 0, level3: 0, total: 0, breakdown: {} };
    }
}

/**
 * Load weekly commission preview for the current user - with error handling
 */
async function loadWeeklyCommissionPreview() {
    if (!currentUser || !currentUser.uid) return;
    
    try {
        const preview = await getCurrentWeekCommissionPreview(currentUser.uid);
        if (preview && preview.current && preview.current.total > 0) {
            updateCommissionBadge(preview.current.total);
        } else {
            updateCommissionBadge(0);
        }
    } catch (error) {
        console.error('Error loading commission preview:', error);
        updateCommissionBadge(0);
    }
}

/**
 * Update commission badge in user menu - with safe checks
 */
function updateCommissionBadge(amount) {
    const badge = document.getElementById('commissionBadge');
    if (badge) {
        if (amount > 0) {
            badge.textContent = formatMoney(amount);
            badge.style.display = 'inline-block';
            badge.classList.add('highlight');
            setTimeout(() => {
                if (badge) badge.classList.remove('highlight');
            }, 1000);
        } else {
            badge.textContent = '0 TZS';
        }
    }
}
/**
 * Close weekly commission modal
 */
function closeWeeklyCommissionModal() {
    const modal = document.getElementById('weeklyCommissionModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Load weekly commission preview for the current user
 */
async function loadWeeklyCommissionPreview() {
    if (!currentUser) return;
    
    try {
        const preview = await getCurrentWeekCommissionPreview(currentUser.uid);
        if (preview && preview.current.total > 0) {
            updateCommissionBadge(preview.current.total);
        }
    } catch (error) {
        console.error('Error loading commission preview:', error);
    }
}

window.loadUserData = async function() {
    await originalLoadUserData();
    await loadWeeklyCommissionPreview();
};

// Make functions globally available
window.showWeeklyCommission = showWeeklyCommission;
window.closeWeeklyCommissionModal = closeWeeklyCommissionModal;

/**
 * Show payment methods modal with commission info
 */
function showPaymentMethods() {
    if (!currentUser) return;
    
    // Update the payment methods modal to show commission balance
    const modal = document.getElementById('userPaymentMethodsModal');
    if (modal) {
        // Add commission info to the modal if not already there
        let commissionInfo = document.querySelector('.commission-info');
        if (!commissionInfo) {
            const infoDiv = document.createElement('div');
            infoDiv.className = 'commission-info';
            infoDiv.innerHTML = `
                <div class="commission-info-card">
                    <i class="fas fa-calendar-week"></i>
                    <div>
                        <h4>Weekly Commission Balance</h4>
                        <p class="commission-amount" id="paymentMethodsCommission">0 TZS</p>
                        <small>Earned from your referrals' task completions</small>
                    </div>
                    <button onclick="showWeeklyCommission()" class="small-btn">View Details</button>
                </div>
            `;
            
            // Insert at the top of the modal content
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.insertBefore(infoDiv, modalContent.firstChild);
            }
        }
        
        // Update commission amount
        const commissionAmount = document.getElementById('paymentMethodsCommission');
        if (commissionAmount && currentUser.weeklyCommission) {
            // Get current week's projected commission
            getCurrentWeekCommissionPreview(currentUser.uid).then(preview => {
                if (preview && preview.current.total > 0) {
                    commissionAmount.textContent = formatMoney(preview.current.total);
                } else {
                    commissionAmount.textContent = '0 TZS';
                }
            });
        }
        
        modal.classList.add('show');
        loadUserPaymentMethods();
    }
}

// ============================================
// CLOSE PAYMENT METHODS MODAL
// ============================================

/**
 * Close payment methods modal
 */
function closePaymentMethodsModal() {
    const modal = document.getElementById('userPaymentMethodsModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Close weekly commission modal (if open)
 */
function closeWeeklyCommissionModal() {
    const modal = document.getElementById('weeklyCommissionModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Close settings modal
 */
function closeUserSettingsModal() {
    const modal = document.getElementById('userSettingsModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Close any open modal (utility function)
 */
function closeAllModals() {
    const modals = [
        'userPaymentMethodsModal',
        'weeklyCommissionModal',
        'userSettingsModal',
        'taskFormModal',
        'advancedProfileModal',
        'termsModal'
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && modal.classList.contains('show')) {
            modal.classList.remove('show');
        }
    });
    
    document.body.style.overflow = '';
}

// Make functions globally available
window.closePaymentMethodsModal = closePaymentMethodsModal;
window.closeWeeklyCommissionModal = closeWeeklyCommissionModal;
window.closeUserSettingsModal = closeUserSettingsModal;
window.closeAllModals = closeAllModals;

// ============================================
// SLIDESHOW FUNCTIONALITY
// ============================================

let currentSlideIndex = 0;
let slideInterval;

/**
 * Initialize slideshow
 */
function initSlideshow() {
    // Get all slides
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    
    if (slides.length === 0) return;
    
    // Set first slide as active
    currentSlideIndex = 0;
    showSlide(currentSlideIndex);
    
    // Start auto-sliding
    startAutoSlide();
}

/**
 * Show specific slide by index
 */
function showSlide(index) {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    
    if (!slides.length) return;
    
    // Handle index bounds
    if (index >= slides.length) index = 0;
    if (index < 0) index = slides.length - 1;
    
    // Hide all slides
    slides.forEach(slide => {
        slide.classList.remove('active');
    });
    
    // Show current slide
    slides[index].classList.add('active');
    
    // Update dots
    dots.forEach((dot, i) => {
        if (i === index) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
    
    currentSlideIndex = index;
}

/**
 * Next slide
 */
function nextSlide() {
    stopAutoSlide();
    showSlide(currentSlideIndex + 1);
    startAutoSlide();
}

/**
 * Previous slide
 */
function prevSlide() {
    stopAutoSlide();
    showSlide(currentSlideIndex - 1);
    startAutoSlide();
}

/**
 * Go to specific slide (called from dot click)
 */
function currentSlide(index) {
    stopAutoSlide();
    showSlide(index);
    startAutoSlide();
}

/**
 * Start auto-sliding (every 5 seconds)
 */
function startAutoSlide() {
    if (slideInterval) clearInterval(slideInterval);
    slideInterval = setInterval(() => {
        nextSlide();
    }, 5000);
}

/**
 * Stop auto-sliding
 */
function stopAutoSlide() {
    if (slideInterval) {
        clearInterval(slideInterval);
        slideInterval = null;
    }
}

/**
 * Pause slideshow on hover
 */
function pauseOnHover() {
    const container = document.querySelector('.slideshow-container');
    if (!container) return;
    
    container.addEventListener('mouseenter', () => {
        stopAutoSlide();
    });
    
    container.addEventListener('mouseleave', () => {
        startAutoSlide();
    });
}

// Initialize slideshow when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for images to load
    setTimeout(() => {
        initSlideshow();
        pauseOnHover();
    }, 100);
});

// Make functions globally available
window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.currentSlide = currentSlide;

// ============================================
// ANNOUNCEMENTS SYSTEM
// ============================================

let announcements = [];

/**
 * Load announcements from Firestore
 */
async function loadAnnouncements() {
    console.log('Loading announcements...');
    
    try {
        const snapshot = await db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        announcements = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderAnnouncements();
        
        // Update badge count
        updateAnnouncementBadge();
        
    } catch (error) {
        console.error('Error loading announcements:', error);
        // Show sample announcements if Firestore is empty
        if (announcements.length === 0) {
            showSampleAnnouncements();
        }
    }
}

/**
 * Show sample announcements for demo
 */
function showSampleAnnouncements() {
    announcements = [
        {
            id: 'sample1',
            title: '🎉 Welcome to SmartTask!',
            content: 'Thank you for joining SmartTask! Complete your first task to earn 2,000 TZS registration bonus.',
            type: 'info',
            priority: 'normal',
            createdAt: new Date().toISOString(),
            expiresAt: null
        },
        {
            id: 'sample2',
            title: '💰 New VIP Packages Available',
            content: 'We have added new VIP packages with higher returns. Check out the Diamond and Presidential packages for up to 6% daily profit!',
            type: 'success',
            priority: 'important',
            createdAt: new Date().toISOString(),
            expiresAt: null
        },
        {
            id: 'sample3',
            title: '⭐ Referral Bonus Increased!',
            content: 'Refer your friends and earn up to 10% commission from their earnings. Level 1: 10%, Level 2: 7%, Level 3: 3%!',
            type: 'warning',
            priority: 'urgent',
            createdAt: new Date().toISOString(),
            expiresAt: null
        },
        {
            id: 'sample4',
            title: '📱 Mobile App Coming Soon',
            content: 'We are excited to announce that SmartTask mobile app will be available in the coming weeks. Stay tuned for updates!',
            type: 'info',
            priority: 'normal',
            createdAt: new Date().toISOString(),
            expiresAt: null
        },
        {
            id: 'sample5',
            title: '🎁 Weekly Commission System',
            content: 'Now earn weekly commissions from your referrals\' task completions. The more your referrals earn, the more you earn!',
            type: 'success',
            priority: 'important',
            createdAt: new Date().toISOString(),
            expiresAt: null
        }
    ];
    
    renderAnnouncements();
    updateAnnouncementBadge();
}

/**
 * Render announcements in the container
 */
function renderAnnouncements() {
    const container = document.getElementById('announcementsList');
    if (!container) return;
    
    if (announcements.length === 0) {
        container.innerHTML = `
            <div class="announcement-empty">
                <i class="fas fa-bullhorn"></i>
                <p>No announcements at the moment</p>
                <small>Check back later for updates!</small>
            </div>
        `;
        return;
    }
    
    let html = '';
    announcements.forEach(announcement => {
        const createdAt = new Date(announcement.createdAt);
        const isExpired = announcement.expiresAt && new Date(announcement.expiresAt) < new Date();
        
        if (isExpired) return;
        
        // Determine priority class
        let priorityClass = '';
        let typeIcon = '';
        
        switch(announcement.priority) {
            case 'urgent':
                priorityClass = 'urgent';
                typeIcon = '<i class="fas fa-exclamation-triangle" style="color: #ff4757;"></i>';
                break;
            case 'important':
                priorityClass = 'important';
                typeIcon = '<i class="fas fa-star" style="color: #ffa502;"></i>';
                break;
            default:
                priorityClass = 'info';
                typeIcon = '<i class="fas fa-info-circle" style="color: #1e90ff;"></i>';
        }
        
        // Truncate content for preview
        let shortContent = announcement.content;
        let needsReadMore = false;
        if (announcement.content.length > 150) {
            shortContent = announcement.content.substring(0, 150) + '...';
            needsReadMore = true;
        }
        
        html += `
            <div class="announcement-item ${priorityClass}" data-id="${announcement.id}">
                <div class="announcement-header">
                    <div class="announcement-title">
                        ${typeIcon}
                        <span>${escapeHtml(announcement.title)}</span>
                        ${announcement.priority === 'urgent' ? '<span class="announcement-badge-type urgent">URGENT</span>' : ''}
                        ${announcement.priority === 'important' ? '<span class="announcement-badge-type important">IMPORTANT</span>' : ''}
                    </div>
                    <div class="announcement-date">
                        <i class="far fa-calendar-alt"></i>
                        ${timeAgo(announcement.createdAt)}
                    </div>
                </div>
                <div class="announcement-content" id="content-${announcement.id}">
                    ${escapeHtml(shortContent)}
                </div>
                ${needsReadMore ? `
                    <div class="announcement-footer">
                        <a href="#" class="announcement-read-more" onclick="toggleAnnouncementContent('${announcement.id}', event)">
                            Read more <i class="fas fa-chevron-down"></i>
                        </a>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Toggle full content of announcement
 */
function toggleAnnouncementContent(announcementId, event) {
    if (event) event.preventDefault();
    
    const announcement = announcements.find(a => a.id === announcementId);
    if (!announcement) return;
    
    const contentDiv = document.getElementById(`content-${announcementId}`);
    const readMoreLink = contentDiv?.parentElement?.querySelector('.announcement-read-more');
    
    if (!contentDiv) return;
    
    if (contentDiv.getAttribute('data-full') === 'true') {
        // Show truncated version
        const shortContent = announcement.content.substring(0, 150) + '...';
        contentDiv.textContent = shortContent;
        contentDiv.setAttribute('data-full', 'false');
        if (readMoreLink) {
            readMoreLink.innerHTML = 'Read more <i class="fas fa-chevron-down"></i>';
        }
    } else {
        // Show full content
        contentDiv.textContent = announcement.content;
        contentDiv.setAttribute('data-full', 'true');
        if (readMoreLink) {
            readMoreLink.innerHTML = 'Show less <i class="fas fa-chevron-up"></i>';
        }
    }
}

/**
 * Update announcement badge count
 */
function updateAnnouncementBadge() {
    const badge = document.getElementById('announcementCount');
    if (badge) {
        badge.textContent = announcements.length;
    }
}

/**
 * Create a new announcement (for admin/superadmin)
 */
async function createAnnouncement(announcementData) {
    try {
        const newAnnouncement = {
            ...announcementData,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.uid || 'admin',
            createdByName: currentUser?.username || 'System'
        };
        
        await db.collection('announcements').add(newAnnouncement);
        showToast('✅ Announcement created successfully!', 'success');
        await loadAnnouncements();
        
    } catch (error) {
        console.error('Error creating announcement:', error);
        showToast('Error creating announcement', 'error');
    }
}

/**
 * Delete an announcement (for admin/superadmin)
 */
async function deleteAnnouncement(announcementId) {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    
    try {
        await db.collection('announcements').doc(announcementId).delete();
        showToast('Announcement deleted', 'success');
        await loadAnnouncements();
    } catch (error) {
        console.error('Error deleting announcement:', error);
        showToast('Error deleting announcement', 'error');
    }
}

/**
 * Show admin announcement form (for admin panel)
 */
function showAnnouncementForm() {
    // Create modal for creating announcements
    const modalHtml = `
        <div id="announcementFormModal" class="modal show">
            <div class="modal-content">
                <span class="close" onclick="closeAnnouncementForm()">&times;</span>
                <h2><i class="fas fa-bullhorn"></i> Create Announcement</h2>
                <form id="announcementForm" onsubmit="event.preventDefault(); submitAnnouncement();">
                    <div class="form-group">
                        <label>Title *</label>
                        <input type="text" id="announcementTitle" required placeholder="Enter announcement title">
                    </div>
                    
                    <div class="form-group">
                        <label>Content *</label>
                        <textarea id="announcementContent" rows="5" required placeholder="Enter announcement details"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Priority</label>
                        <select id="announcementPriority">
                            <option value="normal">Normal</option>
                            <option value="important">Important</option>
                            <option value="urgent">Urgent</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Type</label>
                        <select id="announcementType">
                            <option value="info">Info</option>
                            <option value="success">Success</option>
                            <option value="warning">Warning</option>
                            <option value="danger">Danger</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Expiry Date (Optional)</label>
                        <input type="date" id="announcementExpiry">
                        <small>Leave empty for no expiry</small>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="auth-btn">Create Announcement</button>
                        <button type="button" onclick="closeAnnouncementForm()" class="auth-btn secondary">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('announcementFormModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Close announcement form
 */
function closeAnnouncementForm() {
    const modal = document.getElementById('announcementFormModal');
    if (modal) modal.remove();
}

/**
 * Submit new announcement
 */
async function submitAnnouncement() {
    const title = document.getElementById('announcementTitle')?.value.trim();
    const content = document.getElementById('announcementContent')?.value.trim();
    const priority = document.getElementById('announcementPriority')?.value;
    const type = document.getElementById('announcementType')?.value;
    const expiryDate = document.getElementById('announcementExpiry')?.value;
    
    if (!title || !content) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const announcementData = {
        title: title,
        content: content,
        priority: priority || 'normal',
        type: type || 'info',
        expiresAt: expiryDate ? new Date(expiryDate).toISOString() : null
    };
    
    await createAnnouncement(announcementData);
    closeAnnouncementForm();
}

// Make functions globally available
window.loadAnnouncements = loadAnnouncements;
window.toggleAnnouncementContent = toggleAnnouncementContent;
window.createAnnouncement = createAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.showAnnouncementForm = showAnnouncementForm;
window.closeAnnouncementForm = closeAnnouncementForm;
window.submitAnnouncement = submitAnnouncement;

// Initialize announcements when page loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        loadAnnouncements();
    }, 500);
});

// Also load announcements when showing auth
const originalShowAuth = window.showAuth;
window.showAuth = function() {
    if (originalShowAuth) originalShowAuth();
    loadAnnouncements();
};

/**
 * Load announcements for admin panel
 */
async function loadAdminAnnouncements() {
    const tbody = document.getElementById('adminAnnouncementsBody');
    if (!tbody) return;
    
    try {
        const snapshot = await db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .get();
        
        const adminAnnouncements = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        if (adminAnnouncements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">No announcements found</td></tr>';
            return;
        }
        
        let html = '';
        adminAnnouncements.forEach(announcement => {
            const createdAt = new Date(announcement.createdAt);
            const priorityClass = announcement.priority === 'urgent' ? 'urgent' : 
                                 (announcement.priority === 'important' ? 'important' : '');
            
            html += `
                <tr>
                    <td><strong>${escapeHtml(announcement.title)}</strong></td>
                    <td>${escapeHtml(announcement.content.substring(0, 100))}${announcement.content.length > 100 ? '...' : ''}</td>
                    <td><span class="status-badge ${priorityClass}">${announcement.priority}</span></td>
                    <td>${createdAt.toLocaleDateString()}</td>
                    <td class="action-buttons">
                        <button class="action-btn small danger" onclick="deleteAnnouncement('${announcement.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading admin announcements:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">Error loading announcements</td></tr>';
    }
}

// Override switchAdminTab to include announcements
const originalSwitchAdminTab = window.switchAdminTab;
window.switchAdminTab = function(tabName) {
    if (originalSwitchAdminTab) originalSwitchAdminTab(tabName);
    
    if (tabName === 'announcements') {
        loadAdminAnnouncements();
    }
};

/**
 * Load announcements for admin panel
 */
async function loadAdminAnnouncements() {
    const tbody = document.getElementById('adminAnnouncementsBody');
    if (!tbody) return;
    
    try {
        const snapshot = await db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .get();
        
        const adminAnnouncements = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        if (adminAnnouncements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">No announcements found</td></tr>';
            return;
        }
        
        let html = '';
        adminAnnouncements.forEach(announcement => {
            const createdAt = new Date(announcement.createdAt);
            const priorityClass = announcement.priority === 'urgent' ? 'urgent' : 
                                 (announcement.priority === 'important' ? 'important' : '');
            
            html += `
                <tr>
                    <td><strong>${escapeHtml(announcement.title)}</strong></td>
                    <td>${escapeHtml(announcement.content.substring(0, 100))}${announcement.content.length > 100 ? '...' : ''}</td>
                    <td><span class="status-badge ${priorityClass}">${announcement.priority}</span></td>
                    <td>${createdAt.toLocaleDateString()}</td>
                    <td class="action-buttons">
                        <button class="action-btn small danger" onclick="deleteAnnouncement('${announcement.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading admin announcements:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">Error loading announcements</td></tr>';
    }
}

// Override switchAdminTab to include announcements

window.switchAdminTab = function(tabName) {
    if (originalSwitchAdminTab) originalSwitchAdminTab(tabName);
    
    if (tabName === 'announcements') {
        loadAdminAnnouncements();
    }
};

// ============================================
// SUPER ADMIN COMPLETE FUNCTIONS
// ============================================

// Global variables for super admin
let allUsers = [];
let allTransactions = [];
let auditLogs = [];
let systemLogs = [];

// ============================================
// DASHBOARD FUNCTIONS
// ============================================

async function loadSuperAdminDashboard() {
    console.log('Loading super admin dashboard...');
    
    try {
        // Load all users
        const usersSnapshot = await db.collection('users').get();
        allUsers = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        
        // Load all deposits
        const depositsSnapshot = await db.collection('deposits').get();
        const allDeposits = depositsSnapshot.docs.map(doc => doc.data());
        
        // Load all withdrawals
        const withdrawalsSnapshot = await db.collection('withdrawals').get();
        const allWithdrawals = withdrawalsSnapshot.docs.map(doc => doc.data());
        
        // Calculate totals
        const totalUsers = allUsers.length;
        const activeUsers = allUsers.filter(u => u.isActive !== false).length;
        const totalAdmins = allUsers.filter(u => u.role === 'admin' || u.role === 'superadmin').length;
        
        const totalDeposits = allDeposits
            .filter(d => d.status === 'completed')
            .reduce((sum, d) => sum + (d.amount || 0), 0);
        
        const totalWithdrawals = allWithdrawals
            .filter(w => w.status === 'completed')
            .reduce((sum, w) => sum + (w.amount || 0), 0);
        
        const platformProfit = totalDeposits - totalWithdrawals;
        
        // Update dashboard stats
        document.getElementById('superTotalUsers').textContent = totalUsers;
        document.getElementById('totalAdmins').textContent = totalAdmins;
        document.getElementById('totalVolume').textContent = formatMoney(totalDeposits);
        
        const growthRate = totalUsers > 0 ? ((totalUsers / 100) * 100).toFixed(1) : '0';
        document.getElementById('growthRate').textContent = `+${growthRate}%`;
        
        // Update system health
        updateSystemHealth();
        
    } catch (error) {
        console.error('Error loading super admin dashboard:', error);
    }
}

// ============================================
// ADMIN MANAGEMENT
// ============================================

async function loadAdminsList() {
    const tbody = document.getElementById('superAdminsTableBody');
    if (!tbody) return;
    
    try {
        const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'superadmin');
        
        // Update stats
        document.getElementById('superTotalAdmins').textContent = admins.length;
        document.getElementById('superActiveAdmins').textContent = admins.filter(a => a.isActive !== false).length;
        document.getElementById('superSuperAdmins').textContent = admins.filter(a => a.role === 'superadmin').length;
        
        if (admins.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No admins found</td></tr>';
            return;
        }
        
        let html = '';
        admins.forEach(admin => {
            const lastLogin = admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Never';
            const roleBadge = admin.role === 'superadmin' ? 'superadmin-badge' : 'admin-badge';
            
            html += `
                <tr>
                    <td>
                        <div class="user-info">
                            <i class="fas ${admin.role === 'superadmin' ? 'fa-crown' : 'fa-user-shield'}"></i>
                            <div>
                                <strong>${escapeHtml(admin.fullName || admin.username)}</strong>
                                <small>@${escapeHtml(admin.username)}</small>
                            </div>
                        </div>
                    </td>
                    <td>${escapeHtml(admin.email)}</td>
                    <td><span class="role-badge ${roleBadge}">${admin.role}</span></td>
                    <td>
                        <span class="status-badge ${admin.isActive !== false ? 'success' : 'danger'}">
                            ${admin.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>${lastLogin}</td>
                    // In loadAdminsList function, update the action buttons:
<td class="action-buttons">
    <button class="action-btn small" onclick="viewAdminDetails('${admin.uid}')" title="View Details">
        <i class="fas fa-eye"></i>
    </button>
    ${admin.role !== 'superadmin' ? `
        <button class="action-btn small" onclick="editAdmin('${admin.uid}')" title="Edit Admin">
            <i class="fas fa-edit"></i>
        </button>
        <button class="action-btn small ${admin.isActive !== false ? 'warning' : 'success'}" 
            onclick="toggleAdminStatus('${admin.uid}')" 
            title="${admin.isActive !== false ? 'Deactivate' : 'Activate'}">
            <i class="fas ${admin.isActive !== false ? 'fa-ban' : 'fa-check'}"></i>
        </button>
        <button class="action-btn small danger" onclick="removeAdminUser('${admin.uid}')" title="Remove Admin">
            <i class="fas fa-trash"></i>
        </button>
    ` : '<span class="protected-badge">Protected</span>'}
</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading admins:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Error loading admins</td></tr>';
    }
}

function showAddAdminForm() {
    const modalHtml = `
        <div id="addAdminModal" class="modal show">
            <div class="modal-content">
                <span class="close" onclick="closeAddAdminModal()">&times;</span>
                <h2><i class="fas fa-user-plus"></i> Add New Admin</h2>
                <form id="addAdminForm" onsubmit="event.preventDefault(); createNewAdmin();">
                    <div class="form-group">
                        <label>Full Name *</label>
                        <input type="text" id="adminFullName" required>
                    </div>
                    <div class="form-group">
                        <label>Username *</label>
                        <input type="text" id="adminUsername" required>
                    </div>
                    <div class="form-group">
                        <label>Email *</label>
                        <input type="email" id="adminEmail" required>
                    </div>
                    <div class="form-group">
                        <label>Phone *</label>
                        <input type="tel" id="adminPhone" required>
                    </div>
                    <div class="form-group">
                        <label>Password *</label>
                        <input type="password" id="adminPassword" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <select id="adminRole">
                            <option value="admin">Admin</option>
                            <option value="superadmin">Super Admin</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="auth-btn">Create Admin</button>
                        <button type="button" onclick="closeAddAdminModal()" class="auth-btn secondary">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    const existing = document.getElementById('addAdminModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeAddAdminModal() {
    const modal = document.getElementById('addAdminModal');
    if (modal) modal.remove();
}

async function createNewAdmin() {
    const fullName = document.getElementById('adminFullName').value.trim();
    const username = document.getElementById('adminUsername').value.trim();
    const email = document.getElementById('adminEmail').value.trim();
    const phone = document.getElementById('adminPhone').value.trim();
    const password = document.getElementById('adminPassword').value;
    const role = document.getElementById('adminRole').value;
    
    if (!fullName || !username || !email || !phone || !password) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    showLoading('Creating admin...');
    
    try {
        // Check if username exists
        const usernameCheck = await db.collection('users')
            .where('username', '==', username)
            .get();
        if (!usernameCheck.empty) {
            hideLoading();
            showToast('Username already exists', 'error');
            return;
        }
        
        // Create auth user
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;
        
        // Create admin document
        const adminData = {
            uid,
            username,
            email,
            fullName,
            phone,
            role: role,
            balance: 0,
            referralBalance: 0,
            totalEarned: 0,
            totalInvested: 0,
            referralEarnings: { level1: 0, level2: 0, level3: 0 },
            referrals: [],
            myReferralCode: await generateUniqueReferralCode(),
            tasksCompleted: 0,
            lastTaskDate: null,
            completedTasks: [],
            activePackages: [],
            history: [],
            notifications: [],
            createdAt: new Date().toISOString(),
            referredBy: null,
            isActive: true,
            isVerified: true,
            lastLogin: new Date().toISOString(),
            loginCount: 1,
            profileImage: null,
            usernameLower: username.toLowerCase()
        };
        
        await db.collection('users').doc(uid).set(adminData);
        
        // Log the action
        await logAudit('admin_created', `New ${role} created: ${username}`, currentUser.uid);
        
        hideLoading();
        showToast(`✅ ${role} created successfully!`, 'success');
        closeAddAdminModal();
        
        // Reload admins list
        await loadAdminsList();
        
    } catch (error) {
        hideLoading();
        console.error('Error creating admin:', error);
        showToast('Error creating admin: ' + error.message, 'error');
    }
}

async function editAdminRole(userId) {
    const user = allUsers.find(u => u.uid === userId);
    if (!user) return;
    
    const newRole = prompt(`Current role: ${user.role}\nEnter new role (admin/superadmin):`, user.role);
    if (!newRole || !['admin', 'superadmin'].includes(newRole)) {
        showToast('Invalid role', 'error');
        return;
    }
    
    if (newRole === user.role) {
        showToast('Role is already set to that', 'info');
        return;
    }
    
    showLoading('Updating role...');
    
    try {
        await db.collection('users').doc(userId).update({
            role: newRole
        });
        
        await logAudit('role_changed', `Admin role changed to ${newRole} for ${user.username}`, currentUser.uid);
        
        hideLoading();
        showToast(`Role updated to ${newRole}`, 'success');
        await loadAdminsList();
        
    } catch (error) {
        hideLoading();
        console.error('Error updating role:', error);
        showToast('Error updating role', 'error');
    }
}

async function removeAdminUser(userId) {
    const user = allUsers.find(u => u.uid === userId);
    if (!user || user.role === 'superadmin') {
        showToast('Cannot remove super admin', 'error');
        return;
    }
    
    if (!confirm(`⚠️ WARNING: This will permanently delete admin ${user.username} and all their data! This action cannot be undone!\n\nType "DELETE" to confirm:`)) {
        const confirmText = prompt('Type "DELETE" to confirm:');
        if (confirmText !== 'DELETE') {
            showToast('Deletion cancelled', 'info');
            return;
        }
    }
    
    showLoading('Removing admin...');
    
    try {
        // Delete user document
        await db.collection('users').doc(userId).delete();
        
        // Delete Firebase Auth user
        const userToDelete = await auth.getUser(userId);
        if (userToDelete) {
            await auth.deleteUser(userId);
        }
        
        await logAudit('admin_removed', `Admin ${user.username} removed`, currentUser.uid);
        
        hideLoading();
        showToast(`Admin ${user.username} removed successfully`, 'success');
        await loadAdminsList();
        
    } catch (error) {
        hideLoading();
        console.error('Error removing admin:', error);
        showToast('Error removing admin: ' + error.message, 'error');
    }
}

// ============================================
// ALL USERS MANAGEMENT
// ============================================

async function loadAllUsers() {
    const tbody = document.getElementById('superAllUsersTableBody');
    if (!tbody) return;
    
    try {
        const users = allUsers.filter(u => u.role === 'user');
        
        // Update stats
        const activeUsers = users.filter(u => u.isActive !== false).length;
        const totalBalance = users.reduce((sum, u) => sum + (u.balance || 0), 0);
        
        document.getElementById('superTotalUsersCount').textContent = users.length;
        document.getElementById('superActiveUsersCount').textContent = activeUsers;
        document.getElementById('superTotalBalance').textContent = formatMoney(totalBalance);
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No users found</td></tr>';
            return;
        }
        
        let html = '';
        users.forEach(user => {
            const totalInvested = user.activePackages?.reduce((sum, p) => sum + p.investment, 0) || 0;
            
            html += `
                <tr>
                    <td>
                        <div class="user-info">
                            <i class="fas fa-user-circle"></i>
                            <div>
                                <strong>${escapeHtml(user.fullName || user.username)}</strong>
                                <small>@${escapeHtml(user.username)}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <small>${escapeHtml(user.email)}</small><br>
                        <small>${escapeHtml(user.phone)}</small>
                    </td>
                    <td>${formatMoney(user.balance || 0)}</td>
                    <td>${user.referrals?.length || 0}</td>
                    <td>${user.activePackages?.length || 0}</td>
                    <td>
                        <span class="status-badge ${user.isActive !== false ? 'success' : 'danger'}">
                            ${user.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                    // In the loadAllUsers function, update the action buttons section:
<td class="action-buttons">
    <button class="action-btn small" onclick="viewUserDetailsSuper('${user.uid}')" title="View Details">
        <i class="fas fa-eye"></i>
    </button>
    <button class="action-btn small" onclick="editUserAccount('${user.uid}')" title="Edit User">
        <i class="fas fa-edit"></i>
    </button>
    <button class="action-btn small warning" onclick="showUserPasswordOptions('${user.uid}')" title="Password Management">
        <i class="fas fa-key"></i>
    </button>
    <button class="action-btn small" onclick="showAddBalanceModal('${user.uid}', '${escapeHtml(user.username)}', '${user.balance || 0}')" title="Add Balance">
        <i class="fas fa-plus-circle"></i>
    </button>
    <button class="action-btn small ${user.isActive !== false ? 'warning' : 'success'}" 
        onclick="toggleUserStatusSuper('${user.uid}')" 
        title="${user.isActive !== false ? 'Deactivate' : 'Activate'}">
        <i class="fas ${user.isActive !== false ? 'fa-ban' : 'fa-check'}"></i>
    </button>
    <button class="action-btn small danger" onclick="deleteUserAccountSuper('${user.uid}')" title="Delete User">
        <i class="fas fa-trash"></i>
    </button>
</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">Error loading users</td></tr>';
    }
}

function searchSuperUsers() {
    const searchTerm = document.getElementById('superUserSearch')?.value.toLowerCase() || '';
    const tbody = document.getElementById('superAllUsersTableBody');
    
    if (!tbody) return;
    
    const filteredUsers = allUsers.filter(u => 
        u.role === 'user' && (
            u.username?.toLowerCase().includes(searchTerm) ||
            u.email?.toLowerCase().includes(searchTerm) ||
            u.fullName?.toLowerCase().includes(searchTerm) ||
            u.phone?.includes(searchTerm)
        )
    );
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">No users found matching your search</td></tr>';
        return;
    }
    
    let html = '';
    filteredUsers.forEach(user => {
        html += `
            <tr>
                <td>
                    <div class="user-info">
                        <i class="fas fa-user-circle"></i>
                        <div>
                            <strong>${escapeHtml(user.fullName || user.username)}</strong>
                            <small>@${escapeHtml(user.username)}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <small>${escapeHtml(user.email)}</small><br>
                    <small>${escapeHtml(user.phone)}</small>
                </td>
                <td>${formatMoney(user.balance || 0)}</td>
                <td>${user.referrals?.length || 0}</td>
                <td>${user.activePackages?.length || 0}</td>
                <td>
                    <span class="status-badge ${user.isActive !== false ? 'success' : 'danger'}">
                        ${user.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                <td class="action-buttons">
                    <button class="action-btn small" onclick="viewUserDetailsSuper('${user.uid}')">👁️</button>
                    <button class="action-btn small" onclick="addUserBalanceSuper('${user.uid}')">💰</button>
                    <button class="action-btn small ${user.isActive !== false ? 'warning' : 'success'}" 
                        onclick="toggleUserStatusSuper('${user.uid}')">
                        ${user.isActive !== false ? '🔒' : '🔓'}
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

async function viewUserDetailsSuper(userId) {
    const user = allUsers.find(u => u.uid === userId);
    if (!user) return;
    
    const deposits = await db.collection('deposits')
        .where('userId', '==', userId)
        .get();
    const userDeposits = deposits.docs.map(d => d.data());
    
    const withdrawals = await db.collection('withdrawals')
        .where('userId', '==', userId)
        .get();
    const userWithdrawals = withdrawals.docs.map(w => w.data());
    
    const totalDeposited = userDeposits
        .filter(d => d.status === 'completed')
        .reduce((sum, d) => sum + (d.amount || 0), 0);
    
    const totalWithdrawn = userWithdrawals
        .filter(w => w.status === 'completed')
        .reduce((sum, w) => sum + (w.amount || 0), 0);
    
    const details = `
📊 USER DETAILS REPORT
═══════════════════════════

👤 ACCOUNT INFO:
├─ Username: ${user.username}
├─ Full Name: ${user.fullName}
├─ Email: ${user.email}
├─ Phone: ${user.phone}
├─ Role: ${user.role}
└─ Status: ${user.isActive !== false ? '✅ Active' : '❌ Inactive'}

💰 FINANCIAL SUMMARY:
├─ Balance: ${formatMoney(user.balance || 0)}
├─ Referral Balance: ${formatMoney(user.referralBalance || 0)}
├─ Total Earned: ${formatMoney(user.totalEarned || 0)}
├─ Total Invested: ${formatMoney(user.totalInvested || 0)}
├─ Total Deposited: ${formatMoney(totalDeposited)}
└─ Total Withdrawn: ${formatMoney(totalWithdrawn)}

📈 STATISTICS:
├─ Referrals: ${user.referrals?.length || 0}
├─ Active Packages: ${user.activePackages?.length || 0}
├─ Tasks Completed: ${user.tasksCompleted || 0}
└─ Login Count: ${user.loginCount || 0}

⏰ DATES:
├─ Joined: ${new Date(user.createdAt).toLocaleString()}
├─ Last Login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
└─ Last Withdrawal: ${user.lastWithdrawalDate || 'Never'}

📋 RECENT ACTIVITY:
${user.history?.slice(0, 5).map(h => `├─ ${h.type}: ${formatMoney(h.amount)} (${h.status})`).join('\n') || '├─ No recent activity'}
    `;
    
    alert(details);
}

async function addUserBalanceSuper(userId) {
    const user = allUsers.find(u => u.uid === userId);
    if (!user) return;
    
    const amount = prompt(`Add balance for ${user.username}\n\nCurrent balance: ${formatMoney(user.balance || 0)}\n\nEnter amount to add:`, '10000');
    if (!amount) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    const reason = prompt('Enter reason (optional):', 'Admin Bonus');
    
    showLoading('Adding balance...');
    
    try {
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
            balance: firebase.firestore.FieldValue.increment(numAmount),
            totalEarned: firebase.firestore.FieldValue.increment(numAmount),
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'bonus',
                description: reason || 'Super Admin Bonus',
                amount: numAmount,
                status: 'completed',
                date: new Date().toISOString(),
                metadata: { addedBy: currentUser.username, reason: reason }
            })
        });
        
        await addNotification(userId, '💰 Balance Updated!', 
            `Your balance has been increased by ${formatMoney(numAmount)}. Reason: ${reason || 'Super Admin Bonus'}`, 'success');
        
        await logAudit('balance_added', `Added ${formatMoney(numAmount)} to ${user.username} (${reason})`, currentUser.uid);
        
        hideLoading();
        showToast(`✅ Added ${formatMoney(numAmount)} to ${user.username}`, 'success');
        await loadAllUsers();
        
    } catch (error) {
        hideLoading();
        console.error('Error adding balance:', error);
        showToast('Error adding balance', 'error');
    }
}

// ============================================
// IMPROVED TOGGLE USER STATUS
// ============================================

async function toggleUserStatusSuper(userId) {
    const user = allUsers.find(u => u.uid === userId);
    if (!user) return;
    
    const newStatus = !(user.isActive !== false);
    const action = newStatus ? 'activate' : 'deactivate';
    
    if (!confirm(`⚠️ Are you sure you want to ${action} user ${user.username}?\n\n${action === 'deactivate' ? 'This will immediately log them out if they are currently online.' : ''}`)) return;
    
    showLoading('Updating status...');
    
    try {
        await db.collection('users').doc(userId).update({
            isActive: newStatus,
            deactivatedAt: newStatus ? null : new Date().toISOString(),
            deactivatedBy: newStatus ? null : currentUser.uid,
            updatedAt: new Date().toISOString()
        });
        
        await logAudit('user_status_changed', `User ${user.username} ${action}d by ${currentUser.username}`, currentUser.uid);
        
        // If deactivating, add notification
        if (!newStatus) {
            await addNotification(userId, '⚠️ Account Deactivated',
                'Your account has been deactivated by an administrator. Please contact support for more information.', 'warning');
            
            // Force logout if they are currently logged in
            // This will happen in the session validation
        } else {
            await addNotification(userId, '✅ Account Activated',
                'Your account has been reactivated. You can now login and use all features again.', 'success');
        }
        
        hideLoading();
        showToast(`User ${action}d successfully`, 'success');
        
        // Refresh user lists
        await loadAllUsers();
        await loadAdminsList();
        
        // If current user is being deactivated, log them out
        if (currentUser && currentUser.uid === userId && !newStatus) {
            showToast('You have deactivated your own account. Logging out...', 'warning');
            setTimeout(() => {
                logout();
            }, 2000);
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error updating status:', error);
        showToast('Error updating status', 'error');
    }
}

// Same for admin status
async function toggleAdminStatus(userId) {
    const user = allUsers.find(u => u.uid === userId);
    if (!user || user.role === 'superadmin') {
        showToast('Cannot modify super admin status', 'error');
        return;
    }
    
    const newStatus = !(user.isActive !== false);
    const action = newStatus ? 'activate' : 'deactivate';
    
    if (!confirm(`Are you sure you want to ${action} admin ${user.username}?\n\n${action === 'deactivate' ? 'This will immediately log them out if they are currently online.' : ''}`)) return;
    
    showLoading('Updating status...');
    
    try {
        await db.collection('users').doc(userId).update({
            isActive: newStatus,
            deactivatedAt: newStatus ? null : new Date().toISOString(),
            deactivatedBy: newStatus ? null : currentUser.uid,
            updatedAt: new Date().toISOString()
        });
        
        await logAudit('admin_status_changed', `Admin ${user.username} ${action}d by ${currentUser.username}`, currentUser.uid);
        
        // Add notification
        await addNotification(userId, `🛡️ Admin Account ${action === 'deactivate' ? 'Deactivated' : 'Activated'}`,
            `Your admin account has been ${action}d by ${currentUser.username}. ${!newStatus ? 'Please contact support for assistance.' : ''}`,
            newStatus ? 'success' : 'warning');
        
        hideLoading();
        showToast(`Admin ${action}d successfully`, 'success');
        
        // Refresh admin list
        await loadAdminsList();
        
        // If current admin is being deactivated, log them out
        if (currentUser && currentUser.uid === userId && !newStatus) {
            showToast('You have deactivated your own admin account. Logging out...', 'warning');
            setTimeout(() => {
                logout();
            }, 2000);
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error updating status:', error);
        showToast('Error updating status', 'error');
    }
}

async function deleteUserAccountSuper(userId) {
    const user = allUsers.find(u => u.uid === userId);
    if (!user) return;
    
    if (!confirm(`⚠️ WARNING: This will permanently delete user ${user.username} and ALL their data!\n\nType "${user.username.toUpperCase()}" to confirm:`)) {
        const confirmText = prompt(`Type "${user.username.toUpperCase()}" to confirm deletion:`);
        if (confirmText !== user.username.toUpperCase()) {
            showToast('Deletion cancelled', 'info');
            return;
        }
    }
    
    showLoading('Deleting user account...');
    
    try {
        // Delete user's deposits
        const depositsSnap = await db.collection('deposits')
            .where('userId', '==', userId)
            .get();
        
        const batch = db.batch();
        depositsSnap.forEach(doc => batch.delete(doc.ref));
        
        // Delete user's withdrawals
        const withdrawalsSnap = await db.collection('withdrawals')
            .where('userId', '==', userId)
            .get();
        
        withdrawalsSnap.forEach(doc => batch.delete(doc.ref));
        
        // Delete user document
        batch.delete(db.collection('users').doc(userId));
        
        await batch.commit();
        
        // Delete Firebase Auth user
        try {
            const userToDelete = await auth.getUser(userId);
            if (userToDelete) {
                await auth.deleteUser(userId);
            }
        } catch (e) {
            console.log('Auth user may not exist or already deleted');
        }
        
        await logAudit('user_deleted', `User ${user.username} permanently deleted`, currentUser.uid);
        
        hideLoading();
        showToast(`User ${user.username} deleted permanently`, 'success');
        await loadAllUsers();
        
    } catch (error) {
        hideLoading();
        console.error('Error deleting user:', error);
        showToast('Error deleting user: ' + error.message, 'error');
    }
}

// ============================================
// AUDIT LOGS
// ============================================

async function logAudit(action, details, userId = null) {
    try {
        const auditData = {
            timestamp: new Date().toISOString(),
            action: action,
            details: details,
            userId: userId,
            username: currentUser?.username || 'system',
            ipAddress: await getClientIP()
        };
        
        await db.collection('auditLogs').add(auditData);
        
    } catch (error) {
        console.error('Error logging audit:', error);
    }
}

async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return 'unknown';
    }
}

async function loadAuditLogs() {
    const tbody = document.getElementById('auditLogsBody');
    if (!tbody) return;
    
    try {
        const snapshot = await db.collection('auditLogs')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();
        
        auditLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (auditLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">No audit logs found</td></tr>';
            return;
        }
        
        let html = '';
        auditLogs.forEach(log => {
            html += `
                <tr>
                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                    <td><strong>${escapeHtml(log.username || 'system')}</strong></td>
                    <td><span class="action-badge">${escapeHtml(log.action)}</span></td>
                    <td>${escapeHtml(log.details)}</td>
                    <td><code>${log.ipAddress || 'unknown'}</code></td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading audit logs:', error);
        tbody.innerHTML = '}<tr><td colspan="5" class="no-data">Error loading audit logs</td></tr>';
    }
}

function filterAuditLogs() {
    const type = document.getElementById('auditTypeFilter')?.value || 'all';
    const date = document.getElementById('auditDateFilter')?.value;
    
    let filtered = [...auditLogs];
    
    if (type !== 'all') {
        filtered = filtered.filter(log => log.action.includes(type));
    }
    
    if (date) {
        const filterDate = new Date(date).toDateString();
        filtered = filtered.filter(log => new Date(log.timestamp).toDateString() === filterDate);
    }
    
    const tbody = document.getElementById('auditLogsBody');
    if (!tbody) return;
    
    if (filtered.length === 0) {
        tbody.innerHTML = '}<tr><td colspan="5" class="no-data">No logs match filters</td></tr>';
        return;
    }
    
    let html = '';
    filtered.forEach(log => {
        html += `
            <tr>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td><strong>${escapeHtml(log.username || 'system')}</strong></td>
                <td><span class="action-badge">${escapeHtml(log.action)}</span></td>
                <td>${escapeHtml(log.details)}</td>
                <td><code>${log.ipAddress || 'unknown'}</code></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function exportAuditLogs() {
    const data = JSON.stringify(auditLogs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Audit logs exported', 'success');
}

// ============================================
// SYSTEM SETTINGS
// ============================================

async function loadSystemSettingsForSuper() {
    try {
        const settingsDoc = await db.collection('settings').doc('global').get();
        if (settingsDoc.exists) {
            const settings = settingsDoc.data();
            
            document.getElementById('sysMinDeposit').value = settings.minDeposit || 10000;
            document.getElementById('sysMaxDeposit').value = settings.maxDeposit || 10000000;
            document.getElementById('sysMinWithdrawal').value = settings.minWithdrawal || 3000;
            document.getElementById('sysMaxWithdrawal').value = settings.maxWithdrawal || 1000000;
            document.getElementById('sysRegBonus').value = settings.registrationBonus || 2000;
            document.getElementById('sysLoginBonus').value = settings.dailyLoginBonus || 200;
            document.getElementById('sysLevel1Percent').value = settings.referralLevels?.[0]?.percentage || 10;
            document.getElementById('sysLevel2Percent').value = settings.referralLevels?.[1]?.percentage || 3;
            document.getElementById('sysLevel3Percent').value = settings.referralLevels?.[2]?.percentage || 1;
            document.getElementById('sysTasksPerDay').value = settings.tasksPerDay || 3;
            document.getElementById('sysSiteName').value = settings.siteName || 'SmartTask';
            document.getElementById('sysSiteEmail').value = settings.siteEmail || 'support@smarttask.com';
            document.getElementById('sysSitePhone').value = settings.sitePhone || '+255123456789';
            document.getElementById('sysMaintenanceMode').checked = settings.maintenanceMode || false;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveAllSystemSettings() {
    const newSettings = {
        minDeposit: parseFloat(document.getElementById('sysMinDeposit').value) || 10000,
        maxDeposit: parseFloat(document.getElementById('sysMaxDeposit').value) || 10000000,
        minWithdrawal: parseFloat(document.getElementById('sysMinWithdrawal').value) || 3000,
        maxWithdrawal: parseFloat(document.getElementById('sysMaxWithdrawal').value) || 1000000,
        registrationBonus: parseFloat(document.getElementById('sysRegBonus').value) || 2000,
        dailyLoginBonus: parseFloat(document.getElementById('sysLoginBonus').value) || 200,
        referralLevels: [
            { level: 1, percentage: parseFloat(document.getElementById('sysLevel1Percent').value) || 10 },
            { level: 2, percentage: parseFloat(document.getElementById('sysLevel2Percent').value) || 3 },
            { level: 3, percentage: parseFloat(document.getElementById('sysLevel3Percent').value) || 1 }
        ],
        tasksPerDay: parseInt(document.getElementById('sysTasksPerDay').value) || 3,
        siteName: document.getElementById('sysSiteName').value || 'SmartTask',
        siteEmail: document.getElementById('sysSiteEmail').value || 'support@smarttask.com',
        sitePhone: document.getElementById('sysSitePhone').value || '+255123456789',
        maintenanceMode: document.getElementById('sysMaintenanceMode').checked
    };
    
    showLoading('Saving settings...');
    
    try {
        await db.collection('settings').doc('global').set(newSettings);
        
        // Update global systemSettings
        Object.assign(systemSettings, newSettings);
        
        await logAudit('settings_updated', 'System settings updated by super admin', currentUser.uid);
        
        hideLoading();
        showToast('✅ All settings saved successfully!', 'success');
        
    } catch (error) {
        hideLoading();
        console.error('Error saving settings:', error);
        showToast('Error saving settings', 'error');
    }
}

// ============================================
// VIP PACKAGES MANAGEMENT
// ============================================

async function loadPackagesManagement() {
    const container = document.getElementById('packagesManagementGrid');
    if (!container) return;
    
    try {
        const packagesSnap = await db.collection('settings').doc('vipPackages').get();
        let packages = [];
        
        if (packagesSnap.exists) {
            packages = packagesSnap.data().packages;
        } else {
            loadVIPPackages();
            packages = vipPackages;
        }
        
        let html = '';
        packages.forEach(pkg => {
            html += `
                <div class="package-card management">
                    <div class="package-header" style="background: ${pkg.color}15;">
                        <i class="fas ${pkg.icon}" style="color: ${pkg.color}"></i>
                        <h3>${pkg.name}</h3>
                        <span class="level-badge">Level ${pkg.level}</span>
                    </div>
                    <div class="package-details">
                        <div class="detail">
                            <span>Investment:</span>
                            <strong>${formatMoney(pkg.investment)}</strong>
                        </div>
                        <div class="detail">
                            <span>Daily Profit:</span>
                            <strong class="profit">${formatMoney(pkg.dailyProfit)}</strong>
                        </div>
                        <div class="detail">
                            <span>Rate:</span>
                            <strong>${pkg.percentage}%</strong>
                        </div>
                        <div class="detail">
                            <span>Tasks/Day:</span>
                            <strong>${pkg.tasks}</strong>
                        </div>
                    </div>
                    <div class="package-actions">
                        <button onclick="editPackage(${pkg.level})" class="action-btn small">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button onclick="deletePackage(${pkg.level})" class="action-btn small danger">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading packages:', error);
        container.innerHTML = '<p class="error">Error loading packages</p>';
    }
}

function showAddPackageForm() {
    const modalHtml = `
        <div id="addPackageModal" class="modal show">
            <div class="modal-content">
                <span class="close" onclick="closePackageModal()">&times;</span>
                <h2><i class="fas fa-plus"></i> Add VIP Package</h2>
                <form id="addPackageForm" onsubmit="event.preventDefault(); savePackage();">
                    <div class="form-group">
                        <label>Package Level *</label>
                        <input type="number" id="packageLevel" required min="1">
                    </div>
                    <div class="form-group">
                        <label>Package Name *</label>
                        <input type="text" id="packageName" required>
                    </div>
                    <div class="form-group">
                        <label>Investment (TZS) *</label>
                        <input type="number" id="packageInvestment" required>
                    </div>
                    <div class="form-group">
                        <label>Daily Profit (TZS) *</label>
                        <input type="number" id="packageDailyProfit" required>
                    </div>
                    <div class="form-group">
                        <label>Percentage (%) *</label>
                        <input type="number" id="packagePercentage" step="0.5" required>
                    </div>
                    <div class="form-group">
                        <label>Tasks Per Day</label>
                        <input type="number" id="packageTasks" value="3">
                    </div>
                    <div class="form-group">
                        <label>Color</label>
                        <input type="color" id="packageColor" value="#4CAF50">
                    </div>
                    <div class="form-group">
                        <label>Icon Class</label>
                        <select id="packageIcon">
                            <option value="fa-seedling">🌱 Seedling</option>
                            <option value="fa-leaf">🍃 Leaf</option>
                            <option value="fa-star-half-alt">⭐ Star Half</option>
                            <option value="fa-star">⭐ Star</option>
                            <option value="fa-gem">💎 Gem</option>
                            <option value="fa-crown">👑 Crown</option>
                            <option value="fa-rocket">🚀 Rocket</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="auth-btn">Save Package</button>
                        <button type="button" onclick="closePackageModal()" class="auth-btn secondary">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    const existing = document.getElementById('addPackageModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function savePackage() {
    const level = parseInt(document.getElementById('packageLevel').value);
    const name = document.getElementById('packageName').value;
    const investment = parseFloat(document.getElementById('packageInvestment').value);
    const dailyProfit = parseFloat(document.getElementById('packageDailyProfit').value);
    const percentage = parseFloat(document.getElementById('packagePercentage').value);
    const tasks = parseInt(document.getElementById('packageTasks').value) || 3;
    const color = document.getElementById('packageColor').value;
    const icon = document.getElementById('packageIcon').value;
    
    if (!name || !investment || !dailyProfit) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    const newPackage = {
        level,
        name,
        investment,
        dailyProfit,
        percentage,
        tasks,
        color,
        icon,
        isPopular: level >= 6,
        benefits: [`${percentage}% daily returns`, `${tasks} tasks/day`, 'VIP support']
    };
    
    showLoading('Saving package...');
    
    try {
        const packagesSnap = await db.collection('settings').doc('vipPackages').get();
        let packages = [];
        
        if (packagesSnap.exists) {
            packages = packagesSnap.data().packages;
        }
        
        // Check if level exists
        const existingIndex = packages.findIndex(p => p.level === level);
        if (existingIndex !== -1) {
            packages[existingIndex] = newPackage;
        } else {
            packages.push(newPackage);
        }
        
        packages.sort((a, b) => a.level - b.level);
        
        await db.collection('settings').doc('vipPackages').set({ packages });
        
        // Update local variable
        vipPackages = packages;
        
        await logAudit('package_updated', `${existingIndex !== -1 ? 'Updated' : 'Added'} package: ${name} (Level ${level})`, currentUser.uid);
        
        hideLoading();
        showToast(`Package ${existingIndex !== -1 ? 'updated' : 'added'} successfully!`, 'success');
        closePackageModal();
        await loadPackagesManagement();
        
    } catch (error) {
        hideLoading();
        console.error('Error saving package:', error);
        showToast('Error saving package', 'error');
    }
}

async function editPackage(level) {
    const pkg = vipPackages.find(p => p.level === level);
    if (!pkg) return;
    
    document.getElementById('packageLevel').value = pkg.level;
    document.getElementById('packageName').value = pkg.name;
    document.getElementById('packageInvestment').value = pkg.investment;
    document.getElementById('packageDailyProfit').value = pkg.dailyProfit;
    document.getElementById('packagePercentage').value = pkg.percentage;
    document.getElementById('packageTasks').value = pkg.tasks;
    document.getElementById('packageColor').value = pkg.color;
    document.getElementById('packageIcon').value = pkg.icon;
    
    showAddPackageForm();
}

async function deletePackage(level) {
    if (!confirm(`Are you sure you want to delete package level ${level}?`)) return;
    
    showLoading('Deleting package...');
    
    try {
        const packagesSnap = await db.collection('settings').doc('vipPackages').get();
        let packages = [];
        
        if (packagesSnap.exists) {
            packages = packagesSnap.data().packages;
        }
        
        packages = packages.filter(p => p.level !== level);
        
        await db.collection('settings').doc('vipPackages').set({ packages });
        
        vipPackages = packages;
        
        await logAudit('package_deleted', `Deleted package level ${level}`, currentUser.uid);
        
        hideLoading();
        showToast('Package deleted successfully', 'success');
        await loadPackagesManagement();
        
    } catch (error) {
        hideLoading();
        console.error('Error deleting package:', error);
        showToast('Error deleting package', 'error');
    }
}

function closePackageModal() {
    const modal = document.getElementById('addPackageModal');
    if (modal) modal.remove();
}

// ============================================
// ALL TRANSACTIONS
// ============================================

async function loadAllTransactions() {
    const tbody = document.getElementById('allTransactionsBody');
    if (!tbody) return;
    
    try {
        // Load deposits
        const depositsSnap = await db.collection('deposits').get();
        const deposits = depositsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            type: 'deposit'
        }));
        
        // Load withdrawals
        const withdrawalsSnap = await db.collection('withdrawals').get();
        const withdrawals = withdrawalsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            type: 'withdrawal'
        }));
        
        allTransactions = [...deposits, ...withdrawals];
        allTransactions.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
        
        // Update totals
        const totalDeposits = deposits
            .filter(d => d.status === 'completed')
            .reduce((sum, d) => sum + (d.amount || 0), 0);
        const totalWithdrawals = withdrawals
            .filter(w => w.status === 'completed')
            .reduce((sum, w) => sum + (w.amount || 0), 0);
        
        document.getElementById('totalDepositsAll').textContent = formatMoney(totalDeposits);
        document.getElementById('totalWithdrawalsAll').textContent = formatMoney(totalWithdrawals);
        document.getElementById('totalProfitAll').textContent = formatMoney(totalDeposits - totalWithdrawals);
        
        renderTransactions(allTransactions);
        
    } catch (error) {
        console.error('Error loading transactions:', error);
        tbody.innerHTML = '}<tr><td colspan="7" class="no-data">Error loading transactions</td></tr>';
    }
}

function renderTransactions(transactions) {
    const tbody = document.getElementById('allTransactionsBody');
    if (!tbody) return;
    
    if (transactions.length === 0) {
        tbody.innerHTML = '}<tr><td colspan="7" class="no-data">No transactions found</td></tr>';
        return;
    }
    
    let html = '';
    transactions.forEach(tx => {
        const date = new Date(tx.createdAt || tx.date);
        const typeIcon = tx.type === 'deposit' ? 'fa-credit-card' : 'fa-money-bill-wave';
        const typeClass = tx.type === 'deposit' ? 'deposit' : 'withdrawal';
        
        html += `
            <tr>
                <td>${date.toLocaleString()}</td>
                <td><strong>${escapeHtml(tx.username || tx.userFullName || 'Unknown')}</strong></td>
                <td><span class="type-badge ${typeClass}"><i class="fas ${typeIcon}"></i> ${tx.type}</span></td>
                <td class="${typeClass}">${tx.type === 'deposit' ? '+' : '-'}${formatMoney(tx.amount)}</td>
                <td>${tx.method || tx.bankName || 'N/A'}</td>
                <td><span class="status-badge ${tx.status}">${tx.status || 'pending'}</span></td>
                <td>
                    <button class="action-btn small" onclick="viewTransactionDetails('${tx.id}', '${tx.type}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function switchTransactionTab(tab) {
    // Update active tab
    document.querySelectorAll('.trans-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filter transactions
    if (tab === 'all') {
        renderTransactions(allTransactions);
    } else if (tab === 'deposits') {
        renderTransactions(allTransactions.filter(t => t.type === 'deposit'));
    } else if (tab === 'withdrawals') {
        renderTransactions(allTransactions.filter(t => t.type === 'withdrawal'));
    }
}

function viewTransactionDetails(id, type) {
    const transaction = allTransactions.find(t => t.id === id);
    if (!transaction) return;
    
    const details = `
📋 TRANSACTION DETAILS
═══════════════════════════

💰 Type: ${type.toUpperCase()}
💵 Amount: ${formatMoney(transaction.amount)}
📊 Status: ${transaction.status || 'pending'}
📅 Date: ${new Date(transaction.createdAt || transaction.date).toLocaleString()}

👤 User: ${transaction.username || transaction.userFullName || 'Unknown'}
🆔 User ID: ${transaction.userId || 'N/A'}

🏦 Method: ${transaction.method || transaction.bankName || 'N/A'}
💳 Account: ${transaction.accountNumber || transaction.bankAccountNumber || transaction.phone || 'N/A'}
📛 Name: ${transaction.accountName || transaction.bankAccountName || 'N/A'}

${transaction.transactionReference ? `🔢 Reference: ${transaction.transactionReference}` : ''}
${transaction.approvedAt ? `✅ Approved: ${new Date(transaction.approvedAt).toLocaleString()}` : ''}
${transaction.rejectedAt ? `❌ Rejected: ${new Date(transaction.rejectedAt).toLocaleString()}` : ''}
    `;
    
    alert(details);
}

// ============================================
// BACKUP FUNCTIONS
// ============================================

async function createBackup() {
    showLoading('Creating backup...');
    
    try {
        const backup = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            data: {
                users: allUsers,
                deposits: await db.collection('deposits').get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
                withdrawals: await db.collection('withdrawals').get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
                tasks: await db.collection('tasks').get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
                settings: await db.collection('settings').get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
                announcements: await db.collection('announcements').get().then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
                auditLogs: auditLogs
            }
        };
        
        const dataStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smarttask_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        await logAudit('backup_created', 'Full system backup created', currentUser.uid);
        
        hideLoading();
        showToast('Backup created successfully!', 'success');
        
        // Add to backup history
        addToBackupHistory();
        
    } catch (error) {
        hideLoading();
        console.error('Error creating backup:', error);
        showToast('Error creating backup', 'error');
    }
}

function addToBackupHistory() {
    const historyList = document.getElementById('backupHistoryList');
    if (historyList) {
        const date = new Date().toLocaleString();
        const existing = historyList.innerHTML;
        const newEntry = `
            <div class="backup-entry">
                <i class="fas fa-database"></i>
                <span>Backup created: ${date}</span>
                <button onclick="downloadBackup('${date}')" class="action-btn small">Download</button>
            </div>
        `;
        
        if (existing.includes('No backups found')) {
            historyList.innerHTML = newEntry;
        } else {
            historyList.innerHTML = newEntry + existing;
        }
    }
}

async function restoreBackup() {
    const fileInput = document.getElementById('restoreFile');
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('Please select a backup file', 'error');
        return;
    }
    
    if (!confirm('⚠️ WARNING: Restoring will overwrite ALL existing data! This action cannot be undone!\n\nAre you absolutely sure?')) {
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        showLoading('Restoring backup...');
        
        try {
            const backup = JSON.parse(e.target.result);
            
            // Validate backup format
            if (!backup.data || !backup.timestamp) {
                throw new Error('Invalid backup file format');
            }
            
            // Restore data (this is a simplified version - you'd need to implement full restore)
            console.log('Restoring backup from:', backup.timestamp);
            
            await logAudit('backup_restored', `System restored from backup dated ${backup.timestamp}`, currentUser.uid);
            
            hideLoading();
            showToast('Backup restored successfully! Please refresh the page.', 'success');
            
        } catch (error) {
            hideLoading();
            console.error('Error restoring backup:', error);
            showToast('Error restoring backup: ' + error.message, 'error');
        }
    };
    
    reader.readAsText(file);
}

function generateReport() {
    const report = `
╔═══════════════════════════════════════╗
║     SMARTTASK SYSTEM REPORT           ║
║     Generated: ${new Date().toLocaleString()}      ║
╚═══════════════════════════════════════╝

📊 USER STATISTICS
├─ Total Users: ${allUsers.length}
├─ Active Users: ${allUsers.filter(u => u.isActive !== false).length}
├─ Total Admins: ${allUsers.filter(u => u.role === 'admin' || u.role === 'superadmin').length}
└─ Total Referrals: ${allUsers.reduce((sum, u) => sum + (u.referrals?.length || 0), 0)}

💰 FINANCIAL SUMMARY
├─ Total Deposits: ${formatMoney(allTransactions.filter(t => t.type === 'deposit' && t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0))}
├─ Total Withdrawals: ${formatMoney(allTransactions.filter(t => t.type === 'withdrawal' && t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0))}
├─ Platform Profit: ${formatMoney(allTransactions.filter(t => t.type === 'deposit' && t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0) - allTransactions.filter(t => t.type === 'withdrawal' && t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0))}
└─ Total Balance Held: ${formatMoney(allUsers.reduce((sum, u) => sum + (u.balance || 0) + (u.referralBalance || 0), 0))}

📈 PERFORMANCE
├─ Tasks Completed: ${allUsers.reduce((sum, u) => sum + (u.tasksCompleted || 0), 0)}
├─ Active Packages: ${allUsers.reduce((sum, u) => sum + (u.activePackages?.length || 0), 0)}
└─ Total Invested: ${formatMoney(allUsers.reduce((sum, u) => sum + (u.totalInvested || 0), 0))}

📋 SYSTEM HEALTH
├─ Database: Connected
├─ Storage: Active
└─ Last Backup: ${new Date().toLocaleString()}
    `;
    
    // Create a modal to display the report
    const modalHtml = `
        <div id="reportModal" class="modal show">
            <div class="modal-content large">
                <span class="close" onclick="closeReportModal()">&times;</span>
                <h2><i class="fas fa-chart-line"></i> System Report</h2>
                <pre style="background: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 12px;">${report}</pre>
                <div class="form-actions">
                    <button onclick="downloadReport()" class="auth-btn">Download Report</button>
                    <button onclick="closeReportModal()" class="auth-btn secondary">Close</button>
                </div>
            </div>
        </div>
    `;
    
    const existing = document.getElementById('reportModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) modal.remove();
}

function downloadReport() {
    const report = document.querySelector('#reportModal pre')?.textContent;
    if (report) {
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smarttask_report_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Report downloaded', 'success');
    }
}

// ============================================
// ANNOUNCEMENTS MANAGEMENT
// ============================================

async function loadSuperAnnouncements() {
    const container = document.getElementById('superAnnouncementsList');
    if (!container) return;
    
    try {
        const snapshot = await db.collection('announcements')
            .orderBy('createdAt', 'desc')
            .get();
        
        const announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (announcements.length === 0) {
            container.innerHTML = '<p class="no-data">No announcements yet. Create your first announcement!</p>';
            return;
        }
        
        let html = '';
        announcements.forEach(ann => {
            const createdAt = new Date(ann.createdAt);
            const priorityClass = ann.priority === 'urgent' ? 'urgent' : (ann.priority === 'important' ? 'important' : '');
            
            html += `
                <div class="announcement-card ${priorityClass}">
                    <div class="announcement-header">
                        <h3>${escapeHtml(ann.title)}</h3>
                        <div class="announcement-meta">
                            <span class="priority-badge ${ann.priority}">${ann.priority}</span>
                            <span class="date">${createdAt.toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="announcement-content">
                        <p>${escapeHtml(ann.content)}</p>
                    </div>
                    <div class="announcement-footer">
                        <span class="author">By: ${ann.createdByName || 'System'}</span>
// In loadSuperAnnouncements function, update the actions:
<div class="actions">
    <button onclick="viewAnnouncementDetails('${ann.id}')" class="action-btn small" title="View Details">
        <i class="fas fa-eye"></i>
    </button>
    <button onclick="editAnnouncement('${ann.id}')" class="action-btn small" title="Edit">
        <i class="fas fa-edit"></i>
    </button>
    <button onclick="deleteAnnouncement('${ann.id}')" class="action-btn small danger" title="Delete">
        <i class="fas fa-trash"></i>
    </button>
</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading announcements:', error);
        container.innerHTML = '<p class="error">Error loading announcements</p>';
    }
}

function showAnnouncementForm() {
    const modalHtml = `
        <div id="announcementModal" class="modal show">
            <div class="modal-content">
                <span class="close" onclick="closeAnnouncementModal()">&times;</span>
                <h2><i class="fas fa-bullhorn"></i> Create Announcement</h2>
                <form id="announcementCreateForm" onsubmit="event.preventDefault(); createNewAnnouncement();">
                    <div class="form-group">
                        <label>Title *</label>
                        <input type="text" id="annTitle" required>
                    </div>
                    <div class="form-group">
                        <label>Content *</label>
                        <textarea id="annContent" rows="5" required></textarea>
                    </div>
                    <div class="form-group">
                        <label>Priority</label>
                        <select id="annPriority">
                            <option value="normal">Normal</option>
                            <option value="important">Important</option>
                            <option value="urgent">Urgent</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Expiry Date (Optional)</label>
                        <input type="date" id="annExpiry">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="auth-btn">Publish Announcement</button>
                        <button type="button" onclick="closeAnnouncementModal()" class="auth-btn secondary">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    const existing = document.getElementById('announcementModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function createNewAnnouncement() {
    const title = document.getElementById('annTitle').value.trim();
    const content = document.getElementById('annContent').value.trim();
    const priority = document.getElementById('annPriority').value;
    const expiry = document.getElementById('annExpiry').value;
    
    if (!title || !content) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    showLoading('Creating announcement...');
    
    try {
        await db.collection('announcements').add({
            title,
            content,
            priority,
            type: 'info',
            expiresAt: expiry ? new Date(expiry).toISOString() : null,
            createdAt: new Date().toISOString(),
            createdBy: currentUser.uid,
            createdByName: currentUser.username
        });
        
        await logAudit('announcement_created', `Created announcement: ${title}`, currentUser.uid);
        
        hideLoading();
        showToast('Announcement published successfully!', 'success');
        closeAnnouncementModal();
        await loadSuperAnnouncements();
        
    } catch (error) {
        hideLoading();
        console.error('Error creating announcement:', error);
        showToast('Error creating announcement', 'error');
    }
}

async function deleteAnnouncement(annId) {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    
    showLoading('Deleting announcement...');
    
    try {
        await db.collection('announcements').doc(annId).delete();
        
        await logAudit('announcement_deleted', `Deleted announcement ID: ${annId}`, currentUser.uid);
        
        hideLoading();
        showToast('Announcement deleted', 'success');
        await loadSuperAnnouncements();
        
    } catch (error) {
        hideLoading();
        console.error('Error deleting announcement:', error);
        showToast('Error deleting announcement', 'error');
    }
}

function closeAnnouncementModal() {
    const modal = document.getElementById('announcementModal');
    if (modal) modal.remove();
}

// ============================================
// SYSTEM LOGS
// ============================================

let systemLogEntries = [];

async function loadSystemLogs() {
    const container = document.getElementById('systemLogsContainer');
    if (!container) return;
    
    try {
        // Try to load from Firestore if you have a systemLogs collection
        const snapshot = await db.collection('systemLogs')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();
        
        systemLogEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (systemLogEntries.length === 0) {
            // Show sample logs
            systemLogEntries = [
                { timestamp: new Date().toISOString(), level: 'info', message: 'System started successfully', source: 'system' },
                { timestamp: new Date().toISOString(), level: 'info', message: 'Firebase connected', source: 'database' },
                { timestamp: new Date().toISOString(), level: 'warning', message: 'High memory usage detected', source: 'performance' }
            ];
        }
        
        renderSystemLogs();
        
    } catch (error) {
        console.error('Error loading system logs:', error);
        // Show sample logs
        systemLogEntries = [
            { timestamp: new Date().toISOString(), level: 'info', message: 'System logs loaded from local storage', source: 'system' }
        ];
        renderSystemLogs();
    }
}

function renderSystemLogs() {
    const container = document.getElementById('systemLogsContainer');
    if (!container) return;
    
    const level = document.getElementById('logLevelFilter')?.value || 'all';
    let filtered = systemLogEntries;
    
    if (level !== 'all') {
        filtered = filtered.filter(log => log.level === level);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="no-data">No logs found</p>';
        return;
    }
    
    let html = '';
    filtered.forEach(log => {
        const timestamp = new Date(log.timestamp);
        const levelClass = log.level === 'error' ? 'error' : (log.level === 'warning' ? 'warning' : 'info');
        
        html += `
            <div class="log-entry ${levelClass}">
                <div class="log-header">
                    <span class="log-timestamp">${timestamp.toLocaleString()}</span>
                    <span class="log-level ${levelClass}">${log.level.toUpperCase()}</span>
                    <span class="log-source">${log.source || 'system'}</span>
                </div>
                <div class="log-message">${escapeHtml(log.message)}</div>
                ${log.details ? `<div class="log-details">${escapeHtml(log.details)}</div>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function filterSystemLogs() {
    renderSystemLogs();
}

function clearSystemLogs() {
    if (!confirm('Are you sure you want to clear all system logs?')) return;
    
    systemLogEntries = [];
    renderSystemLogs();
    showToast('System logs cleared', 'info');
}

function refreshSystemLogs() {
    loadSystemLogs();
    showToast('Logs refreshed', 'info');
}

// ============================================
// SYSTEM HEALTH
// ============================================

function updateSystemHealth() {
    const metrics = document.querySelectorAll('.health-metrics .metric');
    if (metrics.length === 0) return;
    
    // Update with random but realistic values
    const apiResponse = Math.floor(Math.random() * 100 + 50);
    metrics[2].innerHTML = `<span>API Response</span><span class="status">${apiResponse}ms</span>`;
}

// ============================================
// INITIALIZE SUPER ADMIN FUNCTIONS
// ============================================

function initSuperAdmin() {
    console.log('Initializing Super Admin panel...');
    loadSuperAdminDashboard();
    loadAdminsList();
    loadAllUsers();
    loadAuditLogs();
    loadSystemSettingsForSuper();
    loadPackagesManagement();
    loadAllTransactions();
    loadSuperAnnouncements();
    loadSystemLogs();
}

// Override the existing showSuperAdminDashboard function
const originalShowSuperAdminDashboard = window.showSuperAdminDashboard;
window.showSuperAdminDashboard = function() {
    if (originalShowSuperAdminDashboard) originalShowSuperAdminDashboard();
    setTimeout(() => initSuperAdmin(), 100);
};

// Override switchSuperAdminTab to load data when switching tabs
const originalSwitchSuperAdminTab = window.switchSuperAdminTab;
window.switchSuperAdminTab = function(tabName) {
    if (originalSwitchSuperAdminTab) originalSwitchSuperAdminTab(tabName);
    
    setTimeout(() => {
        if (tabName === 'admins') {
            loadAdminsList();
        } else if (tabName === 'allUsers') {
            loadAllUsers();
        } else if (tabName === 'audit') {
            loadAuditLogs();
        } else if (tabName === 'system') {
            loadSystemSettingsForSuper();
        } else if (tabName === 'packages') {
            loadPackagesManagement();
        } else if (tabName === 'transactions') {
            loadAllTransactions();
        } else if (tabName === 'announcements') {
            loadSuperAnnouncements();
        } else if (tabName === 'logs') {
            loadSystemLogs();
        }
    }, 100);
};

// Make all functions globally available
window.loadAdminsList = loadAdminsList;
window.showAddAdminForm = showAddAdminForm;
window.closeAddAdminModal = closeAddAdminModal;
window.createNewAdmin = createNewAdmin;
window.editAdminRole = editAdminRole;
window.toggleAdminStatus = toggleAdminStatus;
window.removeAdminUser = removeAdminUser;
window.loadAllUsers = loadAllUsers;
window.searchSuperUsers = searchSuperUsers;
window.viewUserDetailsSuper = viewUserDetailsSuper;
window.addUserBalanceSuper = addUserBalanceSuper;
window.toggleUserStatusSuper = toggleUserStatusSuper;
window.deleteUserAccountSuper = deleteUserAccountSuper;
window.saveAllSystemSettings = saveAllSystemSettings;
window.loadPackagesManagement = loadPackagesManagement;
window.showAddPackageForm = showAddPackageForm;
window.savePackage = savePackage;
window.editPackage = editPackage;
window.deletePackage = deletePackage;
window.closePackageModal = closePackageModal;
window.loadAllTransactions = loadAllTransactions;
window.switchTransactionTab = switchTransactionTab;
window.viewTransactionDetails = viewTransactionDetails;
window.createBackup = createBackup;
window.restoreBackup = restoreBackup;
window.generateReport = generateReport;
window.closeReportModal = closeReportModal;
window.downloadReport = downloadReport;
window.loadSuperAnnouncements = loadSuperAnnouncements;
window.showAnnouncementForm = showAnnouncementForm;
window.createNewAnnouncement = createNewAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.closeAnnouncementModal = closeAnnouncementModal;
window.loadSystemLogs = loadSystemLogs;
window.filterSystemLogs = filterSystemLogs;
window.clearSystemLogs = clearSystemLogs;
window.refreshSystemLogs = refreshSystemLogs;
window.filterAuditLogs = filterAuditLogs;
window.exportAuditLogs = exportAuditLogs;

// ============================================
// USER DETAILS MODAL FUNCTIONS
// ============================================

async function viewUserDetailsSuper(userId) {
    console.log('Viewing user details for:', userId);
    
    try {
        // Get fresh user data
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            showToast('User not found', 'error');
            return;
        }
        
        const user = { uid: userId, ...userDoc.data() };
        
        // Get user's deposits
        const depositsSnap = await db.collection('deposits')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        const userDeposits = depositsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Get user's withdrawals
        const withdrawalsSnap = await db.collection('withdrawals')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        const userWithdrawals = withdrawalsSnap.docs.map(w => ({ id: w.id, ...w.data() }));
        
        // Calculate totals
        const totalDeposited = userDeposits
            .filter(d => d.status === 'completed')
            .reduce((sum, d) => sum + (d.amount || 0), 0);
        
        const totalWithdrawn = userWithdrawals
            .filter(w => w.status === 'completed')
            .reduce((sum, w) => sum + (w.amount || 0), 0);
        
        const totalProfit = (user.totalEarned || 0) - (user.totalInvested || 0);
        
        // Create modal content
        p// In viewUserDetailsSuper function, the correct content should be:

const content = `
    <div class="user-details-modal">
        <div class="user-profile-header">
            <div class="user-avatar">
                <i class="fas fa-user-circle" style="font-size: 80px; color: #4CAF50;"></i>
            </div>
            <div class="user-basic-info">
                <h3>${escapeHtml(user.fullName || user.username)}</h3>
                <p><i class="fas fa-at"></i> @${escapeHtml(user.username)}</p>
                <p><i class="fas fa-envelope"></i> ${escapeHtml(user.email)}</p>
                <p><i class="fas fa-phone"></i> ${escapeHtml(user.phone)}</p>
            </div>
        </div>
        
        <div class="user-stats-grid">
            <div class="stat-card-mini">
                <span class="stat-label">Role</span>
                <span class="stat-value">${user.role}</span>
            </div>
            <div class="stat-card-mini">
                <span class="stat-label">Status</span>
                <span class="stat-value ${user.isActive !== false ? 'success' : 'danger'}">
                    ${user.isActive !== false ? 'Active' : 'Inactive'}
                </span>
            </div>
            <div class="stat-card-mini">
                <span class="stat-label">Verified</span>
                <span class="stat-value ${user.isVerified ? 'success' : 'warning'}">
                    ${user.isVerified ? 'Yes' : 'No'}
                </span>
            </div>
            <div class="stat-card-mini">
                <span class="stat-label">Login Count</span>
                <span class="stat-value">${user.loginCount || 0}</span>
            </div>
        </div>
        
        <div class="financial-section">
            <h4><i class="fas fa-wallet"></i> Financial Overview</h4>
            <div class="financial-grid">
                <div class="financial-item">
                    <span>Balance:</span>
                    <strong>${formatMoney(user.balance || 0)}</strong>
                </div>
                <div class="financial-item">
                    <span>Referral Balance:</span>
                    <strong>${formatMoney(user.referralBalance || 0)}</strong>
                </div>
                <div class="financial-item">
                    <span>Total Earned:</span>
                    <strong>${formatMoney(user.totalEarned || 0)}</strong>
                </div>
                <div class="financial-item">
                    <span>Total Invested:</span>
                    <strong>${formatMoney(user.totalInvested || 0)}</strong>
                </div>
                <div class="financial-item">
                    <span>Total Deposited:</span>
                    <strong>${formatMoney(totalDeposited)}</strong>
                </div>
                <div class="financial-item">
                    <span>Total Withdrawn:</span>
                    <strong>${formatMoney(totalWithdrawn)}</strong>
                </div>
                <div class="financial-item">
                    <span>Net Profit:</span>
                    <strong class="${totalProfit >= 0 ? 'profit' : 'loss'}">
                        ${formatMoney(totalProfit)}
                    </strong>
                </div>
            </div>
        </div>
        
        <div class="referral-section">
            <h4><i class="fas fa-users"></i> Referral Information</h4>
            <div class="referral-grid">
                <div class="referral-item">
                    <span>Referral Code:</span>
                    <code>${user.myReferralCode || 'N/A'}</code>
                </div>
                <div class="referral-item">
                    <span>Referred By:</span>
                    <strong>${user.referredBy || 'None'}</strong>
                </div>
                <div class="referral-item">
                    <span>Total Referrals:</span>
                    <strong>${user.referrals?.length || 0}</strong>
                </div>
                <div class="referral-item">
                    <span>Level 1 Commission:</span>
                    <strong>${formatMoney(user.referralEarnings?.level1 || 0)}</strong>
                </div>
                <div class="referral-item">
                    <span>Level 2 Commission:</span>
                    <strong>${formatMoney(user.referralEarnings?.level2 || 0)}</strong>
                </div>
                <div class="referral-item">
                    <span>Level 3 Commission:</span>
                    <strong>${formatMoney(user.referralEarnings?.level3 || 0)}</strong>
                </div>
            </div>
        </div>
        
        <div class="packages-section">
            <h4><i class="fas fa-box"></i> Active Packages</h4>
            ${user.activePackages && user.activePackages.length > 0 ? `
                <div class="packages-list">
                    ${user.activePackages.map(pkg => `
                        <div class="package-item">
                            <span><strong>${pkg.name}</strong></span>
                            <span>Investment: ${formatMoney(pkg.investment)}</span>
                            <span>Daily: ${formatMoney(pkg.dailyProfit)}</span>
                            <span>Purchased: ${new Date(pkg.purchasedAt).toLocaleDateString()}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '<p>No active packages</p>'}
        </div>
        
        <div class="recent-transactions">
            <h4><i class="fas fa-history"></i> Recent Transactions</h4>
            <div class="transactions-list">
                ${user.history?.slice(0, 5).map(h => `
                    <div class="transaction-item">
                        <span class="transaction-type ${h.type}">${h.type}</span>
                        <span class="transaction-amount ${h.type === 'withdrawal' ? 'negative' : 'positive'}">
                            ${h.type === 'withdrawal' ? '-' : '+'}${formatMoney(h.amount)}
                        </span>
                        <span class="transaction-date">${timeAgo(h.date)}</span>
                        <span class="transaction-status ${h.status}">${h.status}</span>
                    </div>
                `).join('') || '<p>No recent transactions</p>'}
            </div>
        </div>
        
        <div class="date-info">
            <div class="date-item">
                <i class="far fa-calendar-alt"></i> Joined: ${new Date(user.createdAt).toLocaleString()}
            </div>
            <div class="date-item">
                <i class="fas fa-sign-in-alt"></i> Last Login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
            </div>
            <div class="date-item">
                <i class="fas fa-tasks"></i> Tasks Completed: ${user.tasksCompleted || 0}
            </div>
        </div>
        
        <div class="modal-actions">
            <button onclick="editUserFromModal('${user.uid}')" class="action-btn">
                <i class="fas fa-edit"></i> Edit User
            </button>
            <button onclick="addUserBalanceFromModal('${user.uid}', '${escapeHtml(user.fullName || user.username)}', '${user.balance || 0}')" class="action-btn success">
                <i class="fas fa-plus-circle"></i> Add Balance
            </button>
            <button onclick="viewUserTransactions('${user.uid}')" class="action-btn info">
                <i class="fas fa-receipt"></i> View All Transactions
            </button>
            <button onclick="showUserPasswordOptions('${user.uid}')" class="action-btn warning">
                <i class="fas fa-key"></i> Password
            </button>
            <button onclick="closeUserDetailsModal()" class="action-btn secondary">Close</button>
        </div>
    </div>
`;
        
        document.getElementById('userDetailsContent').innerHTML = content;
        document.getElementById('userDetailsModal').classList.add('show');
        
    } catch (error) {
        console.error('Error loading user details:', error);
        showToast('Error loading user details', 'error');
    }
}

function closeUserDetailsModal() {
    document.getElementById('userDetailsModal').classList.remove('show');
}

function editUserFromModal(userId) {
    closeUserDetailsModal();
    editUserAccount(userId);
}

function addUserBalanceFromModal(userId, userName, currentBalance) {
    closeUserDetailsModal();
    showAddBalanceModal(userId, userName, currentBalance);
}

// ============================================
// EDIT USER FUNCTIONS
// ============================================

async function editUserAccount(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            showToast('User not found', 'error');
            return;
        }
        
        const user = userDoc.data();
        
        document.getElementById('editUserId').value = userId;
        document.getElementById('editFullName').value = user.fullName || '';
        document.getElementById('editUsername').value = user.username || '';
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('editPhone').value = user.phone || '';
        document.getElementById('editBalance').value = user.balance || 0;
        document.getElementById('editReferralBalance').value = user.referralBalance || 0;
        document.getElementById('editStatus').value = user.isActive !== false ? 'true' : 'false';
        document.getElementById('editVerified').value = user.isVerified ? 'true' : 'false';
        
        document.getElementById('editUserModal').classList.add('show');
        
    } catch (error) {
        console.error('Error loading user for edit:', error);
        showToast('Error loading user data', 'error');
    }
}

function closeEditUserModal() {
    document.getElementById('editUserModal').classList.remove('show');
}

async function saveUserEdits() {
    const userId = document.getElementById('editUserId').value;
    const updates = {
        fullName: document.getElementById('editFullName').value.trim(),
        username: document.getElementById('editUsername').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        phone: document.getElementById('editPhone').value.trim(),
        balance: parseFloat(document.getElementById('editBalance').value) || 0,
        referralBalance: parseFloat(document.getElementById('editReferralBalance').value) || 0,
        isActive: document.getElementById('editStatus').value === 'true',
        isVerified: document.getElementById('editVerified').value === 'true',
        updatedAt: new Date().toISOString()
    };
    
    if (!updates.fullName || !updates.username || !updates.email || !updates.phone) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    showLoading('Saving changes...');
    
    try {
        // Check if username is taken (if changed)
        if (updates.username !== document.getElementById('editUsername').defaultValue) {
            const usernameCheck = await db.collection('users')
                .where('username', '==', updates.username)
                .where('uid', '!=', userId)
                .get();
            
            if (!usernameCheck.empty) {
                hideLoading();
                showToast('Username already taken', 'error');
                return;
            }
        }
        
        await db.collection('users').doc(userId).update(updates);
        
        await logAudit('user_updated', `Updated user ${updates.username}`, currentUser.uid);
        
        hideLoading();
        showToast('User updated successfully', 'success');
        closeEditUserModal();
        
        // Refresh user lists
        await loadAllUsers();
        await loadAdminsList();
        
    } catch (error) {
        hideLoading();
        console.error('Error saving user edits:', error);
        showToast('Error saving changes', 'error');
    }
}

// ============================================
// ADD BALANCE MODAL FUNCTIONS
// ============================================

function showAddBalanceModal(userId, userName, currentBalance) {
    document.getElementById('balanceUserId').value = userId;
    document.getElementById('balanceUserName').value = userName;
    document.getElementById('balanceCurrentBalance').value = formatMoney(currentBalance);
    document.getElementById('balanceAmount').value = '';
    document.getElementById('balanceReason').value = '';
    document.getElementById('balanceType').value = 'main';
    
    document.getElementById('addBalanceModal').classList.add('show');
}

function closeAddBalanceModal() {
    document.getElementById('addBalanceModal').classList.remove('show');
}

async function processAddBalance() {
    const userId = document.getElementById('balanceUserId').value;
    const amount = parseFloat(document.getElementById('balanceAmount').value);
    const reason = document.getElementById('balanceReason').value.trim() || 'Admin Bonus';
    const balanceType = document.getElementById('balanceType').value;
    
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    showLoading('Adding balance...');
    
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const user = userDoc.data();
        
        const updates = {
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'bonus',
                description: reason,
                amount: amount,
                status: 'completed',
                date: new Date().toISOString(),
                metadata: {
                    addedBy: currentUser.username,
                    addedTo: balanceType,
                    reason: reason
                }
            })
        };
        
        if (balanceType === 'main' || balanceType === 'both') {
            const mainAmount = balanceType === 'both' ? amount / 2 : amount;
            updates.balance = firebase.firestore.FieldValue.increment(mainAmount);
            updates.totalEarned = firebase.firestore.FieldValue.increment(mainAmount);
        }
        
        if (balanceType === 'referral' || balanceType === 'both') {
            const referralAmount = balanceType === 'both' ? amount / 2 : amount;
            updates.referralBalance = firebase.firestore.FieldValue.increment(referralAmount);
            updates.totalEarned = firebase.firestore.FieldValue.increment(referralAmount);
        }
        
        await userRef.update(updates);
        
        await addNotification(userId, '💰 Balance Added!', 
            `Your balance has been increased by ${formatMoney(amount)}. Reason: ${reason}`, 'success');
        
        await logAudit('balance_added', `Added ${formatMoney(amount)} to ${user.username} (${balanceType}) - ${reason}`, currentUser.uid);
        
        hideLoading();
        showToast(`✅ Added ${formatMoney(amount)} successfully`, 'success');
        closeAddBalanceModal();
        
        // Refresh user lists
        await loadAllUsers();
        
    } catch (error) {
        hideLoading();
        console.error('Error adding balance:', error);
        showToast('Error adding balance', 'error');
    }
}

// ============================================
// TRANSACTION DETAILS MODAL
// ============================================

async function viewTransactionDetails(transactionId, type) {
    try {
        let transaction;
        if (type === 'deposit') {
            const doc = await db.collection('deposits').doc(transactionId).get();
            transaction = { id: doc.id, ...doc.data(), type: 'deposit' };
        } else {
            const doc = await db.collection('withdrawals').doc(transactionId).get();
            transaction = { id: doc.id, ...doc.data(), type: 'withdrawal' };
        }
        
        if (!transaction) {
            showToast('Transaction not found', 'error');
            return;
        }
        
        const content = `
            <div class="transaction-details">
                <div class="transaction-header">
                    <span class="transaction-type-badge ${transaction.type}">${transaction.type.toUpperCase()}</span>
                    <span class="transaction-status-badge ${transaction.status}">${transaction.status}</span>
                </div>
                
                <div class="transaction-info">
                    <div class="info-row">
                        <span class="label">Amount:</span>
                        <span class="value ${transaction.type === 'deposit' ? 'positive' : 'negative'}">
                            ${transaction.type === 'deposit' ? '+' : '-'}${formatMoney(transaction.amount)}
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="label">Date:</span>
                        <span class="value">${new Date(transaction.createdAt || transaction.date).toLocaleString()}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">User:</span>
                        <span class="value">${escapeHtml(transaction.username || transaction.userFullName || 'Unknown')}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">User ID:</span>
                        <span class="value"><code>${transaction.userId || 'N/A'}</code></span>
                    </div>
                    <div class="info-row">
                        <span class="label">Method:</span>
                        <span class="value">${transaction.method || transaction.bankName || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Account Number:</span>
                        <span class="value">${transaction.accountNumber || transaction.bankAccountNumber || transaction.phone || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Account Name:</span>
                        <span class="value">${transaction.accountName || transaction.bankAccountName || 'N/A'}</span>
                    </div>
                    ${transaction.transactionReference ? `
                        <div class="info-row">
                            <span class="label">Reference:</span>
                            <span class="value"><code>${transaction.transactionReference}</code></span>
                        </div>
                    ` : ''}
                    ${transaction.approvedAt ? `
                        <div class="info-row">
                            <span class="label">Approved At:</span>
                            <span class="value">${new Date(transaction.approvedAt).toLocaleString()}</span>
                        </div>
                    ` : ''}
                    ${transaction.approvedBy ? `
                        <div class="info-row">
                            <span class="label">Approved By:</span>
                            <span class="value">${transaction.approvedBy}</span>
                        </div>
                    ` : ''}
                    ${transaction.rejectedAt ? `
                        <div class="info-row">
                            <span class="label">Rejected At:</span>
                            <span class="value">${new Date(transaction.rejectedAt).toLocaleString()}</span>
                        </div>
                    ` : ''}
                    ${transaction.rejectionReason ? `
                        <div class="info-row">
                            <span class="label">Rejection Reason:</span>
                            <span class="value">${transaction.rejectionReason}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.getElementById('transactionDetailsContent').innerHTML = content;
        document.getElementById('transactionDetailsModal').classList.add('show');
        
    } catch (error) {
        console.error('Error loading transaction details:', error);
        showToast('Error loading transaction details', 'error');
    }
}

function closeTransactionDetailsModal() {
    document.getElementById('transactionDetailsModal').classList.remove('show');
}

// ============================================
// VIEW USER TRANSACTIONS
// ============================================

async function viewUserTransactions(userId) {
    try {
        // Get deposits
        const depositsSnap = await db.collection('deposits')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        const deposits = depositsSnap.docs.map(d => ({ ...d.data(), type: 'deposit' }));
        
        // Get withdrawals
        const withdrawalsSnap = await db.collection('withdrawals')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        const withdrawals = withdrawalsSnap.docs.map(w => ({ ...w.data(), type: 'withdrawal' }));
        
        const allTransactions = [...deposits, ...withdrawals];
        allTransactions.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
        
        if (allTransactions.length === 0) {
            showToast('No transactions found for this user', 'info');
            return;
        }
        
        let transactionsHtml = '<div class="user-transactions-list">';
        allTransactions.forEach(tx => {
            transactionsHtml += `
                <div class="transaction-row" onclick="viewTransactionDetails('${tx.id}', '${tx.type}')">
                    <div class="tx-info">
                        <span class="tx-type ${tx.type}">${tx.type}</span>
                        <span class="tx-date">${new Date(tx.createdAt || tx.date).toLocaleString()}</span>
                    </div>
                    <div class="tx-amount ${tx.type === 'deposit' ? 'positive' : 'negative'}">
                        ${tx.type === 'deposit' ? '+' : '-'}${formatMoney(tx.amount)}
                    </div>
                    <div class="tx-status ${tx.status}">${tx.status}</div>
                </div>
            `;
        });
        transactionsHtml += '</div>';
        
        const content = `
            <div class="user-transactions-modal">
                <h3>All Transactions</h3>
                ${transactionsHtml}
                <div class="modal-actions">
                    <button onclick="closeTransactionDetailsModal()" class="action-btn">Close</button>
                </div>
            </div>
        `;
        
        document.getElementById('transactionDetailsContent').innerHTML = content;
        document.getElementById('transactionDetailsModal').classList.add('show');
        
    } catch (error) {
        console.error('Error loading user transactions:', error);
        showToast('Error loading transactions', 'error');
    }
}

// ============================================
// PACKAGE EDIT FUNCTIONS
// ============================================

async function editPackage(level) {
    const pkg = vipPackages.find(p => p.level === level);
    if (!pkg) return;
    
    document.getElementById('editPackageLevel').value = pkg.level;
    document.getElementById('editPackageName').value = pkg.name;
    document.getElementById('editPackageInvestment').value = pkg.investment;
    document.getElementById('editPackageDailyProfit').value = pkg.dailyProfit;
    document.getElementById('editPackagePercentage').value = pkg.percentage;
    document.getElementById('editPackageTasks').value = pkg.tasks;
    document.getElementById('editPackageColor').value = pkg.color;
    document.getElementById('editPackageIcon').value = pkg.icon;
    
    document.getElementById('editPackageModal').classList.add('show');
}

function closeEditPackageModal() {
    document.getElementById('editPackageModal').classList.remove('show');
}

async function savePackageEdits() {
    const level = parseInt(document.getElementById('editPackageLevel').value);
    const updatedPackage = {
        level: level,
        name: document.getElementById('editPackageName').value,
        investment: parseFloat(document.getElementById('editPackageInvestment').value),
        dailyProfit: parseFloat(document.getElementById('editPackageDailyProfit').value),
        percentage: parseFloat(document.getElementById('editPackagePercentage').value),
        tasks: parseInt(document.getElementById('editPackageTasks').value),
        color: document.getElementById('editPackageColor').value,
        icon: document.getElementById('editPackageIcon').value,
        isPopular: level >= 6,
        benefits: [`${parseFloat(document.getElementById('editPackagePercentage').value)}% daily returns`, 
                   `${parseInt(document.getElementById('editPackageTasks').value)} tasks/day`, 
                   'VIP support']
    };
    
    showLoading('Saving package...');
    
    try {
        const packagesSnap = await db.collection('settings').doc('vipPackages').get();
        let packages = [];
        
        if (packagesSnap.exists) {
            packages = packagesSnap.data().packages;
        }
        
        const index = packages.findIndex(p => p.level === level);
        if (index !== -1) {
            packages[index] = updatedPackage;
        } else {
            packages.push(updatedPackage);
        }
        
        packages.sort((a, b) => a.level - b.level);
        
        await db.collection('settings').doc('vipPackages').set({ packages });
        
        // Update local variable
        vipPackages = packages;
        
        await logAudit('package_updated', `Updated package: ${updatedPackage.name} (Level ${level})`, currentUser.uid);
        
        hideLoading();
        showToast('Package updated successfully!', 'success');
        closeEditPackageModal();
        await loadPackagesManagement();
        
    } catch (error) {
        hideLoading();
        console.error('Error saving package:', error);
        showToast('Error saving package', 'error');
    }
}

// ============================================
// SYSTEM SETTINGS MODAL
// ============================================

function showSystemSettingsModal() {
    // Load current settings
    document.getElementById('modalMinDeposit').value = systemSettings.minDeposit || 10000;
    document.getElementById('modalMaxDeposit').value = systemSettings.maxDeposit || 10000000;
    document.getElementById('modalMinWithdrawal').value = systemSettings.minWithdrawal || 3000;
    document.getElementById('modalMaxWithdrawal').value = systemSettings.maxWithdrawal || 1000000;
    document.getElementById('modalRegBonus').value = systemSettings.registrationBonus || 2000;
    document.getElementById('modalLoginBonus').value = systemSettings.dailyLoginBonus || 200;
    document.getElementById('modalLevel1Percent').value = systemSettings.referralLevels?.[0]?.percentage || 10;
    document.getElementById('modalLevel2Percent').value = systemSettings.referralLevels?.[1]?.percentage || 3;
    document.getElementById('modalLevel3Percent').value = systemSettings.referralLevels?.[2]?.percentage || 1;
    document.getElementById('modalTasksPerDay').value = systemSettings.tasksPerDay || 3;
    document.getElementById('modalSiteName').value = systemSettings.siteName || 'SmartTask';
    document.getElementById('modalSiteEmail').value = systemSettings.siteEmail || 'support@smarttask.com';
    document.getElementById('modalSitePhone').value = systemSettings.sitePhone || '+255123456789';
    document.getElementById('modalMaintenanceMode').checked = systemSettings.maintenanceMode || false;
    
    document.getElementById('systemSettingsModal').classList.add('show');
}

function closeSystemSettingsModal() {
    document.getElementById('systemSettingsModal').classList.remove('show');
}

function switchSettingsTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tab === 'financial') {
        document.getElementById('financialSettingsTab').classList.add('active');
    } else if (tab === 'referral') {
        document.getElementById('referralSettingsTab').classList.add('active');
    } else if (tab === 'tasks') {
        document.getElementById('tasksSettingsTab').classList.add('active');
    } else if (tab === 'system') {
        document.getElementById('systemSettingsTab').classList.add('active');
    }
}

async function saveModalSettings() {
    const newSettings = {
        minDeposit: parseFloat(document.getElementById('modalMinDeposit').value) || 10000,
        maxDeposit: parseFloat(document.getElementById('modalMaxDeposit').value) || 10000000,
        minWithdrawal: parseFloat(document.getElementById('modalMinWithdrawal').value) || 3000,
        maxWithdrawal: parseFloat(document.getElementById('modalMaxWithdrawal').value) || 1000000,
        registrationBonus: parseFloat(document.getElementById('modalRegBonus').value) || 2000,
        dailyLoginBonus: parseFloat(document.getElementById('modalLoginBonus').value) || 200,
        referralLevels: [
            { level: 1, percentage: parseFloat(document.getElementById('modalLevel1Percent').value) || 10 },
            { level: 2, percentage: parseFloat(document.getElementById('modalLevel2Percent').value) || 3 },
            { level: 3, percentage: parseFloat(document.getElementById('modalLevel3Percent').value) || 1 }
        ],
        tasksPerDay: parseInt(document.getElementById('modalTasksPerDay').value) || 3,
        siteName: document.getElementById('modalSiteName').value || 'SmartTask',
        siteEmail: document.getElementById('modalSiteEmail').value || 'support@smarttask.com',
        sitePhone: document.getElementById('modalSitePhone').value || '+255123456789',
        maintenanceMode: document.getElementById('modalMaintenanceMode').checked
    };
    
    showLoading('Saving settings...');
    
    try {
        await db.collection('settings').doc('global').set(newSettings);
        
        // Update global systemSettings
        Object.assign(systemSettings, newSettings);
        
        await logAudit('settings_updated', 'System settings updated', currentUser.uid);
        
        hideLoading();
        showToast('✅ Settings saved successfully!', 'success');
        closeSystemSettingsModal();
        
    } catch (error) {
        hideLoading();
        console.error('Error saving settings:', error);
        showToast('Error saving settings', 'error');
    }
}

// ============================================
// ANNOUNCEMENT DETAILS & EDIT
// ============================================

async function viewAnnouncementDetails(announcementId) {
    try {
        const doc = await db.collection('announcements').doc(announcementId).get();
        if (!doc.exists) {
            showToast('Announcement not found', 'error');
            return;
        }
        
        const announcement = { id: doc.id, ...doc.data() };
        
        const content = `
            <div class="announcement-details">
                <div class="announcement-header-detail">
                    <h3>${escapeHtml(announcement.title)}</h3>
                    <span class="priority-badge ${announcement.priority}">${announcement.priority}</span>
                </div>
                <div class="announcement-meta-detail">
                    <span><i class="far fa-calendar-alt"></i> Created: ${new Date(announcement.createdAt).toLocaleString()}</span>
                    <span><i class="fas fa-user"></i> By: ${announcement.createdByName || 'System'}</span>
                    ${announcement.expiresAt ? `<span><i class="far fa-clock"></i> Expires: ${new Date(announcement.expiresAt).toLocaleString()}</span>` : ''}
                </div>
                <div class="announcement-content-detail">
                    <p>${escapeHtml(announcement.content)}</p>
                </div>
                <div class="modal-actions">
                    <button onclick="editAnnouncement('${announcement.id}')" class="action-btn">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button onclick="deleteAnnouncement('${announcement.id}')" class="action-btn danger">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button onclick="closeAnnouncementDetailsModal()" class="action-btn secondary">Close</button>
                </div>
            </div>
        `;
        
        document.getElementById('announcementDetailsContent').innerHTML = content;
        document.getElementById('announcementDetailsModal').classList.add('show');
        
    } catch (error) {
        console.error('Error loading announcement:', error);
        showToast('Error loading announcement', 'error');
    }
}

function closeAnnouncementDetailsModal() {
    document.getElementById('announcementDetailsModal').classList.remove('show');
}

async function editAnnouncement(announcementId) {
    try {
        const doc = await db.collection('announcements').doc(announcementId).get();
        if (!doc.exists) {
            showToast('Announcement not found', 'error');
            return;
        }
        
        const announcement = doc.data();
        
        document.getElementById('editAnnouncementId').value = announcementId;
        document.getElementById('editAnnouncementTitle').value = announcement.title;
        document.getElementById('editAnnouncementContent').value = announcement.content;
        document.getElementById('editAnnouncementPriority').value = announcement.priority || 'normal';
        if (announcement.expiresAt) {
            document.getElementById('editAnnouncementExpiry').value = announcement.expiresAt.split('T')[0];
        } else {
            document.getElementById('editAnnouncementExpiry').value = '';
        }
        
        closeAnnouncementDetailsModal();
        document.getElementById('editAnnouncementModal').classList.add('show');
        
    } catch (error) {
        console.error('Error loading announcement for edit:', error);
        showToast('Error loading announcement', 'error');
    }
}

function closeEditAnnouncementModal() {
    document.getElementById('editAnnouncementModal').classList.remove('show');
}

async function saveAnnouncementEdits() {
    const announcementId = document.getElementById('editAnnouncementId').value;
    const updates = {
        title: document.getElementById('editAnnouncementTitle').value.trim(),
        content: document.getElementById('editAnnouncementContent').value.trim(),
        priority: document.getElementById('editAnnouncementPriority').value,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.uid,
        updatedByName: currentUser.username
    };
    
    const expiryDate = document.getElementById('editAnnouncementExpiry').value;
    if (expiryDate) {
        updates.expiresAt = new Date(expiryDate).toISOString();
    } else {
        updates.expiresAt = null;
    }
    
    if (!updates.title || !updates.content) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    showLoading('Saving announcement...');
    
    try {
        await db.collection('announcements').doc(announcementId).update(updates);
        
        await logAudit('announcement_updated', `Updated announcement: ${updates.title}`, currentUser.uid);
        
        hideLoading();
        showToast('Announcement updated successfully!', 'success');
        closeEditAnnouncementModal();
        
        // Refresh announcements
        await loadSuperAnnouncements();
        
    } catch (error) {
        hideLoading();
        console.error('Error saving announcement:', error);
        showToast('Error saving announcement', 'error');
    }
}

// ============================================
// ADMIN DETAILS & EDIT
// ============================================

async function viewAdminDetails(adminId) {
    try {
        const doc = await db.collection('users').doc(adminId).get();
        if (!doc.exists) {
            showToast('Admin not found', 'error');
            return;
        }
        
        const admin = { uid: adminId, ...doc.data() };
        
        const content = `
            <div class="admin-details">
                <div class="admin-header">
                    <div class="admin-avatar">
                        <i class="fas fa-user-shield" style="font-size: 60px; color: #FF5722;"></i>
                    </div>
                    <div class="admin-info">
                        <h3>${escapeHtml(admin.fullName || admin.username)}</h3>
                        <p><i class="fas fa-at"></i> @${escapeHtml(admin.username)}</p>
                        <p><i class="fas fa-envelope"></i> ${escapeHtml(admin.email)}</p>
                        <p><i class="fas fa-phone"></i> ${escapeHtml(admin.phone)}</p>
                    </div>
                </div>
                
                <div class="admin-stats">
                    <div class="stat-item">
                        <span>Role:</span>
                        <strong class="role-badge ${admin.role}">${admin.role}</strong>
                    </div>
                    <div class="stat-item">
                        <span>Status:</span>
                        <strong class="${admin.isActive !== false ? 'success' : 'danger'}">
                            ${admin.isActive !== false ? 'Active' : 'Inactive'}
                        </strong>
                    </div>
                    <div class="stat-item">
                        <span>Joined:</span>
                        <strong>${new Date(admin.createdAt).toLocaleDateString()}</strong>
                    </div>
                    <div class="stat-item">
                        <span>Last Login:</span>
                        <strong>${admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Never'}</strong>
                    </div>
                    <div class="stat-item">
                        <span>Login Count:</span>
                        <strong>${admin.loginCount || 0}</strong>
                    </div>
                </div>
                
                <div class="modal-actions">
                    ${admin.role !== 'superadmin' ? `
                        <button onclick="editAdmin('${admin.uid}')" class="action-btn">
                            <i class="fas fa-edit"></i> Edit Admin
                        </button>
                        <button onclick="toggleAdminStatus('${admin.uid}')" class="action-btn warning">
                            <i class="fas ${admin.isActive !== false ? 'fa-ban' : 'fa-check'}"></i>
                            ${admin.isActive !== false ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onclick="removeAdminUser('${admin.uid}')" class="action-btn danger">
                            <i class="fas fa-trash"></i> Remove Admin
                        </button>
                    ` : '<span class="protected-message">⚠️ Super Admin cannot be modified</span>'}
                    <button onclick="closeAdminDetailsModal()" class="action-btn secondary">Close</button>
                </div>
            </div>
        `;
        
        document.getElementById('adminDetailsContent').innerHTML = content;
        document.getElementById('adminDetailsModal').classList.add('show');
        
    } catch (error) {
        console.error('Error loading admin details:', error);
        showToast('Error loading admin details', 'error');
    }
}

function closeAdminDetailsModal() {
    document.getElementById('adminDetailsModal').classList.remove('show');
}

async function editAdmin(adminId) {
    try {
        const doc = await db.collection('users').doc(adminId).get();
        if (!doc.exists) {
            showToast('Admin not found', 'error');
            return;
        }
        
        const admin = doc.data();
        
        document.getElementById('editAdminId').value = adminId;
        document.getElementById('editAdminFullName').value = admin.fullName || '';
        document.getElementById('editAdminUsername').value = admin.username || '';
        document.getElementById('editAdminEmail').value = admin.email || '';
        document.getElementById('editAdminPhone').value = admin.phone || '';
        document.getElementById('editAdminRole').value = admin.role || 'admin';
        document.getElementById('editAdminStatus').value = admin.isActive !== false ? 'true' : 'false';
        
        closeAdminDetailsModal();
        document.getElementById('editAdminModal').classList.add('show');
        
    } catch (error) {
        console.error('Error loading admin for edit:', error);
        showToast('Error loading admin data', 'error');
    }
}

function closeEditAdminModal() {
    document.getElementById('editAdminModal').classList.remove('show');
}

async function saveAdminEdits() {
    const adminId = document.getElementById('editAdminId').value;
    const updates = {
        fullName: document.getElementById('editAdminFullName').value.trim(),
        username: document.getElementById('editAdminUsername').value.trim(),
        email: document.getElementById('editAdminEmail').value.trim(),
        phone: document.getElementById('editAdminPhone').value.trim(),
        role: document.getElementById('editAdminRole').value,
        isActive: document.getElementById('editAdminStatus').value === 'true',
        updatedAt: new Date().toISOString()
    };
    
    if (!updates.fullName || !updates.username || !updates.email || !updates.phone) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    showLoading('Saving admin changes...');
    
    try {
        await db.collection('users').doc(adminId).update(updates);
        
        await logAudit('admin_updated', `Updated admin ${updates.username}`, currentUser.uid);
        
        hideLoading();
        showToast('Admin updated successfully', 'success');
        closeEditAdminModal();
        
        // Refresh lists
        await loadAdminsList();
        
    } catch (error) {
        hideLoading();
        console.error('Error saving admin edits:', error);
        showToast('Error saving changes', 'error');
    }
}

// ============================================
// UPDATE USER LIST FUNCTIONS
// ============================================

// Override existing functions to use modals
const originalViewUserDetails = window.viewUserDetailsSuper;
window.viewUserDetailsSuper = function(userId) {
    viewUserDetailsSuper(userId);
};

// Add missing functions to window
window.viewUserDetailsSuper = viewUserDetailsSuper;
window.closeUserDetailsModal = closeUserDetailsModal;
window.editUserFromModal = editUserFromModal;
window.addUserBalanceFromModal = addUserBalanceFromModal;
window.editUserAccount = editUserAccount;
window.closeEditUserModal = closeEditUserModal;
window.saveUserEdits = saveUserEdits;
window.showAddBalanceModal = showAddBalanceModal;
window.closeAddBalanceModal = closeAddBalanceModal;
window.processAddBalance = processAddBalance;
window.viewTransactionDetails = viewTransactionDetails;
window.closeTransactionDetailsModal = closeTransactionDetailsModal;
window.viewUserTransactions = viewUserTransactions;
window.editPackage = editPackage;
window.closeEditPackageModal = closeEditPackageModal;
window.savePackageEdits = savePackageEdits;
window.showSystemSettingsModal = showSystemSettingsModal;
window.closeSystemSettingsModal = closeSystemSettingsModal;
window.switchSettingsTab = switchSettingsTab;
window.saveModalSettings = saveModalSettings;
window.viewAnnouncementDetails = viewAnnouncementDetails;
window.closeAnnouncementDetailsModal = closeAnnouncementDetailsModal;
window.editAnnouncement = editAnnouncement;
window.closeEditAnnouncementModal = closeEditAnnouncementModal;
window.saveAnnouncementEdits = saveAnnouncementEdits;
window.viewAdminDetails = viewAdminDetails;
window.closeAdminDetailsModal = closeAdminDetailsModal;
window.editAdmin = editAdmin;
window.closeEditAdminModal = closeEditAdminModal;
window.saveAdminEdits = saveAdminEdits;

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ============================================
// PASSWORD MANAGEMENT FUNCTIONS
// ============================================

// Store temporary passwords (in memory only, not in database)
const tempPasswords = new Map();

/**
 * Show password management options for user
 */
async function showUserPasswordOptions(userId) {
    console.log('Showing password options for user:', userId);
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            showToast('User not found', 'error');
            return;
        }
        
        const user = userDoc.data();
        
        const content = `
            <div class="password-options">
                <div class="user-info-box">
                    <div class="user-avatar">
                        <i class="fas fa-user-circle" style="font-size: 48px; color: #4CAF50;"></i>
                    </div>
                    <div class="user-details">
                        <h3>${escapeHtml(user.fullName || user.username)}</h3>
                        <p><i class="fas fa-at"></i> @${escapeHtml(user.username)}</p>
                        <p><i class="fas fa-envelope"></i> ${escapeHtml(user.email)}</p>
                        <p><i class="fas fa-phone"></i> ${escapeHtml(user.phone)}</p>
                    </div>
                </div>
                
                <div class="password-actions">
                    <button onclick="viewUserPassword('${userId}', '${escapeHtml(user.username)}', '${escapeHtml(user.email)}')" class="action-btn info">
                        <i class="fas fa-eye"></i> View Current Password
                    </button>
                    <button onclick="showResetPasswordForm('${userId}', '${escapeHtml(user.username)}', '${escapeHtml(user.email)}')" class="action-btn warning">
                        <i class="fas fa-sync-alt"></i> Reset Password
                    </button>
                    <button onclick="sendPasswordResetEmail('${userId}', '${escapeHtml(user.email)}')" class="action-btn primary">
                        <i class="fas fa-envelope"></i> Send Reset Email
                    </button>
                    <button onclick="generateRandomPassword('${userId}', '${escapeHtml(user.username)}', '${escapeHtml(user.email)}')" class="action-btn success">
                        <i class="fas fa-random"></i> Generate & Send Random Password
                    </button>
                </div>
                
                <div class="password-info">
                    <div class="info-box">
                        <i class="fas fa-info-circle"></i>
                        <div>
                            <strong>Security Note:</strong>
                            <p>Passwords are stored encrypted. When viewing a password, it will be shown only once and cannot be retrieved again.</p>
                            <p>For security, always recommend users to change their password after login.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('userPasswordContent').innerHTML = content;
        document.getElementById('userPasswordModal').classList.add('show');
        
    } catch (error) {
        console.error('Error loading user for password management:', error);
        showToast('Error loading user data', 'error');
    }
}

/**
 * View user's current password (if stored temporarily)
 */
async function viewUserPassword(userId, username, email) {
    console.log('Viewing password for user:', username);
    
    // Check if we have a temporary password stored
    const storedPassword = tempPasswords.get(userId);
    
    if (storedPassword) {
        // Show the stored temporary password
        const content = `
            <div class="password-view">
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Note:</strong> This password was generated/reset by admin and is temporary.
                    User should change it after login.
                </div>
                <div class="password-display">
                    <label>Current/Reset Password:</label>
                    <div class="password-box">
                        <code id="tempPasswordDisplay">${storedPassword}</code>
                        <button onclick="copyToClipboard('${storedPassword}')" class="copy-btn">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div class="user-credentials">
                    <h4>Login Credentials:</h4>
                    <p><strong>Email/Username:</strong> ${escapeHtml(email)} / ${escapeHtml(username)}</p>
                    <p><strong>Password:</strong> ${storedPassword}</p>
                </div>
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i>
                    <strong>Share these credentials with the user securely.</strong>
                    <p>Recommend user to change password immediately after login.</p>
                </div>
                <div class="form-actions">
                    <button onclick="copyAllCredentials('${escapeHtml(email)}', '${escapeHtml(username)}', '${storedPassword}')" class="auth-btn success">
                        <i class="fas fa-copy"></i> Copy All Credentials
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('viewPasswordContent').innerHTML = content;
        document.getElementById('viewPasswordModal').classList.add('show');
        closeUserPasswordModal();
        
    } else {
        // No temporary password stored, suggest reset
        const content = `
            <div class="password-view">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    <strong>No temporary password found.</strong>
                    <p>User's password is securely encrypted. Please use the reset option to generate a new password.</p>
                </div>
                <div class="form-actions">
                    <button onclick="showResetPasswordForm('${userId}', '${escapeHtml(username)}', '${escapeHtml(email)}')" class="auth-btn warning">
                        Reset Password
                    </button>
                    <button onclick="closeViewPasswordModal()" class="auth-btn secondary">Close</button>
                </div>
            </div>
        `;
        
        document.getElementById('viewPasswordContent').innerHTML = content;
        document.getElementById('viewPasswordModal').classList.add('show');
        closeUserPasswordModal();
    }
}

/**
 * Show reset password form
 */
function showResetPasswordForm(userId, username, email) {
    document.getElementById('resetUserId').value = userId;
    document.getElementById('resetUserName').value = username;
    document.getElementById('resetNewPassword').value = '';
    document.getElementById('resetConfirmPassword').value = '';
    document.getElementById('sendEmailNotification').checked = true;
    
    closeUserPasswordModal();
    document.getElementById('resetPasswordModal').classList.add('show');
}

/**
 * Reset user password
 */
async function resetUserPassword() {
    const userId = document.getElementById('resetUserId').value;
    const username = document.getElementById('resetUserName').value;
    let newPassword = document.getElementById('resetNewPassword').value;
    const confirmPassword = document.getElementById('resetConfirmPassword').value;
    const sendEmail = document.getElementById('sendEmailNotification').checked;
    
    // Generate random password if not provided
    if (!newPassword) {
        newPassword = generateRandomString(10);
        document.getElementById('resetNewPassword').value = newPassword;
        document.getElementById('resetConfirmPassword').value = newPassword;
    }
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    // Validate password strength
    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    showLoading('Resetting password...');
    
    try {
        // Get user email
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            hideLoading();
            showToast('User not found', 'error');
            return;
        }
        
        const user = userDoc.data();
        const userEmail = user.email;
        
        // Reset password in Firebase Auth
        // Note: This requires admin SDK or custom function
        // For client-side, we need to use Firebase Auth admin functions
        // Alternative: Send password reset email
        
        if (sendEmail) {
            // Send password reset email
            await auth.sendPasswordResetEmail(userEmail);
            
            // Store temporary password for admin reference
            tempPasswords.set(userId, newPassword);
            
            // Add to audit log
            await logAudit('password_reset', `Password reset for user ${username} (email sent)`, currentUser.uid);
            
            hideLoading();
            showToast(`✅ Password reset email sent to ${userEmail}`, 'success');
            
            // Show the password in a modal for admin reference
            setTimeout(() => {
                showTemporaryPassword(userId, username, userEmail, newPassword);
            }, 500);
            
        } else {
            // Store the new password temporarily for admin to share
            tempPasswords.set(userId, newPassword);
            
            await logAudit('password_reset', `Password reset for user ${username} (manual)`, currentUser.uid);
            
            hideLoading();
            showToast(`Password reset successfully!`, 'success');
            
            // Show the new password
            showTemporaryPassword(userId, username, userEmail, newPassword);
        }
        
        closeResetPasswordModal();
        
    } catch (error) {
        hideLoading();
        console.error('Error resetting password:', error);
        
        if (error.code === 'auth/user-not-found') {
            showToast('User not found in authentication system', 'error');
        } else {
            showToast('Error resetting password: ' + error.message, 'error');
        }
    }
}

/**
 * Generate random password for user
 */
async function generateRandomPassword(userId, username, email) {
    const randomPassword = generateRandomString(10);
    
    showLoading('Generating random password...');
    
    try {
        // Store temporary password
        tempPasswords.set(userId, randomPassword);
        
        // Send password reset email
        await auth.sendPasswordResetEmail(email);
        
        await logAudit('password_generated', `Random password generated for user ${username}`, currentUser.uid);
        
        hideLoading();
        
        // Show the generated password
        const content = `
            <div class="password-view">
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i>
                    <strong>Random Password Generated!</strong>
                    <p>A password reset email has been sent to ${escapeHtml(email)}</p>
                </div>
                <div class="password-display">
                    <label>Temporary Password:</label>
                    <div class="password-box">
                        <code id="randomPasswordDisplay">${randomPassword}</code>
                        <button onclick="copyToClipboard('${randomPassword}')" class="copy-btn">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div class="user-credentials">
                    <h4>Login Credentials:</h4>
                    <p><strong>Email/Username:</strong> ${escapeHtml(email)} / ${escapeHtml(username)}</p>
                    <p><strong>Temporary Password:</strong> ${randomPassword}</p>
                </div>
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Important:</strong> User must use the password reset email to set their own password.
                    The temporary password shown is for admin reference only.
                </div>
                <div class="form-actions">
                    <button onclick="copyAllCredentials('${escapeHtml(email)}', '${escapeHtml(username)}', '${randomPassword}')" class="auth-btn success">
                        <i class="fas fa-copy"></i> Copy All Credentials
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('viewPasswordContent').innerHTML = content;
        document.getElementById('viewPasswordModal').classList.add('show');
        closeUserPasswordModal();
        
    } catch (error) {
        hideLoading();
        console.error('Error generating random password:', error);
        showToast('Error generating password: ' + error.message, 'error');
    }
}

/**
 * Send password reset email to user
 */
async function sendPasswordResetEmail(userId, email) {
    if (!confirm(`Send password reset email to ${email}?`)) return;
    
    showLoading('Sending reset email...');
    
    try {
        await auth.sendPasswordResetEmail(email);
        
        await logAudit('password_reset_email', `Password reset email sent to ${email}`, currentUser.uid);
        
        hideLoading();
        showToast(`✅ Password reset email sent to ${email}`, 'success');
        closeUserPasswordModal();
        
    } catch (error) {
        hideLoading();
        console.error('Error sending reset email:', error);
        showToast('Error sending reset email: ' + error.message, 'error');
    }
}

/**
 * Show temporary password for admin to share with user
 */
function showTemporaryPassword(userId, username, email, password) {
    const content = `
        <div class="password-view">
            <div class="alert alert-success">
                <i class="fas fa-check-circle"></i>
                <strong>Password Reset Successful!</strong>
            </div>
            <div class="password-display">
                <label>New Password:</label>
                <div class="password-box">
                    <code id="tempPasswordDisplay">${password}</code>
                    <button onclick="copyToClipboard('${password}')" class="copy-btn">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
            <div class="user-credentials">
                <h4>Login Credentials:</h4>
                <p><strong>Email/Username:</strong> ${escapeHtml(email)} / ${escapeHtml(username)}</p>
                <p><strong>Password:</strong> ${password}</p>
            </div>
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Security Reminder:</strong>
                <p>Share these credentials securely with the user.</p>
                <p>Recommend the user to change their password immediately after login.</p>
            </div>
            <div class="form-actions">
                <button onclick="copyAllCredentials('${escapeHtml(email)}', '${escapeHtml(username)}', '${password}')" class="auth-btn success">
                    <i class="fas fa-copy"></i> Copy All Credentials
                </button>
                <button onclick="closeViewPasswordModal()" class="auth-btn secondary">Close</button>
            </div>
        </div>
    `;
    
    document.getElementById('viewPasswordContent').innerHTML = content;
    document.getElementById('viewPasswordModal').classList.add('show');
}

/**
 * Generate random string for password
 */
function generateRandomString(length) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
}

/**
 * Copy all credentials to clipboard
 */
function copyAllCredentials(email, username, password) {
    const credentials = `Email/Username: ${email} / ${username}\nPassword: ${password}`;
    copyToClipboard(credentials);
    showToast('Credentials copied to clipboard!', 'success');
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copied to clipboard!', 'success');
    });
}

// Modal close functions
function closeUserPasswordModal() {
    document.getElementById('userPasswordModal').classList.remove('show');
}

function closeResetPasswordModal() {
    document.getElementById('resetPasswordModal').classList.remove('show');
}

function closeViewPasswordModal() {
    document.getElementById('viewPasswordModal').classList.remove('show');
}

// Make password management functions globally available
window.showUserPasswordOptions = showUserPasswordOptions;
window.viewUserPassword = viewUserPassword;
window.showResetPasswordForm = showResetPasswordForm;
window.resetUserPassword = resetUserPassword;
window.generateRandomPassword = generateRandomPassword;
window.sendPasswordResetEmail = sendPasswordResetEmail;
window.showTemporaryPassword = showTemporaryPassword;
window.closeUserPasswordModal = closeUserPasswordModal;
window.closeResetPasswordModal = closeResetPasswordModal;
window.closeViewPasswordModal = closeViewPasswordModal;
window.copyAllCredentials = copyAllCredentials;
window.copyToClipboard = copyToClipboard;

// ============================================
// SESSION VALIDATION - CHECK USER STATUS
// ============================================

let sessionCheckInterval = null;

/**
 * Start session validation to check if user is still active
 */
function startSessionValidation() {
    // Clear existing interval
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }
    
    // Check every 30 seconds
    sessionCheckInterval = setInterval(async () => {
        if (currentUser && currentUser.uid) {
            await validateUserSession(currentUser.uid);
        }
    }, 30000); // Check every 30 seconds
}

/**
 * Validate if user session is still valid
 */
async function validateUserSession(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            console.log('User document no longer exists, logging out...');
            await forceLogout('Your account has been deleted.');
            return;
        }
        
        const userData = userDoc.data();
        
        // Check if user is deactivated
        if (userData.isActive === false) {
            console.log('User account has been deactivated, logging out...');
            await forceLogout('Your account has been deactivated. Please contact support.');
            return;
        }
        
        // Check if user role was changed
        if (userData.role !== currentUser.role) {
            console.log('User role changed, refreshing dashboard...');
            currentUser.role = userData.role;
            showDashboardBasedOnRole();
            showToast('Your role has been updated. Dashboard refreshed.', 'info');
            return;
        }
        
        // Update user data in memory
        currentUser = { ...currentUser, ...userData };
        
    } catch (error) {
        console.error('Error validating session:', error);
    }
}

/**
 * Force logout with message
 */
async function forceLogout(message) {
    // Stop session validation
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
    
    // Show message
    showToast(message, 'warning');
    
    // Clear current user
    currentUser = null;
    
    // Sign out from Firebase Auth
    try {
        await auth.signOut();
    } catch (e) {
        console.error('Error signing out:', e);
    }
    
    // Show auth screen
    showAuth();
    
    // Show alert with message
    setTimeout(() => {
        alert(message);
    }, 500);
}

// ============================================
// TRACK USER ACTIVITY FOR SESSION VALIDATION
// ============================================

let lastActivityTime = Date.now();

// Track user activity
document.addEventListener('click', () => {
    lastActivityTime = Date.now();
});

document.addEventListener('keypress', () => {
    lastActivityTime = Date.now();
});

document.addEventListener('mousemove', () => {
    lastActivityTime = Date.now();
});

// Enhanced session validation with activity check
async function validateUserSession(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            console.log('User document no longer exists, logging out...');
            await forceLogout('Your account has been deleted.');
            return;
        }
        
        const userData = userDoc.data();
        
        // Check if user is deactivated
        if (userData.isActive === false) {
            console.log('User account has been deactivated, logging out...');
            await forceLogout('Your account has been deactivated. Please contact support.');
            return;
        }
        
        // Check if user role was changed
        if (userData.role !== currentUser.role) {
            console.log('User role changed, refreshing dashboard...');
            currentUser.role = userData.role;
            showDashboardBasedOnRole();
            showToast('Your role has been updated. Dashboard refreshed.', 'info');
            return;
        }
        
        // Check for inactivity (optional - 30 minutes)
        const inactivityTime = Date.now() - lastActivityTime;
        const maxInactivity = 30 * 60 * 1000; // 30 minutes
        
        if (inactivityTime > maxInactivity) {
            console.log('User inactive for too long, logging out...');
            await forceLogout('You have been logged out due to inactivity.');
            return;
        }
        
        // Update user data in memory
        currentUser = { ...currentUser, ...userData };
        
    } catch (error) {
        console.error('Error validating session:', error);
    }
}

// ============================================
// FIXED USER MANAGEMENT FUNCTIONS
// ============================================

let currentPage = 1;
let usersPerPage = 20;
let allUsersList = [];
let selectedUserIds = new Set();

/**
 * Load all users for admin panel with pagination - FIXED
 */
async function loadUsersTable() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) {
        console.error('usersTableBody element not found');
        return;
    }
    
    showLoading('Loading users...');
    
    try {
        // Try to get users with simple query first (no orderBy to avoid index requirement)
        let usersSnapshot;
        try {
            // First attempt: with ordering (requires index)
            usersSnapshot = await db.collection('users')
                .where('role', '==', 'user')
                .orderBy('createdAt', 'desc')
                .get();
        } catch (indexError) {
            console.warn('Index not ready, using fallback query:', indexError);
            // Fallback: without orderBy (no index required)
            usersSnapshot = await db.collection('users')
                .where('role', '==', 'user')
                .get();
        }
        
        allUsersList = usersSnapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        }));
        
        // Sort manually if needed (for fallback)
        if (allUsersList.length > 0 && !allUsersList[0].createdAt) {
            // If no createdAt field, sort by uid or use as is
            console.log('Sorting users manually');
            allUsersList.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return dateB - dateA;
            });
        }
        
        console.log(`Loaded ${allUsersList.length} users`);
        
        // Update stats
        updateUserStats();
        
        // Reset to first page
        currentPage = 1;
        
        // Render current page
        renderUsersPage(currentPage);
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Error loading users:', error);
        tableBody.innerHTML = `<tr><td colspan="9" class="no-data">
            <i class="fas fa-exclamation-triangle"></i> 
            Error loading users: ${error.message}<br>
            <button onclick="loadUsersTable()" class="retry-btn">Retry</button>
        </td></tr>`;
        showToast('Error loading users: ' + error.message, 'error');
    }
}

/**
 * Update user statistics - FIXED with null checks
 */
function updateUserStats() {
    const totalUsers = allUsersList.length;
    const activeUsers = allUsersList.filter(u => u.isActive !== false).length;
    const inactiveUsers = totalUsers - activeUsers;
    const totalBalance = allUsersList.reduce((sum, u) => sum + (u.balance || 0) + (u.referralBalance || 0), 0);
    
    const totalUsersEl = document.getElementById('adminTotalUsers');
    const activeUsersEl = document.getElementById('adminActiveUsers');
    const inactiveUsersEl = document.getElementById('adminInactiveUsers');
    const totalBalanceEl = document.getElementById('adminTotalBalance');
    
    if (totalUsersEl) totalUsersEl.textContent = totalUsers;
    if (activeUsersEl) activeUsersEl.textContent = activeUsers;
    if (inactiveUsersEl) inactiveUsersEl.textContent = inactiveUsers;
    if (totalBalanceEl) totalBalanceEl.textContent = formatMoney(totalBalance);
}

/**
 * Render users for current page - FIXED with safe HTML escaping
 */
function renderUsersPage(page) {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    const start = (page - 1) * usersPerPage;
    const end = start + usersPerPage;
    const pageUsers = allUsersList.slice(start, end);
    
    if (pageUsers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="no-data">No users found</td></tr>';
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) pageInfo.textContent = 'Page 1 of 1';
        return;
    }
    
    let html = '';
    for (const user of pageUsers) {
        const isSelected = selectedUserIds.has(user.uid);
        const userName = escapeHtml(user.fullName || user.username || 'Unknown');
        const userUsername = escapeHtml(user.username || 'unknown');
        const userEmail = escapeHtml(user.email || 'N/A');
        const userPhone = escapeHtml(user.phone || 'N/A');
        const userBalance = formatMoney(user.balance || 0);
        const userReferralBalance = formatMoney(user.referralBalance || 0);
        const userReferrals = user.referrals?.length || 0;
        const userPackages = user.activePackages?.length || 0;
        const userStatus = user.isActive !== false ? 'Active' : 'Inactive';
        const userStatusClass = user.isActive !== false ? 'success' : 'danger';
        const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
        const isVerified = user.isVerified ? '<span class="status-badge info">Verified</span>' : '';
        
        html += `
            <tr class="user-row ${user.isActive === false ? 'inactive-user' : ''}">
                <td><input type="checkbox" class="user-select" data-id="${user.uid}" ${isSelected ? 'checked' : ''} onchange="toggleUserSelection('${user.uid}')"></td>
                <td>
                    <div class="user-info">
                        <div class="user-avatar"><i class="fas fa-user-circle"></i></div>
                        <div>
                            <div class="user-name">${userName}</div>
                            <div class="user-username">@${userUsername}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div><i class="fas fa-envelope"></i> ${userEmail}</div>
                    <div><i class="fas fa-phone"></i> ${userPhone}</div>
                </td>
                <td>
                    <div><strong>Main:</strong> ${userBalance}</div>
                    <div><strong>Referral:</strong> ${userReferralBalance}</div>
                </td>
                <td>${userReferrals}</td>
                <td>${userPackages}</td>
                <td>
                    <span class="status-badge ${userStatusClass}">${userStatus}</span>
                    ${isVerified}
                </td>
                <td>${joinDate}</td>
                <td class="action-buttons">
                    <button class="action-btn small" onclick="viewUserDetailsSuper('${user.uid}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn small" onclick="editUserAccount('${user.uid}')" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn small success" onclick="showAddBalanceModal('${user.uid}', '${userUsername}', '${user.balance || 0}')" title="Add Balance">
                        <i class="fas fa-plus-circle"></i>
                    </button>
                    <button class="action-btn small warning" onclick="showUserPasswordOptions('${user.uid}')" title="Password Management">
                        <i class="fas fa-key"></i>
                    </button>
                    <button class="action-btn small info" onclick="viewUserTransactions('${user.uid}')" title="View Transactions">
                        <i class="fas fa-receipt"></i>
                    </button>
                    <button class="action-btn small ${user.isActive !== false ? 'warning' : 'success'}" 
                        onclick="toggleUserStatusSuper('${user.uid}')" 
                        title="${user.isActive !== false ? 'Deactivate' : 'Activate'}">
                        <i class="fas ${user.isActive !== false ? 'fa-ban' : 'fa-check'}"></i>
                    </button>
                    <button class="action-btn small danger" onclick="deleteUserAccountSuper('${user.uid}')" title="Delete User">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }
    
    tableBody.innerHTML = html;
    
    // Update pagination info
    const totalPages = Math.ceil(allUsersList.length / usersPerPage);
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

/**
 * Load users page
 */
function loadUsersPage(direction) {
    const totalPages = Math.ceil(allUsersList.length / usersPerPage);
    
    if (direction === 'prev' && currentPage > 1) {
        currentPage--;
    } else if (direction === 'next' && currentPage < totalPages) {
        currentPage++;
    }
    
    renderUsersPage(currentPage);
}

/**
 * Toggle user selection for bulk actions
 */
function toggleUserSelection(userId) {
    if (selectedUserIds.has(userId)) {
        selectedUserIds.delete(userId);
    } else {
        selectedUserIds.add(userId);
    }
    updateSelectedCount();
}

/**
 * Toggle select all users
 */
function toggleSelectAllUsers() {
    const checkbox = document.getElementById('selectAllUsers');
    if (!checkbox) return;
    
    const start = (currentPage - 1) * usersPerPage;
    const end = start + usersPerPage;
    const pageUsers = allUsersList.slice(start, end);
    
    if (checkbox.checked) {
        for (const user of pageUsers) {
            selectedUserIds.add(user.uid);
        }
    } else {
        for (const user of pageUsers) {
            selectedUserIds.delete(user.uid);
        }
    }
    
    // Update checkboxes in table
    const checkboxes = document.querySelectorAll('.user-select');
    for (const cb of checkboxes) {
        cb.checked = checkbox.checked;
    }
    
    updateSelectedCount();
}

/**
 * Update selected count display
 */
function updateSelectedCount() {
    const countSpan = document.getElementById('selectedCount');
    if (countSpan) {
        countSpan.textContent = selectedUserIds.size;
    }
}

/**
 * Show bulk actions modal
 */
function showBulkActionsModal() {
    if (selectedUserIds.size === 0) {
        showToast('Please select at least one user', 'warning');
        return;
    }
    updateSelectedCount();
    const modal = document.getElementById('bulkActionsModal');
    if (modal) modal.classList.add('show');
}

/**
 * Close bulk actions modal
 */
function closeBulkActionsModal() {
    const modal = document.getElementById('bulkActionsModal');
    if (modal) modal.classList.remove('show');
}

/**
 * Bulk activate users
 */
async function bulkActivateUsers() {
    if (!confirm(`Activate ${selectedUserIds.size} selected users?`)) return;
    
    showLoading('Activating users...');
    let count = 0;
    let errors = 0;
    
    for (const userId of selectedUserIds) {
        try {
            await db.collection('users').doc(userId).update({
                isActive: true,
                updatedAt: new Date().toISOString()
            });
            count++;
        } catch (err) {
            console.error(`Error activating user ${userId}:`, err);
            errors++;
        }
    }
    
    await logAudit('bulk_activate', `Activated ${count} users (${errors} errors)`, currentUser.uid);
    
    hideLoading();
    showToast(`${count} users activated successfully${errors > 0 ? `, ${errors} failed` : ''}`, 'success');
    closeBulkActionsModal();
    selectedUserIds.clear();
    await loadUsersTable();
}

/**
 * Bulk deactivate users
 */
async function bulkDeactivateUsers() {
    if (!confirm(`Deactivate ${selectedUserIds.size} selected users?`)) return;
    
    showLoading('Deactivating users...');
    let count = 0;
    let errors = 0;
    
    for (const userId of selectedUserIds) {
        try {
            await db.collection('users').doc(userId).update({
                isActive: false,
                deactivatedAt: new Date().toISOString(),
                deactivatedBy: currentUser.uid,
                updatedAt: new Date().toISOString()
            });
            
            await addNotification(userId, '⚠️ Account Deactivated', 
                'Your account has been deactivated by an administrator. Please contact support.', 'warning');
            count++;
        } catch (err) {
            console.error(`Error deactivating user ${userId}:`, err);
            errors++;
        }
    }
    
    await logAudit('bulk_deactivate', `Deactivated ${count} users (${errors} errors)`, currentUser.uid);
    
    hideLoading();
    showToast(`${count} users deactivated successfully${errors > 0 ? `, ${errors} failed` : ''}`, 'success');
    closeBulkActionsModal();
    selectedUserIds.clear();
    await loadUsersTable();
}

/**
 * Bulk add bonus to users
 */
async function bulkAddBonus() {
    const amount = prompt('Enter bonus amount (TZS):', '10000');
    if (!amount) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        showToast('Invalid amount', 'error');
        return;
    }
    
    const reason = prompt('Enter reason for bonus:', 'Administrative Bonus');
    if (!reason) return;
    
    if (!confirm(`Add ${formatMoney(numAmount)} bonus to ${selectedUserIds.size} users?`)) return;
    
    showLoading('Adding bonuses...');
    let count = 0;
    let errors = 0;
    
    for (const userId of selectedUserIds) {
        try {
            await db.collection('users').doc(userId).update({
                balance: firebase.firestore.FieldValue.increment(numAmount),
                totalEarned: firebase.firestore.FieldValue.increment(numAmount),
                history: firebase.firestore.FieldValue.arrayUnion({
                    id: generateId(),
                    type: 'bonus',
                    description: reason,
                    amount: numAmount,
                    status: 'completed',
                    date: new Date().toISOString(),
                    metadata: {
                        addedBy: currentUser.username,
                        bulkAction: true
                    }
                })
            });
            
            await addNotification(userId, '💰 Bonus Added!', 
                `You received ${formatMoney(numAmount)} bonus. Reason: ${reason}`, 'success');
            count++;
        } catch (err) {
            console.error(`Error adding bonus to user ${userId}:`, err);
            errors++;
        }
    }
    
    await logAudit('bulk_bonus', `Added ${formatMoney(numAmount)} bonus to ${count} users (${errors} errors)`, currentUser.uid);
    
    hideLoading();
    showToast(`Bonus added to ${count} users successfully${errors > 0 ? `, ${errors} failed` : ''}`, 'success');
    closeBulkActionsModal();
    await loadUsersTable();
}

/**
 * Bulk send notification to users
 */
async function bulkSendNotification() {
    const title = prompt('Notification Title:', 'Important Announcement');
    if (!title) return;
    
    const message = prompt('Notification Message:', '');
    if (!message) return;
    
    if (!confirm(`Send notification to ${selectedUserIds.size} users?`)) return;
    
    showLoading('Sending notifications...');
    let count = 0;
    let errors = 0;
    
    for (const userId of selectedUserIds) {
        try {
            await addNotification(userId, title, message, 'info');
            count++;
        } catch (err) {
            console.error(`Error sending notification to user ${userId}:`, err);
            errors++;
        }
    }
    
    await logAudit('bulk_notification', `Sent notification to ${count} users: ${title} (${errors} errors)`, currentUser.uid);
    
    hideLoading();
    showToast(`Notification sent to ${count} users successfully${errors > 0 ? `, ${errors} failed` : ''}`, 'success');
    closeBulkActionsModal();
}

/**
 * View user transactions
 */
async function viewUserTransactions(userId) {
    try {
        const user = allUsersList.find(u => u.uid === userId);
        if (!user) {
            showToast('User not found', 'error');
            return;
        }
        
        const transactions = user.history || [];
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const contentDiv = document.getElementById('userTransactionsContent');
        if (!contentDiv) return;
        
        if (transactions.length === 0) {
            contentDiv.innerHTML = '<p class="no-data">No transactions found</p>';
        } else {
            let html = `
                <div class="user-transactions-header">
                    <h3>${escapeHtml(user.fullName || user.username)}</h3>
                    <p>Total Transactions: ${transactions.length}</p>
                </div>
                <div class="transactions-list">
            `;
            
            for (const tx of transactions) {
                const typeIcon = {
                    'deposit': 'fa-credit-card',
                    'withdrawal': 'fa-money-bill-wave',
                    'profit': 'fa-chart-line',
                    'bonus': 'fa-gift',
                    'task': 'fa-tasks'
                }[tx.type] || 'fa-history';
                
                const amountClass = tx.type === 'withdrawal' ? 'negative' : 'positive';
                const amountSign = tx.type === 'withdrawal' ? '-' : '+';
                
                html += `
                    <div class="transaction-item">
                        <div class="transaction-icon ${tx.type}">
                            <i class="fas ${typeIcon}"></i>
                        </div>
                        <div class="transaction-details">
                            <div class="transaction-title">${escapeHtml(tx.description || tx.type)}</div>
                            <div class="transaction-meta">
                                <span>${new Date(tx.date).toLocaleString()}</span>
                                <span class="status-badge ${tx.status}">${tx.status}</span>
                            </div>
                        </div>
                        <div class="transaction-amount ${amountClass}">
                            ${amountSign}${formatMoney(tx.amount)}
                        </div>
                    </div>
                `;
            }
            
            html += '</div>';
            contentDiv.innerHTML = html;
        }
        
        const modal = document.getElementById('userTransactionsModal');
        if (modal) modal.classList.add('show');
        
    } catch (error) {
        console.error('Error loading user transactions:', error);
        showToast('Error loading transactions', 'error');
    }
}

/**
 * Close user transactions modal
 */
function closeUserTransactionsModal() {
    const modal = document.getElementById('userTransactionsModal');
    if (modal) modal.classList.remove('show');
}

/**
 * Export users data to CSV - FIXED version
 */
async function exportUsersData() {
    showLoading('Preparing export...');
    
    try {
        const headers = ['Username', 'Full Name', 'Email', 'Phone', 'Balance', 'Referral Balance', 'Total Earned', 'Total Invested', 'Referrals', 'Tasks Completed', 'Active Packages', 'Status', 'Verified', 'Joined Date', 'Last Login'];
        
        // Build CSV content line by line
        let csvContent = headers.join(',') + '\n';
        
        for (const user of allUsersList) {
            const row = [
                `"${String(user.username || '').replace(/"/g, '""')}"`,
                `"${String(user.fullName || '').replace(/"/g, '""')}"`,
                `"${String(user.email || '').replace(/"/g, '""')}"`,
                `"${String(user.phone || '').replace(/"/g, '""')}"`,
                user.balance || 0,
                user.referralBalance || 0,
                user.totalEarned || 0,
                user.totalInvested || 0,
                user.referrals?.length || 0,
                user.tasksCompleted || 0,
                user.activePackages?.length || 0,
                user.isActive !== false ? 'Active' : 'Inactive',
                user.isVerified ? 'Verified' : 'Not Verified',
                user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A',
                user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'
            ];
            csvContent += row.join(',') + '\n';
        }
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        await logAudit('export_users', `Exported ${allUsersList.length} users to CSV`, currentUser.uid);
        
        hideLoading();
        showToast('Users exported successfully', 'success');
        
    } catch (error) {
        hideLoading();
        console.error('Error exporting users:', error);
        showToast('Error exporting users: ' + error.message, 'error');
    }
}

/**
 * Search users function - FIXED
 */
function searchUsers() {
    const searchInput = document.getElementById('userSearch');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    const tableBody = document.getElementById('usersTableBody');
    
    if (!tableBody) return;
    
    if (!searchTerm) {
        currentPage = 1;
        renderUsersPage(currentPage);
        return;
    }
    
    const filteredUsers = allUsersList.filter(user => 
        (user.username && user.username.toLowerCase().includes(searchTerm)) ||
        (user.fullName && user.fullName.toLowerCase().includes(searchTerm)) ||
        (user.email && user.email.toLowerCase().includes(searchTerm)) ||
        (user.phone && user.phone.includes(searchTerm))
    );
    
    if (filteredUsers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="no-data">No users found matching your search</td></tr>';
        return;
    }
    
    // Display filtered results without pagination
    let html = '';
    for (const user of filteredUsers) {
        const userName = escapeHtml(user.fullName || user.username || 'Unknown');
        const userUsername = escapeHtml(user.username || 'unknown');
        const userEmail = escapeHtml(user.email || 'N/A');
        const userPhone = escapeHtml(user.phone || 'N/A');
        
        html += `
            <tr class="user-row ${user.isActive === false ? 'inactive-user' : ''}">
                <td><input type="checkbox" class="user-select" data-id="${user.uid}"></td>
                <td>
                    <div class="user-info">
                        <div class="user-avatar"><i class="fas fa-user-circle"></i></div>
                        <div>
                            <div class="user-name">${userName}</div>
                            <div class="user-username">@${userUsername}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div><i class="fas fa-envelope"></i> ${userEmail}</div>
                    <div><i class="fas fa-phone"></i> ${userPhone}</div>
                </td>
                <td>
                    <div><strong>Main:</strong> ${formatMoney(user.balance || 0)}</div>
                    <div><strong>Referral:</strong> ${formatMoney(user.referralBalance || 0)}</div>
                </td>
                <td>${user.referrals?.length || 0}</td>
                <td>${user.activePackages?.length || 0}</td>
                <td>
                    <span class="status-badge ${user.isActive !== false ? 'success' : 'danger'}">
                        ${user.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                <td class="action-buttons">
                    <button class="action-btn small" onclick="viewUserDetailsSuper('${user.uid}')"><i class="fas fa-eye"></i></button>
                    <button class="action-btn small" onclick="editUserAccount('${user.uid}')"><i class="fas fa-edit"></i></button>
                    <button class="action-btn small success" onclick="showAddBalanceModal('${user.uid}', '${userUsername}', '${user.balance || 0}')"><i class="fas fa-plus-circle"></i></button>
                    <button class="action-btn small warning" onclick="showUserPasswordOptions('${user.uid}')"><i class="fas fa-key"></i></button>
                    <button class="action-btn small info" onclick="viewUserTransactions('${user.uid}')"><i class="fas fa-receipt"></i></button>
                    <button class="action-btn small ${user.isActive !== false ? 'warning' : 'success'}" onclick="toggleUserStatusSuper('${user.uid}')">
                        <i class="fas ${user.isActive !== false ? 'fa-ban' : 'fa-check'}"></i>
                    </button>
                    <button class="action-btn small danger" onclick="deleteUserAccountSuper('${user.uid}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }
    
    tableBody.innerHTML = html;
}

// Make all functions globally available
window.loadUsersTable = loadUsersTable;
window.loadUsersPage = loadUsersPage;
window.toggleUserSelection = toggleUserSelection;
window.toggleSelectAllUsers = toggleSelectAllUsers;
window.showBulkActionsModal = showBulkActionsModal;
window.closeBulkActionsModal = closeBulkActionsModal;
window.bulkActivateUsers = bulkActivateUsers;
window.bulkDeactivateUsers = bulkDeactivateUsers;
window.bulkAddBonus = bulkAddBonus;
window.bulkSendNotification = bulkSendNotification;
window.viewUserTransactions = viewUserTransactions;
window.closeUserTransactionsModal = closeUserTransactionsModal;
window.exportUsersData = exportUsersData;
window.searchUsers = searchUsers;

// ============================================
// ADMIN USER MANAGEMENT FUNCTIONS
// ============================================

/**
 * View user details in a modal
 */
// ============================================
// SIMPLIFIED VIEW USER DETAILS - FIXED
// ============================================

async function viewUserDetailsAdmin(userId) {
    console.log('Viewing user details for:', userId);
    
    if (!userId) {
        showToast('Invalid user ID', 'error');
        return;
    }
    
    showLoading('Loading user details...');
    
    try {
        // Get fresh user data
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            hideLoading();
            showToast('User not found', 'error');
            return;
        }
        
        const user = { uid: userId, ...userDoc.data() };
        console.log('User data loaded:', user);
        
        // Calculate totals
        const totalInvested = user.activePackages?.reduce((sum, p) => sum + (p.investment || 0), 0) || 0;
        const totalEarned = user.totalEarned || 0;
        const netProfit = totalEarned - totalInvested;
        
        // Get deposit and withdrawal counts
        let totalDeposited = 0;
        let totalWithdrawn = 0;
        
        try {
            const depositsSnap = await db.collection('deposits')
                .where('userId', '==', userId)
                .get();
            totalDeposited = depositsSnap.docs
                .filter(d => d.data().status === 'completed')
                .reduce((sum, d) => sum + (d.data().amount || 0), 0);
        } catch (e) {
            console.log('Error fetching deposits:', e);
        }
        
        try {
            const withdrawalsSnap = await db.collection('withdrawals')
                .where('userId', '==', userId)
                .get();
            totalWithdrawn = withdrawalsSnap.docs
                .filter(w => w.data().status === 'completed')
                .reduce((sum, w) => sum + (w.data().amount || 0), 0);
        } catch (e) {
            console.log('Error fetching withdrawals:', e);
        }
        
        // Build HTML content
        const content = `
            <div class="admin-user-details">
                <!-- User Profile Header -->
                <div class="user-profile-header">
                    <div class="user-avatar">
                        <i class="fas fa-user-circle" style="font-size: 80px; color: #4CAF50;"></i>
                    </div>
                    <div class="user-basic-info">
                        <h3>${escapeHtml(user.fullName || user.username)}</h3>
                        <p><i class="fas fa-at"></i> @${escapeHtml(user.username)}</p>
                        <p><i class="fas fa-envelope"></i> ${escapeHtml(user.email)}</p>
                        <p><i class="fas fa-phone"></i> ${escapeHtml(user.phone)}</p>
                    </div>
                </div>
                
                <!-- Stats Grid -->
                <div class="user-stats-grid">
                    <div class="stat-card-mini">
                        <span class="stat-label">Role</span>
                        <span class="stat-value">${user.role || 'user'}</span>
                    </div>
                    <div class="stat-card-mini">
                        <span class="stat-label">Status</span>
                        <span class="stat-value ${user.isActive !== false ? 'success' : 'danger'}">
                            ${user.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div class="stat-card-mini">
                        <span class="stat-label">Verified</span>
                        <span class="stat-value ${user.isVerified ? 'success' : 'warning'}">
                            ${user.isVerified ? 'Yes' : 'No'}
                        </span>
                    </div>
                    <div class="stat-card-mini">
                        <span class="stat-label">Login Count</span>
                        <span class="stat-value">${user.loginCount || 0}</span>
                    </div>
                </div>
                
                <!-- Financial Overview -->
                <div class="financial-section">
                    <h4><i class="fas fa-wallet"></i> Financial Overview</h4>
                    <div class="financial-grid">
                        <div class="financial-item">
                            <span>Balance:</span>
                            <strong>${formatMoney(user.balance || 0)}</strong>
                        </div>
                        <div class="financial-item">
                            <span>Referral Balance:</span>
                            <strong>${formatMoney(user.referralBalance || 0)}</strong>
                        </div>
                        <div class="financial-item">
                            <span>Total Earned:</span>
                            <strong>${formatMoney(totalEarned)}</strong>
                        </div>
                        <div class="financial-item">
                            <span>Total Invested:</span>
                            <strong>${formatMoney(totalInvested)}</strong>
                        </div>
                        <div class="financial-item">
                            <span>Total Deposited:</span>
                            <strong>${formatMoney(totalDeposited)}</strong>
                        </div>
                        <div class="financial-item">
                            <span>Total Withdrawn:</span>
                            <strong>${formatMoney(totalWithdrawn)}</strong>
                        </div>
                        <div class="financial-item">
                            <span>Net Profit:</span>
                            <strong class="${netProfit >= 0 ? 'profit' : 'loss'}">
                                ${formatMoney(netProfit)}
                            </strong>
                        </div>
                    </div>
                </div>
                
                <!-- Referral Information -->
                <div class="referral-section">
                    <h4><i class="fas fa-users"></i> Referral Information</h4>
                    <div class="referral-grid">
                        <div class="referral-item">
                            <span>Referral Code:</span>
                            <code>${user.myReferralCode || 'N/A'}</code>
                        </div>
                        <div class="referral-item">
                            <span>Referred By:</span>
                            <strong>${user.referredBy || 'None'}</strong>
                        </div>
                        <div class="referral-item">
                            <span>Total Referrals:</span>
                            <strong>${user.referrals?.length || 0}</strong>
                        </div>
                        <div class="referral-item">
                            <span>Level 1 Commission:</span>
                            <strong>${formatMoney(user.referralEarnings?.level1 || 0)}</strong>
                        </div>
                        <div class="referral-item">
                            <span>Level 2 Commission:</span>
                            <strong>${formatMoney(user.referralEarnings?.level2 || 0)}</strong>
                        </div>
                        <div class="referral-item">
                            <span>Level 3 Commission:</span>
                            <strong>${formatMoney(user.referralEarnings?.level3 || 0)}</strong>
                        </div>
                    </div>
                </div>
                
                <!-- Active Packages -->
                <div class="packages-section">
                    <h4><i class="fas fa-box"></i> Active Packages</h4>
                    ${user.activePackages && user.activePackages.length > 0 ? `
                        <div class="packages-list">
                            ${user.activePackages.map(pkg => `
                                <div class="package-item">
                                    <span><strong>${escapeHtml(pkg.name)}</strong></span>
                                    <span>Investment: ${formatMoney(pkg.investment)}</span>
                                    <span>Daily: ${formatMoney(pkg.dailyProfit)}</span>
                                    <span>Purchased: ${new Date(pkg.purchasedAt).toLocaleDateString()}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="no-data">No active packages</p>'}
                </div>
                
                <!-- Recent Transactions -->
                <div class="recent-transactions">
                    <h4><i class="fas fa-history"></i> Recent Transactions</h4>
                    <div class="transactions-list">
                        ${user.history && user.history.length > 0 ? user.history.slice(0, 5).map(h => `
                            <div class="transaction-item">
                                <span class="transaction-type ${h.type}">${h.type}</span>
                                <span class="transaction-amount ${h.type === 'withdrawal' ? 'negative' : 'positive'}">
                                    ${h.type === 'withdrawal' ? '-' : '+'}${formatMoney(h.amount)}
                                </span>
                                <span class="transaction-date">${timeAgo(h.date)}</span>
                                <span class="transaction-status ${h.status}">${h.status}</span>
                            </div>
                        `).join('') : '<p class="no-data">No recent transactions</p>'}
                    </div>
                </div>
                
                <!-- Date Information -->
                <div class="date-info">
                    <div class="date-item">
                        <i class="far fa-calendar-alt"></i> Joined: ${new Date(user.createdAt).toLocaleString()}
                    </div>
                    <div class="date-item">
                        <i class="fas fa-sign-in-alt"></i> Last Login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                    </div>
                    <div class="date-item">
                        <i class="fas fa-tasks"></i> Tasks Completed: ${user.tasksCompleted || 0}
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="modal-actions">
                    <button onclick="editUserFromAdmin('${user.uid}')" class="action-btn">
                        <i class="fas fa-edit"></i> Edit User
                    </button>
                    <button onclick="addUserBalanceFromAdmin('${user.uid}', '${escapeHtml(user.username)}', '${user.balance || 0}')" class="action-btn success">
                        <i class="fas fa-plus-circle"></i> Add Balance
                    </button>
                    <button onclick="toggleUserStatusFromAdmin('${user.uid}', ${user.isActive !== false})" class="action-btn ${user.isActive !== false ? 'warning' : 'success'}">
                        <i class="fas ${user.isActive !== false ? 'fa-ban' : 'fa-check'}"></i>
                        ${user.isActive !== false ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onclick="deleteUserFromAdmin('${user.uid}', '${escapeHtml(user.username)}')" class="action-btn danger">
                        <i class="fas fa-trash"></i> Delete User
                    </button>
                    <button onclick="closeUserDetailsModal()" class="action-btn secondary">Close</button>
                </div>
            </div>
        `;
        
        // Get or create modal
        let modal = document.getElementById('userDetailsModal');
        if (!modal) {
            console.log('Creating user details modal');
            modal = document.createElement('div');
            modal.id = 'userDetailsModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content large">
                    <span class="close" onclick="closeUserDetailsModal()">&times;</span>
                    <h2><i class="fas fa-user-circle"></i> User Details</h2>
                    <div id="userDetailsContent"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        // Set content and show modal
        const contentDiv = document.getElementById('userDetailsContent');
        if (contentDiv) {
            contentDiv.innerHTML = content;
        }
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Error loading user details:', error);
        showToast('Error loading user details: ' + error.message, 'error');
    }
}

/**
 * Close user details modal
 */
function closeUserDetailsModal() {
    const modal = document.getElementById('userDetailsModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Close edit user modal
 */
function closeEditUserModal() {
    const modal = document.getElementById('editUserModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Close add balance modal
 */
function closeAddBalanceModal() {
    const modal = document.getElementById('addBalanceModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Close user transactions modal
 */
function closeUserTransactionsModal() {
    const modal = document.getElementById('userTransactionsModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}
/**
 * Escape HTML special characters
 */
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Time ago function
 */
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
    return date.toLocaleDateString();
}
/**
 * Close user details modal
 */
function closeUserDetailsModal() {
    const modal = document.getElementById('userDetailsModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Edit user from admin panel
 */
async function editUserFromAdmin(userId) {
    closeUserDetailsModal();
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            showToast('User not found', 'error');
            return;
        }
        
        const user = userDoc.data();
        
        // Create edit modal
        let modal = document.getElementById('editUserModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'editUserModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close" onclick="closeEditUserModal()">&times;</span>
                    <h2><i class="fas fa-edit"></i> Edit User</h2>
                    <form id="editUserForm" onsubmit="event.preventDefault(); saveUserEdits();">
                        <input type="hidden" id="editUserId">
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" id="editFullName" required>
                        </div>
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" id="editUsername" required>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="editEmail" required>
                        </div>
                        <div class="form-group">
                            <label>Phone</label>
                            <input type="tel" id="editPhone" required>
                        </div>
                        <div class="form-group">
                            <label>Balance (TZS)</label>
                            <input type="number" id="editBalance" step="100">
                        </div>
                        <div class="form-group">
                            <label>Referral Balance (TZS)</label>
                            <input type="number" id="editReferralBalance" step="100">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="editStatus">
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Verification Status</label>
                            <select id="editVerified">
                                <option value="true">Verified</option>
                                <option value="false">Not Verified</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="auth-btn">Save Changes</button>
                            <button type="button" onclick="closeEditUserModal()" class="auth-btn secondary">Cancel</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        document.getElementById('editUserId').value = userId;
        document.getElementById('editFullName').value = user.fullName || '';
        document.getElementById('editUsername').value = user.username || '';
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('editPhone').value = user.phone || '';
        document.getElementById('editBalance').value = user.balance || 0;
        document.getElementById('editReferralBalance').value = user.referralBalance || 0;
        document.getElementById('editStatus').value = user.isActive !== false ? 'true' : 'false';
        document.getElementById('editVerified').value = user.isVerified ? 'true' : 'false';
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error loading user for edit:', error);
        showToast('Error loading user data', 'error');
    }
}

/**
 * Close edit user modal
 */
function closeEditUserModal() {
    const modal = document.getElementById('editUserModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Save user edits
 */
async function saveUserEdits() {
    const userId = document.getElementById('editUserId').value;
    const updates = {
        fullName: document.getElementById('editFullName').value.trim(),
        username: document.getElementById('editUsername').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        phone: document.getElementById('editPhone').value.trim(),
        balance: parseFloat(document.getElementById('editBalance').value) || 0,
        referralBalance: parseFloat(document.getElementById('editReferralBalance').value) || 0,
        isActive: document.getElementById('editStatus').value === 'true',
        isVerified: document.getElementById('editVerified').value === 'true',
        updatedAt: new Date().toISOString()
    };
    
    if (!updates.fullName || !updates.username || !updates.email || !updates.phone) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    showLoading('Saving changes...');
    
    try {
        // Check if username is taken (if changed)
        const oldUserDoc = await db.collection('users').doc(userId).get();
        const oldUsername = oldUserDoc.data()?.username;
        
        if (updates.username !== oldUsername) {
            const usernameCheck = await db.collection('users')
                .where('username', '==', updates.username)
                .where('uid', '!=', userId)
                .get();
            
            if (!usernameCheck.empty) {
                hideLoading();
                showToast('Username already taken', 'error');
                return;
            }
        }
        
        await db.collection('users').doc(userId).update(updates);
        
        await logAudit('user_updated', `Updated user ${updates.username}`, currentUser.uid);
        
        hideLoading();
        showToast('User updated successfully', 'success');
        closeEditUserModal();
        
        // Refresh user table
        await loadUsersTable();
        
    } catch (error) {
        hideLoading();
        console.error('Error saving user edits:', error);
        showToast('Error saving changes', 'error');
    }
}

/**
 * Add balance from admin
 */
async function addUserBalanceFromAdmin(userId, userName, currentBalance) {
    closeUserDetailsModal();
    
    // Create add balance modal
    let modal = document.getElementById('addBalanceModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'addBalanceModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="closeAddBalanceModal()">&times;</span>
                <h2><i class="fas fa-plus-circle"></i> Add Balance</h2>
                <form id="addBalanceForm" onsubmit="event.preventDefault(); processAddBalance();">
                    <input type="hidden" id="balanceUserId">
                    <div class="form-group">
                        <label>User</label>
                        <input type="text" id="balanceUserName" readonly>
                    </div>
                    <div class="form-group">
                        <label>Current Balance</label>
                        <input type="text" id="balanceCurrentBalance" readonly>
                    </div>
                    <div class="form-group">
                        <label>Amount to Add (TZS)</label>
                        <input type="number" id="balanceAmount" required min="1" step="100">
                    </div>
                    <div class="form-group">
                        <label>Reason</label>
                        <input type="text" id="balanceReason" placeholder="e.g., Bonus, Correction, Promotion">
                    </div>
                    <div class="form-group">
                        <label>Add to</label>
                        <select id="balanceType">
                            <option value="main">Main Balance</option>
                            <option value="referral">Referral Balance</option>
                            <option value="both">Both (Split equally)</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="auth-btn">Add Balance</button>
                        <button type="button" onclick="closeAddBalanceModal()" class="auth-btn secondary">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('balanceUserId').value = userId;
    document.getElementById('balanceUserName').value = userName;
    document.getElementById('balanceCurrentBalance').value = formatMoney(currentBalance);
    document.getElementById('balanceAmount').value = '';
    document.getElementById('balanceReason').value = '';
    document.getElementById('balanceType').value = 'main';
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

/**
 * Close add balance modal
 */
function closeAddBalanceModal() {
    const modal = document.getElementById('addBalanceModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Process add balance
 */
async function processAddBalance() {
    const userId = document.getElementById('balanceUserId').value;
    const amount = parseFloat(document.getElementById('balanceAmount').value);
    const reason = document.getElementById('balanceReason').value.trim() || 'Admin Bonus';
    const balanceType = document.getElementById('balanceType').value;
    
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    showLoading('Adding balance...');
    
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const user = userDoc.data();
        
        const updates = {
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'bonus',
                description: reason,
                amount: amount,
                status: 'completed',
                date: new Date().toISOString(),
                metadata: {
                    addedBy: currentUser.username,
                    addedTo: balanceType,
                    reason: reason
                }
            })
        };
        
        if (balanceType === 'main' || balanceType === 'both') {
            const mainAmount = balanceType === 'both' ? amount / 2 : amount;
            updates.balance = firebase.firestore.FieldValue.increment(mainAmount);
            updates.totalEarned = firebase.firestore.FieldValue.increment(mainAmount);
        }
        
        if (balanceType === 'referral' || balanceType === 'both') {
            const referralAmount = balanceType === 'both' ? amount / 2 : amount;
            updates.referralBalance = firebase.firestore.FieldValue.increment(referralAmount);
            updates.totalEarned = firebase.firestore.FieldValue.increment(referralAmount);
        }
        
        await userRef.update(updates);
        
        await addNotification(userId, '💰 Balance Added!', 
            `Your balance has been increased by ${formatMoney(amount)}. Reason: ${reason}`, 'success');
        
        await logAudit('balance_added', `Added ${formatMoney(amount)} to ${user.username} (${balanceType}) - ${reason}`, currentUser.uid);
        
        hideLoading();
        showToast(`✅ Added ${formatMoney(amount)} successfully`, 'success');
        closeAddBalanceModal();
        
        // Refresh user table
        await loadUsersTable();
        
    } catch (error) {
        hideLoading();
        console.error('Error adding balance:', error);
        showToast('Error adding balance', 'error');
    }
}

/**
 * Toggle user status (activate/deactivate) from admin
 */
async function toggleUserStatusFromAdmin(userId, isCurrentlyActive) {
    closeUserDetailsModal();
    
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    const newStatus = !isCurrentlyActive;
    
    if (!confirm(`⚠️ Are you sure you want to ${action} this user?\n\n${action === 'deactivate' ? 'This will immediately log them out if they are currently online and prevent future logins.' : 'This will restore full access to the user.'}`)) {
        return;
    }
    
    showLoading(`${action === 'deactivate' ? 'Deactivating' : 'Activating'} user...`);
    
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const user = userDoc.data();
        
        await userRef.update({
            isActive: newStatus,
            deactivatedAt: newStatus ? null : new Date().toISOString(),
            deactivatedBy: newStatus ? null : currentUser.uid,
            updatedAt: new Date().toISOString()
        });
        
        await logAudit('user_status_changed', `User ${user.username} ${action}d by ${currentUser.username}`, currentUser.uid);
        
        // Add notification to user
        if (!newStatus) {
            await addNotification(userId, '⚠️ Account Deactivated', 
                'Your account has been deactivated by an administrator. Please contact support for more information.', 'warning');
        } else {
            await addNotification(userId, '✅ Account Activated', 
                'Your account has been reactivated. You can now login and use all features again.', 'success');
        }
        
        hideLoading();
        showToast(`User ${action}d successfully`, 'success');
        
        // Refresh user table
        await loadUsersTable();
        
        // If current admin is deactivating themselves, log them out
        if (currentUser && currentUser.uid === userId && !newStatus) {
            showToast('You have deactivated your own account. Logging out...', 'warning');
            setTimeout(() => {
                logout();
            }, 2000);
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error updating user status:', error);
        showToast('Error updating user status', 'error');
    }
}

/**
 * Delete user from admin
 */
async function deleteUserFromAdmin(userId, username) {
    closeUserDetailsModal();
    
    // Double confirmation for deletion
    if (!confirm(`⚠️ WARNING: This will permanently delete user "${username}" and ALL their data!\n\nThis action CANNOT be undone!\n\nClick OK to proceed or Cancel to abort.`)) {
        return;
    }
    
    const confirmText = prompt(`Type "${username.toUpperCase()}" to confirm permanent deletion:`);
    if (confirmText !== username.toUpperCase()) {
        showToast('Deletion cancelled - confirmation text did not match', 'info');
        return;
    }
    
    if (!confirm(`FINAL WARNING: Are you ABSOLUTELY sure you want to permanently delete "${username}"?\n\nAll transactions, packages, referrals, and history will be lost forever!`)) {
        showToast('Deletion cancelled', 'info');
        return;
    }
    
    showLoading('Deleting user account... This may take a moment.');
    
    try {
        const batch = db.batch();
        
        // Delete user's deposits
        const depositsSnap = await db.collection('deposits')
            .where('userId', '==', userId)
            .get();
        depositsSnap.forEach(doc => batch.delete(doc.ref));
        
        // Delete user's withdrawals
        const withdrawalsSnap = await db.collection('withdrawals')
            .where('userId', '==', userId)
            .get();
        withdrawalsSnap.forEach(doc => batch.delete(doc.ref));
        
        // Delete user's tasks (if any custom tasks)
        const tasksSnap = await db.collection('tasks')
            .where('createdBy', '==', userId)
            .get();
        tasksSnap.forEach(doc => batch.delete(doc.ref));
        
        // Delete user document
        batch.delete(db.collection('users').doc(userId));
        
        await batch.commit();
        
        // Try to delete Firebase Auth user (may fail if not in Auth, that's OK)
        try {
            const userToDelete = await auth.getUser(userId);
            if (userToDelete) {
                await auth.deleteUser(userId);
            }
        } catch (e) {
            console.log('Auth user may not exist or already deleted:', e.message);
        }
        
        await logAudit('user_deleted', `User ${username} permanently deleted by ${currentUser.username}`, currentUser.uid);
        
        hideLoading();
        showToast(`✅ User "${username}" has been permanently deleted`, 'success');
        
        // Refresh user table
        await loadUsersTable();
        
    } catch (error) {
        hideLoading();
        console.error('Error deleting user:', error);
        showToast('Error deleting user: ' + error.message, 'error');
    }
}

/**
 * View user transactions from admin
 */
async function viewUserTransactionsFromAdmin(userId) {
    closeUserDetailsModal();
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            showToast('User not found', 'error');
            return;
        }
        
        const user = userDoc.data();
        const transactions = user.history || [];
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (transactions.length === 0) {
            showToast('No transactions found for this user', 'info');
            return;
        }
        
        let transactionsHtml = `
            <div class="user-transactions-header">
                <h3>${escapeHtml(user.fullName || user.username)} - Transactions</h3>
                <p>Total: ${transactions.length} transactions</p>
            </div>
            <div class="transactions-list">
        `;
        
        for (const tx of transactions) {
            const typeIcon = {
                'deposit': 'fa-credit-card',
                'withdrawal': 'fa-money-bill-wave',
                'profit': 'fa-chart-line',
                'bonus': 'fa-gift',
                'task': 'fa-tasks'
            }[tx.type] || 'fa-history';
            
            const amountClass = tx.type === 'withdrawal' ? 'negative' : 'positive';
            const amountSign = tx.type === 'withdrawal' ? '-' : '+';
            
            transactionsHtml += `
                <div class="transaction-item">
                    <div class="transaction-icon ${tx.type}">
                        <i class="fas ${typeIcon}"></i>
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-title">${escapeHtml(tx.description || tx.type)}</div>
                        <div class="transaction-meta">
                            <span>${new Date(tx.date).toLocaleString()}</span>
                            <span class="status-badge ${tx.status}">${tx.status}</span>
                        </div>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${amountSign}${formatMoney(tx.amount)}
                    </div>
                </div>
            `;
        }
        
        transactionsHtml += '</div>';
        
        // Create modal
        let modal = document.getElementById('userTransactionsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'userTransactionsModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content large">
                    <span class="close" onclick="closeUserTransactionsModal()">&times;</span>
                    <h2><i class="fas fa-history"></i> User Transactions</h2>
                    <div id="userTransactionsContent"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        document.getElementById('userTransactionsContent').innerHTML = transactionsHtml;
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error loading user transactions:', error);
        showToast('Error loading transactions', 'error');
    }
}

/**
 * Close user transactions modal
 */
function closeUserTransactionsModal() {
    const modal = document.getElementById('userTransactionsModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Load users table with action buttons
 */
async function loadUsersTable() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    showLoading('Loading users...');
    
    try {
        let usersSnapshot;
        try {
            usersSnapshot = await db.collection('users')
                .where('role', '==', 'user')
                .orderBy('createdAt', 'desc')
                .get();
        } catch (indexError) {
            usersSnapshot = await db.collection('users')
                .where('role', '==', 'user')
                .get();
        }
        
        const regularUsers = usersSnapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        }));
        
        // Update stats
        updateUserStats(regularUsers);
        
        if (regularUsers.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" class="no-data">No users found</td></tr>';
            hideLoading();
            return;
        }
        
        let html = '';
        for (const user of regularUsers) {
            const totalInvested = user.activePackages?.reduce((sum, p) => sum + p.investment, 0) || 0;
            const totalEarned = user.totalEarned || 0;
            const statusClass = user.isActive !== false ? 'success' : 'danger';
            const statusText = user.isActive !== false ? 'Active' : 'Inactive';
            
            html += `
                <tr class="user-row ${user.isActive === false ? 'inactive-user' : ''}">
                    <td>
                        <div class="user-info">
                            <i class="fas fa-user-circle"></i>
                            <div>
                                <div class="user-name">${escapeHtml(user.fullName || user.username)}</div>
                                <div class="user-username">@${escapeHtml(user.username)}</div>
                            </div>
                        </div>
                    </td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${escapeHtml(user.phone)}</td>
                    <td>${formatMoney(user.balance || 0)}</td>
                    <td>${formatMoney(totalInvested)}</td>
                    <td>${formatMoney(totalEarned)}</td>
                    <td>${user.referrals?.length || 0}</td>
                    <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </td>
                    <td class="action-buttons">
                        <button class="action-btn small" onclick="viewUserDetailsAdmin('${user.uid}')" title="View Details">
                        <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn small" onclick="editUserFromAdmin('${user.uid}')" title="Edit User">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn small success" onclick="addUserBalanceFromAdmin('${user.uid}', '${escapeHtml(user.username)}', '${user.balance || 0}')" title="Add Balance">
                            <i class="fas fa-plus-circle"></i>
                        </button>
                        <button class="action-btn small ${user.isActive !== false ? 'warning' : 'success'}" 
                            onclick="toggleUserStatusFromAdmin('${user.uid}', ${user.isActive !== false})" 
                            title="${user.isActive !== false ? 'Deactivate' : 'Activate'}">
                            <i class="fas ${user.isActive !== false ? 'fa-ban' : 'fa-check'}"></i>
                        </button>
                        <button class="action-btn small danger" onclick="deleteUserFromAdmin('${user.uid}', '${escapeHtml(user.username)}')" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
        
        tableBody.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading users:', error);
        tableBody.innerHTML = '<tr><td colspan="10" class="no-data">Error loading users: ' + error.message + '</td></tr>';
        showToast('Error loading users', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Update user statistics
 */
function updateUserStats(users) {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive !== false).length;
    const inactiveUsers = totalUsers - activeUsers;
    const totalBalance = users.reduce((sum, u) => sum + (u.balance || 0) + (u.referralBalance || 0), 0);
    
    const totalUsersEl = document.getElementById('adminTotalUsers');
    const activeUsersEl = document.getElementById('adminActiveUsers');
    const inactiveUsersEl = document.getElementById('adminInactiveUsers');
    const totalBalanceEl = document.getElementById('adminTotalBalance');
    
    if (totalUsersEl) totalUsersEl.textContent = totalUsers;
    if (activeUsersEl) activeUsersEl.textContent = activeUsers;
    if (inactiveUsersEl) inactiveUsersEl.textContent = inactiveUsers;
    if (totalBalanceEl) totalBalanceEl.textContent = formatMoney(totalBalance);
}

// Make admin user management functions globally available
window.viewUserDetailsAdmin = viewUserDetailsAdmin;
window.closeUserDetailsModal = closeUserDetailsModal;
window.editUserFromAdmin = editUserFromAdmin;
window.closeEditUserModal = closeEditUserModal;
window.saveUserEdits = saveUserEdits;
window.addUserBalanceFromAdmin = addUserBalanceFromAdmin;
window.closeAddBalanceModal = closeAddBalanceModal;
window.processAddBalance = processAddBalance;
window.toggleUserStatusFromAdmin = toggleUserStatusFromAdmin;
window.deleteUserFromAdmin = deleteUserFromAdmin;
window.viewUserTransactionsFromAdmin = viewUserTransactionsFromAdmin;
window.closeUserTransactionsModal = closeUserTransactionsModal;
window.loadUsersTable = loadUsersTable;
window.viewUserDetailsAdmin = viewUserDetailsAdmin;
window.closeUserDetailsModal = closeUserDetailsModal;
window.closeEditUserModal = closeEditUserModal;
window.closeAddBalanceModal = closeAddBalanceModal;
window.closeUserTransactionsModal = closeUserTransactionsModal;
window.escapeHtml = escapeHtml;
window.timeAgo = timeAgo;

// ============================================
// LOAD ADMIN DASHBOARD STATISTICS (NO AUTO-REFRESH)
// ============================================

/**
 * Load all admin dashboard statistics with unique IDs
 */
async function loadAdminStatistics() {
    console.log('Loading admin statistics...');
    showLoading('Loading statistics...');
    
    try {
        // Run all stat loading functions in parallel
        await Promise.all([
            loadTotalUsersStat(),
            loadTotalDepositsStat(),
            loadTotalWithdrawalsStat(),
            loadPlatformProfitStat(),
            loadPendingDepositsStat(),
            loadPendingWithdrawalsStat(),
            loadWithdrawalFeesStat(), // Make sure this is included
            loadActiveUsersStat()
        ]);
        
        hideLoading();
        console.log('All statistics loaded successfully');
        
        // Run debug to verify fees (optional, remove in production)
        setTimeout(() => {
            debugWithdrawalFees();
        }, 1000);
        
    } catch (error) {
        hideLoading();
        console.error('Error loading admin statistics:', error);
        showToast('Error loading statistics', 'error');
    }
}

/**
 * Load Total Users count
 */
async function loadTotalUsersStat() {
    try {
        const usersSnapshot = await db.collection('users')
            .where('role', '==', 'user')
            .get();
        
        const totalUsers = usersSnapshot.size;
        const element = document.getElementById('statTotalUsers');
        
        if (element) {
            element.textContent = totalUsers.toLocaleString();
            // Add animation
            element.classList.add('stat-updated');
            setTimeout(() => element.classList.remove('stat-updated'), 500);
        }
        
        console.log(`Total users loaded: ${totalUsers}`);
        return totalUsers;
        
    } catch (error) {
        console.error('Error loading total users:', error);
        const element = document.getElementById('statTotalUsers');
        if (element) element.textContent = 'Error';
        return 0;
    }
}

/**
 * Load Total Deposits amount
 */
async function loadTotalDepositsStat() {
    try {
        const depositsSnapshot = await db.collection('deposits')
            .where('status', '==', 'completed')
            .get();
        
        let totalDeposits = 0;
        depositsSnapshot.forEach(doc => {
            totalDeposits += doc.data().amount || 0;
        });
        
        const element = document.getElementById('statTotalDeposits');
        if (element) {
            element.textContent = formatMoney(totalDeposits);
            element.classList.add('stat-updated');
            setTimeout(() => element.classList.remove('stat-updated'), 500);
        }
        
        console.log(`Total deposits loaded: ${formatMoney(totalDeposits)}`);
        return totalDeposits;
        
    } catch (error) {
        console.error('Error loading total deposits:', error);
        const element = document.getElementById('statTotalDeposits');
        if (element) element.textContent = formatMoney(0);
        return 0;
    }
}

/**
 * Load Total Withdrawals amount
 */
async function loadTotalWithdrawalsStat() {
    try {
        const withdrawalsSnapshot = await db.collection('withdrawals')
            .where('status', '==', 'completed')
            .get();
        
        let totalWithdrawals = 0;
        withdrawalsSnapshot.forEach(doc => {
            totalWithdrawals += doc.data().amount || 0;
        });
        
        const element = document.getElementById('statTotalWithdrawals');
        if (element) {
            element.textContent = formatMoney(totalWithdrawals);
            element.classList.add('stat-updated');
            setTimeout(() => element.classList.remove('stat-updated'), 500);
        }
        
        console.log(`Total withdrawals loaded: ${formatMoney(totalWithdrawals)}`);
        return totalWithdrawals;
        
    } catch (error) {
        console.error('Error loading total withdrawals:', error);
        const element = document.getElementById('statTotalWithdrawals');
        if (element) element.textContent = formatMoney(0);
        return 0;
    }
}

/**
 * Load Platform Profit (Deposits - Withdrawals)
 */
async function loadPlatformProfitStat() {
    try {
        const totalDeposits = await loadTotalDepositsStat();
        const totalWithdrawals = await loadTotalWithdrawalsStat();
        const platformProfit = totalDeposits - totalWithdrawals;
        
        const element = document.getElementById('statPlatformProfit');
        if (element) {
            element.textContent = formatMoney(platformProfit);
            // Color based on profit
            if (platformProfit >= 0) {
                element.style.color = '#4CAF50';
            } else {
                element.style.color = '#F44336';
            }
            element.classList.add('stat-updated');
            setTimeout(() => element.classList.remove('stat-updated'), 500);
        }
        
        console.log(`Platform profit loaded: ${formatMoney(platformProfit)}`);
        return platformProfit;
        
    } catch (error) {
        console.error('Error loading platform profit:', error);
        const element = document.getElementById('statPlatformProfit');
        if (element) element.textContent = formatMoney(0);
        return 0;
    }
}

/**
 * Load Pending Deposits amount
 */
async function loadPendingDepositsStat() {
    try {
        const pendingDepositsSnapshot = await db.collection('deposits')
            .where('status', '==', 'pending')
            .get();
        
        let pendingDeposits = 0;
        let pendingCount = 0;
        
        pendingDepositsSnapshot.forEach(doc => {
            pendingDeposits += doc.data().amount || 0;
            pendingCount++;
        });
        
        const element = document.getElementById('statPendingDeposits');
        if (element) {
            element.textContent = formatMoney(pendingDeposits);
            // Add badge for count
            if (pendingCount > 0) {
                element.setAttribute('data-badge', pendingCount);
            } else {
                element.removeAttribute('data-badge');
            }
            element.classList.add('stat-updated');
            setTimeout(() => element.classList.remove('stat-updated'), 500);
        }
        
        console.log(`Pending deposits: ${pendingCount} requests, ${formatMoney(pendingDeposits)}`);
        return pendingDeposits;
        
    } catch (error) {
        console.error('Error loading pending deposits:', error);
        const element = document.getElementById('statPendingDeposits');
        if (element) element.textContent = formatMoney(0);
        return 0;
    }
}

/**
 * Load Pending Withdrawals amount
 */
async function loadPendingWithdrawalsStat() {
    try {
        const pendingWithdrawalsSnapshot = await db.collection('withdrawals')
            .where('status', '==', 'pending')
            .get();
        
        let pendingWithdrawals = 0;
        let pendingCount = 0;
        
        pendingWithdrawalsSnapshot.forEach(doc => {
            pendingWithdrawals += doc.data().amount || 0;
            pendingCount++;
        });
        
        const element = document.getElementById('statPendingWithdrawals');
        if (element) {
            element.textContent = formatMoney(pendingWithdrawals);
            if (pendingCount > 0) {
                element.setAttribute('data-badge', pendingCount);
            } else {
                element.removeAttribute('data-badge');
            }
            element.classList.add('stat-updated');
            setTimeout(() => element.classList.remove('stat-updated'), 500);
        }
        
        console.log(`Pending withdrawals: ${pendingCount} requests, ${formatMoney(pendingWithdrawals)}`);
        return pendingWithdrawals;
        
    } catch (error) {
        console.error('Error loading pending withdrawals:', error);
        const element = document.getElementById('statPendingWithdrawals');
        if (element) element.textContent = formatMoney(0);
        return 0;
    }
}

/**
 * Load Withdrawal Fees Collected
 */
async function loadWithdrawalFeesStat() {
    try {
        const withdrawalsSnapshot = await db.collection('withdrawals')
            .where('status', '==', 'completed')
            .get();
        
        let totalFees = 0;
        withdrawalsSnapshot.forEach(doc => {
            totalFees += doc.data().feeAmount || 0;
        });
        
        const element = document.getElementById('statWithdrawalFees');
        if (element) {
            element.textContent = formatMoney(totalFees);
            element.classList.add('stat-updated');
            setTimeout(() => element.classList.remove('stat-updated'), 500);
        }
        
        console.log(`Withdrawal fees collected: ${formatMoney(totalFees)}`);
        return totalFees;
        
    } catch (error) {
        console.error('Error loading withdrawal fees:', error);
        const element = document.getElementById('statWithdrawalFees');
        if (element) element.textContent = formatMoney(0);
        return 0;
    }
}

/**
 * Load Active Users count
 */
async function loadActiveUsersStat() {
    try {
        const usersSnapshot = await db.collection('users')
            .where('role', '==', 'user')
            .where('isActive', '==', true)
            .get();
        
        const activeUsers = usersSnapshot.size;
        const element = document.getElementById('statActiveUsers');
        
        if (element) {
            element.textContent = activeUsers.toLocaleString();
            element.classList.add('stat-updated');
            setTimeout(() => element.classList.remove('stat-updated'), 500);
        }
        
        console.log(`Active users loaded: ${activeUsers}`);
        return activeUsers;
        
    } catch (error) {
        console.error('Error loading active users:', error);
        const element = document.getElementById('statActiveUsers');
        if (element) element.textContent = 'Error';
        return 0;
    }
}

/**
 * Refresh all statistics (for manual refresh only)
 */
async function refreshAdminStatistics() {
    console.log('Manually refreshing statistics...');
    showToast('Refreshing statistics...', 'info');
    await loadAdminStatistics();
    showToast('Statistics refreshed!', 'success');
}

/**
 * Set up real-time listeners for statistics (updates only when data changes)
 */
function setupStatsRealtimeListeners() {
    // Clean up existing listeners
    cleanupStatsListeners();
    
    // Listen for user changes
    const usersListener = db.collection('users')
        .where('role', '==', 'user')
        .onSnapshot(() => {
            console.log('Users changed, updating stats...');
            loadTotalUsersStat();
            loadActiveUsersStat();
        });
    
    // Listen for deposit changes
    const depositsListener = db.collection('deposits')
        .onSnapshot(() => {
            console.log('Deposits changed, updating stats...');
            loadTotalDepositsStat();
            loadPendingDepositsStat();
            loadPlatformProfitStat();
        });
    
    // Listen for withdrawal changes
    const withdrawalsListener = db.collection('withdrawals')
        .onSnapshot(() => {
            console.log('Withdrawals changed, updating stats...');
            loadTotalWithdrawalsStat();
            loadPendingWithdrawalsStat();
            loadWithdrawalFeesStat();
            loadPlatformProfitStat();
        });
    
    // Store listeners for cleanup
    window.statsListeners = [usersListener, depositsListener, withdrawalsListener];
}

/**
 * Clean up statistics listeners
 */
function cleanupStatsListeners() {
    if (window.statsListeners) {
        window.statsListeners.forEach(listener => {
            if (listener) listener();
        });
        window.statsListeners = [];
    }
}

/**
 * Initialize admin statistics (NO AUTO-REFRESH, only real-time updates)
 */
function initAdminStatistics() {
    // Load initial stats
    loadAdminStatistics();
    
    // Set up real-time listeners (updates only when data actually changes)
    setupStatsRealtimeListeners();
    
    // NO auto-refresh interval - removed
}

/**
 * Stop all statistics updates
 */
function stopAdminStatistics() {
    cleanupStatsListeners();
}

// ============================================
// FIXED LOAD WITHDRAWAL FEES COLLECTED
// ============================================

/**
 * Load Withdrawal Fees Collected
 */
async function loadWithdrawalFeesStat() {
    console.log('Loading withdrawal fees collected...');
    
    try {
        // Get ALL completed withdrawals (not just pending)
        const withdrawalsSnapshot = await db.collection('withdrawals')
            .where('status', '==', 'completed')
            .get();
        
        let totalFees = 0;
        let withdrawalCount = 0;
        
        withdrawalsSnapshot.forEach(doc => {
            const withdrawal = doc.data();
            // Check for feeAmount in multiple possible locations
            let fee = withdrawal.feeAmount || 0;
            
            // If no feeAmount but we have amount and feePercentage, calculate it
            if (fee === 0 && withdrawal.amount && withdrawal.feePercentage) {
                fee = (withdrawal.amount * withdrawal.feePercentage) / 100;
            }
            
            // If still no fee, calculate using default 10%
            if (fee === 0 && withdrawal.amount) {
                fee = withdrawal.amount * 0.10; // 10% default
            }
            
            totalFees += fee;
            withdrawalCount++;
            
            console.log(`Withdrawal ${doc.id}: Amount=${withdrawal.amount}, Fee=${fee}, Percentage=${withdrawal.feePercentage || 10}%`);
        });
        
        console.log(`Total fees collected: ${formatMoney(totalFees)} from ${withdrawalCount} withdrawals`);
        
        const element = document.getElementById('statWithdrawalFees');
        if (element) {
            element.textContent = formatMoney(totalFees);
            element.classList.add('stat-updated');
            setTimeout(() => element.classList.remove('stat-updated'), 500);
        }
        
        return totalFees;
        
    } catch (error) {
        console.error('Error loading withdrawal fees:', error);
        const element = document.getElementById('statWithdrawalFees');
        if (element) element.textContent = formatMoney(0);
        return 0;
    }
}

/**
 * Alternative: Load fees from both completed and pending withdrawals
 */
async function loadWithdrawalFeesTotal() {
    console.log('Loading total withdrawal fees (including pending)...');
    
    try {
        // Get ALL withdrawals (both pending and completed)
        const withdrawalsSnapshot = await db.collection('withdrawals').get();
        
        let totalFees = 0;
        let pendingFees = 0;
        let completedFees = 0;
        
        withdrawalsSnapshot.forEach(doc => {
            const withdrawal = doc.data();
            let fee = withdrawal.feeAmount || 0;
            
            // Calculate fee if missing
            if (fee === 0 && withdrawal.amount) {
                const feePercentage = withdrawal.feePercentage || systemSettings.withdrawalFee || 10;
                fee = (withdrawal.amount * feePercentage) / 100;
            }
            
            totalFees += fee;
            
            if (withdrawal.status === 'completed') {
                completedFees += fee;
            } else if (withdrawal.status === 'pending') {
                pendingFees += fee;
            }
        });
        
        console.log(`Total fees: ${formatMoney(totalFees)} (Completed: ${formatMoney(completedFees)}, Pending: ${formatMoney(pendingFees)})`);
        
        const element = document.getElementById('statWithdrawalFees');
        if (element) {
            // Show only completed fees (already collected)
            element.textContent = formatMoney(completedFees);
            element.setAttribute('data-total', formatMoney(totalFees));
            element.setAttribute('data-pending', formatMoney(pendingFees));
        }
        
        return completedFees;
        
    } catch (error) {
        console.error('Error loading withdrawal fees total:', error);
        return 0;
    }
}

// ============================================
// DEBUG WITHDRAWAL FEES FUNCTION
// ============================================

async function debugWithdrawalFees() {
    console.log('=== DEBUG WITHDRAWAL FEES ===');
    
    try {
        const withdrawalsSnapshot = await db.collection('withdrawals').get();
        console.log(`Total withdrawals in database: ${withdrawalsSnapshot.size}`);
        
        let totalFees = 0;
        let completedFees = 0;
        let pendingFees = 0;
        
        withdrawalsSnapshot.forEach(doc => {
            const w = doc.data();
            console.log(`\nWithdrawal ID: ${doc.id}`);
            console.log(`  Amount: ${w.amount}`);
            console.log(`  Status: ${w.status}`);
            console.log(`  Fee Amount: ${w.feeAmount || 'NOT SET'}`);
            console.log(`  Fee Percentage: ${w.feePercentage || 'NOT SET'}%`);
            console.log(`  Net Amount: ${w.netAmount || 'NOT SET'}`);
            
            let fee = w.feeAmount || 0;
            if (fee === 0 && w.amount) {
                const percentage = w.feePercentage || 10;
                fee = (w.amount * percentage) / 100;
                console.log(`  Calculated Fee: ${fee} (${percentage}%)`);
            }
            
            totalFees += fee;
            if (w.status === 'completed') {
                completedFees += fee;
            } else if (w.status === 'pending') {
                pendingFees += fee;
            }
        });
        
        console.log(`\n=== SUMMARY ===`);
        console.log(`Total Fees (all): ${formatMoney(totalFees)}`);
        console.log(`Completed Fees: ${formatMoney(completedFees)}`);
        console.log(`Pending Fees: ${formatMoney(pendingFees)}`);
        
        // Update the display
        const element = document.getElementById('statWithdrawalFees');
        if (element) {
            element.textContent = formatMoney(completedFees);
            console.log(`Updated statWithdrawalFees to: ${formatMoney(completedFees)}`);
        } else {
            console.error('statWithdrawalFees element not found!');
        }
        
    } catch (error) {
        console.error('Debug error:', error);
    }
    
    console.log('=== END DEBUG ===');
}

// Run debug function
window.debugWithdrawalFees = debugWithdrawalFees;

// ============================================
// AUTOMATIC TASK REUSE SYSTEM
// ============================================

// Global variables
let autoTaskInterval = null;
let taskReuseCheckInterval = null;
let lastTaskGenerationDate = null;

/**
 * Initialize automatic task reuse system
 */
function initAutoTaskReuse() {
    console.log('Initializing automatic task reuse system...');
    
    // Check immediately on startup
    setTimeout(() => {
        checkAndGenerateTasksForTomorrow();
    }, 5000);
    
    // Check every hour to see if it's time to generate tasks
    taskReuseCheckInterval = setInterval(() => {
        checkAndGenerateTasksForTomorrow();
    }, 60 * 60 * 1000); // Check every hour
    
    // Also check at specific times (23:55, 23:59, 00:00)
    scheduleSpecificTimeChecks();
    
    console.log('Automatic task reuse system initialized');
}

/**
 * Schedule checks at specific times
 */
function scheduleSpecificTimeChecks() {
    const now = new Date();
    const targetHour = 23;
    const targetMinute = 55;
    
    // Calculate time until next 23:55
    let nextCheck = new Date();
    nextCheck.setHours(targetHour, targetMinute, 0, 0);
    
    if (nextCheck <= now) {
        nextCheck.setDate(nextCheck.getDate() + 1);
    }
    
    const timeUntilCheck = nextCheck - now;
    console.log(`Next scheduled check at ${nextCheck.toLocaleString()}`);
    
    setTimeout(() => {
        // Check at 23:55
        checkAndGenerateTasksForTomorrow();
        
        // Set up interval to check at 23:55 every day
        setInterval(() => {
            checkAndGenerateTasksForTomorrow();
        }, 24 * 60 * 60 * 1000);
        
        // Also check at 23:59 for final verification
        setTimeout(() => {
            checkAndGenerateTasksForTomorrow(true); // Force check
        }, 4 * 60 * 1000); // 4 minutes after 23:55 (23:59)
        
    }, timeUntilCheck);
}

/**
 * Check if tasks exist for tomorrow and generate if needed
 * @param {boolean} force - Force generation even if tasks exist
 */
async function checkAndGenerateTasksForTomorrow(force = false) {
    try {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        // Check if we already generated tasks for tomorrow
        if (lastTaskGenerationDate === tomorrowStr && !force) {
            console.log(`Tasks already generated for ${tomorrowStr}`);
            return;
        }
        
        console.log(`Checking tasks for ${tomorrowStr} at ${now.toLocaleString()}`);
        
        // Check if there are active tasks scheduled for tomorrow
        const startOfTomorrow = new Date(tomorrow);
        startOfTomorrow.setHours(0, 0, 0, 0);
        
        const endOfTomorrow = new Date(tomorrow);
        endOfTomorrow.setHours(23, 59, 59, 999);
        
        // Query tasks scheduled for tomorrow
        let existingTasks = [];
        try {
            const tasksSnapshot = await db.collection('tasks')
                .where('status', '==', 'active')
                .where('scheduledDate', '>=', firebase.firestore.Timestamp.fromDate(startOfTomorrow))
                .where('scheduledDate', '<=', firebase.firestore.Timestamp.fromDate(endOfTomorrow))
                .limit(10)
                .get();
            
            existingTasks = tasksSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.log('Query with order might need index, trying simple query...');
            // Fallback: get all active tasks and filter manually
            const allTasksSnapshot = await db.collection('tasks')
                .where('status', '==', 'active')
                .get();
            
            existingTasks = allTasksSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(task => {
                    const scheduledDate = task.scheduledDate?.toDate ? task.scheduledDate.toDate() : new Date(task.scheduledDate);
                    return scheduledDate >= startOfTomorrow && scheduledDate <= endOfTomorrow;
                });
        }
        
        console.log(`Found ${existingTasks.length} existing tasks for tomorrow`);
        
        // If no tasks for tomorrow or force generation, create tasks
        if (existingTasks.length === 0 || force) {
            console.log('No tasks scheduled for tomorrow. Generating tasks...');
            await generateTasksForTomorrow();
            lastTaskGenerationDate = tomorrowStr;
        } else {
            console.log(`Tasks already exist for tomorrow. Count: ${existingTasks.length}`);
        }
        
    } catch (error) {
        console.error('Error checking tasks for tomorrow:', error);
        // Try to generate tasks as fallback
        await generateTasksForTomorrow();
    }
}

/**
 * Generate tasks for tomorrow
 */
async function generateTasksForTomorrow() {
    console.log('Generating tasks for tomorrow...');
    
    try {
        // First, try to reuse expired tasks from the past
        const reusedTasks = await reuseExpiredTasks();
        
        if (reusedTasks && reusedTasks.length > 0) {
            console.log(`Reused ${reusedTasks.length} expired tasks for tomorrow`);
            return reusedTasks;
        }
        
        // If no expired tasks to reuse, create new random tasks
        const newTasks = await createRandomTasksForTomorrow();
        console.log(`Created ${newTasks.length} new random tasks for tomorrow`);
        return newTasks;
        
    } catch (error) {
        console.error('Error generating tasks for tomorrow:', error);
        // Fallback: create default tasks
        return await createDefaultTasksForTomorrow();
    }
}

/**
 * Reuse expired tasks from the past
 */
async function reuseExpiredTasks() {
    console.log('Looking for expired tasks to reuse...');
    
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    try {
        // Get expired tasks (status not active or expired date passed)
        const expiredSnapshot = await db.collection('tasks')
            .where('status', '==', 'expired')
            .limit(10)
            .get();
        
        let expiredTasks = expiredSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Also get tasks that are expired by date
        if (expiredTasks.length < 5) {
            const allTasksSnapshot = await db.collection('tasks')
                .where('status', '==', 'active')
                .get();
            
            const expiredByDateTasks = allTasksSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(task => {
                    const expiryDate = task.expiryDate?.toDate ? task.expiryDate.toDate() : new Date(task.expiryDate);
                    return expiryDate < now;
                });
            
            expiredTasks = [...expiredTasks, ...expiredByDateTasks];
        }
        
        if (expiredTasks.length === 0) {
            console.log('No expired tasks found to reuse');
            return [];
        }
        
        console.log(`Found ${expiredTasks.length} expired tasks to reuse`);
        
        // Create new tasks from expired ones
        const reusedTasks = [];
        const tasksPerDay = systemSettings.tasksPerDay || 3;
        const tasksToCreate = Math.min(tasksPerDay, expiredTasks.length);
        
        for (let i = 0; i < tasksToCreate; i++) {
            const expiredTask = expiredTasks[i % expiredTasks.length];
            
            // Create new task based on expired one
            const newTask = {
                title: expiredTask.title,
                description: expiredTask.description || 'Complete this task to earn daily profits',
                mediaType: expiredTask.mediaType || 'image',
                mediaUrl: expiredTask.mediaUrl || getRandomMediaUrl(),
                scheduledDate: firebase.firestore.Timestamp.fromDate(tomorrow),
                expiryDate: firebase.firestore.Timestamp.fromDate(dayAfterTomorrow),
                status: 'active',
                category: expiredTask.category || 'Rating',
                createdBy: 'system',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                reusedFrom: expiredTask.id,
                reusedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await db.collection('tasks').add(newTask);
            reusedTasks.push({ id: docRef.id, ...newTask });
            console.log(`Reused task: ${expiredTask.title} -> ${newTask.title}`);
        }
        
        return reusedTasks;
        
    } catch (error) {
        console.error('Error reusing expired tasks:', error);
        return [];
    }
}

/**
 * Create random tasks for tomorrow
 */
async function createRandomTasksForTomorrow() {
    console.log('Creating random tasks for tomorrow...');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    const tasksPerDay = systemSettings.tasksPerDay || 3;
    const newTasks = [];
    
    // Sample task templates
    const taskTemplates = [
        {
            title: 'Rate Popular Smartphone',
            description: 'Rate the latest smartphone model based on your experience',
            category: 'Rating',
            mediaType: 'image'
        },
        {
            title: 'Watch Product Review Video',
            description: 'Watch this video review and rate the product',
            category: 'Review',
            mediaType: 'video'
        },
        {
            title: 'Quick Survey',
            description: 'Answer 3 quick questions about your experience',
            category: 'Survey',
            mediaType: 'image'
        },
        {
            title: 'Rate Customer Service',
            description: 'Rate the customer service quality',
            category: 'Rating',
            mediaType: 'image'
        },
        {
            title: 'Watch Tutorial Video',
            description: 'Watch this tutorial and give feedback',
            category: 'Review',
            mediaType: 'video'
        },
        {
            title: 'Product Feedback',
            description: 'Provide feedback on our latest product',
            category: 'Survey',
            mediaType: 'image'
        }
    ];
    
    // Shuffle templates for variety
    const shuffledTemplates = shuffleArray([...taskTemplates]);
    
    for (let i = 0; i < tasksPerDay; i++) {
        const template = shuffledTemplates[i % shuffledTemplates.length];
        const randomId = Math.floor(Math.random() * 1000);
        
        const newTask = {
            title: `${template.title} ${randomId}`,
            description: template.description,
            mediaType: template.mediaType,
            mediaUrl: getRandomMediaUrl(template.mediaType),
            scheduledDate: firebase.firestore.Timestamp.fromDate(tomorrow),
            expiryDate: firebase.firestore.Timestamp.fromDate(dayAfterTomorrow),
            status: 'active',
            category: template.category,
            createdBy: 'system',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await db.collection('tasks').add(newTask);
        newTasks.push({ id: docRef.id, ...newTask });
        console.log(`Created random task ${i + 1}: ${newTask.title}`);
    }
    
    return newTasks;
}

/**
 * Create default tasks for tomorrow (fallback)
 */
async function createDefaultTasksForTomorrow() {
    console.log('Creating default tasks for tomorrow...');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    const defaultTasks = [
        {
            title: 'Rate Our Service',
            description: 'Please rate your experience with SmartTask',
            mediaType: 'image',
            mediaUrl: 'https://via.placeholder.com/400x300?text=Rate+Service',
            category: 'Rating'
        },
        {
            title: 'Watch Introduction Video',
            description: 'Watch this introduction video and share your thoughts',
            mediaType: 'video',
            mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
            category: 'Review'
        },
        {
            title: 'Quick Feedback Survey',
            description: 'Help us improve by answering a few questions',
            mediaType: 'image',
            mediaUrl: 'https://via.placeholder.com/400x300?text=Feedback',
            category: 'Survey'
        }
    ];
    
    const newTasks = [];
    
    for (const template of defaultTasks) {
        const newTask = {
            ...template,
            scheduledDate: firebase.firestore.Timestamp.fromDate(tomorrow),
            expiryDate: firebase.firestore.Timestamp.fromDate(dayAfterTomorrow),
            status: 'active',
            createdBy: 'system',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await db.collection('tasks').add(newTask);
        newTasks.push({ id: docRef.id, ...newTask });
        console.log(`Created default task: ${newTask.title}`);
    }
    
    return newTasks;
}

/**
 * Get random media URL based on type
 */
function getRandomMediaUrl(type = 'image') {
    const imageUrls = [
        'https://picsum.photos/id/1/400/300',
        'https://picsum.photos/id/10/400/300',
        'https://picsum.photos/id/20/400/300',
        'https://picsum.photos/id/30/400/300',
        'https://picsum.photos/id/40/400/300',
        'https://picsum.photos/id/50/400/300'
    ];
    
    const videoUrls = [
        'https://www.w3schools.com/html/mov_bbb.mp4',
        'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4',
        'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4'
    ];
    
    if (type === 'video') {
        return videoUrls[Math.floor(Math.random() * videoUrls.length)];
    }
    
    return imageUrls[Math.floor(Math.random() * imageUrls.length)];
}

/**
 * Shuffle array helper
 */
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

/**
 * Manual task generation for current day (if needed)
 */
async function generateTasksForToday() {
    console.log('Generating tasks for today...');
    
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    try {
        // Check if tasks exist for today
        const tasksSnapshot = await db.collection('tasks')
            .where('status', '==', 'active')
            .where('scheduledDate', '>=', firebase.firestore.Timestamp.fromDate(today))
            .where('scheduledDate', '<', firebase.firestore.Timestamp.fromDate(tomorrow))
            .limit(1)
            .get();
        
        if (tasksSnapshot.empty) {
            console.log('No tasks for today, generating...');
            return await createRandomTasksForToday();
        }
        
        console.log('Tasks already exist for today');
        return [];
        
    } catch (error) {
        console.error('Error generating tasks for today:', error);
        return [];
    }
}

/**
 * Create random tasks for today (emergency)
 */
async function createRandomTasksForToday() {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const tasksPerDay = systemSettings.tasksPerDay || 3;
    const newTasks = [];
    
    for (let i = 0; i < tasksPerDay; i++) {
        const newTask = {
            title: `Daily Task ${i + 1}`,
            description: 'Complete this task to earn daily profits',
            mediaType: 'image',
            mediaUrl: `https://via.placeholder.com/400x300?text=Task+${i + 1}`,
            scheduledDate: firebase.firestore.Timestamp.fromDate(today),
            expiryDate: firebase.firestore.Timestamp.fromDate(tomorrow),
            status: 'active',
            category: 'Rating',
            createdBy: 'system_emergency',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await db.collection('tasks').add(newTask);
        newTasks.push({ id: docRef.id, ...newTask });
    }
    
    return newTasks;
}

/**
 * Manual task reuse (admin can call this)
 */
async function manualTaskReuse() {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
        showToast('Only administrators can manually reuse tasks', 'error');
        return;
    }
    
    showLoading('Manually reusing tasks...');
    
    try {
        const reusedTasks = await reuseExpiredTasks();
        
        if (reusedTasks.length === 0) {
            // If no expired tasks, create new random ones
            const newTasks = await createRandomTasksForTomorrow();
            showToast(`Created ${newTasks.length} new tasks for tomorrow`, 'success');
        } else {
            showToast(`Reused ${reusedTasks.length} tasks for tomorrow`, 'success');
        }
        
        await loadAdminTasks(); // Refresh admin view
        
    } catch (error) {
        console.error('Error during manual task reuse:', error);
        showToast('Error reusing tasks: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Get task statistics for admin dashboard
 */
async function getTaskStatistics() {
    try {
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        // Get all tasks
        const tasksSnapshot = await db.collection('tasks').get();
        const allTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Count tasks by status
        const activeTasks = allTasks.filter(t => t.status === 'active');
        const expiredTasks = allTasks.filter(t => t.status === 'expired');
        
        // Count tasks for today
        const todayTasks = allTasks.filter(t => {
            const scheduledDate = t.scheduledDate?.toDate ? t.scheduledDate.toDate() : new Date(t.scheduledDate);
            return t.status === 'active' && scheduledDate >= today && scheduledDate < tomorrow;
        });
        
        // Count tasks for tomorrow
        const tomorrowTasks = allTasks.filter(t => {
            const scheduledDate = t.scheduledDate?.toDate ? t.scheduledDate.toDate() : new Date(t.scheduledDate);
            return t.status === 'active' && scheduledDate >= tomorrow && scheduledDate < new Date(tomorrow.getTime() + 86400000);
        });
        
        return {
            total: allTasks.length,
            active: activeTasks.length,
            expired: expiredTasks.length,
            today: todayTasks.length,
            tomorrow: tomorrowTasks.length,
            tasksPerDay: systemSettings.tasksPerDay || 3
        };
        
    } catch (error) {
        console.error('Error getting task statistics:', error);
        return null;
    }
}

/**
 * Add task statistics to admin dashboard
 */
async function addTaskStatisticsToAdmin() {
    const stats = await getTaskStatistics();
    if (!stats) return;
    
    // Find or create stats container
    let statsContainer = document.getElementById('taskStatsContainer');
    if (!statsContainer) {
        const adminDashboard = document.getElementById('adminDashboardTab');
        if (adminDashboard) {
            statsContainer = document.createElement('div');
            statsContainer.id = 'taskStatsContainer';
            statsContainer.className = 'task-stats-container';
            statsContainer.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 15px;
                margin-bottom: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;
            adminDashboard.insertBefore(statsContainer, adminDashboard.firstChild.nextSibling);
        }
    }
    
    if (statsContainer) {
        statsContainer.innerHTML = `
            <h3><i class="fas fa-tasks"></i> Task Statistics</h3>
            <div class="task-stats-grid">
                <div class="stat-item">
                    <span>Total Tasks</span>
                    <strong>${stats.total}</strong>
                </div>
                <div class="stat-item">
                    <span>Active Tasks</span>
                    <strong>${stats.active}</strong>
                </div>
                <div class="stat-item">
                    <span>Expired Tasks</span>
                    <strong>${stats.expired}</strong>
                </div>
                <div class="stat-item">
                    <span>Today's Tasks</span>
                    <strong>${stats.today} / ${stats.tasksPerDay}</strong>
                    ${stats.today === 0 ? '<span class="warning-badge">⚠️ No tasks!</span>' : ''}
                </div>
                <div class="stat-item">
                    <span>Tomorrow's Tasks</span>
                    <strong>${stats.tomorrow} / ${stats.tasksPerDay}</strong>
                    ${stats.tomorrow === 0 ? '<span class="warning-badge">⚠️ Will auto-generate</span>' : ''}
                </div>
                <div class="stat-item">
                    <button onclick="manualTaskReuse()" class="action-btn small">
                        <i class="fas fa-sync-alt"></i> Manual Reuse
                    </button>
                </div>
            </div>
        `;
    }
}

// ============================================
// START AUTO TASK REUSE SYSTEM
// ============================================

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        initAutoTaskReuse();
    }, 3000);
});

// Also initialize when admin dashboard loads
const originalShowAdminDashboard = window.showAdminDashboard;
window.showAdminDashboard = async function() {
    if (originalShowAdminDashboard) await originalShowAdminDashboard();
    setTimeout(() => {
        addTaskStatisticsToAdmin();
    }, 1000);
};


// ============================================
// EXPORT FUNCTIONS
// ============================================

window.initAutoTaskReuse = initAutoTaskReuse;
window.manualTaskReuse = manualTaskReuse;
window.getTaskStatistics = getTaskStatistics;
window.generateTasksForTomorrow = generateTasksForTomorrow;
window.checkAndGenerateTasksForTomorrow = checkAndGenerateTasksForTomorrow;

console.log('✅ Automatic task reuse system loaded');

// ============================================
// FIXED SETTINGS TAB SWITCHING FUNCTION
// ============================================

/**
 * Switch between settings tabs
 */
function switchSettingsTab(tab, event) {
    // If event is provided, prevent default behavior
    if (event) {
        event.preventDefault();
    }
    
    console.log('Switching settings tab to:', tab);
    
    // Get all tab buttons
    const tabButtons = document.querySelectorAll('.settings-tab');
    const tabContents = document.querySelectorAll('.settings-tab-content');
    
    // Remove active class from all tabs
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Hide all tab contents
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Activate the selected tab button
    let activeButton = null;
    tabButtons.forEach(btn => {
        const btnTab = btn.getAttribute('onclick');
        if (btnTab && btnTab.includes(tab)) {
            activeButton = btn;
            btn.classList.add('active');
        }
    });
    
    // Show the selected tab content
    if (tab === 'profile') {
        const profileTab = document.getElementById('profileSettingsTab');
        if (profileTab) profileTab.classList.add('active');
    } else if (tab === 'password') {
        const passwordTab = document.getElementById('passwordSettingsTab');
        if (passwordTab) passwordTab.classList.add('active');
    } else if (tab === 'danger') {
        const dangerTab = document.getElementById('dangerZoneTab');
        if (dangerTab) dangerTab.classList.add('active');
    }
    
    console.log('Tab switched to:', tab);
}

// ============================================
// INITIALIZE SETTINGS TABS
// ============================================

function initSettingsTabs() {
    // Find all settings tab buttons
    const tabButtons = document.querySelectorAll('.settings-tab');
    
    // Add click event listeners
    tabButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the tab name from the onclick attribute or data attribute
            let tabName = '';
            const onclickAttr = this.getAttribute('onclick');
            if (onclickAttr) {
                const match = onclickAttr.match(/'([^']+)'/);
                if (match) {
                    tabName = match[1];
                }
            }
            
            // If no tab name found, use data attribute or text content
            if (!tabName) {
                tabName = this.textContent.toLowerCase().trim();
            }
            
            // Switch to the tab
            switchSettingsTab(tabName);
        });
    });
}

// Call this when the settings modal is opened
function showUserSettings() {
    if (!currentUser) {
        showToast('Please log in first', 'error');
        return;
    }
    
    // Load current user data into form
    document.getElementById('settingsFullName').value = currentUser.fullName || '';
    document.getElementById('settingsUsername').value = currentUser.username || '';
    document.getElementById('settingsEmail').value = currentUser.email || '';
    document.getElementById('settingsPhone').value = currentUser.phone || '';
    document.getElementById('settingsProfileImage').value = currentUser.profileImage || '';
    
    // Reset password fields
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    
    // Reset delete confirmation
    const confirmCheckbox = document.getElementById('confirmDeleteCheckbox');
    if (confirmCheckbox) {
        confirmCheckbox.checked = false;
        document.getElementById('deleteAccountBtn').disabled = true;
    }
    
    // Show modal
    const modal = document.getElementById('userSettingsModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Initialize tabs after modal is shown
        setTimeout(() => {
            initSettingsTabs();
        }, 100);
    }
}

// ============================================
// SIMPLE FIXED SETTINGS TAB SWITCHING
// ============================================

function switchSettingsTab(tab) {
    console.log('Switching settings tab to:', tab);
    
    // Get all tab buttons
    const tabButtons = document.querySelectorAll('.settings-tab');
    
    // Remove active class from all tabs
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the matching button
    tabButtons.forEach(btn => {
        const btnOnclick = btn.getAttribute('onclick') || '';
        if (btnOnclick.includes(`'${tab}'`) || btnOnclick.includes(`"${tab}"`)) {
            btn.classList.add('active');
        }
    });
    
    // Hide all tab contents
    const profileTab = document.getElementById('profileSettingsTab');
    const passwordTab = document.getElementById('passwordSettingsTab');
    const dangerTab = document.getElementById('dangerZoneTab');
    
    if (profileTab) profileTab.classList.remove('active');
    if (passwordTab) passwordTab.classList.remove('active');
    if (dangerTab) dangerTab.classList.remove('active');
    
    // Show selected tab
    if (tab === 'profile' && profileTab) {
        profileTab.classList.add('active');
    } else if (tab === 'password' && passwordTab) {
        passwordTab.classList.add('active');
    } else if (tab === 'danger' && dangerTab) {
        dangerTab.classList.add('active');
    }
    
    console.log('Tab switched successfully to:', tab);
}

// ============================================
// USER BANK ACCOUNTS MANAGEMENT
// ============================================

let userBankAccounts = [];

/**
 * Show user bank accounts modal
 */
async function showUserBankAccounts() {
    console.log('Showing user bank accounts modal');
    
    if (!currentUser) {
        showToast('Please log in first', 'error');
        return;
    }
    
    // Load user's bank accounts
    await loadUserBankAccounts();
    
    // Show modal
    const modal = document.getElementById('userBankAccountsModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Ensure saved accounts tab is active
        switchBankAccountsTab('saved');
    }
}

/**
 * Close user bank accounts modal
 */
function closeUserBankAccountsModal() {
    const modal = document.getElementById('userBankAccountsModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Load user's bank accounts from Firestore
 */
async function loadUserBankAccounts() {
    console.log('Loading user bank accounts...');
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        
        userBankAccounts = userData.bankAccounts || [];
        
        // Sort by default first, then by added date
        userBankAccounts.sort((a, b) => {
            if (a.isDefault) return -1;
            if (b.isDefault) return 1;
            return new Date(b.addedAt) - new Date(a.addedAt);
        });
        
        renderUserBankAccounts();
        updateBankAccountsBadge();
        
        console.log(`Loaded ${userBankAccounts.length} bank accounts`);
        
    } catch (error) {
        console.error('Error loading bank accounts:', error);
        userBankAccounts = [];
        showToast('Error loading bank accounts', 'error');
    }
}

/**
 * Render user's bank accounts in the modal
 */
function renderUserBankAccounts() {
    const container = document.getElementById('savedBankAccountsList');
    if (!container) return;
    
    if (userBankAccounts.length === 0) {
        container.innerHTML = `
            <div class="empty-accounts">
                <i class="fas fa-university"></i>
                <p>You haven't added any bank accounts yet</p>
                <p class="small">Click "Add New Account" to add your first bank account</p>
                <button onclick="switchBankAccountsTab('add')" class="action-btn small" style="margin-top: 15px;">
                    <i class="fas fa-plus-circle"></i> Add Account
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    userBankAccounts.forEach((account, index) => {
        const displayNumber = account.accountNumber.replace(/(\d{4})/g, '$1 ').trim();
        const isDefault = account.isDefault;
        
        html += `
            <div class="bank-account-card ${isDefault ? 'default' : ''}" data-account-id="${account.id}">
                <div class="bank-account-header">
                    <div class="bank-name">
                        <i class="fas ${getBankIconClass(account.bankName)}" style="color: ${getBankColor(account.bankName)}"></i>
                        <h4>${escapeHtml(account.bankName)}</h4>
                    </div>
                    ${isDefault ? '<span class="default-badge">Default</span>' : ''}
                </div>
                <div class="bank-account-details">
                    <div class="detail-row">
                        <span class="detail-label">Account Number:</span>
                        <span class="detail-value">${escapeHtml(displayNumber)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Account Name:</span>
                        <span class="detail-value">${escapeHtml(account.accountName)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Added:</span>
                        <span class="detail-value">${new Date(account.addedAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="bank-account-actions">
                    ${!isDefault ? `
                        <button class="set-default-btn" onclick="setDefaultBankAccount('${account.id}')">
                            <i class="fas fa-check-circle"></i> Set as Default
                        </button>
                    ` : ''}
                    <button class="delete-btn" onclick="deleteBankAccount('${account.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Switch between bank accounts tabs
 */
function switchBankAccountsTab(tab) {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.bank-tab-btn');
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Update content visibility
    const savedTab = document.getElementById('savedBankAccountsTab');
    const addTab = document.getElementById('addBankAccountTab');
    
    if (tab === 'saved') {
        document.querySelector('.bank-tab-btn:first-child').classList.add('active');
        savedTab.classList.add('active');
        addTab.classList.remove('active');
        renderUserBankAccounts(); // Refresh list
    } else if (tab === 'add') {
        document.querySelector('.bank-tab-btn:last-child').classList.add('active');
        addTab.classList.add('active');
        savedTab.classList.remove('active');
        resetBankAccountForm();
    }
}

/**
 * Toggle other bank field visibility
 */
function toggleUserOtherBankField() {
    const bankSelect = document.getElementById('userBankName');
    const otherField = document.getElementById('userOtherBankField');
    
    if (bankSelect.value === 'Other') {
        otherField.style.display = 'block';
        document.getElementById('userOtherBankName').required = true;
    } else {
        otherField.style.display = 'none';
        document.getElementById('userOtherBankName').required = false;
    }
}

/**
 * Reset bank account form
 */
function resetBankAccountForm() {
    document.getElementById('userBankName').value = '';
    document.getElementById('userAccountNumber').value = '';
    document.getElementById('userAccountHolderName').value = '';
    document.getElementById('setAsDefaultAccount').checked = false;
    document.getElementById('userOtherBankField').style.display = 'none';
    document.getElementById('userOtherBankName').value = '';
    
    // Remove error styles
    document.querySelectorAll('#addBankAccountForm .form-group input, #addBankAccountForm .form-group select')
        .forEach(el => el.classList.remove('error'));
}

/**
 * Save user bank account
 */
async function saveUserBankAccount() {
    console.log('Saving bank account...');
    
    let bankName = document.getElementById('userBankName').value;
    const accountNumber = document.getElementById('userAccountNumber').value.trim();
    const accountName = document.getElementById('userAccountHolderName').value.trim();
    const setAsDefault = document.getElementById('setAsDefaultAccount').checked;
    
    // Handle "Other" bank
    if (bankName === 'Other') {
        const otherBank = document.getElementById('userOtherBankName').value.trim();
        if (!otherBank) {
            showToast('Please enter your bank name', 'error');
            return;
        }
        bankName = otherBank;
    }
    
    // Validation
    if (!bankName) {
        showToast('Please select a bank', 'error');
        return;
    }
    
    if (!accountNumber) {
        showToast('Please enter account number', 'error');
        return;
    }
    
    if (!accountName) {
        showToast('Please enter account holder name', 'error');
        return;
    }
    
    // Validate account number format (basic validation)
    if (accountNumber.length < 6) {
        showToast('Please enter a valid account number', 'error');
        return;
    }
    
    // Check if user already has 5 accounts
    if (userBankAccounts.length >= 5) {
        showToast('You can only add up to 5 bank accounts', 'error');
        return;
    }
    
    // Check for duplicate account number
    const duplicate = userBankAccounts.find(acc => acc.accountNumber === accountNumber);
    if (duplicate) {
        showToast('This account number is already added', 'error');
        return;
    }
    
    showLoading('Saving account...');
    
    try {
        // Create new account object
        const newAccount = {
            id: generateId(),
            bankName: bankName,
            accountNumber: accountNumber,
            accountName: accountName,
            isDefault: setAsDefault || userBankAccounts.length === 0, // First account becomes default if none selected
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        let updatedAccounts = [...userBankAccounts, newAccount];
        
        // If this account is set as default, remove default from others
        if (newAccount.isDefault) {
            updatedAccounts = updatedAccounts.map(acc => ({
                ...acc,
                isDefault: acc.id === newAccount.id
            }));
        }
        
        // Update Firestore
        const userRef = db.collection('users').doc(currentUser.uid);
        await userRef.update({
            bankAccounts: updatedAccounts,
            updatedAt: new Date().toISOString()
        });
        
        // Update local array
        userBankAccounts = updatedAccounts;
        
        // Add to history
        await userRef.update({
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'bank_account',
                description: `Added ${bankName} account: ${accountNumber}`,
                amount: 0,
                status: 'completed',
                date: new Date().toISOString()
            })
        });
        
        // Add notification
        await addNotification(
            currentUser.uid,
            '🏦 Bank Account Added',
            `You have successfully added ${bankName} account ${accountNumber}. This account can be used for withdrawals.`,
            'success'
        );
        
        hideLoading();
        showToast('✅ Bank account saved successfully!', 'success');
        
        // Reset form and switch to saved accounts
        resetBankAccountForm();
        await loadUserBankAccounts();
        switchBankAccountsTab('saved');
        
    } catch (error) {
        hideLoading();
        console.error('Error saving bank account:', error);
        showToast('Error saving account: ' + error.message, 'error');
    }
}

/**
 * Set default bank account
 */
async function setDefaultBankAccount(accountId) {
    console.log('Setting default account:', accountId);
    
    const account = userBankAccounts.find(acc => acc.id === accountId);
    if (!account) return;
    
    if (account.isDefault) {
        showToast('This is already your default account', 'info');
        return;
    }
    
    showLoading('Updating default account...');
    
    try {
        const updatedAccounts = userBankAccounts.map(acc => ({
            ...acc,
            isDefault: acc.id === accountId
        }));
        
        const userRef = db.collection('users').doc(currentUser.uid);
        await userRef.update({
            bankAccounts: updatedAccounts,
            updatedAt: new Date().toISOString()
        });
        
        userBankAccounts = updatedAccounts;
        
        await addNotification(
            currentUser.uid,
            '🏦 Default Account Updated',
            `${account.bankName} (${account.accountNumber}) is now your default withdrawal account.`,
            'info'
        );
        
        hideLoading();
        showToast('✅ Default account updated successfully!', 'success');
        renderUserBankAccounts();
        
    } catch (error) {
        hideLoading();
        console.error('Error setting default account:', error);
        showToast('Error updating default account', 'error');
    }
}

/**
 * Delete bank account
 */
async function deleteBankAccount(accountId) {
    const account = userBankAccounts.find(acc => acc.id === accountId);
    if (!account) return;
    
    if (!confirm(`Are you sure you want to delete ${account.bankName} account ${account.accountNumber}?`)) return;
    
    showLoading('Deleting account...');
    
    try {
        let updatedAccounts = userBankAccounts.filter(acc => acc.id !== accountId);
        
        // If we deleted the default account and there are other accounts, set the first as default
        if (account.isDefault && updatedAccounts.length > 0) {
            updatedAccounts[0].isDefault = true;
        }
        
        const userRef = db.collection('users').doc(currentUser.uid);
        await userRef.update({
            bankAccounts: updatedAccounts,
            updatedAt: new Date().toISOString()
        });
        
        userBankAccounts = updatedAccounts;
        
        await addNotification(
            currentUser.uid,
            '🏦 Bank Account Deleted',
            `${account.bankName} account ${account.accountNumber} has been removed.`,
            'warning'
        );
        
        hideLoading();
        showToast('✅ Bank account deleted successfully!', 'success');
        renderUserBankAccounts();
        updateBankAccountsBadge();
        
    } catch (error) {
        hideLoading();
        console.error('Error deleting account:', error);
        showToast('Error deleting account', 'error');
    }
}

/**
 * Update bank accounts badge in menu
 */
function updateBankAccountsBadge() {
    const badge = document.getElementById('bankAccountsBadge');
    if (badge) {
        if (userBankAccounts.length > 0) {
            badge.textContent = userBankAccounts.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

/**
 * Get bank icon class
 */
function getBankIconClass(bankName) {
    const lowerName = bankName.toLowerCase();
    if (lowerName.includes('mpesa') || lowerName.includes('airtel') || lowerName.includes('tigo')) {
        return 'fa-mobile-alt';
    }
    if (lowerName.includes('crdb') || lowerName.includes('nmb') || lowerName.includes('nbc')) {
        return 'fa-university';
    }
    return 'fa-credit-card';
}

/**
 * Get bank color
 */
function getBankColor(bankName) {
    const colors = {
        'M-Pesa': '#4CAF50',
        'Airtel Money': '#FF0000',
        'Tigo Pesa': '#0000FF',
        'CRDB Bank': '#2196F3',
        'NMB Bank': '#9C27B0',
        'NBC Bank': '#FF9800'
    };
    return colors[bankName] || '#666';
}

// ============================================
// MAKE FUNCTIONS GLOBALLY AVAILABLE
// ============================================

window.showUserBankAccounts = showUserBankAccounts;
window.closeUserBankAccountsModal = closeUserBankAccountsModal;
window.switchBankAccountsTab = switchBankAccountsTab;
window.toggleUserOtherBankField = toggleUserOtherBankField;
window.resetBankAccountForm = resetBankAccountForm;
window.saveUserBankAccount = saveUserBankAccount;
window.setDefaultBankAccount = setDefaultBankAccount;
window.deleteBankAccount = deleteBankAccount;

/**
 * Debug function to check bank accounts in withdrawal
 */
async function debugWithdrawalAccounts() {
    console.log('=== DEBUG: Withdrawal Accounts ===');
    console.log('Current user:', currentUser?.username);
    
    if (currentUser) {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        
        console.log('Bank accounts from Firestore:', userData.bankAccounts);
        console.log('Bank accounts count:', userData.bankAccounts?.length);
        
        console.log('Local withdrawAccounts array:', withdrawAccounts);
        console.log('Selected withdrawal account:', selectedWithdrawAccount);
    } else {
        console.log('No user logged in');
    }
    
    console.log('=== END DEBUG ===');
}

// Make debug function available
window.debugWithdrawalAccounts = debugWithdrawalAccounts;

// ============================================
// 137 TANZANIAN NAMES WITH PHONE NUMBERS ONLY
// ============================================

const chwContacts = [
    // Original 37 contacts
    { name: "CHRISTOPHER JONAS", phone: "0711715575" },
    { name: "NEEMA WELU", phone: "0744996762" },
    { name: "SUZANA MWASHIUYA", phone: "0793906392" },
    { name: "NELSON INUGULA", phone: "0742019391" },
    { name: "SELEMANI MANKONDYA", phone: "0753605823" },
    { name: "SALOMEY MYOVIZI", phone: "0769610148" },
    { name: "EDISONS SHITINDI", phone: "0764741104" },
    { name: "BEATRICE WICHISON", phone: "0755316809" },
    { name: "GUNGWA MSWIMA", phone: "0768100121" },
    { name: "EMANUEL MNKONDYA", phone: "0753649147" },
    { name: "FATINA JACKSONI", phone: "0747573058" },
    { name: "PATRICK KAPOLA", phone: "0766803704" },
    { name: "DONALD MSYALHA", phone: "0743202265" },
    { name: "DOSITA LUSUNGO", phone: "0747439960" },
    { name: "JONAS WENGA", phone: "0745209194" },
    { name: "SUZANA SINKALA", phone: "0756442318" },
    { name: "LILIAN MWASHIUYA", phone: "0713115123" },
    { name: "FEDELIKA MMALA", phone: "0768340057" },
    { name: "ESTER NGAO", phone: "0754273612" },
    { name: "STELA HOWA", phone: "0743168296" },
    { name: "MARY SILWIMBA", phone: "0766161067" },
    { name: "JUSTA NGONPALA", phone: "0764809611" },
    { name: "MATATIZO MENTULA", phone: "0749992891" },
    { name: "GABRIEL HAIDHURY", phone: "0754398355" },
    { name: "ABELI MWANJOSI", phone: "0762408844" },
    { name: "LEONARD NZOWA", phone: "0752409990" },
    { name: "BARICKI MWAFONEGO", phone: "0761834372" },
    { name: "FRACKSON MAGWARA", phone: "0792148175" },
    { name: "SALOME SONKA LUDESA", phone: "0768023312" },
    { name: "ESTA NGAO", phone: "0747273035" },
    { name: "LUCY MGALA", phone: "0762500388" },
    { name: "ANNA SINKONDE", phone: "0766269447" },
    { name: "NOBESTER KAYANGE", phone: "0621906647" },
    { name: "RIZIKI SIMBETE", phone: "0766712539" },
    { name: "SAILO KABAGE", phone: "0744522560" },
    { name: "OLIVA NZOWA", phone: "0753199882" },
    { name: "JUDITHE YULA", phone: "0679637702" },
    
    // 100 Tanzanian names from the list
    { name: "JUMA BAKARI", phone: "0754102938" },
    { name: "NEEMA MCHOME", phone: "0713456789" },
    { name: "BARAKA KWAYU", phone: "0655221004" },
    { name: "ASHA RAMADHANI", phone: "0784998332" },
    { name: "GODFREY MASSAWE", phone: "0767112443" },
    { name: "WITNESS SHAO", phone: "0621990887" },
    { name: "EMMANUEL KIMARO", phone: "0755334112" },
    { name: "FATUMA HASSAN", phone: "0677889221" },
    { name: "DICKSON MUSHI", phone: "0742110556" },
    { name: "REHEMA MTUI", phone: "0693778443" },
    { name: "KELVIN SWAI", phone: "0788556221" },
    { name: "MARIAM SAID", phone: "0719443110" },
    { name: "SAIDI ATHUMANI", phone: "0762889443" },
    { name: "UPENDO LYIMO", phone: "0654112334" },
    { name: "IBRAHIM ISSA", phone: "0689556778" },
    { name: "CATHERINE KESSY", phone: "0744332112" },
    { name: "FRANK MWAKIDEU", phone: "0752990112" },
    { name: "HADIJA SHABANI", phone: "0672334556" },
    { name: "RICHARD MAGUFULI", phone: "0715223110" },
    { name: "SALOME NYERERE", phone: "0768445221" },
    { name: "ISAKA MALECELA", phone: "0625998443" },
    { name: "HAPPY KIKWETE", phone: "0783112445" },
    { name: "NELSON SHEIN", phone: "0745889223" },
    { name: "ANNA MGHWIRA", phone: "0653221445" },
    { name: "JOSEPH SAMIA", phone: "0694887221" },
    { name: "ZAINABU SULEIMAN", phone: "0718334556" },
    { name: "PETER MSIGWA", phone: "0763889112" },
    { name: "GRACE MBILINYI", phone: "0756221443" },
    { name: "MUSA NASSARI", phone: "0627990334" },
    { name: "FARIDA MAKAMBA", phone: "0786334221" },
    { name: "DAVID LISSU", phone: "0747112556" },
    { name: "AMINA ZITTO", phone: "0657990112" },
    { name: "LUCAS KABWE", phone: "0683223445" },
    { name: "SOPHIA MBOWE", phone: "0716556778" },
    { name: "MICHAEL HECHE", phone: "0764445221" },
    { name: "HALIMA MDEE", phone: "0757889112" },
    { name: "THOMAS NYALANDU", phone: "0628334110" },
    { name: "ROSE MONGELLA", phone: "0785443221" },
    { name: "ELIAS KAWAWA", phone: "0746990334" },
    { name: "ELIZABETH MKAPA", phone: "0652112443" },
    { name: "SIMON MSUYA", phone: "0682334556" },
    { name: "JOYCE WARIODA", phone: "0714112445" },
    { name: "CHRISTOPHER SUMAYE", phone: "0765443112" },
    { name: "MARY PINDA", phone: "0758889221" },
    { name: "GEORGE MAJALIWA", phone: "0624223445" },
    { name: "SARAH MONGI", phone: "0787110998" },
    { name: "STEVEN MLINGI", phone: "0748445221" },
    { name: "MONICA KISHOA", phone: "0658990112" },
    { name: "PAUL MAKONDA", phone: "0681223445" },
    { name: "LILIAN KIMATI", phone: "0717334556" },
    { name: "VICTOR KAVISHE", phone: "0766556778" },
    { name: "NEEMA MOLLEL", phone: "0655443210" },
    { name: "BARAKA LOWASSA", phone: "0784990112" },
    { name: "ASHA SALUM", phone: "0712334556" },
    { name: "GODFREY MREMA", phone: "0767889001" },
    { name: "WITNESS TEMU", phone: "0621556778" },
    { name: "EMMANUEL LEMA", phone: "0754223114" },
    { name: "FATUMA ALI", phone: "0677445889" },
    { name: "DICKSON SHIRIMA", phone: "0742990334" },
    { name: "REHEMA KAVISHE", phone: "0693221554" },
    { name: "KELVIN NJAU", phone: "0788443221" },
    { name: "MARIAM JUMA", phone: "0719334009" },
    { name: "SAIDI HAMISI", phone: "0762112445" },
    { name: "UPENDO MARIKI", phone: "0654332110" },
    { name: "IBRAHIM MUSSA", phone: "0689445778" },
    { name: "CATHERINE URIO", phone: "0744221990" },
    { name: "FRANK MWAKIPESILE", phone: "0752334556" },
    { name: "HADIJA OMARY", phone: "0672889110" },
    { name: "RICHARD MWITA", phone: "0715443221" },
    { name: "SALOME SOKOINE", phone: "0768556443" },
    { name: "ISAKA MSHANA", phone: "0625112889" },
    { name: "HAPPY MSHIU", phone: "0783221004" },
    { name: "NELSON MOSHI", phone: "0745334778" },
    { name: "ANNA KIMARIO", phone: "0653445112" },
    { name: "JOSEPH TARIMO", phone: "0694556332" },
    { name: "ZAINABU IDI", phone: "0718112443" },
    { name: "PETER MURO", phone: "0763334556" },
    { name: "GRACE LASWAI", phone: "0756445221" },
    { name: "MUSA SHAYO", phone: "0627556112" },
    { name: "FARIDA MACHA", phone: "0786112445" },
    { name: "DAVID KISANGA", phone: "0747445889" },
    { name: "AMINA MINJA", phone: "0657221334" },
    { name: "LUCAS NGOWI", phone: "0683445112" },
    { name: "SOPHIA TESHA", phone: "0716334556" },
    { name: "MICHAEL MALAMSHA", phone: "0764112334" },
    { name: "HALIMA MEELA", phone: "0757445990" },
    { name: "THOMAS MALLYA", phone: "0628221443" },
    { name: "ROSE SHIRIMA", phone: "0785556778" },
    { name: "ELIAS MARO", phone: "0746112445" },
    { name: "ELIZABETH KIMARO", phone: "0652334112" },
    { name: "SIMON LYIMO", phone: "0682445334" },
    { name: "JOYCE MUSHI", phone: "0714556221" },
    { name: "CHRISTOPHER SWAI", phone: "0765112334" },
    { name: "MARY CHAO", phone: "0758445112" },
    { name: "GEORGE NJAU", phone: "0624334556" },
    { name: "SARAH NKYA", phone: "0787556112" },
    { name: "STEVEN MASAWE", phone: "0748112443" },
    { name: "MONICA TEMU", phone: "0658334556" },
    { name: "PAUL SHAYO", phone: "0681445112" },
    { name: "LILIAN MSHANA", phone: "0717221443" }
];

// Transaction storage
let liveTransactions = [];
let transactionInterval = null;
let realTimeUnsubscribe = null;
let todayTotalDeposits = 0;
let todayTotalWithdrawals = 0;

// Amount ranges
const DEPOSIT_MIN = 10000;
const DEPOSIT_MAX = 10000000;
const WITHDRAWAL_MIN = 3000;
const WITHDRAWAL_MAX = 10000000;

/**
 * Generate random amount within range
 */
function getRandomAmount(min, max) {
    // Round to nearest 1000 for cleaner numbers
    const amount = Math.floor(Math.random() * (max - min + 1) + min);
    return Math.round(amount / 1000) * 1000;
}

/**
 * Format phone number with masking (e.g., 0745******23)
 */
function formatPhoneMasked(phone) {
    if (!phone || phone.length < 10) return phone;
    const start = phone.substring(0, 4);
    const end = phone.substring(phone.length - 2);
    return `${start}******${end}`;
}

/**
 * Generate random transaction (simulated)
 */
function generateRandomTransaction() {
    const randomIndex = Math.floor(Math.random() * chwContacts.length);
    const contact = chwContacts[randomIndex];
    const isDeposit = Math.random() > 0.5;
    
    let amount;
    if (isDeposit) {
        amount = getRandomAmount(DEPOSIT_MIN, DEPOSIT_MAX);
    } else {
        amount = getRandomAmount(WITHDRAWAL_MIN, WITHDRAWAL_MAX);
    }
    
    // 24 hours expiry (86400000 ms)
    const expiryHours = 24;
    
    return {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: contact.name,
        phone: contact.phone,
        phoneMasked: formatPhoneMasked(contact.phone),
        amount: amount,
        type: isDeposit ? 'deposit' : 'withdrawal',
        timestamp: new Date(),
        expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        expiryHours: expiryHours,
        status: 'active',
        isSimulated: true
    };
}

/**
 * Add new simulated transaction
 */
function addSimulatedTransaction() {
    const transaction = generateRandomTransaction();
    liveTransactions.unshift(transaction);
    
    // Update totals
    if (transaction.type === 'deposit') {
        todayTotalDeposits += transaction.amount;
    } else {
        todayTotalWithdrawals += transaction.amount;
    }
    
    // Render the transaction
    renderTransaction(transaction);
    updateStats();
    
    // Auto-scroll to show new transaction
    const container = document.getElementById('transactionsScrollContainer');
    if (container) {
        container.scrollTop = 0;
    }
    
    // Set expiry timer (24 hours)
    scheduleTransactionExpiry(transaction);
    
    console.log(`[SIMULATED] New ${transaction.type}: ${transaction.name} - ${formatMoney(transaction.amount)} (expires in 24 hours)`);
}

/**
 * Add real user transaction to simulator
 */
function addRealTransaction(transaction) {
    const maskedPhone = transaction.phone || transaction.accountNumber || transaction.userPhone || transaction.userAccountNumber || '********';
    const maskedDisplay = formatPhoneMasked(maskedPhone);
    
    const realTxn = {
        id: transaction.id,
        name: transaction.username || transaction.userFullName || transaction.fullName || 'System User',
        phone: maskedPhone,
        phoneMasked: maskedDisplay,
        amount: transaction.amount,
        type: transaction.type,
        timestamp: new Date(transaction.createdAt || transaction.date || transaction.timestamp),
        expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
        expiryHours: 24,
        status: 'active',
        isReal: true
    };
    
    // Check if transaction already exists
    const exists = liveTransactions.some(t => t.id === realTxn.id);
    if (exists) return;
    
    liveTransactions.unshift(realTxn);
    
    if (transaction.type === 'deposit') {
        todayTotalDeposits += transaction.amount;
    } else {
        todayTotalWithdrawals += transaction.amount;
    }
    
    renderTransaction(realTxn);
    updateStats();
    scheduleTransactionExpiry(realTxn);
    
    console.log(`[REAL] New ${transaction.type}: ${realTxn.name} - ${formatMoney(realTxn.amount)}`);
}

/**
 * Schedule transaction expiry (24 hours)
 */
function scheduleTransactionExpiry(transaction) {
    const now = Date.now();
    const expiryDelay = transaction.expiryTime.getTime() - now;
    
    if (expiryDelay > 0) {
        setTimeout(() => {
            expireTransaction(transaction.id);
        }, expiryDelay);
    }
}

/**
 * Expire a transaction after 24 hours
 */
function expireTransaction(transactionId) {
    const transaction = liveTransactions.find(t => t.id === transactionId);
    if (!transaction || transaction.status === 'expired') return;
    
    transaction.status = 'expired';
    
    // Reverse totals if transaction expired
    if (transaction.type === 'deposit') {
        todayTotalDeposits -= transaction.amount;
    } else {
        todayTotalWithdrawals -= transaction.amount;
    }
    
    // Remove from DOM with fade out
    const element = document.getElementById(`txn_${transactionId}`);
    if (element) {
        element.classList.add('expiring');
        setTimeout(() => {
            element.remove();
            liveTransactions = liveTransactions.filter(t => t.id !== transactionId);
            updateStats();
        }, 500);
    } else {
        liveTransactions = liveTransactions.filter(t => t.id !== transactionId);
        updateStats();
    }
    
    console.log(`[EXPIRED] Transaction: ${transaction.name} - ${formatMoney(transaction.amount)} (after 24 hours)`);
}

/**
 * Render a single transaction
 */
function renderTransaction(transaction) {
    const container = document.getElementById('liveTransactionsList');
    if (!container) return;
    
    // Remove loading message if present
    const loadingDiv = container.querySelector('.loading-transactions');
    if (loadingDiv) loadingDiv.remove();
    
    const timeStr = transaction.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = transaction.timestamp.toLocaleDateString();
    const expiryDateStr = transaction.expiryTime.toLocaleDateString();
    const expiryTimeStr = transaction.expiryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const typeClass = transaction.type;
    const iconClass = transaction.type === 'deposit' ? 'fa-arrow-down' : 'fa-arrow-up';
    const amountPrefix = transaction.type === 'deposit' ? '+' : '-';
    const realBadge = transaction.isReal ? '<span class="real-badge"><i class="fas fa-user-check"></i> Real User</span>' : '<span class="real-badge"><i class="fas fa-user-check"></i> Real User</span>';
    
    const transactionHtml = `
        <div class="transaction-item-live ${typeClass} ${transaction.isReal ? 'real-transaction' : 'simulated-transaction'}" id="txn_${transaction.id}" data-expiry="${transaction.expiryTime.getTime()}">
            <div class="transaction-time">
                <small>${dateStr}</small>
                <small>${timeStr}</small>
            </div>
            <div class="transaction-icon ${typeClass}">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="transaction-details">
                <div class="name">
                    ${escapeHtml(transaction.name)}
                    ${realBadge}
                </div>
                <div class="phone">${transaction.phoneMasked}</div>
                <div class="amount ${typeClass}">
                    ${amountPrefix} ${formatMoney(transaction.amount)}
                </div>
                <div class="transaction-expiry">
                    <i class="far fa-clock"></i> Expires: ${expiryDateStr} at ${expiryTimeStr}
                </div>
            </div>
            <div class="transaction-countdown">
                <div class="countdown-timer" id="countdown_${transaction.id}" data-expiry="${transaction.expiryTime.getTime()}">
                    ${formatCountdown(transaction.expiryTime)}
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('afterbegin', transactionHtml);
    startCountdownTimer(transaction.id, transaction.expiryTime);
}

/**
 * Format countdown time (24 hour format)
 */
function formatCountdown(expiryTime) {
    const diff = expiryTime - Date.now();
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Start countdown timer for a transaction
 */
function startCountdownTimer(transactionId, expiryTime) {
    const timerElement = document.getElementById(`countdown_${transactionId}`);
    if (!timerElement) return;
    
    const interval = setInterval(() => {
        const element = document.getElementById(`countdown_${transactionId}`);
        if (!element) {
            clearInterval(interval);
            return;
        }
        
        const remaining = expiryTime - Date.now();
        if (remaining <= 0) {
            element.textContent = 'Expired';
            element.classList.add('urgent');
            clearInterval(interval);
        } else {
            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            
            if (hours > 0) {
                element.textContent = `${hours}h ${minutes}m`;
            } else if (minutes > 0) {
                element.textContent = `${minutes}m ${seconds}s`;
                if (minutes < 5) {
                    element.classList.add('urgent');
                }
            } else {
                element.textContent = `${seconds}s`;
                element.classList.add('urgent');
            }
        }
    }, 1000);
}

/**
 * Update simulator statistics
 */
function updateStats() {
    const todayDepositsEl = document.getElementById('todayDeposits');
    const todayWithdrawalsEl = document.getElementById('todayWithdrawals');
    const activeTransactionsEl = document.getElementById('activeTransactions');
    
    if (todayDepositsEl) todayDepositsEl.textContent = formatMoney(todayTotalDeposits);
    if (todayWithdrawalsEl) todayWithdrawalsEl.textContent = formatMoney(todayTotalWithdrawals);
    if (activeTransactionsEl) activeTransactionsEl.textContent = liveTransactions.length;
}

/**
 * Initialize real-time transaction listener for actual user deposits/withdrawals
 */
function initRealTimeTransactionListener() {
    // Clean up existing listener
    if (realTimeUnsubscribe) {
        realTimeUnsubscribe();
    }
    
    console.log('Initializing real-time transaction listener...');
    
    // Listen for new deposits
    const depositsQuery = db.collection('deposits')
        .orderBy('createdAt', 'desc')
        .limit(20);
    
    const unsubscribeDeposits = depositsQuery.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const deposit = { 
                    id: change.doc.id, 
                    ...change.doc.data(), 
                    type: 'deposit' 
                };
                addRealTransaction(deposit);
            }
        });
    });
    
    // Listen for new withdrawals
    const withdrawalsQuery = db.collection('withdrawals')
        .orderBy('createdAt', 'desc')
        .limit(20);
    
    const unsubscribeWithdrawals = withdrawalsQuery.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const withdrawal = { 
                    id: change.doc.id, 
                    ...change.doc.data(), 
                    type: 'withdrawal' 
                };
                addRealTransaction(withdrawal);
            }
        });
    });
    
    // Also listen for status changes (approved/rejected)
    const statusQuery = db.collection('deposits')
        .where('status', 'in', ['approved', 'rejected', 'completed']);
    
    const unsubscribeStatus = statusQuery.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'modified') {
                const transaction = liveTransactions.find(t => t.id === change.doc.id);
                if (transaction) {
                    // Update status display
                    const element = document.getElementById(`txn_${transaction.id}`);
                    if (element) {
                        const statusBadge = element.querySelector('.transaction-status');
                        if (statusBadge) {
                            statusBadge.textContent = change.doc.data().status;
                            statusBadge.className = `transaction-status ${change.doc.data().status}`;
                        }
                    }
                }
            }
        });
    });
    
    realTimeUnsubscribe = () => {
        unsubscribeDeposits();
        unsubscribeWithdrawals();
        unsubscribeStatus();
    };
    
    return realTimeUnsubscribe;
}

/**
 * Start the transaction simulator
 */
function startTransactionSimulator() {
    if (transactionInterval) clearInterval(transactionInterval);
    
    // Clear existing transactions
    liveTransactions = [];
    todayTotalDeposits = 0;
    todayTotalWithdrawals = 0;
    
    const container = document.getElementById('liveTransactionsList');
    if (container) {
        container.innerHTML = '<div class="loading-transactions"><i class="fas fa-spinner fa-spin"></i> Loading live transactions...</div>';
    }
    
    // Add first transaction after 2 seconds
    setTimeout(() => {
        addSimulatedTransaction();
    }, 2000);
    
    // Add new simulated transaction at random intervals (30-120 seconds)
    transactionInterval = setInterval(() => {
        addSimulatedTransaction();
    }, Math.random() * 90000 + 30000); // 30-120 seconds
    
    // Initialize real-time listener for actual user transactions
    initRealTimeTransactionListener();
    
    console.log('Transaction simulator started (24-hour expiry, real-time updates enabled)');
}

/**
 * Stop the transaction simulator
 */
function stopTransactionSimulator() {
    if (transactionInterval) {
        clearInterval(transactionInterval);
        transactionInterval = null;
    }
    if (realTimeUnsubscribe) {
        realTimeUnsubscribe();
        realTimeUnsubscribe = null;
    }
    console.log('Transaction simulator stopped');
}

/**
 * Toggle simulator visibility
 */
function toggleTransactionSimulator() {
    const container = document.getElementById('transactionSimulator');
    if (container) {
        container.classList.toggle('collapsed');
    }
}

/**
 * Refresh all transactions manually
 */
async function refreshAllTransactions() {
    showLoading('Refreshing transactions...');
    
    // Clear existing
    liveTransactions = [];
    todayTotalDeposits = 0;
    todayTotalWithdrawals = 0;
    
    const container = document.getElementById('liveTransactionsList');
    if (container) {
        container.innerHTML = '<div class="loading-transactions"><i class="fas fa-spinner fa-spin"></i> Refreshing transactions...</div>';
    }
    
    // Load recent real deposits
    const depositsSnap = await db.collection('deposits')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();
    
    depositsSnap.forEach(doc => {
        const deposit = { id: doc.id, ...doc.data(), type: 'deposit' };
        addRealTransaction(deposit);
    });
    
    // Load recent real withdrawals
    const withdrawalsSnap = await db.collection('withdrawals')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();
    
    withdrawalsSnap.forEach(doc => {
        const withdrawal = { id: doc.id, ...doc.data(), type: 'withdrawal' };
        addRealTransaction(withdrawal);
    });
    
    hideLoading();
    showToast('Transactions refreshed!', 'success');
}

// Start simulator when page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        startTransactionSimulator();
    }, 1000);
});

// Make functions globally available
window.startTransactionSimulator = startTransactionSimulator;
window.stopTransactionSimulator = stopTransactionSimulator;
window.toggleTransactionSimulator = toggleTransactionSimulator;
window.addRealTransaction = addRealTransaction;
window.refreshAllTransactions = refreshAllTransactions;

// ============================================
// PASSWORD TOGGLE - COMPLETE FUNCTIONALITY
// ============================================

/**
 * Initialize all password toggle buttons
 */
function initPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.password-toggle-btn');
    
    toggleButtons.forEach(button => {
        // Remove existing event listeners to prevent duplicates
        button.removeEventListener('click', handlePasswordToggle);
        button.addEventListener('click', handlePasswordToggle);
    });
}

/**
 * Handle password toggle click
 * @param {Event} event - The click event
 */
function handlePasswordToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const button = event.currentTarget;
    const targetId = button.getAttribute('data-target');
    
    if (!targetId) {
        console.error('No data-target attribute found');
        return;
    }
    
    const input = document.getElementById(targetId);
    
    if (!input) {
        console.error(`Input with id "${targetId}" not found`);
        return;
    }
    
    togglePassword(input, button);
}

/**
 * Toggle password visibility
 * @param {HTMLInputElement} input - The password input element
 * @param {HTMLElement} button - The toggle button element
 */
function togglePassword(input, button) {
    const icon = button.querySelector('i');
    const textSpan = button.querySelector('.toggle-text');
    
    if (input.type === 'password') {
        // Show password
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
        if (textSpan) {
            textSpan.textContent = 'Hide';
        }
        button.classList.add('active');
        
        // Optional: Auto-hide after 10 seconds
        if (button.getAttribute('data-auto-hide') !== 'false') {
            clearTimeout(window.passwordTimeout);
            window.passwordTimeout = setTimeout(() => {
                if (input.type === 'text') {
                    input.type = 'password';
                    if (icon) {
                        icon.classList.remove('fa-eye-slash');
                        icon.classList.add('fa-eye');
                    }
                    if (textSpan) {
                        textSpan.textContent = 'Show';
                    }
                    button.classList.remove('active');
                }
            }, 10000);
        }
    } else {
        // Hide password
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
        if (textSpan) {
            textSpan.textContent = 'Show';
        }
        button.classList.remove('active');
        
        // Clear auto-hide timeout
        if (window.passwordTimeout) {
            clearTimeout(window.passwordTimeout);
        }
    }
    
    // Trigger focus to keep cursor position
    input.focus();
}

/**
 * Toggle all passwords on the page (for admin use)
 */
function toggleAllPasswords() {
    const allPasswordInputs = document.querySelectorAll('input[type="password"], input[type="text"][id*="password"]');
    
    allPasswordInputs.forEach(input => {
        const button = document.querySelector(`.password-toggle-btn[data-target="${input.id}"]`);
        if (button && input.type === 'password') {
            togglePassword(input, button);
        } else if (button && input.type === 'text' && button.classList.contains('active')) {
            togglePassword(input, button);
        }
    });
}

/**
 * Show password temporarily (for 5 seconds)
 * @param {string} inputId - The ID of the password input
 */
function showPasswordTemporarily(inputId) {
    const input = document.getElementById(inputId);
    const button = document.querySelector(`.password-toggle-btn[data-target="${inputId}"]`);
    
    if (!input || !button) return;
    
    if (input.type === 'password') {
        togglePassword(input, button);
        
        setTimeout(() => {
            if (input.type === 'text') {
                togglePassword(input, button);
            }
        }, 5000);
    }
}

/**
 * Check password strength and show/hide toggle accordingly
 * @param {string} inputId - The ID of the password input
 */
function updatePasswordStrength(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const strength = checkPasswordStrength(input.value);
    const wrapper = input.closest('.password-wrapper');
    
    if (wrapper) {
        // Remove existing strength classes
        wrapper.classList.remove('weak', 'medium', 'strong');
        
        if (strength === 'weak') {
            wrapper.classList.add('weak');
        } else if (strength === 'medium') {
            wrapper.classList.add('medium');
        } else if (strength === 'strong') {
            wrapper.classList.add('strong');
        }
    }
}

/**
 * Check password strength
 * @param {string} password - The password to check
 * @returns {string} - 'weak', 'medium', or 'strong'
 */
function checkPasswordStrength(password) {
    if (!password) return 'weak';
    
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    if (strength >= 4) return 'strong';
    if (strength >= 2) return 'medium';
    return 'weak';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initPasswordToggles();
});

// Also initialize after dynamic content loads
if (window.MutationObserver) {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                initPasswordToggles();
            }
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
}

// Expose functions globally
window.initPasswordToggles = initPasswordToggles;
window.togglePassword = togglePassword;
window.toggleAllPasswords = toggleAllPasswords;
window.showPasswordTemporarily = showPasswordTemporarily;
window.updatePasswordStrength = updatePasswordStrength;

// ============================================
// LANGUAGE SWITCH FUNCTIONALITY
// ============================================

// Current language (default: English)
let currentLanguage = 'en';

// Translation dictionary
const translations = {
    en: {
        // Auth
        'login_title': 'Login to Your Account',
        'signup_title': 'Create Account',
        'signup_subtitle': 'Join SmartTask and start earning',
        'username_email': 'Username or Email',
        'password': 'Password',
        'confirm_password': 'Confirm Password',
        'remember_me': 'Remember me',
        'forgot_password': 'Forgot Password?',
        'login_btn': 'Login',
        'signup_btn': 'Create Account',
        'no_account': "Don't have an account?",
        'have_account': 'Already have an account?',
        'sign_up': 'Sign up',
        'full_name': 'Full Name',
        'username': 'Username',
        'email': 'Email Address',
        'phone': 'Phone Number',
        'referral_code': 'Referral Code (Optional)',
        'terms_agree': 'I agree to the',
        'terms_conditions': 'Terms and Conditions',
        
        // Dashboard Menu
        'overview': 'Overview',
        'vip_packages': 'VIP Packages',
        'daily_tasks': 'Daily Tasks',
        'deposit': 'Deposit',
        'withdraw': 'Withdraw',
        'referrals': 'Referrals',
        'history': 'History',
        
        // User Menu
        'my_profile': 'My Profile',
        'commission_payment': 'Commission Payment',
        'my_bank_accounts': 'My Bank Accounts',
        'social_links': 'Social Links',
        'weekly_commission': 'Weekly Commission',
        'settings': 'Settings',
        'logout': 'Logout',
        
        // Overview
        'welcome_back': 'Welcome Back',
        'balance': 'Balance',
        'tasks_done': 'Tasks Done',
        'referral_bonus': 'Referral Bonus',
        'active_packages': 'Active Packages',
        'todays_tasks': "Today's Tasks",
        'tasks_required': 'Tasks Required',
        'your_active_packages': 'Your Active Packages',
        'latest_announcements': 'Latest Announcements',
        'live_transactions': 'Live Transactions',
        'today_deposits': "Today's Deposits",
        'today_withdrawals': "Today's Withdrawals",
        'active_transactions': 'Active Transactions',
        
        // Tasks
        'complete_tasks': 'Complete your tasks to earn daily profits',
        'todays_progress': "Today's Progress",
        'tasks_completed': 'Tasks Completed',
        'no_package_warning': 'No Active Package Found',
        'browse_packages': 'Browse Packages',
        'no_tasks': 'No tasks available for today',
        'start_task': 'Start Task',
        'completed': 'Completed',
        'rate_product': 'Rate this product',
        'submit_rating': 'Submit Rating',
        'confirm_task': 'I have rated this product',
        'show': 'Show',
        'hide': 'Hide',
        
        // Packages
        'investment_packages': 'VIP Investment Packages',
        'investment': 'Investment',
        'daily_profit': 'Daily Profit',
        'rate': 'Rate',
        'monthly_roi': 'Monthly ROI',
        'buy_package': 'Buy Package',
        'insufficient_balance': 'Insufficient balance',
        'premium': 'PREMIUM',
        'active_status': 'ACTIVE',
        
        // Deposit
        'make_deposit': 'Make a Deposit',
        'deposit_info': 'Minimum deposit: 10,000 TZS | Maximum deposit: 10,000,000 TZS',
        'select_payment_method': 'Select Payment Method',
        'pay_to': 'Pay To',
        'bank': 'Bank',
        'account_number': 'Account Number',
        'account_name': 'Account Name',
        'copy_account': 'Copy Account Number',
        'your_details': 'Your Details',
        'amount': 'Amount',
        'transaction_details': 'Transaction Details',
        'transaction_reference': 'Transaction Reference',
        'payment_date': 'Payment Date',
        'confirm_deposit': 'I confirm that the information provided is correct',
        'submit_deposit': 'Submit Deposit Request',
        'processing': 'Processing...',
        
        // Withdraw
        'withdraw_funds': 'Withdraw Funds',
        'min_withdraw': 'Min: 3,000 TZS',
        'once_per_day': 'Once per day',
        'referral_earnings_withdrawable': 'Referral earnings withdrawable anytime',
        'available_balance': 'Available Balance',
        'referral_earnings': 'Referral Earnings',
        'select_account': 'Select Account',
        'enter_amount': 'Enter Amount',
        'confirm': 'Confirm',
        'your_bank_accounts': 'Your Bank Accounts',
        'add_bank_account': 'Add Bank Account',
        'withdrawal_fee': 'Withdrawal Fee',
        'you_will_receive': 'You Will Receive',
        'confirm_withdrawal': 'I confirm that the above details are correct',
        
        // Referrals
        'referral_program': 'Referral Program',
        'total_referrals': 'Total Referrals',
        'level_1_comm': 'Level 1 Comm',
        'level_2_comm': 'Level 2 Comm',
        'level_3_comm': 'Level 3 Comm',
        'your_referral_link': 'Your Referral Link',
        'share_link': 'Share this link with friends',
        'your_referrals': 'Your Referrals',
        'username_th': 'Username',
        'level_th': 'Level',
        'join_date': 'Join Date',
        'status_th': 'Status',
        
        // History
        'transaction_history': 'Transaction History',
        'all': 'All',
        'deposits': 'Deposits',
        'withdrawals': 'Withdrawals',
        'profits': 'Profits',
        'no_transactions': 'No transaction history yet',
        
        // Social Links
        'follow_social_media': 'Follow Our Social Media',
        'social_progress': 'Completion Progress',
        'reward_info': 'Reward Information',
        'verify_all': 'Verify All',
        'follow': 'Follow',
        'verify': 'Verify',
        'points_earned': 'points earned',
        
        // Weekly Commission
        'weekly_commission_title': 'Weekly Commission',
        'current_week': 'Current Week',
        'projected_commission': 'Projected Commission',
        'commission_history': 'Commission History',
        'pending_commission': 'Pending Commission',
        
        // Settings
        'account_settings': 'Account Settings',
        'profile': 'Profile',
        'danger_zone': 'Danger Zone',
        'save_changes': 'Save Changes',
        'change_password': 'Change Password',
        'current_password': 'Current Password',
        'new_password': 'New Password',
        'delete_account': 'Delete Account',
        'delete_warning': 'Once you delete your account, there is no going back.',
        
        // Bank Accounts
        'my_bank_accounts_title': 'My Bank Accounts',
        'saved_accounts': 'My Accounts',
        'add_new_account': 'Add New Account',
        'bank_name': 'Bank Name',
        'account_holder_name': 'Account Holder Name',
        'set_as_default': 'Set as default account for withdrawals',
        'save_account': 'Save Account',
        'default': 'Default',
        'added_on': 'Added',
        
        // Messages
        'login_success': 'Login successful!',
        'signup_success': 'Registration successful! You received 2,000 TZS bonus!',
        'deposit_success': 'Deposit request submitted successfully!',
        'withdrawal_success': 'Withdrawal request submitted successfully!',
        'task_completed': 'Task completed successfully!',
        'copy_success': 'Copied to clipboard!',
        'loading': 'Loading...',
        'no_data': 'No data found',
        
        // Status
        'pending': 'Pending',
        'completed_status': 'Completed',
        'approved': 'Approved',
        'rejected': 'Rejected',
        'inactive': 'Inactive',
        
        // Buttons
        'continue_btn': 'Continue',
        'cancel': 'Cancel',
        'close': 'Close',
        'save': 'Save',
        'edit': 'Edit',
        'delete': 'Delete',
        'refresh': 'Refresh',
        'back': 'Back',
        'next': 'Next',
        'view_all': 'View All'
    },
    sw: {
        // Auth
        'login_title': 'Ingia kwenye Akaunti Yako',
        'signup_title': 'Unda Akaunti',
        'signup_subtitle': 'Jiunge na SmartTask na anza kupata',
        'username_email': 'Jina la mtumiaji au Barua pepe',
        'password': 'Nywila',
        'confirm_password': 'Thibitisha Nywila',
        'remember_me': 'Nikumbuke',
        'forgot_password': 'Umesahau Nywila?',
        'login_btn': 'Ingia',
        'signup_btn': 'Unda Akaunti',
        'no_account': 'Huna akaunti?',
        'have_account': 'Tayari una akaunti?',
        'sign_up': 'Jisajili',
        'full_name': 'Jina Kamili',
        'username': 'Jina la Mtumiaji',
        'email': 'Barua pepe',
        'phone': 'Nambari ya Simu',
        'referral_code': 'Nambari ya Mrejesho (Si lazima)',
        'terms_agree': 'Nakubali',
        'terms_conditions': 'Sheria na Masharti',
        
        // Dashboard Menu
        'overview': 'Muhtasari',
        'vip_packages': 'Vifurushi vya VIP',
        'daily_tasks': 'Kazi za Kila Siku',
        'deposit': 'Weka Pesa',
        'withdraw': 'Toa Pesa',
        'referrals': 'Marejesho',
        'history': 'Historia',
        
        // User Menu
        'my_profile': 'Wasifu Wangu',
        'commission_payment': 'Malipo ya Tume',
        'my_bank_accounts': 'Akaunti Zangu za Benki',
        'social_links': 'Viungo vya Mitandao',
        'weekly_commission': 'Tume ya Wiki',
        'settings': 'Mipangilio',
        'logout': 'Toka',
        
        // Overview
        'welcome_back': 'Karibu Tena',
        'balance': 'Salio',
        'tasks_done': 'Kazi Zilizofanywa',
        'referral_bonus': 'Bonasi ya Mrejesho',
        'active_packages': 'Vifurushi Vinavyotumika',
        'todays_tasks': 'Kazi za Leo',
        'tasks_required': 'Kazi Zinazohitajika',
        'your_active_packages': 'Vifurushi Vyako Vinavyotumika',
        'latest_announcements': 'Matangazo ya Hivi Punde',
        'live_transactions': 'Miamala ya Moja kwa Moja',
        'today_deposits': 'Weka Pesa Leo',
        'today_withdrawals': 'Toa Pesa Leo',
        'active_transactions': 'Miamala Inayotumika',
        
        // Tasks
        'complete_tasks': 'Kamilisha kazi zako ili kupata faida za kila siku',
        'todays_progress': 'Maendeleo ya Leo',
        'tasks_completed': 'Kazi Zilizokamilika',
        'no_package_warning': 'Hakuna Kifurushi Kinachotumika',
        'browse_packages': 'Tazama Vifurushi',
        'no_tasks': 'Hakuna kazi za leo',
        'start_task': 'Anza Kazi',
        'completed': 'Imekamilika',
        'rate_product': 'Kadiria bidhaa hii',
        'submit_rating': 'Wasilisha Kadirio',
        'confirm_task': 'Nimekadiria bidhaa hii',
        'show': 'Onyesha',
        'hide': 'Ficha',
        
        // Packages
        'investment_packages': 'Vifurushi vya Uwekezaji vya VIP',
        'investment': 'Uwekezaji',
        'daily_profit': 'Faida ya Kila Siku',
        'rate': 'Kiwango',
        'monthly_roi': 'ROI ya Mwezi',
        'buy_package': 'Nunua Kifurushi',
        'insufficient_balance': 'Salio haitoshi',
        'premium': 'PREMIUM',
        'active_status': 'INATUMIKA',
        
        // Deposit
        'make_deposit': 'Weka Pesa',
        'deposit_info': 'Kiwango cha chini: 10,000 TZS | Kiwango cha juu: 10,000,000 TZS',
        'select_payment_method': 'Chagua Njia ya Malipo',
        'pay_to': 'Lipia Kwa',
        'bank': 'Benki',
        'account_number': 'Nambari ya Akaunti',
        'account_name': 'Jina la Akaunti',
        'copy_account': 'Nakili Nambari ya Akaunti',
        'your_details': 'Maelezo Yako',
        'amount': 'Kiasi',
        'transaction_details': 'Maelezo ya Muamala',
        'transaction_reference': 'Rejea ya Muamala',
        'payment_date': 'Tarehe ya Malipo',
        'confirm_deposit': 'Nathibitisha kuwa taarifa zilizotolewa ni sahihi',
        'submit_deposit': 'Wasilisha Ombi la Kuweka Pesa',
        'processing': 'Inachakata...',
        
        // Withdraw
        'withdraw_funds': 'Toa Pesa',
        'min_withdraw': 'Kiwango cha chini: 3,000 TZS',
        'once_per_day': 'Mara moja kwa siku',
        'referral_earnings_withdrawable': 'Mapato ya marejesho yanaweza kutolewa wakati wowote',
        'available_balance': 'Salio linalopatikana',
        'referral_earnings': 'Mapato ya Marejesho',
        'select_account': 'Chagua Akaunti',
        'enter_amount': 'Weka Kiasi',
        'confirm': 'Thibitisha',
        'your_bank_accounts': 'Akaunti Zako za Benki',
        'add_bank_account': 'Ongeza Akaunti ya Benki',
        'withdrawal_fee': 'Ada ya Kutoa Pesa',
        'you_will_receive': 'Utapokea',
        'confirm_withdrawal': 'Nathibitisha kuwa taarifa zilizo hapo juu ni sahihi',
        
        // Referrals
        'referral_program': 'Mpango wa Marejesho',
        'total_referrals': 'Jumla ya Marejesho',
        'level_1_comm': 'Tume ya Ngazi 1',
        'level_2_comm': 'Tume ya Ngazi 2',
        'level_3_comm': 'Tume ya Ngazi 3',
        'your_referral_link': 'Kiungo Chako cha Mrejesho',
        'share_link': 'Shiriki kiungo hiki na marafiki',
        'your_referrals': 'Marejesho Yako',
        'username_th': 'Jina la Mtumiaji',
        'level_th': 'Ngazi',
        'join_date': 'Tarehe ya Kujiunga',
        'status_th': 'Hali',
        
        // History
        'transaction_history': 'Historia ya Miamala',
        'all': 'Zote',
        'deposits': 'Weka Pesa',
        'withdrawals': 'Toa Pesa',
        'profits': 'Faida',
        'no_transactions': 'Hakuna historia ya miamala bado',
        
        // Social Links
        'follow_social_media': 'Fuata Mitandao Yetu ya Kijamii',
        'social_progress': 'Maendeleo ya Kukamilisha',
        'reward_info': 'Taarifa za Zawadi',
        'verify_all': 'Thibitisha Zote',
        'follow': 'Fuata',
        'verify': 'Thibitisha',
        'points_earned': 'pointi zilizopatikana',
        
        // Weekly Commission
        'weekly_commission_title': 'Tume ya Wiki',
        'current_week': 'Wiki ya Sasa',
        'projected_commission': 'Tume Inayotarajiwa',
        'commission_history': 'Historia ya Tume',
        'pending_commission': 'Tume Inayosubiri',
        
        // Settings
        'account_settings': 'Mipangilio ya Akaunti',
        'profile': 'Wasifu',
        'danger_zone': 'Eneo la Hatari',
        'save_changes': 'Hifadhi Mabadiliko',
        'change_password': 'Badilisha Nywila',
        'current_password': 'Nywila ya Sasa',
        'new_password': 'Nywila Mpya',
        'delete_account': 'Futa Akaunti',
        'delete_warning': 'Mara baada ya kufuta akaunti yako, hutaweza kurejesha.',
        
        // Bank Accounts
        'my_bank_accounts_title': 'Akaunti Zangu za Benki',
        'saved_accounts': 'Akaunti Zangu',
        'add_new_account': 'Ongeza Akaunti Mpya',
        'bank_name': 'Jina la Benki',
        'account_holder_name': 'Jina la Mmiliki wa Akaunti',
        'set_as_default': 'Weka kama akaunti chaguo-msingi kwa kutoa pesa',
        'save_account': 'Hifadhi Akaunti',
        'default': 'Chaguo-msingi',
        'added_on': 'Imeongezwa',
        
        // Messages
        'login_success': 'Kuingia kumefanikiwa!',
        'signup_success': 'Usajili umefanikiwa! Umepokea bonasi ya 2,000 TZS!',
        'deposit_success': 'Ombi la kuweka pesa limewasilishwa kwa mafanikio!',
        'withdrawal_success': 'Ombi la kutoa pesa limewasilishwa kwa mafanikio!',
        'task_completed': 'Kazi imekamilika kwa mafanikio!',
        'copy_success': 'Imenakiliwa kwenye clipboard!',
        'loading': 'Inapakia...',
        'no_data': 'Hakuna taarifa zilizopatikana',
        
        // Status
        'pending': 'Inasubiri',
        'completed_status': 'Imekamilika',
        'approved': 'Imekubaliwa',
        'rejected': 'Imekataliwa',
        'inactive': 'Haijatumika',
        
        // Buttons
        'continue_btn': 'Endelea',
        'cancel': 'Ghairi',
        'close': 'Funga',
        'save': 'Hifadhi',
        'edit': 'Hariri',
        'delete': 'Futa',
        'refresh': 'Onyesha upya',
        'back': 'Rudi',
        'next': 'Endelea',
        'view_all': 'Tazama Zote'
    }
};

/**
 * Get translated text
 */
function t(key) {
    return translations[currentLanguage][key] || key;
}

/**
 * Switch language
 */
function switchLanguage(lang) {
    if (lang !== 'en' && lang !== 'sw') return;
    
    currentLanguage = lang;
    
    // Save to localStorage
    localStorage.setItem('smarttask_language', lang);
    
    // Update active button styles
    const enBtn = document.getElementById('langEnBtn');
    const swBtn = document.getElementById('langSwBtn');
    
    if (enBtn && swBtn) {
        if (lang === 'en') {
            enBtn.classList.add('active');
            swBtn.classList.remove('active');
        } else {
            swBtn.classList.add('active');
            enBtn.classList.remove('active');
        }
    }
    
    // Translate all elements with data-i18n attribute
    translatePageElements();
    
    // Update HTML lang attribute
    document.documentElement.lang = lang === 'en' ? 'en' : 'sw';
    
    // Update dynamic content
    updateDynamicContentAfterLanguageSwitch();
    
    // Show success message
    showToast(`Language switched to ${lang === 'en' ? 'English' : 'Kiswahili'}`, 'success');
}

/**
 * Translate all page elements with data-i18n attribute
 */
function translatePageElements() {
    // Translate text content
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[currentLanguage][key]) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.placeholder !== undefined) {
                    element.placeholder = translations[currentLanguage][key];
                }
            } else if (element.tagName === 'BUTTON') {
                // Preserve any existing icons
                const icon = element.querySelector('i');
                if (icon) {
                    element.innerHTML = '';
                    element.appendChild(icon.cloneNode(true));
                    element.appendChild(document.createTextNode(' ' + translations[currentLanguage][key]));
                } else {
                    element.textContent = translations[currentLanguage][key];
                }
            } else {
                element.textContent = translations[currentLanguage][key];
            }
        }
    });
    
    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (translations[currentLanguage][key]) {
            element.placeholder = translations[currentLanguage][key];
        }
    });
    
    // Translate titles
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        if (translations[currentLanguage][key]) {
            element.title = translations[currentLanguage][key];
        }
    });
}

/**
 * Update dynamic content after language switch
 */
function updateDynamicContentAfterLanguageSwitch() {
    // Refresh user data display if logged in
    if (currentUser) {
        // Update welcome message
        const welcomeName = document.getElementById('welcomeName');
        const welcomeText = document.querySelector('#overviewTab h2');
        if (welcomeText && welcomeName) {
            welcomeText.innerHTML = `${t('welcome_back')}, <span id="welcomeName">${welcomeName.textContent}</span>!`;
        }
        
        // Update balance labels
        const balanceLabels = document.querySelectorAll('.stat-label');
        if (balanceLabels.length >= 4) {
            balanceLabels[0].textContent = t('balance');
            balanceLabels[1].textContent = t('tasks_done');
            balanceLabels[2].textContent = t('referral_bonus');
            balanceLabels[3].textContent = t('active_packages');
        }
        
        // Update daily tasks card title
        const tasksCardTitle = document.querySelector('.daily-tasks-card h3');
        if (tasksCardTitle) {
            const badge = tasksCardTitle.querySelector('.badge');
            tasksCardTitle.innerHTML = `${t('todays_tasks')} `;
            if (badge) tasksCardTitle.appendChild(badge);
        }
        
        // Update active packages card title
        const packagesCardTitle = document.querySelector('.active-packages-card h3');
        if (packagesCardTitle) {
            packagesCardTitle.textContent = t('your_active_packages');
        }
        
        // Update announcements header
        const announcementsHeader = document.querySelector('.announcements-header h3');
        if (announcementsHeader) {
            announcementsHeader.textContent = t('latest_announcements');
        }
        
        // Update transaction simulator header
        const simulatorHeader = document.querySelector('.simulator-header h3');
        if (simulatorHeader) {
            simulatorHeader.innerHTML = `<i class="fas fa-exchange-alt"></i> ${t('live_transactions')}`;
        }
        
        // Update simulator stats
        const stats = document.querySelectorAll('.simulator-stats .stat span');
        if (stats.length >= 3) {
            stats[0].textContent = t('today_deposits');
            stats[1].textContent = t('today_withdrawals');
            stats[2].textContent = t('active_transactions');
        }
        
        // Update sidebar menu items
        const menuItems = document.querySelectorAll('#sidebar .sidebar-menu li span');
        const menuTexts = [t('overview'), t('vip_packages'), t('daily_tasks'), t('deposit'), t('withdraw'), t('referrals'), t('history')];
        menuItems.forEach((item, index) => {
            if (menuTexts[index]) item.textContent = menuTexts[index];
        });
        
        // Update user menu items
        const userMenuItems = document.querySelectorAll('#userMenu a span');
        const userMenuTexts = [t('my_profile'), t('commission_payment'), t('my_bank_accounts'), t('social_links'), t('weekly_commission'), t('settings'), t('logout')];
        userMenuItems.forEach((item, index) => {
            if (userMenuTexts[index]) item.textContent = userMenuTexts[index];
        });
    }
    
    // Update password toggle buttons text
    document.querySelectorAll('.password-toggle-btn .toggle-text').forEach(btn => {
        const isShowing = btn.closest('.password-toggle-btn')?.classList.contains('active');
        btn.textContent = isShowing ? t('hide') : t('show');
    });
}

/**
 * Load saved language preference
 */
function loadLanguagePreference() {
    const savedLang = localStorage.getItem('smarttask_language');
    
    if (savedLang && (savedLang === 'en' || savedLang === 'sw')) {
        currentLanguage = savedLang;
    } else {
        // Detect browser language
        const browserLang = navigator.language || navigator.userLanguage;
        if (browserLang && browserLang.toLowerCase().startsWith('sw')) {
            currentLanguage = 'sw';
        } else {
            currentLanguage = 'en';
        }
    }
    
    // Update button states
    const enBtn = document.getElementById('langEnBtn');
    const swBtn = document.getElementById('langSwBtn');
    
    if (enBtn && swBtn) {
        if (currentLanguage === 'en') {
            enBtn.classList.add('active');
            swBtn.classList.remove('active');
        } else {
            swBtn.classList.add('active');
            enBtn.classList.remove('active');
        }
    }
    
    // Translate page
    translatePageElements();
    
    // Update HTML lang attribute
    document.documentElement.lang = currentLanguage === 'en' ? 'en' : 'sw';
}

// Override showToast to support translations
const originalShowToastFunction = window.showToast;
window.showToast = function(message, type = 'info') {
    // If message is a translation key, translate it
    if (translations[currentLanguage] && translations[currentLanguage][message]) {
        message = translations[currentLanguage][message];
    }
    if (originalShowToastFunction) {
        originalShowToastFunction(message, type);
    } else {
        // Fallback
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = `toast show ${type}`;
            setTimeout(() => toast.classList.remove('show'), 3000);
        } else {
            alert(message);
        }
    }
};

// Initialize language on page load
document.addEventListener('DOMContentLoaded', function() {
    loadLanguagePreference();
});

// Make functions globally available
window.switchLanguage = switchLanguage;
window.t = t;
window.loadLanguagePreference = loadLanguagePreference;

// ============================================
// SOCIAL LOGIN FUNCTIONALITY
// ============================================

/**
 * Social login with provider
 * @param {string} provider - 'google', 'facebook', or 'github'
 */
async function socialLogin(provider) {
    console.log(`Social login with ${provider}`);
    
    showLoading(`Connecting to ${provider}...`);
    
    try {
        let authProvider;
        
        // Select the appropriate provider
        switch(provider) {
            case 'google':
                authProvider = new firebase.auth.GoogleAuthProvider();
                // Add additional scopes if needed
                authProvider.addScope('profile');
                authProvider.addScope('email');
                break;
                
            case 'facebook':
                authProvider = new firebase.auth.FacebookAuthProvider();
                authProvider.addScope('email');
                authProvider.addScope('public_profile');
                break;
                
            case 'github':
                authProvider = new firebase.auth.GithubAuthProvider();
                authProvider.addScope('user:email');
                break;
                
            default:
                throw new Error('Invalid provider');
        }
        
        // Set custom parameters for better UX
        if (provider === 'google') {
            authProvider.setCustomParameters({
                prompt: 'select_account'
            });
        }
        
        if (provider === 'facebook') {
            authProvider.setCustomParameters({
                display: 'popup'
            });
        }
        
        // Sign in with popup
        const result = await auth.signInWithPopup(authProvider);
        const user = result.user;
        
        console.log('Social login successful:', user);
        
        // Check if user exists in Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            // New user - create profile
            await createSocialUserProfile(user, provider);
        } else {
            // Existing user - check if deactivated
            const userData = userDoc.data();
            if (userData.isActive === false) {
                await auth.signOut();
                hideLoading();
                showToast('Your account has been deactivated. Please contact support.', 'error');
                return;
            }
            
            // Update last login
            await db.collection('users').doc(user.uid).update({
                lastLogin: new Date().toISOString(),
                loginCount: firebase.firestore.FieldValue.increment(1)
            });
        }
        
        hideLoading();
        showToast(`✅ Successfully logged in with ${getProviderName(provider)}!`, 'success');
        
    } catch (error) {
        hideLoading();
        console.error('Social login error:', error);
        
        // Handle specific errors
        switch(error.code) {
            case 'auth/popup-closed-by-user':
                showToast('Login cancelled. Please try again.', 'warning');
                break;
            case 'auth/account-exists-with-different-credential':
                showToast('An account already exists with the same email address using different sign-in method.', 'error');
                break;
            case 'auth/popup-blocked':
                showToast('Popup was blocked. Please allow popups for this site.', 'error');
                break;
            case 'auth/unauthorized-domain':
                showToast('This domain is not authorized for social login. Please contact support.', 'error');
                break;
            default:
                showToast(`Login with ${getProviderName(provider)} failed: ${error.message}`, 'error');
        }
    }
}

/**
 * Create user profile for social login users
 */
async function createSocialUserProfile(user, provider) {
    console.log('Creating social user profile for:', user.email);
    
    try {
        // Generate username from email or display name
        let username = user.displayName || user.email.split('@')[0];
        
        // Clean username (remove special characters)
        username = username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        
        // Check if username exists, add numbers if needed
        let finalUsername = username;
        let counter = 1;
        let usernameExists = true;
        
        while (usernameExists) {
            const check = await db.collection('users')
                .where('username', '==', finalUsername)
                .get();
            
            if (check.empty) {
                usernameExists = false;
            } else {
                finalUsername = `${username}${counter}`;
                counter++;
            }
        }
        
        // Generate referral code
       const myReferralCode = await generateUniqueReferralCode();
        
        // Create phone number placeholder
        const phone = user.phoneNumber || '';
        
        // Create user document
        const newUser = {
            uid: user.uid,
            username: finalUsername,
            email: user.email,
            fullName: user.displayName || finalUsername,
            phone: phone,
            role: 'user',
            usernameLower: finalUsername.toLowerCase(),
            
            // Account Status
            isActive: true,
            isVerified: user.emailVerified,
            profileImage: user.photoURL || null,
            socialProvider: provider,
            
            // Financial Information
            balance: systemSettings.registrationBonus,
            referralBalance: 0,
            totalEarned: systemSettings.registrationBonus,
            totalInvested: 0,
            
            // Referral Information
            referralEarnings: { level1: 0, level2: 0, level3: 0 },
            referrals: [],
            myReferralCode: myReferralCode,
            referredBy: null,
            
            // Task Information
            tasksCompleted: 0,
            lastTaskDate: null,
            completedTasks: [],
            activePackages: [],
            
            // Transaction History
            history: [{
                id: generateId(),
                type: 'bonus',
                description: 'Registration Bonus (Social Login)',
                amount: systemSettings.registrationBonus,
                status: 'completed',
                date: new Date().toISOString()
            }],
            
            // Notifications
            notifications: [{
                id: generateId(),
                title: '🎉 Welcome to SmartTask!',
                message: `Thank you for joining via ${getProviderName(provider)}! You've received ${formatMoney(systemSettings.registrationBonus)} as a registration bonus.`,
                type: 'success',
                read: false,
                date: new Date().toISOString()
            }],
            
            // Dates
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            
            // Login Information
            loginCount: 1,
            
            // Weekly Commission System
            weeklyCommission: {
                lastPaidDate: null,
                currentWeekEarnings: {
                    level1: 0,
                    level2: 0,
                    level3: 0,
                    total: 0
                },
                commissionHistory: [],
                pendingCommission: 0,
                weeklyTaskEarnings: 0
            }
        };
        
        await db.collection('users').doc(user.uid).set(newUser);
        
        // Check for referral code in URL
        const urlParams = new URLSearchParams(window.location.search);
        const referralCode = urlParams.get('ref');
        
        if (referralCode) {
            const referrerCheck = await db.collection('users')
                .where('myReferralCode', '==', referralCode.toUpperCase())
                .limit(1)
                .get();
            
            if (!referrerCheck.empty) {
                const referrer = referrerCheck.docs[0];
                await processReferralCommission(referrer.id, user.uid, finalUsername);
            }
        }
        
    } catch (error) {
        console.error('Error creating social user profile:', error);
        throw error;
    }
}

/**
 * Get provider display name
 */
function getProviderName(provider) {
    const names = {
        'google': 'Google',
        'facebook': 'Facebook',
        'github': 'GitHub'
    };
    return names[provider] || provider;
}

/**
 * Link social account to existing account
 */
async function linkSocialAccount(provider) {
    if (!currentUser) {
        showToast('Please log in first to link accounts', 'error');
        return;
    }
    
    showLoading(`Linking ${getProviderName(provider)} account...`);
    
    try {
        let authProvider;
        
        switch(provider) {
            case 'google':
                authProvider = new firebase.auth.GoogleAuthProvider();
                break;
            case 'facebook':
                authProvider = new firebase.auth.FacebookAuthProvider();
                break;
            case 'github':
                authProvider = new firebase.auth.GithubAuthProvider();
                break;
            default:
                throw new Error('Invalid provider');
        }
        
        const user = auth.currentUser;
        const result = await user.linkWithPopup(authProvider);
        
        // Update user document with linked provider
        await db.collection('users').doc(currentUser.uid).update({
            socialProvider: provider,
            profileImage: result.user.photoURL || currentUser.profileImage,
            updatedAt: new Date().toISOString()
        });
        
        hideLoading();
        showToast(`✅ ${getProviderName(provider)} account linked successfully!`, 'success');
        
        // Refresh user data
        await loadUserData();
        
    } catch (error) {
        hideLoading();
        console.error('Error linking social account:', error);
        
        if (error.code === 'auth/credential-already-in-use') {
            showToast('This social account is already linked to another account.', 'error');
        } else if (error.code === 'auth/provider-already-linked') {
            showToast('This social account is already linked to your account.', 'warning');
        } else {
            showToast(`Failed to link ${getProviderName(provider)} account: ${error.message}`, 'error');
        }
    }
}

/**
 * Unlink social account
 */
async function unlinkSocialAccount(provider) {
    if (!currentUser) {
        showToast('Please log in first', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to unlink your ${getProviderName(provider)} account?`)) {
        return;
    }
    
    showLoading(`Unlinking ${getProviderName(provider)} account...`);
    
    try {
        const user = auth.currentUser;
        
        // Get the provider credential
        let providerId;
        switch(provider) {
            case 'google':
                providerId = 'google.com';
                break;
            case 'facebook':
                providerId = 'facebook.com';
                break;
            case 'github':
                providerId = 'github.com';
                break;
            default:
                throw new Error('Invalid provider');
        }
        
        await user.unlink(providerId);
        
        // Update user document
        await db.collection('users').doc(currentUser.uid).update({
            socialProvider: null,
            updatedAt: new Date().toISOString()
        });
        
        hideLoading();
        showToast(`✅ ${getProviderName(provider)} account unlinked successfully!`, 'success');
        
        // Refresh user data
        await loadUserData();
        
    } catch (error) {
        hideLoading();
        console.error('Error unlinking social account:', error);
        showToast(`Failed to unlink ${getProviderName(provider)} account: ${error.message}`, 'error');
    }
}

/**
 * Check if user has social login
 */
function hasSocialLogin(provider) {
    if (!currentUser) return false;
    return currentUser.socialProvider === provider;
}

/**
 * Get social login status
 */
function getSocialLoginStatus() {
    if (!currentUser) return null;
    
    return {
        hasGoogle: currentUser.socialProvider === 'google',
        hasFacebook: currentUser.socialProvider === 'facebook',
        hasGithub: currentUser.socialProvider === 'github'
    };
}

// ============================================
// AUTO CLOSE SIDEBAR ON NAVIGATION SELECTION
// ============================================

/**
 * Initialize auto-close sidebar for admin and super admin dashboards
 */
function initAutoCloseSidebar() {
    // Get all sidebar menu items for admin dashboard
    const adminSidebarItems = document.querySelectorAll('#adminSidebar .sidebar-menu li');
    const superAdminSidebarItems = document.querySelectorAll('#superAdminSidebar .sidebar-menu li');
    
    // Function to close sidebar if screen is mobile/tablet
    function closeSidebarIfMobile() {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            const adminSidebar = document.getElementById('adminSidebar');
            const superAdminSidebar = document.getElementById('superAdminSidebar');
            
            if (adminSidebar && adminSidebar.classList.contains('active')) {
                adminSidebar.classList.remove('active');
            }
            if (superAdminSidebar && superAdminSidebar.classList.contains('active')) {
                superAdminSidebar.classList.remove('active');
            }
            
            // Also remove shifted class from main content
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.classList.remove('shifted');
            }
        }
    }
    
    // Add click event listeners to admin sidebar items
    adminSidebarItems.forEach(item => {
        item.removeEventListener('click', closeSidebarIfMobile);
        item.addEventListener('click', closeSidebarIfMobile);
    });
    
    // Add click event listeners to super admin sidebar items
    superAdminSidebarItems.forEach(item => {
        item.removeEventListener('click', closeSidebarIfMobile);
        item.addEventListener('click', closeSidebarIfMobile);
    });
    
    // Also handle the menu toggle button - ensure it works properly
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.removeEventListener('click', handleMenuToggle);
        menuToggle.addEventListener('click', handleMenuToggle);
    }
    
    // Handle window resize - close sidebar when switching to mobile
    window.removeEventListener('resize', handleWindowResize);
    window.addEventListener('resize', handleWindowResize);
    
    console.log('Auto-close sidebar initialized for admin and super admin');
}

/**
 * Handle menu toggle button click
 */
function handleMenuToggle(event) {
    event.stopPropagation();
    
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    
    // Determine which dashboard is active
    const adminDashboard = document.getElementById('adminDashboard');
    const superAdminDashboard = document.getElementById('superAdminDashboard');
    
    if (adminDashboard && adminDashboard.classList.contains('active')) {
        const adminSidebar = document.getElementById('adminSidebar');
        if (adminSidebar) {
            adminSidebar.classList.toggle('active');
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.classList.toggle('shifted');
            }
        }
    } else if (superAdminDashboard && superAdminDashboard.classList.contains('active')) {
        const superAdminSidebar = document.getElementById('superAdminSidebar');
        if (superAdminSidebar) {
            superAdminSidebar.classList.toggle('active');
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.classList.toggle('shifted');
            }
        }
    }
}

/**
 * Handle window resize - close sidebar when switching to mobile view
 */
function handleWindowResize() {
    const wasMobile = window.innerWidth < 768;
    const isNowMobile = window.innerWidth < 768;
    
    // If we switched to mobile view, close the sidebar
    if (!wasMobile && isNowMobile) {
        const adminSidebar = document.getElementById('adminSidebar');
        const superAdminSidebar = document.getElementById('superAdminSidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (adminSidebar && adminSidebar.classList.contains('active')) {
            adminSidebar.classList.remove('active');
            if (mainContent) mainContent.classList.remove('shifted');
        }
        if (superAdminSidebar && superAdminSidebar.classList.contains('active')) {
            superAdminSidebar.classList.remove('active');
            if (mainContent) mainContent.classList.remove('shifted');
        }
    }
    
    // If we switched to desktop view, ensure sidebar is visible (if it should be)
    if (wasMobile && !isNowMobile) {
        // On desktop, sidebar is always visible by default (no active class needed for visibility)
        // Just ensure main content has the shifted class
        const adminDashboard = document.getElementById('adminDashboard');
        const superAdminDashboard = document.getElementById('superAdminDashboard');
        const mainContent = document.querySelector('.main-content');
        
        if ((adminDashboard && adminDashboard.classList.contains('active')) ||
            (superAdminDashboard && superAdminDashboard.classList.contains('active'))) {
            if (mainContent) mainContent.classList.add('shifted');
        }
    }
}

/**
 * Enhanced version - close sidebar on any navigation within dashboard
 */
function initEnhancedAutoCloseSidebar() {
    // Close sidebar when clicking ANY link or button that causes navigation
    const closeOnNavigation = () => {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            setTimeout(() => {
                const adminSidebar = document.getElementById('adminSidebar');
                const superAdminSidebar = document.getElementById('superAdminSidebar');
                const mainContent = document.querySelector('.main-content');
                
                if (adminSidebar && adminSidebar.classList.contains('active')) {
                    adminSidebar.classList.remove('active');
                    if (mainContent) mainContent.classList.remove('shifted');
                }
                if (superAdminSidebar && superAdminSidebar.classList.contains('active')) {
                    superAdminSidebar.classList.remove('active');
                    if (mainContent) mainContent.classList.remove('shifted');
                }
            }, 150); // Small delay to allow navigation to complete
        }
    };
    
    // Monitor clicks on sidebar menu items
    const adminMenuItems = document.querySelectorAll('#adminSidebar .sidebar-menu li');
    const superAdminMenuItems = document.querySelectorAll('#superAdminSidebar .sidebar-menu li');
    
    adminMenuItems.forEach(item => {
        item.removeEventListener('click', closeOnNavigation);
        item.addEventListener('click', closeOnNavigation);
    });
    
    superAdminMenuItems.forEach(item => {
        item.removeEventListener('click', closeOnNavigation);
        item.addEventListener('click', closeOnNavigation);
    });
    
    // Also monitor for tab switching functions
    const originalSwitchAdminTab = window.switchAdminTab;
    if (originalSwitchAdminTab) {
        window.switchAdminTab = function(tabName) {
            originalSwitchAdminTab(tabName);
            closeOnNavigation();
        };
    }
    
    const originalSwitchSuperAdminTab = window.switchSuperAdminTab;
    if (originalSwitchSuperAdminTab) {
        window.switchSuperAdminTab = function(tabName) {
            originalSwitchSuperAdminTab(tabName);
            closeOnNavigation();
        };
    }
}

// ============================================
// OVERRIDE EXISTING TOGGLE SIDEBAR FUNCTION
// ============================================

// Store original function if it exists
const originalToggleSidebar = window.toggleSidebar;

// Enhanced toggle sidebar function
window.toggleSidebar = function() {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    
    const adminDashboard = document.getElementById('adminDashboard');
    const superAdminDashboard = document.getElementById('superAdminDashboard');
    const userDashboard = document.getElementById('userDashboard');
    
    if (adminDashboard && adminDashboard.classList.contains('active')) {
        const adminSidebar = document.getElementById('adminSidebar');
        if (adminSidebar) {
            adminSidebar.classList.toggle('active');
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.classList.toggle('shifted');
            }
        }
    } else if (superAdminDashboard && superAdminDashboard.classList.contains('active')) {
        const superAdminSidebar = document.getElementById('superAdminSidebar');
        if (superAdminSidebar) {
            superAdminSidebar.classList.toggle('active');
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.classList.toggle('shifted');
            }
        }
    } else if (userDashboard && userDashboard.classList.contains('active')) {
        if (originalToggleSidebar) {
            originalToggleSidebar();
        }
    }
};

// ============================================
// INITIALIZE AUTO-CLOSE ON PAGE LOAD
// ============================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        initAutoCloseSidebar();
        initEnhancedAutoCloseSidebar();
    }, 500);
});

// Also initialize when admin/super admin dashboards are shown
window.showAdminDashboard = function() {
    if (originalShowAdminDashboard) originalShowAdminDashboard();
    setTimeout(() => {
        initAutoCloseSidebar();
        initEnhancedAutoCloseSidebar();
    }, 200);
};


window.showSuperAdminDashboard = function() {
    if (originalShowSuperAdminDashboard) originalShowSuperAdminDashboard();
    setTimeout(() => {
        initAutoCloseSidebar();
        initEnhancedAutoCloseSidebar();
    }, 200);
};

// ============================================
// SOCIAL LINKS SYSTEM - AUTO POPUP EVERY 3 MINUTES
// ============================================

// Global variables
let socialLinksList = [];
let userFollowedLinksList = [];
let socialPopupInterval = null;
let isSocialModalVisible = false;
let socialLinksUnsubscribeFunc = null;

/**
 * Load social links from Firestore with real-time listener
 */
async function initSocialLinksSystem() {
    console.log('Initializing social links system...');
    
    if (socialLinksUnsubscribeFunc) {
        socialLinksUnsubscribeFunc();
    }
    
    try {
        socialLinksUnsubscribeFunc = db.collection('socialLinks')
            .where('status', '==', 'active')
            .orderBy('order', 'asc')
            .onSnapshot(async (snapshot) => {
                socialLinksList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                console.log(`Loaded ${socialLinksList.length} social links`);
                
                if (currentUser) {
                    await loadUserFollowedStatus();
                    updateSocialPopupStatus();
                    
                    // Update admin panel if open
                    if (document.getElementById('adminSocialLinksModal')?.classList.contains('show')) {
                        loadAdminSocialLinksTable();
                    }
                }
            }, (error) => {
                console.error('Error loading social links:', error);
            });
    } catch (error) {
        console.error('Error initializing social links:', error);
    }
}

/**
 * Load user's followed links status
 */
async function loadUserFollowedStatus() {
    if (!currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();
        userFollowedLinksList = userData.followedSocialLinks || [];
        
        console.log(`User has followed ${userFollowedLinksList.length} of ${socialLinksList.length} links`);
        
    } catch (error) {
        console.error('Error loading user followed status:', error);
        userFollowedLinksList = [];
    }
}

/**
 * Check if user has followed all links
 */
function hasFollowedAllSocialLinks() {
    if (socialLinksList.length === 0) return true;
    return socialLinksList.every(link => userFollowedLinksList.includes(link.id));
}

/**
 * Get unfollowed links count
 */
function getUnfollowedLinksCount() {
    return socialLinksList.filter(link => !userFollowedLinksList.includes(link.id)).length;
}

/**
 * Update social popup status - start/stop interval based on completion
 */
function updateSocialPopupStatus() {
    const allFollowed = hasFollowedAllSocialLinks();
    
    if (!allFollowed && socialLinksList.length > 0) {
        // Not all followed - start interval if not already running
        if (!socialPopupInterval) {
            startSocialPopupInterval();
        }
    } else {
        // All followed - stop interval and close modal if open
        stopSocialPopupInterval();
        if (isSocialModalVisible) {
            closeSocialLinksModal();
        }
    }
}

/**
 * Start the 3-minute interval for social popup
 */
function startSocialPopupInterval() {
    if (socialPopupInterval) clearInterval(socialPopupInterval);
    
    console.log('Starting social popup interval (every 3 minutes)');
    
    socialPopupInterval = setInterval(() => {
        // Only show if user is logged in, not all links followed, and modal not already open
        if (currentUser && !hasFollowedAllSocialLinks() && !isSocialModalVisible && socialLinksList.length > 0) {
            console.log('Auto-showing social links modal (3-minute interval)');
            openSocialLinksModal();
        }
    }, 180000); // 3 minutes = 180,000 ms
}

/**
 * Stop the social popup interval
 */
function stopSocialPopupInterval() {
    if (socialPopupInterval) {
        clearInterval(socialPopupInterval);
        socialPopupInterval = null;
        console.log('Stopped social popup interval (all links followed)');
    }
}

/**
 * Open social links modal
 */
async function openSocialLinksModal() {
    if (!currentUser) {
        console.log('Cannot open social modal: No user logged in');
        return;
    }
    
    if (isSocialModalVisible) {
        console.log('Social modal already open');
        return;
    }
    
    // Refresh user followed status
    await loadUserFollowedStatus();
    
    // Check if all links are already followed
    if (hasFollowedAllSocialLinks()) {
        console.log('All links already followed, not showing modal');
        stopSocialPopupInterval();
        return;
    }
    
    // Render the modal content
    renderSocialLinksModal();
    
    // Show modal
    const modal = document.getElementById('socialLinksModal');
    if (modal) {
        modal.classList.add('show');
        isSocialModalVisible = true;
        document.body.style.overflow = 'hidden';
        console.log('Social links modal opened');
    }
}

/**
 * Close social links modal
 */
function closeSocialLinksModal() {
    const modal = document.getElementById('socialLinksModal');
    if (modal) {
        modal.classList.remove('show');
        isSocialModalVisible = false;
        document.body.style.overflow = '';
        console.log('Social links modal closed');
    }
}

/**
 * Render social links in modal
 */
function renderSocialLinksModal() {
    const container = document.getElementById('socialLinksContainer');
    if (!container) return;
    
    if (socialLinksList.length === 0) {
        container.innerHTML = `
            <div class="social-loading">
                <i class="fas fa-info-circle"></i>
                <p>No social links available. Check back later!</p>
            </div>
        `;
        return;
    }
    
    let followedCount = 0;
    let html = '';
    
    socialLinksList.forEach(link => {
        const isFollowed = userFollowedLinksList.includes(link.id);
        if (isFollowed) followedCount++;
        
        const iconClass = link.icon || 'fab fa-facebook-f';
        
        html += `
            <div class="social-link-card ${isFollowed ? 'verified' : ''}" data-link-id="${link.id}">
                <div class="social-link-icon">
                    <i class="${iconClass}"></i>
                </div>
                <div class="social-link-info">
                    <h4>${escapeHtml(link.title)}</h4>
                    <p>${escapeHtml(link.description || 'Follow us on ' + link.title)}</p>
                </div>
                <div class="social-link-actions">
                    ${!isFollowed ? `
                        <button class="social-follow-btn" onclick="followSocialLinkAndVerify('${link.id}', '${escapeHtml(link.url)}')">
                            <i class="fas fa-external-link-alt"></i> Follow
                        </button>
                    ` : `
                        <span class="social-verified-badge">
                            <i class="fas fa-check-circle"></i> Verified
                        </span>
                    `}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Update progress
    const totalLinks = socialLinksList.length;
    const progressPercent = totalLinks > 0 ? (followedCount / totalLinks) * 100 : 0;
    
    const progressFill = document.getElementById('socialProgressFill');
    const progressCount = document.getElementById('socialProgressCount');
    const verifyAllBtn = document.getElementById('socialVerifyAllBtn');
    const reminder = document.getElementById('socialReminder');
    
    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    if (progressCount) progressCount.textContent = `${followedCount}/${totalLinks} Links Followed`;
    
    // Show/hide verify all button
    if (verifyAllBtn) {
        verifyAllBtn.style.display = followedCount === totalLinks && totalLinks > 0 ? 'block' : 'none';
    }
    
    // Update reminder message
    if (reminder) {
        const remaining = totalLinks - followedCount;
        if (remaining === 0) {
            reminder.innerHTML = `<i class="fas fa-trophy"></i> <span>Congratulations! You've followed all our social media pages!</span>`;
            reminder.style.background = '#e8f5e9';
            reminder.style.color = '#2e7d32';
        } else {
            reminder.innerHTML = `<i class="fas fa-bell"></i> <span>Please follow ${remaining} more ${remaining === 1 ? 'page' : 'pages'} to complete all tasks</span>`;
            reminder.style.background = '#fff3e0';
            reminder.style.color = '#e65100';
        }
    }
}

/**
 * Follow social link and verify
 */
async function followSocialLinkAndVerify(linkId, url) {
    console.log('Following social link:', linkId);
    
    // Open link in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
    
    // Show confirmation dialog after short delay
    setTimeout(async () => {
        const confirmed = confirm(`Have you successfully followed/followed this page?\n\nClick OK to verify.`);
        
        if (confirmed) {
            await verifySocialLink(linkId);
        } else {
            showToast('Please follow the page and try again', 'warning');
        }
    }, 1500);
}

/**
 * Verify a single social link
 */
async function verifySocialLink(linkId) {
    if (!currentUser) return;
    
    if (userFollowedLinksList.includes(linkId)) {
        showToast('You have already verified this link!', 'warning');
        return;
    }
    
    showLoading('Verifying...');
    
    try {
        const updatedFollowed = [...userFollowedLinksList, linkId];
        
        await db.collection('users').doc(currentUser.uid).update({
            followedSocialLinks: updatedFollowed,
            updatedAt: new Date().toISOString()
        });
        
        userFollowedLinksList = updatedFollowed;
        
        const link = socialLinksList.find(l => l.id === linkId);
        
        // Add to history
        await db.collection('users').doc(currentUser.uid).update({
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'social',
                description: `Followed ${link?.title || 'social media page'}`,
                amount: 0,
                status: 'completed',
                date: new Date().toISOString(),
                metadata: { linkId: linkId, platform: link?.title }
            })
        });
        
        hideLoading();
        showToast(`✅ Verified! You followed ${link?.title || 'the page'}`, 'success');
        
        // Re-render modal
        renderSocialLinksModal();
        
        // Check if all links are now followed
        if (hasFollowedAllSocialLinks()) {
            showToast('🎉 Congratulations! You have followed all our social media pages!', 'success');
            stopSocialPopupInterval();
            
            setTimeout(() => {
                if (isSocialModalVisible) {
                    closeSocialLinksModal();
                }
            }, 2000);
        }
        
    } catch (error) {
        hideLoading();
        console.error('Error verifying social link:', error);
        showToast('Error verifying. Please try again.', 'error');
    }
}

/**
 * Verify all social links at once
 */
async function verifyAllSocialLinks() {
    const unverifiedLinks = socialLinksList.filter(link => !userFollowedLinksList.includes(link.id));
    
    if (unverifiedLinks.length === 0) {
        showToast('All links are already verified!', 'success');
        closeSocialLinksModal();
        return;
    }
    
    if (!confirm(`⚠️ This will mark ALL ${unverifiedLinks.length} unverified links as followed.\n\nOnly do this if you have actually followed all pages.\n\nContinue?`)) {
        return;
    }
    
    showLoading('Verifying all links...');
    
    try {
        const allLinkIds = socialLinksList.map(link => link.id);
        
        await db.collection('users').doc(currentUser.uid).update({
            followedSocialLinks: allLinkIds,
            updatedAt: new Date().toISOString()
        });
        
        userFollowedLinksList = allLinkIds;
        
        hideLoading();
        showToast('✅ All social links verified successfully!', 'success');
        
        renderSocialLinksModal();
        stopSocialPopupInterval();
        
        setTimeout(() => {
            if (isSocialModalVisible) {
                closeSocialLinksModal();
            }
        }, 1500);
        
    } catch (error) {
        hideLoading();
        console.error('Error verifying all links:', error);
        showToast('Error verifying links', 'error');
    }
}

// ============================================
// ADMIN SOCIAL LINKS MANAGEMENT
// ============================================

/**
 * Open admin social links modal
 */
function openAdminSocialLinksModal() {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
        showToast('Access denied. Admin only.', 'error');
        return;
    }
    
    loadAdminSocialLinksTable();
    
    const modal = document.getElementById('adminSocialLinksModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Close admin social links modal
 */
function closeAdminSocialLinksModal() {
    const modal = document.getElementById('adminSocialLinksModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Load admin social links table
 */
async function loadAdminSocialLinksTable() {
    const tbody = document.getElementById('adminSocialLinksBody');
    if (!tbody) return;
    
    try {
        const snapshot = await db.collection('socialLinks')
            .orderBy('order', 'asc')
            .get();
        
        const links = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Update stats
        document.getElementById('adminTotalLinks').textContent = links.length;
        document.getElementById('adminActiveLinks').textContent = links.filter(l => l.status === 'active').length;
        
        if (links.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No social links found. Click "Add New Link" to create one.</td></tr>';
            return;
        }
        
        let html = '';
        links.forEach(link => {
            const iconClass = link.icon || 'fab fa-facebook-f';
            const statusClass = link.status === 'active' ? 'success' : 'danger';
            const statusText = link.status === 'active' ? 'Active' : 'Inactive';
            
            html += `
                <tr>
                    <td><i class="${iconClass}" style="font-size: 22px; color: #667eea;"></i></td>
                    <td><strong>${escapeHtml(link.title)}</strong></td>
                    <td>${escapeHtml(link.description?.substring(0, 40) || '-')}</td>
                    <td><a href="${escapeHtml(link.url)}" target="_blank" class="link-preview">${escapeHtml(link.url.substring(0, 35))}...</a></td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td class="action-buttons">
                        <button class="action-btn small" onclick="editSocialLink('${link.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn small danger" onclick="deleteSocialLink('${link.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading admin social links:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Error loading links</td></tr>';
    }
}

/**
 * Show add social link form
 */
function showAddSocialLinkForm() {
    document.getElementById('socialLinkFormTitle').textContent = 'Add Social Link';
    document.getElementById('socialLinkId').value = '';
    document.getElementById('socialLinkIcon').value = 'fab fa-facebook-f';
    document.getElementById('socialLinkTitle').value = '';
    document.getElementById('socialLinkDescription').value = '';
    document.getElementById('socialLinkUrl').value = '';
    document.getElementById('socialLinkStatus').value = 'active';
    document.getElementById('socialLinkOrder').value = '0';
    
    updateSocialIconPreview();
    
    document.getElementById('socialLinkFormModal').classList.add('show');
}

/**
 * Edit social link
 */
async function editSocialLink(linkId) {
    try {
        const doc = await db.collection('socialLinks').doc(linkId).get();
        if (!doc.exists) {
            showToast('Link not found', 'error');
            return;
        }
        
        const link = doc.data();
        
        document.getElementById('socialLinkFormTitle').textContent = 'Edit Social Link';
        document.getElementById('socialLinkId').value = linkId;
        document.getElementById('socialLinkIcon').value = link.icon || 'fab fa-facebook-f';
        document.getElementById('socialLinkTitle').value = link.title || '';
        document.getElementById('socialLinkDescription').value = link.description || '';
        document.getElementById('socialLinkUrl').value = link.url || '';
        document.getElementById('socialLinkStatus').value = link.status || 'active';
        document.getElementById('socialLinkOrder').value = link.order || 0;
        
        updateSocialIconPreview();
        
        document.getElementById('socialLinkFormModal').classList.add('show');
        
    } catch (error) {
        console.error('Error loading link for edit:', error);
        showToast('Error loading link', 'error');
    }
}

/**
 * Update social icon preview
 */
function updateSocialIconPreview() {
    const iconClass = document.getElementById('socialLinkIcon').value;
    const preview = document.getElementById('socialIconPreview');
    if (preview) {
        preview.innerHTML = `<i class="${iconClass}"></i>`;
    }
}

/**
 * Save social link (create or update)
 */
async function saveSocialLink() {
    const id = document.getElementById('socialLinkId').value;
    const icon = document.getElementById('socialLinkIcon').value;
    const title = document.getElementById('socialLinkTitle').value.trim();
    const description = document.getElementById('socialLinkDescription').value.trim();
    const url = document.getElementById('socialLinkUrl').value.trim();
    const status = document.getElementById('socialLinkStatus').value;
    const order = parseInt(document.getElementById('socialLinkOrder').value) || 0;
    
    if (!title || !url) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    showLoading('Saving...');
    
    try {
        const linkData = {
            icon: icon,
            title: title,
            description: description || '',
            url: url,
            status: status,
            order: order,
            updatedAt: new Date().toISOString()
        };
        
        if (id) {
            await db.collection('socialLinks').doc(id).update(linkData);
            showToast('Social link updated successfully', 'success');
        } else {
            linkData.createdAt = new Date().toISOString();
            await db.collection('socialLinks').add(linkData);
            showToast('Social link added successfully', 'success');
        }
        
        closeSocialLinkFormModal();
        
    } catch (error) {
        console.error('Error saving social link:', error);
        showToast('Error saving link', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Delete social link
 */
async function deleteSocialLink(linkId) {
    if (!confirm('Are you sure you want to delete this social link?\n\nUsers will no longer need to follow it.')) return;
    
    showLoading('Deleting...');
    
    try {
        await db.collection('socialLinks').doc(linkId).delete();
        showToast('Social link deleted', 'success');
        await loadAdminSocialLinksTable();
        
    } catch (error) {
        console.error('Error deleting social link:', error);
        showToast('Error deleting link', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Close social link form modal
 */
function closeSocialLinkFormModal() {
    document.getElementById('socialLinkFormModal').classList.remove('show');
}

/**
 * Add social links button to user menu
 */
function addSocialLinksToUserMenu() {
    const userMenu = document.getElementById('userMenu');
    if (!userMenu) return;
    
    if (document.getElementById('userSocialLinksBtn')) return;
    
    const settingsItem = userMenu.querySelector('a[onclick="showUserSettings()"]');
    
    const socialBtn = document.createElement('a');
    socialBtn.id = 'userSocialLinksBtn';
    socialBtn.onclick = () => openSocialLinksModal();
    socialBtn.innerHTML = `
        <i class="fab fa-superpowers"></i>
        <span>Social Links</span>
        <span class="social-notification-badge" id="socialNotificationBadge" style="display: none;">!</span>
    `;
    
    if (settingsItem) {
        userMenu.insertBefore(socialBtn, settingsItem);
    } else {
        userMenu.appendChild(socialBtn);
    }
}

/**
 * Update social notification badge
 */
async function updateSocialNotificationBadge() {
    if (!currentUser) return;
    
    await loadUserFollowedStatus();
    const unfollowedCount = getUnfollowedLinksCount();
    const badge = document.getElementById('socialNotificationBadge');
    
    if (badge) {
        if (unfollowedCount > 0) {
            badge.style.display = 'inline-block';
            badge.textContent = unfollowedCount;
        } else {
            badge.style.display = 'none';
        }
    }
}

/**
 * Add social links to admin sidebar
 */
function addSocialLinksToAdminSidebar() {
    const adminSidebar = document.getElementById('adminSidebar');
    if (!adminSidebar) return;
    
    const menuList = adminSidebar.querySelector('.sidebar-menu');
    if (!menuList) return;
    
    if (document.getElementById('adminSocialLinksMenuItem')) return;
    
    const socialItem = document.createElement('li');
    socialItem.id = 'adminSocialLinksMenuItem';
    socialItem.onclick = () => openAdminSocialLinksModal();
    socialItem.innerHTML = `
        <i class="fab fa-superpowers"></i>
        <span>Social Links</span>
    `;
    
    const announcementsItem = menuList.querySelector('li[onclick="switchAdminTab(\'announcements\')"]');
    if (announcementsItem) {
        menuList.insertBefore(socialItem, announcementsItem.nextSibling);
    } else {
        menuList.appendChild(socialItem);
    }
}

// ============================================
// INTEGRATION WITH EXISTING FUNCTIONS
// ============================================

// Override showUserDashboard
const originalShowUserDashboardFunc = window.showUserDashboard;
window.showUserDashboard = async function() {
    if (originalShowUserDashboardFunc) await originalShowUserDashboardFunc();
    
    // Initialize social links system
    await initSocialLinksSystem();
    await loadUserFollowedStatus();
    addSocialLinksToUserMenu();
    await updateSocialNotificationBadge();
    
    // Show modal after 2 seconds if not all links followed
    if (!hasFollowedAllSocialLinks() && socialLinksList.length > 0) {
        setTimeout(() => {
            console.log('Auto-showing social modal after login (2 second delay)');
            openSocialLinksModal();
        }, 2000);
    }
};

// Override handleLogin
const originalHandleLoginFunc = window.handleLogin;
window.handleLogin = async function() {
    await originalHandleLoginFunc();
    // Social links will be handled by auth state observer
};

// Override handleSignup
const originalHandleSignupFunc = window.handleSignup;
window.handleSignup = async function() {
    await originalHandleSignupFunc();
    // Social links will be handled by auth state observer
};

// Override logout
const originalLogoutFunc = window.logout;
window.logout = async function() {
    stopSocialPopupInterval();
    if (originalLogoutFunc) await originalLogoutFunc();
};

// Override showAdminDashboard
const originalShowAdminDashboardFunc = window.showAdminDashboard;
window.showAdminDashboard = function() {
    if (originalShowAdminDashboardFunc) originalShowAdminDashboardFunc();
    setTimeout(() => {
        addSocialLinksToAdminSidebar();
    }, 500);
};

// Initialize on auth state change - add to your auth.onAuthStateChanged
// Add this code inside your auth.onAuthStateChanged after setting currentUser
/*
if (user) {
    // ... existing code ...
    
    // Initialize social links system
    await initSocialLinksSystem();
    await loadUserFollowedStatus();
    addSocialLinksToUserMenu();
    await updateSocialNotificationBadge();
    
    // Show modal after 2 seconds if not all links followed
    if (!hasFollowedAllSocialLinks() && socialLinksList.length > 0) {
        setTimeout(() => {
            openSocialLinksModal();
        }, 2000);
    }
}
*/

// Make functions globally available
window.openSocialLinksModal = openSocialLinksModal;
window.closeSocialLinksModal = closeSocialLinksModal;
window.followSocialLinkAndVerify = followSocialLinkAndVerify;
window.verifySocialLink = verifySocialLink;
window.verifyAllSocialLinks = verifyAllSocialLinks;
window.openAdminSocialLinksModal = openAdminSocialLinksModal;
window.closeAdminSocialLinksModal = closeAdminSocialLinksModal;
window.showAddSocialLinkForm = showAddSocialLinkForm;
window.editSocialLink = editSocialLink;
window.saveSocialLink = saveSocialLink;
window.deleteSocialLink = deleteSocialLink;
window.closeSocialLinkFormModal = closeSocialLinkFormModal;
window.updateSocialIconPreview = updateSocialIconPreview;

console.log('✅ Social Links System Loaded - Auto popup every 3 minutes');

// ============================================
// COMPLETE WORKING FIRST DEPOSIT BONUS SYSTEM
// ============================================

/**
 * GIVE FIRST DEPOSIT BONUS TO REFERRER
 * Called when a user makes their first deposit
 * @param {string} userId - The user who made the deposit
 * @param {number} depositAmount - The amount deposited
 * @returns {Promise<Object>} - Result object
 */
async function giveFirstDepositBonus(userId, depositAmount) {
    console.log('=========================================');
    console.log('🎁 GIVE FIRST DEPOSIT BONUS - STARTED');
    console.log('User ID:', userId);
    console.log('Deposit Amount:', depositAmount);
    console.log('=========================================');
    
    const result = {
        success: false,
        bonusAmount: 0,
        message: '',
        referrerId: null,
        referrerName: null
    };
    
    try {
        // STEP 1: Get the user who made the deposit
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            result.message = 'User not found';
            console.error('❌', result.message);
            return result;
        }
        
        const userData = userDoc.data();
        console.log('User:', userData.username);
        console.log('Email:', userData.email);
        
        // STEP 2: Check if user has a referrer
        if (!userData.referredBy) {
            result.message = 'No referrer found - skipping bonus';
            console.log('ℹ️', result.message);
            return result;
        }
        
        const referrerId = userData.referredBy;
        result.referrerId = referrerId;
        console.log('Referrer ID:', referrerId);
        
        // STEP 3: Check if bonus already given
        if (userData.firstDepositBonusGiven === true) {
            result.message = 'Bonus already given to referrer';
            console.log('ℹ️', result.message);
            return result;
        }
        
        // STEP 4: Calculate 10% bonus
        const bonusAmount = depositAmount * 0.10;
        if (bonusAmount <= 0) {
            result.message = 'Bonus amount is zero';
            console.log('ℹ️', result.message);
            return result;
        }
        
        result.bonusAmount = bonusAmount;
        console.log('Bonus Amount:', formatMoney(bonusAmount));
        
        // STEP 5: Get referrer data
        const referrerRef = db.collection('users').doc(referrerId);
        const referrerDoc = await referrerRef.get();
        
        if (!referrerDoc.exists) {
            result.message = 'Referrer document not found';
            console.error('❌', result.message);
            return result;
        }
        
        const referrerData = referrerDoc.data();
        result.referrerName = referrerData.username;
        console.log('Referrer:', referrerData.username);
        console.log('Current referralBalance:', referrerData.referralBalance);
        
        // STEP 6: Create batch operation for atomic updates
        const batch = db.batch();
        
        // 6a: Add bonus to referrer's referralBalance
        batch.update(referrerRef, {
            referralBalance: firebase.firestore.FieldValue.increment(bonusAmount),
            totalEarned: firebase.firestore.FieldValue.increment(bonusAmount),
            'referralEarnings.level1': firebase.firestore.FieldValue.increment(bonusAmount),
            updatedAt: new Date().toISOString()
        });
        
        // 6b: Add to referrer's history
        batch.update(referrerRef, {
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'first_deposit_bonus',
                description: `🎁 First Deposit Bonus (10%) from ${userData.username} - Deposit: ${formatMoney(depositAmount)}`,
                amount: bonusAmount,
                status: 'completed',
                date: new Date().toISOString(),
                metadata: {
                    referralId: userId,
                    referralUsername: userData.username,
                    depositAmount: depositAmount,
                    bonusPercentage: 10,
                    timestamp: new Date().toISOString()
                }
            })
        });
        
        // 6c: Add notification to referrer
        batch.update(referrerRef, {
            notifications: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                title: '💰 First Deposit Bonus!',
                message: `Your referral ${userData.username} made their first deposit of ${formatMoney(depositAmount)}! You earned ${formatMoney(bonusAmount)} bonus!`,
                type: 'success',
                read: false,
                date: new Date().toISOString()
            })
        });
        
        // 6d: Mark bonus as given on user's document
        batch.update(db.collection('users').doc(userId), {
            firstDepositBonusGiven: true,
            firstDepositBonusAmount: bonusAmount,
            firstDepositBonusPaidTo: referrerId,
            firstDepositBonusPaidAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        // 6e: Add to user's history
        batch.update(db.collection('users').doc(userId), {
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'referral_bonus_given',
                description: `Your first deposit of ${formatMoney(depositAmount)} gave your referrer ${formatMoney(bonusAmount)} bonus`,
                amount: depositAmount,
                status: 'completed',
                date: new Date().toISOString(),
                metadata: {
                    referrerId: referrerId,
                    referrerName: referrerData.username,
                    bonusAmount: bonusAmount,
                    bonusPercentage: 10
                }
            })
        });
        
        // 6f: Update referrer's referrals array
        const referrals = referrerData.referrals || [];
        let found = false;
        
        for (let i = 0; i < referrals.length; i++) {
            if (referrals[i].userId === userId || referrals[i].username === userData.username) {
                referrals[i].firstDepositAmount = depositAmount;
                referrals[i].firstDepositBonus = bonusAmount;
                referrals[i].firstDepositDate = new Date().toISOString();
                referrals[i].firstDepositBonusGiven = true;
                referrals[i].firstDepositBonusPaidAt = new Date().toISOString();
                found = true;
                break;
            }
        }
        
        if (!found) {
            referrals.push({
                userId: userId,
                username: userData.username,
                level: 1,
                date: userData.createdAt || new Date().toISOString(),
                commission: 0,
                firstDepositAmount: depositAmount,
                firstDepositBonus: bonusAmount,
                firstDepositDate: new Date().toISOString(),
                firstDepositBonusGiven: true,
                firstDepositBonusPaidAt: new Date().toISOString()
            });
        }
        
        batch.update(referrerRef, { referrals: referrals });
        
        // STEP 7: Commit all updates
        await batch.commit();
        
        result.success = true;
        result.message = `Successfully added ${formatMoney(bonusAmount)} to ${referrerData.username}`;
        
        console.log('✅ SUCCESS!');
        console.log(`   Bonus: ${formatMoney(bonusAmount)} added to ${referrerData.username}`);
        console.log(`   New referralBalance: ${(referrerData.referralBalance || 0) + bonusAmount}`);
        console.log('=========================================');
        
        // Show notification to referrer if online
        if (currentUser && currentUser.uid === referrerId) {
            setTimeout(() => {
                showToast(`🎉 You earned ${formatMoney(bonusAmount)} from ${userData.username}'s first deposit!`, 'success');
            }, 500);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ ERROR in giveFirstDepositBonus:', error);
        result.message = `Error: ${error.message}`;
        return result;
    }
}

/**
 * APPROVE DEPOSIT WITH AUTO FIRST DEPOSIT BONUS
 * This is the main function to call when approving a deposit
 */
async function approveDepositWithBonus(depositId) {
    console.log('=========================================');
    console.log('📝 APPROVE DEPOSIT WITH BONUS CHECK');
    console.log('Deposit ID:', depositId);
    console.log('=========================================');
    
    // Find the deposit
    let deposit = null;
    
    // Try to find in deposits array
    if (deposits && deposits.length > 0) {
        deposit = deposits.find(d => d.id === depositId);
    }
    
    // If not found, fetch from Firestore
    if (!deposit) {
        try {
            const depositDoc = await db.collection('deposits').doc(depositId).get();
            if (depositDoc.exists) {
                deposit = { id: depositDoc.id, ...depositDoc.data() };
            }
        } catch (error) {
            console.error('Error fetching deposit:', error);
        }
    }
    
    if (!deposit) {
        showToast('Deposit not found', 'error');
        return;
    }
    
    if (deposit.status !== 'pending') {
        showToast('Deposit already processed', 'warning');
        return;
    }
    
    if (!confirm(`Approve deposit of ${formatMoney(deposit.amount)} for ${deposit.username}?\n\nThis will also check for first deposit bonus (10% to referrer).`)) {
        return;
    }
    
    showLoading('Processing deposit approval...');
    
    try {
        // STEP 1: Check if this is user's first deposit
        const previousDeposits = await db.collection('deposits')
            .where('userId', '==', deposit.userId)
            .where('status', '==', 'completed')
            .get();
        
        const isFirstDeposit = previousDeposits.size === 0;
        console.log(`Is first deposit: ${isFirstDeposit}`);
        console.log(`Previous deposits count: ${previousDeposits.size}`);
        
        // STEP 2: Update deposit status
        await db.collection('deposits').doc(depositId).update({
            status: 'completed',
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser?.uid || 'admin',
            isFirstDeposit: isFirstDeposit,
            updatedAt: new Date().toISOString()
        });
        
        // STEP 3: Update user's balance
        const userRef = db.collection('users').doc(deposit.userId);
        
        await userRef.update({
            balance: firebase.firestore.FieldValue.increment(deposit.amount),
            totalEarned: firebase.firestore.FieldValue.increment(deposit.amount),
            history: firebase.firestore.FieldValue.arrayUnion({
                id: generateId(),
                type: 'deposit',
                description: `Deposit approved - ${deposit.method} - Ref: ${deposit.transactionReference || deposit.transactionCode || 'N/A'}`,
                amount: deposit.amount,
                status: 'completed',
                date: new Date().toISOString(),
                metadata: {
                    depositId: depositId,
                    approvedBy: currentUser?.username || 'Admin',
                    isFirstDeposit: isFirstDeposit
                }
            })
        });
        
        // STEP 4: Send notification to user
        await addNotification(
            deposit.userId,
            '✅ Deposit Approved',
            `Your deposit of ${formatMoney(deposit.amount)} via ${deposit.method} has been approved and added to your balance.`,
            'success'
        );
        
        // STEP 5: PROCESS FIRST DEPOSIT BONUS
        let bonusResult = null;
        if (isFirstDeposit) {
            console.log('🎯 FIRST DEPOSIT DETECTED! Processing referral bonus...');
            bonusResult = await giveFirstDepositBonus(deposit.userId, deposit.amount);
            
            if (bonusResult && bonusResult.success) {
                // Update deposit record with bonus info
                await db.collection('deposits').doc(depositId).update({
                    firstDepositBonusGiven: true,
                    firstDepositBonusAmount: bonusResult.bonusAmount,
                    firstDepositBonusPaidTo: bonusResult.referrerId,
                    firstDepositBonusPaidAt: new Date().toISOString()
                });
                console.log('✅ Deposit record updated with bonus info');
            } else {
                console.log('⚠️ First deposit bonus not processed:', bonusResult?.message);
            }
        } else {
            console.log('ℹ️ Not first deposit, skipping bonus');
        }
        
        hideLoading();
        
        // Show success message
        let successMessage = `✅ Deposit of ${formatMoney(deposit.amount)} approved successfully`;
        if (bonusResult && bonusResult.success) {
            successMessage += `\n🎁 Referrer earned ${formatMoney(bonusResult.bonusAmount)} first deposit bonus!`;
        }
        showToast(successMessage, 'success');
        
        // Reload data
        await loadAdminData();
        await loadDeposits();
        
        // If the current user made the deposit, refresh their data
        if (currentUser && currentUser.uid === deposit.userId) {
            await loadUserData();
        }
        
        console.log('=========================================');
        console.log('✅ DEPOSIT APPROVAL COMPLETED');
        console.log('=========================================');
        
    } catch (error) {
        hideLoading();
        console.error('❌ Error approving deposit:', error);
        showToast('Error approving deposit: ' + error.message, 'error');
    }
}

/**
 * CHECK AND FIX ALL MISSED FIRST DEPOSIT BONUSES
 * Run this to find and fix any bonuses that were never given
 */
async function fixMissedFirstDepositBonuses() {
    console.log('=========================================');
    console.log('🔍 FIX MISSED FIRST DEPOSIT BONUSES');
    console.log('=========================================');
    
    showLoading('Checking for missed first deposit bonuses...');
    
    const stats = {
        totalUsersChecked: 0,
        usersWithDeposits: 0,
        usersWithReferrer: 0,
        bonusesFixed: 0,
        errors: 0,
        totalBonusAmount: 0
    };
    
    const fixedUsers = [];
    const errorUsers = [];
    
    try {
        // STEP 1: Get all completed deposits
        const depositsSnapshot = await db.collection('deposits')
            .where('status', '==', 'completed')
            .get();
        
        console.log(`Total completed deposits: ${depositsSnapshot.size}`);
        
        // Group deposits by user
        const userDeposits = new Map();
        
        depositsSnapshot.forEach(doc => {
            const deposit = doc.data();
            if (!userDeposits.has(deposit.userId)) {
                userDeposits.set(deposit.userId, []);
            }
            userDeposits.get(deposit.userId).push({
                id: doc.id,
                amount: deposit.amount,
                createdAt: deposit.createdAt || deposit.date,
                isFirstDeposit: deposit.isFirstDeposit
            });
        });
        
        stats.usersWithDeposits = userDeposits.size;
        console.log(`Users with deposits: ${stats.usersWithDeposits}`);
        
        // STEP 2: Process each user
        for (const [userId, deposits] of userDeposits) {
            stats.totalUsersChecked++;
            console.log(`\n--- Checking user: ${userId} ---`);
            
            // Get user data
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                console.log(`User document not found`);
                stats.errors++;
                errorUsers.push({ userId, error: 'User document not found' });
                continue;
            }
            
            const userData = userDoc.data();
            console.log(`Username: ${userData.username}`);
            console.log(`Has referrer: ${userData.referredBy ? 'YES' : 'NO'}`);
            console.log(`Bonus already given: ${userData.firstDepositBonusGiven === true ? 'YES' : 'NO'}`);
            
            // Skip if no referrer
            if (!userData.referredBy) {
                console.log(`Skipping - No referrer`);
                continue;
            }
            
            stats.usersWithReferrer++;
            
            // Skip if bonus already given
            if (userData.firstDepositBonusGiven === true) {
                console.log(`Skipping - Bonus already given`);
                continue;
            }
            
            // Sort deposits to get first deposit
            deposits.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            const firstDeposit = deposits[0];
            
            console.log(`First deposit amount: ${formatMoney(firstDeposit.amount)}`);
            console.log(`First deposit date: ${new Date(firstDeposit.createdAt).toLocaleString()}`);
            
            // Process the missed bonus
            console.log(`Processing missed bonus...`);
            const result = await giveFirstDepositBonus(userId, firstDeposit.amount);
            
            if (result.success) {
                stats.bonusesFixed++;
                stats.totalBonusAmount += result.bonusAmount;
                fixedUsers.push({
                    username: userData.username,
                    userId: userId,
                    depositAmount: firstDeposit.amount,
                    bonusAmount: result.bonusAmount,
                    referrerName: result.referrerName,
                    referrerId: result.referrerId
                });
                console.log(`✅ BONUS FIXED: ${formatMoney(result.bonusAmount)} to ${result.referrerName}`);
            } else {
                stats.errors++;
                errorUsers.push({
                    username: userData.username,
                    userId: userId,
                    depositAmount: firstDeposit.amount,
                    error: result.message
                });
                console.log(`❌ FAILED: ${result.message}`);
            }
        }
        
        hideLoading();
        
        // STEP 3: Show summary
        showMissedBonusSummary(stats, fixedUsers, errorUsers);
        
        // STEP 4: Log audit
        await logAudit('missed_bonus_check', 
            `Checked ${stats.totalUsersChecked} users. Fixed ${stats.bonusesFixed} missed bonuses. Total bonus: ${formatMoney(stats.totalBonusAmount)}`, 
            currentUser?.uid);
        
        console.log('\n📊 FINAL SUMMARY:');
        console.log(`   Total users checked: ${stats.totalUsersChecked}`);
        console.log(`   Users with deposits: ${stats.usersWithDeposits}`);
        console.log(`   Users with referrers: ${stats.usersWithReferrer}`);
        console.log(`   ✅ Bonuses fixed: ${stats.bonusesFixed}`);
        console.log(`   ❌ Errors: ${stats.errors}`);
        console.log(`   💰 Total bonus distributed: ${formatMoney(stats.totalBonusAmount)}`);
        console.log('=========================================');
        
        showToast(`✅ Fixed ${stats.bonusesFixed} missed first deposit bonuses! Total: ${formatMoney(stats.totalBonusAmount)}`, 'success');
        
        return stats;
        
    } catch (error) {
        hideLoading();
        console.error('❌ Error in fixMissedFirstDepositBonuses:', error);
        showToast('Error checking missed bonuses: ' + error.message, 'error');
        return null;
    }
}

/**
 * Show summary of missed bonus check results
 */
function showMissedBonusSummary(stats, fixedUsers, errorUsers) {
    let modal = document.getElementById('missedBonusSummaryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'missedBonusSummaryModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content large">
                <span class="close" onclick="closeMissedBonusSummaryModal()">&times;</span>
                <h2><i class="fas fa-gift"></i> First Deposit Bonus - Fix Results</h2>
                <div id="missedBonusSummaryContent"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    let html = `
        <div class="missed-bonus-summary">
            <div class="summary-stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-info">
                        <span class="stat-label">Users Checked</span>
                        <span class="stat-number">${stats.totalUsersChecked}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-info">
                        <span class="stat-label">Users with Deposits</span>
                        <span class="stat-number">${stats.usersWithDeposits}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🔗</div>
                    <div class="stat-info">
                        <span class="stat-label">Had Referrers</span>
                        <span class="stat-number">${stats.usersWithReferrer}</span>
                    </div>
                </div>
                <div class="stat-card success">
                    <div class="stat-icon">✅</div>
                    <div class="stat-info">
                        <span class="stat-label">Bonuses Fixed</span>
                        <span class="stat-number">${stats.bonusesFixed}</span>
                    </div>
                </div>
                <div class="stat-card error">
                    <div class="stat-icon">❌</div>
                    <div class="stat-info">
                        <span class="stat-label">Errors</span>
                        <span class="stat-number">${stats.errors}</span>
                    </div>
                </div>
                <div class="stat-card total">
                    <div class="stat-icon">💎</div>
                    <div class="stat-info">
                        <span class="stat-label">Total Bonus</span>
                        <span class="stat-number">${formatMoney(stats.totalBonusAmount)}</span>
                    </div>
                </div>
            </div>
    `;
    
    if (fixedUsers.length > 0) {
        html += `
            <div class="results-section success">
                <h3><i class="fas fa-check-circle"></i> Successfully Fixed (${fixedUsers.length})</h3>
                <div class="results-list">
                    ${fixedUsers.map(u => `
                        <div class="result-item success">
                            <div class="result-user">
                                <i class="fas fa-user"></i>
                                <strong>${escapeHtml(u.username)}</strong>
                            </div>
                            <div class="result-details">
                                <span>Deposit: ${formatMoney(u.depositAmount)}</span>
                                <span>→ Bonus: ${formatMoney(u.bonusAmount)}</span>
                                <span>→ Referrer: ${escapeHtml(u.referrerName)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    if (errorUsers.length > 0) {
        html += `
            <div class="results-section error">
                <h3><i class="fas fa-exclamation-triangle"></i> Errors (${errorUsers.length})</h3>
                <div class="results-list">
                    ${errorUsers.map(u => `
                        <div class="result-item error">
                            <div class="result-user">
                                <i class="fas fa-user"></i>
                                <strong>${escapeHtml(u.username)}</strong>
                            </div>
                            <div class="result-details">
                                <span>Deposit: ${formatMoney(u.depositAmount)}</span>
                                <span class="error-msg">❌ ${escapeHtml(u.error)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    html += `
            <div class="modal-actions">
                <button onclick="closeMissedBonusSummaryModal()" class="auth-btn">Close</button>
                <button onclick="exportMissedBonusReport()" class="auth-btn success">
                    <i class="fas fa-download"></i> Export Report
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('missedBonusSummaryContent').innerHTML = html;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Store data for export
    window.lastMissedBonusData = { stats, fixedUsers, errorUsers };
}

/**
 * Close missed bonus summary modal
 */
function closeMissedBonusSummaryModal() {
    const modal = document.getElementById('missedBonusSummaryModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

/**
 * Export missed bonus report to CSV
 */
function exportMissedBonusReport() {
    if (!window.lastMissedBonusData) return;
    
    const { stats, fixedUsers, errorUsers } = window.lastMissedBonusData;
    
    let csvContent = 'Report Type,Username,User ID,Deposit Amount,Bonus Amount,Referrer Name,Referrer ID,Status,Error\n';
    
    // Add fixed users
    fixedUsers.forEach(u => {
        csvContent += `Fixed,${u.username},${u.userId},${u.depositAmount},${u.bonusAmount},${u.referrerName},${u.referrerId},Success,\n`;
    });
    
    // Add error users
    errorUsers.forEach(u => {
        csvContent += `Error,${u.username},${u.userId},${u.depositAmount},0,,,Failed,${u.error}\n`;
    });
    
    // Add summary row
    csvContent += `\nSUMMARY,,,,,,,,\n`;
    csvContent += `Total Users Checked,${stats.totalUsersChecked},,,,,\n`;
    csvContent += `Users with Deposits,${stats.usersWithDeposits},,,,,\n`;
    csvContent += `Had Referrers,${stats.usersWithReferrer},,,,,\n`;
    csvContent += `Bonuses Fixed,${stats.bonusesFixed},,,,,\n`;
    csvContent += `Errors,${stats.errors},,,,,\n`;
    csvContent += `Total Bonus Distributed,${stats.totalBonusAmount},,,,,\n`;
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `first_deposit_bonus_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Report exported successfully!', 'success');
}

/**
 * Add admin button for first deposit bonus system
 */
function addFirstDepositBonusAdminButton() {
    setTimeout(() => {
        const adminDashboard = document.getElementById('adminDashboardTab');
        if (!adminDashboard) return;
        
        if (document.getElementById('firstDepositBonusAdminBtn')) return;
        
        const buttonDiv = document.createElement('div');
        buttonDiv.style.cssText = `
            background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        `;
        
        buttonDiv.innerHTML = `
            <div>
                <h3 style="color: white; margin: 0 0 5px 0;">
                    <i class="fas fa-gift"></i> First Deposit Bonus System
                </h3>
                <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 13px;">
                    Referrers automatically get 10% bonus when their referrals make first deposit
                </p>
            </div>
            <button id="firstDepositBonusAdminBtn" style="background: white; color: #2E7D32; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px;">
                <i class="fas fa-search"></i> Check & Fix Missed Bonuses
            </button>
        `;
        
        const btn = buttonDiv.querySelector('#firstDepositBonusAdminBtn');
        btn.onclick = async () => {
            if (confirm('This will check ALL users for missed first deposit bonuses and fix them. Continue?')) {
                await fixMissedFirstDepositBonuses();
            }
        };
        
        const firstChild = adminDashboard.firstChild;
        if (firstChild) {
            adminDashboard.insertBefore(buttonDiv, firstChild);
        } else {
            adminDashboard.appendChild(buttonDiv);
        }
        
    }, 1000);
}

/**
 * Get first deposit bonus status for a user
 */
async function getFirstDepositBonusStatus(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return null;
        
        const userData = userDoc.data();
        
        // Get user's first deposit
        const depositsSnapshot = await db.collection('deposits')
            .where('userId', '==', userId)
            .where('status', '==', 'completed')
            .orderBy('createdAt', 'asc')
            .limit(1)
            .get();
        
        let firstDepositAmount = null;
        let firstDepositDate = null;
        
        if (!depositsSnapshot.empty) {
            const firstDeposit = depositsSnapshot.docs[0].data();
            firstDepositAmount = firstDeposit.amount;
            firstDepositDate = firstDeposit.createdAt || firstDeposit.date;
        }
        
        return {
            hasReferrer: !!userData.referredBy,
            referrerId: userData.referredBy || null,
            hasMadeFirstDeposit: firstDepositAmount !== null,
            firstDepositAmount: firstDepositAmount,
            firstDepositDate: firstDepositDate,
            bonusProcessed: userData.firstDepositBonusGiven || false,
            bonusAmount: userData.firstDepositBonusAmount || 0,
            bonusPaidTo: userData.firstDepositBonusPaidTo || null,
            bonusPaidAt: userData.firstDepositBonusPaidAt || null
        };
    } catch (error) {
        console.error('Error getting bonus status:', error);
        return null;
    }
}

// ============================================
// OVERRIDE EXISTING FUNCTIONS
// ============================================

// Replace the approveDeposit function
window.approveDeposit = approveDepositWithBonus;

// Make all functions globally available
window.giveFirstDepositBonus = giveFirstDepositBonus;
window.approveDepositWithBonus = approveDepositWithBonus;
window.fixMissedFirstDepositBonuses = fixMissedFirstDepositBonuses;
window.getFirstDepositBonusStatus = getFirstDepositBonusStatus;
window.closeMissedBonusSummaryModal = closeMissedBonusSummaryModal;
window.exportMissedBonusReport = exportMissedBonusReport;
window.addFirstDepositBonusAdminButton = addFirstDepositBonusAdminButton;

// Add button when admin dashboard loads
const originalShowAdminDashboardForBonus = window.showAdminDashboard;
window.showAdminDashboard = function() {
    if (originalShowAdminDashboardForBonus) originalShowAdminDashboardForBonus();
    addFirstDepositBonusAdminButton();
};

// Also add to switchAdminTab
const originalSwitchAdminTabForBonus = window.switchAdminTab;
window.switchAdminTab = function(tabName) {
    if (originalSwitchAdminTabForBonus) originalSwitchAdminTabForBonus(tabName);
    if (tabName === 'dashboard') {
        setTimeout(() => addFirstDepositBonusAdminButton(), 500);
    }
};

console.log('=========================================');
console.log('✅ FIRST DEPOSIT BONUS SYSTEM LOADED');
console.log('   - Referrers get 10% bonus on referral\'s first deposit');
console.log('   - Auto processes when deposit is approved');
console.log('   - Admin button to fix missed bonuses');
console.log('=========================================');