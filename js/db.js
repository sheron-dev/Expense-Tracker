/**
 * Simulated Database using LocalStorage
 */

const DB_KEY = 'expensematrix_db';

const defaultCategories = [
    { id: 'cat-1', name: '🍔 Food', color: '#ef4444' },     /* Red */
    { id: 'cat-2', name: '🏠 Rent', color: '#3b82f6' },    /* Blue */
    { id: 'cat-3', name: '🚗 Transport', color: '#10b981' },/* Emerald */
    { id: 'cat-4', name: '🛍️ Shopping', color: '#ec4899' }, /* Pink */
    { id: 'cat-5', name: '⚡ Bills', color: '#f59e0b' },    /* Amber */
    { id: 'cat-6', name: '🎮 Entertainment', color: '#8b5cf6' }, /* Violet */
    { id: 'cat-7', name: '📦 Others', color: '#64748b' }    /* Slate */
];

const defaultUser = {
    id: 'user-1',
    name: 'Alex Pro',
    email: 'alex@expensematrix.app'
};

const predefinedColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', 
    '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'
];

class Database {
    constructor() {
        this.baseStruct = {
            users: [defaultUser],
            categories: [...defaultCategories],
            transactions: []
        };
        this.init();
    }

    init() {
        const data = localStorage.getItem(DB_KEY);
        if (!data) {
            this.save(this.baseStruct);
        }
    }

    save(data) {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
    }

    get() {
        return JSON.parse(localStorage.getItem(DB_KEY)) || this.baseStruct;
    }

    // ==== Utils ====
    generateId() {
        return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }

    getRandomColor() {
        return predefinedColors[Math.floor(Math.random() * predefinedColors.length)];
    }

    // ==== Users ====
    getUser() {
        return this.get().users[0];
    }

    // ==== Categories ====
    getCategories() {
        return this.get().categories;
    }

    addCategory(name) {
        const data = this.get();
        const newCat = {
            id: 'cat-' + this.generateId(),
            name,
            color: this.getRandomColor()
        };
        data.categories.push(newCat);
        this.save(data);
        return newCat;
    }

    // ==== Transactions ====
    getTransactions() {
        const txs = this.get().transactions;
        // Keep sorted by date desc
        return txs.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    addTransaction(tx) {
        const data = this.get();
        const newTx = {
            id: 'tx-' + this.generateId(),
            date: tx.date,
            item: tx.item,
            amount: parseFloat(tx.amount),
            categoryId: tx.categoryId,
            notes: tx.notes || ''
        };
        data.transactions.push(newTx);
        this.save(data);
        return newTx;
    }

    deleteTransaction(id) {
        const data = this.get();
        data.transactions = data.transactions.filter(t => t.id !== id);
        this.save(data);
    }

    // ==== Analytical Queries ====
    getCategoryMap() {
        return this.getCategories().reduce((map, cat) => {
            map[cat.id] = cat;
            return map;
        }, {});
    }

    getExpensesByMonth(yearMonth) {
        // yearMonth format: YYYY-MM
        const txs = this.getTransactions();
        if (!yearMonth) return txs;
        return txs.filter(t => t.date.startsWith(yearMonth));
    }

    calculateCategorySpending(yearMonth) {
        // Get all transactions for the month
        const monthlyTxs = this.getExpensesByMonth(yearMonth);
        const categories = this.getCategories();

        // Calculate spending per category
        const spentMap = {};
        monthlyTxs.forEach(tx => {
            spentMap[tx.categoryId] = (spentMap[tx.categoryId] || 0) + tx.amount;
        });

        return categories.map(cat => {
            const spent = spentMap[cat.id] || 0;
            return {
                ...cat,
                spent
            };
        });
    }

    resetAllData() {
        this.save(this.baseStruct);
    }

    keepOnly20() {
        const data = this.get();
        if (data.transactions.length > 20) {
            data.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            data.transactions = data.transactions.slice(0, 20);
            this.save(data);
        }
    }
}

// Attach to window for global app usage
window.AppDB = new Database();
