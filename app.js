class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 50;
        this.errorTypes = {
            STORAGE: 'storage',
            NETWORK: 'network',
            VALIDATION: 'validation',
            CALCULATION: 'calculation',
            UI: 'ui',
            UNKNOWN: 'unknown'
        };
    }

    handleError(error, type = this.errorTypes.UNKNOWN, context = {}) {
        const errorInfo = {
            id: Date.now(),
            type,
            message: error.message || String(error),
            stack: error.stack || '',
            timestamp: new Date().toISOString(),
            context
        };
        
        this.errors.push(errorInfo);
        
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
        
        console.error(`[${type.toUpperCase()}]`, errorInfo);
        
        return errorInfo;
    }

    getRecentErrors(count = 10) {
        return this.errors.slice(-count).reverse();
    }

    clearErrors() {
        this.errors = [];
    }

    getErrorStats() {
        const stats = {};
        this.errors.forEach(error => {
            stats[error.type] = (stats[error.type] || 0) + 1;
        });
        return stats;
    }

    validateInput(value, fieldName, rules = {}) {
        const errors = [];
        
        if (rules.required && (value === null || value === undefined || value === '')) {
            errors.push(`${fieldName}是必填项`);
        }
        
        if (rules.type) {
            if (rules.type === 'number' && isNaN(Number(value))) {
                errors.push(`${fieldName}必须是数字`);
            } else if (rules.type === 'string' && typeof value !== 'string') {
                errors.push(`${fieldName}必须是字符串`);
            }
        }
        
        if (rules.min !== undefined && Number(value) < rules.min) {
            errors.push(`${fieldName}不能小于${rules.min}`);
        }
        
        if (rules.max !== undefined && Number(value) > rules.max) {
            errors.push(`${fieldName}不能大于${rules.max}`);
        }
        
        if (rules.minLength && String(value).length < rules.minLength) {
            errors.push(`${fieldName}长度不能少于${rules.minLength}个字符`);
        }
        
        if (rules.maxLength && String(value).length > rules.maxLength) {
            errors.push(`${fieldName}长度不能超过${rules.maxLength}个字符`);
        }
        
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
        
        return true;
    }

    safeExecute(fn, fallback = null, context = {}) {
        try {
            return fn();
        } catch (error) {
            this.handleError(error, this.errorTypes.UNKNOWN, context);
            return fallback;
        }
    }

    async safeExecuteAsync(fn, fallback = null, context = {}) {
        try {
            return await fn();
        } catch (error) {
            this.handleError(error, this.errorTypes.UNKNOWN, context);
            return fallback;
        }
    }
}

class StorageManager {
    constructor(errorHandler) {
        this.errorHandler = errorHandler;
        this.storageKeys = {
            userData: 'waterReminderData',
            statsData: 'waterStatsData',
            achievementsData: 'waterAchievementsData',
            challengesData: 'waterChallengesData',
            theme: 'waterTheme',
            lastDate: 'lastDate'
        };
        
        this.cache = new Map();
        this.cacheTimeout = 60000;
    }

    save(key, data) {
        try {
            this.errorHandler.validateInput(key, '存储键', {
                required: true,
                type: 'string',
                minLength: 1
            });
            
            const jsonData = JSON.stringify(data);
            localStorage.setItem(key, jsonData);
            this.cache.set(key, { data, timestamp: Date.now() });
            return true;
        } catch (error) {
            this.errorHandler.handleError(error, this.errorHandler.errorTypes.STORAGE, {
                action: 'save',
                key
            });
            return false;
        }
    }

    load(key, defaultValue = null) {
        try {
            this.errorHandler.validateInput(key, '存储键', {
                required: true,
                type: 'string',
                minLength: 1
            });
            
            const cached = this.cache.get(key);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
            
            const data = localStorage.getItem(key);
            if (data) {
                const parsedData = JSON.parse(data);
                this.cache.set(key, { data: parsedData, timestamp: Date.now() });
                return parsedData;
            }
            return defaultValue;
        } catch (error) {
            this.errorHandler.handleError(error, this.errorHandler.errorTypes.STORAGE, {
                action: 'load',
                key
            });
            return defaultValue;
        }
    }

    remove(key) {
        try {
            this.errorHandler.validateInput(key, '存储键', {
                required: true,
                type: 'string',
                minLength: 1
            });
            
            localStorage.removeItem(key);
            this.cache.delete(key);
            return true;
        } catch (error) {
            this.errorHandler.handleError(error, this.errorHandler.errorTypes.STORAGE, {
                action: 'remove',
                key
            });
            return false;
        }
    }

    clearAll() {
        try {
            Object.values(this.storageKeys).forEach(key => {
                localStorage.removeItem(key);
                this.cache.delete(key);
            });
            return true;
        } catch (error) {
            this.errorHandler.handleError(error, this.errorHandler.errorTypes.STORAGE, {
                action: 'clearAll'
            });
            return false;
        }
    }

    clearCache() {
        this.cache.clear();
    }
}

class StatisticsManager {
    constructor(storageManager, errorHandler) {
        this.storage = storageManager;
        this.errorHandler = errorHandler;
        this.statsData = {};
        
        this.cache = new Map();
        this.cacheTimeout = 30000;
        
        this.loadStatsData();
    }

    loadStatsData() {
        this.statsData = this.storage.load(this.storage.storageKeys.statsData, {});
        this.clearCache();
    }

    saveStatsData() {
        this.storage.save(this.storage.storageKeys.statsData, this.statsData);
        this.clearCache();
    }

    clearCache() {
        this.cache.clear();
    }

    getCachedResult(key, computeFn) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.result;
        }
        
        const result = computeFn();
        this.cache.set(key, { result, timestamp: Date.now() });
        return result;
    }

    recordDailyStats(waterCount, waterGoal) {
        const today = new Date().toDateString();
        
        if (!this.statsData[today]) {
            this.statsData[today] = {
                count: 0,
                goal: waterGoal,
                date: today,
                drinkTimes: []
            };
        }
        
        this.statsData[today].count = waterCount;
        this.statsData[today].goal = waterGoal;
        this.saveStatsData();
    }

    recordDrinkTime(drinkTime) {
        const today = new Date().toDateString();
        
        if (!this.statsData[today]) {
            this.statsData[today] = {
                count: 0,
                goal: 8,
                date: today,
                drinkTimes: []
            };
        }
        
        if (!this.statsData[today].drinkTimes) {
            this.statsData[today].drinkTimes = [];
        }
        
        this.statsData[today].drinkTimes.push(drinkTime);
        this.statsData[today].count++;
        this.saveStatsData();
    }

    removeLastDrinkTime() {
        const today = new Date().toDateString();
        
        if (this.statsData[today] && this.statsData[today].drinkTimes && this.statsData[today].drinkTimes.length > 0) {
            this.statsData[today].drinkTimes.pop();
            this.statsData[today].count = Math.max(0, this.statsData[today].count - 1);
            this.saveStatsData();
        }
    }

    getWeeklyStats() {
        return this.getCachedResult('weeklyStats', () => {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            let totalCount = 0;
            let totalGoal = 0;
            let daysTracked = 0;
            
            for (const dateStr in this.statsData) {
                const stats = this.statsData[dateStr];
                const date = new Date(dateStr);
                if (date >= weekAgo && date <= now) {
                    totalCount += stats.count;
                    totalGoal += stats.goal;
                    daysTracked++;
                }
            }
            
            return {
                daysTracked,
                totalCount,
                totalGoal,
                averageCount: daysTracked > 0 ? (totalCount / daysTracked).toFixed(1) : 0,
                averageGoal: daysTracked > 0 ? (totalGoal / daysTracked).toFixed(1) : 0,
                completionRate: daysTracked > 0 ? Math.round((totalCount / totalGoal) * 100) : 0
            };
        });
    }

    getMonthlyStats() {
        return this.getCachedResult('monthlyStats', () => {
            const now = new Date();
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            let totalCount = 0;
            let totalGoal = 0;
            let daysTracked = 0;
            
            for (const dateStr in this.statsData) {
                const stats = this.statsData[dateStr];
                const date = new Date(dateStr);
                if (date >= monthAgo && date <= now) {
                    totalCount += stats.count;
                    totalGoal += stats.goal;
                    daysTracked++;
                }
            }
            
            return {
                daysTracked,
                totalCount,
                totalGoal,
                averageCount: daysTracked > 0 ? (totalCount / daysTracked).toFixed(1) : 0,
                averageGoal: daysTracked > 0 ? (totalGoal / daysTracked).toFixed(1) : 0,
                completionRate: daysTracked > 0 ? Math.round((totalCount / totalGoal) * 100) : 0
            };
        });
    }

    getOverallStats() {
        return this.getCachedResult('overallStats', () => {
            let totalCount = 0;
            let totalGoal = 0;
            let daysTracked = 0;
            let bestDay = 0;
            let bestDayDate = '';
            
            for (const dateStr in this.statsData) {
                const stats = this.statsData[dateStr];
                totalCount += stats.count;
                totalGoal += stats.goal;
                daysTracked++;
                
                if (stats.count > bestDay) {
                    bestDay = stats.count;
                    bestDayDate = dateStr;
                }
            }
            
            return {
                daysTracked,
                totalCount,
                totalGoal,
                averageCount: daysTracked > 0 ? (totalCount / daysTracked).toFixed(1) : 0,
                averageGoal: daysTracked > 0 ? (totalGoal / daysTracked).toFixed(1) : 0,
                completionRate: daysTracked > 0 ? Math.round((totalCount / totalGoal) * 100) : 0,
                bestDay,
                bestDayDate
            };
        });
    }

    analyzeHabits() {
        return this.getCachedResult('habitsAnalysis', () => {
            let totalCount = 0;
            let totalGoal = 0;
            let daysTracked = 0;
            let currentStreak = 0;
            let bestStreak = 0;
            const completionRates = [];
            const hourlyDrinks = new Array(24).fill(0);
            
            for (const dateStr in this.statsData) {
                const stats = this.statsData[dateStr];
                totalCount += stats.count;
                totalGoal += stats.goal;
                daysTracked++;
                
                const completionRate = stats.goal > 0 ? (stats.count / stats.goal) * 100 : 0;
                completionRates.push(completionRate);
                
                if (stats.count >= stats.goal) {
                    currentStreak++;
                    if (currentStreak > bestStreak) {
                        bestStreak = currentStreak;
                    }
                } else {
                    currentStreak = 0;
                }
                
                if (stats.drinkTimes) {
                    stats.drinkTimes.forEach(timeStr => {
                        const hour = new Date(timeStr).getHours();
                        hourlyDrinks[hour]++;
                    });
                }
            }
            
            const averageCount = daysTracked > 0 ? (totalCount / daysTracked).toFixed(1) : 0;
            const averageGoal = daysTracked > 0 ? (totalGoal / daysTracked).toFixed(1) : 0;
            
            let regularityScore = 0;
            if (completionRates.length >= 3) {
                const recentRates = completionRates.slice(-7);
                const avgRate = recentRates.reduce((a, b) => a + b, 0) / recentRates.length;
                const variance = recentRates.reduce((sum, rate) => sum + Math.pow(rate - avgRate, 2), 0) / recentRates.length;
                regularityScore = Math.max(0, 100 - Math.sqrt(variance));
            }
            
            let maxHourlyDrinks = 0;
            let bestTime = '';
            hourlyDrinks.forEach((count, hour) => {
                if (count > maxHourlyDrinks) {
                    maxHourlyDrinks = count;
                    if (hour >= 6 && hour < 12) {
                        bestTime = '早晨';
                    } else if (hour >= 12 && hour < 18) {
                        bestTime = '下午';
                    } else if (hour >= 18 && hour < 22) {
                        bestTime = '晚上';
                    } else {
                        bestTime = '深夜';
                    }
                }
            });
            
            let trend = 0;
            if (completionRates.length >= 7) {
                const recentRates = completionRates.slice(-7);
                const firstHalf = recentRates.slice(0, 3);
                const secondHalf = recentRates.slice(3);
                const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
                const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
                trend = secondAvg - firstAvg;
            }
            
            return {
                averageCount: parseFloat(averageCount),
                averageGoal: parseFloat(averageGoal),
                regularityScore: Math.round(regularityScore),
                bestTime,
                trend,
                currentStreak,
                bestStreak,
                hourlyDrinks
            };
        });
    }

    exportData() {
        if (!this.statsData || Object.keys(this.statsData).length === 0) {
            return null;
        }
        
        let csvContent = 'data:text/csv;charset=utf-8,';
        csvContent += '日期,饮水量(杯),目标(杯),完成率\n';
        
        for (const dateStr in this.statsData) {
            const stats = this.statsData[dateStr];
            const completionRate = stats.goal > 0 ? ((stats.count / stats.goal) * 100).toFixed(1) : 0;
            csvContent += `${dateStr},${stats.count},${stats.goal},${completionRate}%\n`;
        }
        
        return csvContent;
    }
}

class AchievementManager {
    constructor(storageManager, statisticsManager, errorHandler) {
        this.storage = storageManager;
        this.statistics = statisticsManager;
        this.errorHandler = errorHandler;
        this.achievements = [];
        this.initAchievements();
    }

    initAchievements() {
        this.achievements = [
            {
                id: 'first-drink',
                title: '初次尝试',
                description: '第一次记录喝水',
                icon: '🥤',
                condition: (stats) => stats.totalDrinks >= 1,
                unlocked: false,
                date: null
            },
            {
                id: 'water-beginner',
                title: '饮水新手',
                description: '一天内喝够5杯水',
                icon: '🌱',
                condition: (stats) => stats.maxDailyDrinks >= 5,
                unlocked: false,
                date: null
            },
            {
                id: 'water-regular',
                title: '饮水达人',
                description: '一天内喝够8杯水',
                icon: '💧',
                condition: (stats) => stats.maxDailyDrinks >= 8,
                unlocked: false,
                date: null
            },
            {
                id: 'water-master',
                title: '饮水大师',
                description: '一天内喝够12杯水',
                icon: '🏆',
                condition: (stats) => stats.maxDailyDrinks >= 12,
                unlocked: false,
                date: null
            },
            {
                id: 'streak-3',
                title: '坚持3天',
                description: '连续3天达成饮水目标',
                icon: '🔥',
                condition: (stats) => stats.currentStreak >= 3,
                unlocked: false,
                date: null
            },
            {
                id: 'streak-7',
                title: '坚持一周',
                description: '连续7天达成饮水目标',
                icon: '⭐',
                condition: (stats) => stats.currentStreak >= 7,
                unlocked: false,
                date: null
            },
            {
                id: 'streak-14',
                title: '坚持两周',
                description: '连续14天达成饮水目标',
                icon: '🌟',
                condition: (stats) => stats.currentStreak >= 14,
                unlocked: false,
                date: null
            },
            {
                id: 'streak-30',
                title: '坚持一月',
                description: '连续30天达成饮水目标',
                icon: '👑',
                condition: (stats) => stats.currentStreak >= 30,
                unlocked: false,
                date: null
            },
            {
                id: 'total-50',
                title: '累计50杯',
                description: '累计喝够50杯水',
                icon: '🎯',
                condition: (stats) => stats.totalDrinks >= 50,
                unlocked: false,
                date: null
            },
            {
                id: 'total-100',
                title: '累计100杯',
                description: '累计喝够100杯水',
                icon: '💯',
                condition: (stats) => stats.totalDrinks >= 100,
                unlocked: false,
                date: null
            },
            {
                id: 'total-500',
                title: '累计500杯',
                description: '累计喝够500杯水',
                icon: '🚀',
                condition: (stats) => stats.totalDrinks >= 500,
                unlocked: false,
                date: null
            },
            {
                id: 'total-1000',
                title: '累计1000杯',
                description: '累计喝够1000杯水',
                icon: '🏅',
                condition: (stats) => stats.totalDrinks >= 1000,
                unlocked: false,
                date: null
            },
            {
                id: 'early-bird',
                title: '早起鸟',
                description: '在早晨8点前喝够3杯水',
                icon: '🐦',
                condition: (stats) => this.checkEarlyBirdCondition(stats),
                unlocked: false,
                date: null
            },
            {
                id: 'night-owl',
                title: '夜猫子',
                description: '在晚上10点后还能保持饮水习惯',
                icon: '🦉',
                condition: (stats) => this.checkNightOwlCondition(stats),
                unlocked: false,
                date: null
            },
            {
                id: 'consistency-king',
                title: '坚持之王',
                description: '连续10天达成饮水目标',
                icon: '👑',
                condition: (stats) => stats.currentStreak >= 10,
                unlocked: false,
                date: null
            },
            {
                id: 'perfect-week',
                title: '完美一周',
                description: '一周内每天都达成饮水目标',
                icon: '✨',
                condition: (stats) => this.checkPerfectWeekCondition(stats),
                unlocked: false,
                date: null
            },
            {
                id: 'hydration-hero',
                title: '补水英雄',
                description: '单日喝够15杯水',
                icon: '🦸',
                condition: (stats) => stats.maxDailyDrinks >= 15,
                unlocked: false,
                date: null
            },
            {
                id: 'water-lover',
                title: '饮水爱好者',
                description: '使用应用达到7天',
                icon: '❤️',
                condition: (stats) => this.checkUsageDaysCondition(stats, 7),
                unlocked: false,
                date: null
            },
            {
                id: 'water-fanatic',
                title: '饮水狂热者',
                description: '使用应用达到30天',
                icon: '💖',
                condition: (stats) => this.checkUsageDaysCondition(stats, 30),
                unlocked: false,
                date: null
            }
        ];
        
        this.loadAchievementsData();
    }

    checkEarlyBirdCondition(stats) {
        for (const dateStr in this.statistics.statsData) {
            const dayData = this.statistics.statsData[dateStr];
            if (dayData.drinkTimes && dayData.drinkTimes.length >= 3) {
                const earlyDrinks = dayData.drinkTimes.filter(time => {
                    const hour = new Date(time).getHours();
                    return hour < 8;
                });
                if (earlyDrinks.length >= 3) {
                    return true;
                }
            }
        }
        return false;
    }

    checkNightOwlCondition(stats) {
        for (const dateStr in this.statistics.statsData) {
            const dayData = this.statistics.statsData[dateStr];
            if (dayData.drinkTimes && dayData.drinkTimes.length > 0) {
                const nightDrinks = dayData.drinkTimes.filter(time => {
                    const hour = new Date(time).getHours();
                    return hour >= 22;
                });
                if (nightDrinks.length > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    checkPerfectWeekCondition(stats) {
        const dates = Object.keys(this.statistics.statsData).sort();
        let consecutiveDays = 0;
        
        for (let i = dates.length - 1; i >= 0; i--) {
            const dateStr = dates[i];
            const dayData = this.statistics.statsData[dateStr];
            
            if (dayData.count >= dayData.goal) {
                consecutiveDays++;
                if (consecutiveDays >= 7) {
                    return true;
                }
            } else {
                consecutiveDays = 0;
            }
        }
        
        return false;
    }

    checkUsageDaysCondition(stats, targetDays) {
        const totalDays = Object.keys(this.statistics.statsData).length;
        return totalDays >= targetDays;
    }

    loadAchievementsData() {
        const achievementsData = this.storage.load(this.storage.storageKeys.achievementsData);
        if (achievementsData) {
            this.achievements.forEach(achievement => {
                const savedAchievement = achievementsData.find(a => a.id === achievement.id);
                if (savedAchievement) {
                    achievement.unlocked = savedAchievement.unlocked;
                    achievement.date = savedAchievement.date;
                }
            });
        }
    }

    saveAchievementsData() {
        this.storage.save(this.storage.storageKeys.achievementsData, this.achievements);
    }

    calculateAchievementStats() {
        let totalDrinks = 0;
        let maxDailyDrinks = 0;
        let currentStreak = 0;
        
        for (const dateStr in this.statistics.statsData) {
            const stats = this.statistics.statsData[dateStr];
            totalDrinks += stats.count;
            if (stats.count > maxDailyDrinks) {
                maxDailyDrinks = stats.count;
            }
        }
        
        const today = new Date();
        let checkDate = new Date(today);
        
        while (true) {
            const dateStr = checkDate.toDateString();
            const stats = this.statistics.statsData[dateStr];
            
            if (stats && stats.count >= stats.goal) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        return {
            totalDrinks,
            maxDailyDrinks,
            currentStreak
        };
    }

    checkAchievements() {
        const stats = this.calculateAchievementStats();
        let newAchievements = [];
        
        this.achievements.forEach(achievement => {
            if (!achievement.unlocked && achievement.condition(stats)) {
                achievement.unlocked = true;
                achievement.date = new Date().toDateString();
                newAchievements.push(achievement);
            }
        });
        
        if (newAchievements.length > 0) {
            this.saveAchievementsData();
            return newAchievements;
        }
        
        return [];
    }

    getAchievementProgress(achievement) {
        const stats = this.calculateAchievementStats();
        
        switch (achievement.id) {
            case 'first-drink':
                return Math.min(stats.totalDrinks / 1 * 100, 100);
            case 'water-beginner':
                return Math.min(stats.maxDailyDrinks / 5 * 100, 100);
            case 'water-regular':
                return Math.min(stats.maxDailyDrinks / 8 * 100, 100);
            case 'water-master':
                return Math.min(stats.maxDailyDrinks / 12 * 100, 100);
            case 'hydration-hero':
                return Math.min(stats.maxDailyDrinks / 15 * 100, 100);
            case 'streak-3':
                return Math.min(stats.currentStreak / 3 * 100, 100);
            case 'streak-7':
                return Math.min(stats.currentStreak / 7 * 100, 100);
            case 'streak-14':
                return Math.min(stats.currentStreak / 14 * 100, 100);
            case 'streak-30':
                return Math.min(stats.currentStreak / 30 * 100, 100);
            case 'consistency-king':
                return Math.min(stats.currentStreak / 10 * 100, 100);
            case 'total-50':
                return Math.min(stats.totalDrinks / 50 * 100, 100);
            case 'total-100':
                return Math.min(stats.totalDrinks / 100 * 100, 100);
            case 'total-500':
                return Math.min(stats.totalDrinks / 500 * 100, 100);
            case 'total-1000':
                return Math.min(stats.totalDrinks / 1000 * 100, 100);
            case 'water-lover':
                const totalDays7 = Object.keys(this.statistics.statsData).length;
                return Math.min(totalDays7 / 7 * 100, 100);
            case 'water-fanatic':
                const totalDays30 = Object.keys(this.statistics.statsData).length;
                return Math.min(totalDays30 / 30 * 100, 100);
            case 'early-bird':
            case 'night-owl':
            case 'perfect-week':
                return achievement.unlocked ? 100 : 0;
            default:
                return 0;
        }
    }

    getUnlockedCount() {
        return this.achievements.filter(a => a.unlocked).length;
    }

    getTotalCount() {
        return this.achievements.length;
    }
}

class HealthMonitor {
    constructor(statisticsManager, errorHandler) {
        this.statistics = statisticsManager;
        this.errorHandler = errorHandler;
    }

    analyzeHealthData() {
        let totalWater = 0;
        let totalGoal = 0;
        let daysTracked = 0;
        let currentStreak = 0;
        let weeklyWater = 0;
        
        for (const dateStr in this.statistics.statsData) {
            const stats = this.statistics.statsData[dateStr];
            totalWater += stats.count;
            totalGoal += stats.goal;
            daysTracked++;
            
            if (stats.count >= stats.goal) {
                currentStreak++;
            } else {
                currentStreak = 0;
            }
        }
        
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        
        for (const dateStr in this.statistics.statsData) {
            const date = new Date(dateStr);
            if (date >= weekStart) {
                weeklyWater += this.statistics.statsData[dateStr].count;
            }
        }
        
        const averageDailyWater = daysTracked > 0 ? (totalWater / daysTracked).toFixed(1) : 0;
        const goalCompletionRate = daysTracked > 0 ? Math.round((totalWater / totalGoal) * 100) : 0;
        
        let dehydrationRisk = '低';
        let dehydrationMessage = '您的饮水习惯良好，脱水风险较低。';
        
        if (parseFloat(averageDailyWater) < 6) {
            dehydrationRisk = '高';
            dehydrationMessage = '您的饮水量不足，存在较高的脱水风险。';
        } else if (parseFloat(averageDailyWater) < 8) {
            dehydrationRisk = '中';
            dehydrationMessage = '您的饮水量基本达标，但仍有轻度脱水风险。';
        }
        
        const healthTips = [];
        
        if (parseFloat(averageDailyWater) < 8) {
            healthTips.push('建议增加每日饮水量，达到8-10杯。');
        }
        
        if (goalCompletionRate < 80) {
            healthTips.push('尝试设置更合理的饮水目标，逐步提高达成率。');
        }
        
        if (currentStreak >= 7) {
            healthTips.push('恭喜您已连续一周达成饮水目标，继续保持！');
        }
        
        healthTips.push('建议在早晨起床后喝一杯温水，有助于启动新陈代谢。');
        healthTips.push('避免在睡前2小时大量饮水，以免影响睡眠质量。');
        healthTips.push('可以尝试在水中加入柠檬片或薄荷，增加饮水的趣味性。');
        
        return {
            dehydrationRisk,
            dehydrationMessage,
            averageDailyWater,
            goalCompletionRate,
            currentStreak,
            weeklyWater,
            healthTips
        };
    }

    getDetailedHealthAnalysis() {
        const basicAnalysis = this.analyzeHealthData();
        const habitsAnalysis = this.statistics.analyzeHabits();
        
        const hydrationScore = this.calculateHydrationScore(basicAnalysis);
        const consistencyScore = habitsAnalysis.regularityScore;
        const overallHealthScore = Math.round((hydrationScore + consistencyScore) / 2);
        
        const healthStatus = this.getHealthStatus(overallHealthScore);
        const recommendations = this.generateRecommendations(basicAnalysis, habitsAnalysis);
        
        return {
            ...basicAnalysis,
            hydrationScore,
            consistencyScore,
            overallHealthScore,
            healthStatus,
            recommendations,
            bestDrinkingTime: habitsAnalysis.bestTime,
            trend: habitsAnalysis.trend
        };
    }

    calculateHydrationScore(analysis) {
        let score = 50;
        
        const averageWater = parseFloat(analysis.averageDailyWater);
        if (averageWater >= 8) {
            score += 30;
        } else if (averageWater >= 6) {
            score += 15;
        } else if (averageWater >= 4) {
            score += 5;
        }
        
        if (analysis.goalCompletionRate >= 80) {
            score += 15;
        } else if (analysis.goalCompletionRate >= 60) {
            score += 10;
        } else if (analysis.goalCompletionRate >= 40) {
            score += 5;
        }
        
        if (analysis.currentStreak >= 7) {
            score += 5;
        } else if (analysis.currentStreak >= 3) {
            score += 3;
        }
        
        return Math.min(100, score);
    }

    getHealthStatus(score) {
        if (score >= 80) {
            return {
                level: '优秀',
                color: 'success',
                message: '您的饮水习惯非常好，请继续保持！'
            };
        } else if (score >= 60) {
            return {
                level: '良好',
                color: 'info',
                message: '您的饮水习惯良好，还有提升空间。'
            };
        } else if (score >= 40) {
            return {
                level: '一般',
                color: 'warning',
                message: '您的饮水习惯一般，需要改善。'
            };
        } else {
            return {
                level: '需要改善',
                color: 'danger',
                message: '您的饮水习惯需要立即改善。'
            };
        }
    }

    generateRecommendations(basicAnalysis, habitsAnalysis) {
        const recommendations = [];
        
        if (parseFloat(basicAnalysis.averageDailyWater) < 6) {
            recommendations.push({
                priority: 'high',
                category: '饮水量',
                title: '增加每日饮水量',
                description: '建议每天至少喝6-8杯水，分多次饮用'
            });
        }
        
        if (habitsAnalysis.regularityScore < 60) {
            recommendations.push({
                priority: 'medium',
                category: '规律性',
                title: '建立规律饮水习惯',
                description: '尝试在固定时间喝水，如早晨起床后、饭前等'
            });
        }
        
        if (habitsAnalysis.trend < 0) {
            recommendations.push({
                priority: 'medium',
                category: '趋势',
                title: '改善饮水趋势',
                description: '最近饮水完成率下降，建议重新审视饮水计划'
            });
        }
        
        if (basicAnalysis.currentStreak < 3) {
            recommendations.push({
                priority: 'low',
                category: '坚持',
                title: '提高连续达标天数',
                description: '设定小目标，逐步增加连续达标天数'
            });
        }
        
        recommendations.push({
            priority: 'low',
            category: '健康',
            title: '优化饮水时间',
            description: `您最常在${habitsAnalysis.bestTime}饮水，可以适当调整饮水时间分布`
        });
        
        return recommendations;
    }

    getSeasonalAdvice() {
        const month = new Date().getMonth() + 1;
        let season = '';
        let tip = '';
        
        if (month >= 3 && month <= 5) {
            season = '春季';
            tip = `
                <h4>春季饮水建议</h4>
                <p>春季是万物复苏的季节，气温逐渐升高，人体新陈代谢加快，需要更多的水分来支持身体的各项功能。</p>
                <ul>
                    <li>每天至少喝够8-10杯水，保持身体水分平衡</li>
                    <li>多喝温水，有助于促进血液循环和新陈代谢</li>
                    <li>可以适量饮用花茶，如菊花茶、茉莉花茶等，有助于清热解毒</li>
                    <li>注意补充维生素C，增强免疫力</li>
                </ul>
            `;
        } else if (month >= 6 && month <= 8) {
            season = '夏季';
            tip = `
                <h4>夏季饮水建议</h4>
                <p>夏季气温高，人体出汗多，水分流失快，需要及时补充水分，防止脱水。</p>
                <ul>
                    <li>每天至少喝够10-12杯水，甚至更多</li>
                    <li>随身携带水杯，随时补充水分</li>
                    <li>避免饮用过多含糖饮料，选择白开水或淡盐水</li>
                    <li>可以适量饮用绿豆汤、酸梅汤等清热解暑的饮品</li>
                    <li>运动后及时补充电解质水</li>
                </ul>
            `;
        } else if (month >= 9 && month <= 11) {
            season = '秋季';
            tip = `
                <h4>秋季饮水建议</h4>
                <p>秋季气候干燥，容易出现口干舌燥、皮肤干燥等症状，需要多喝水来润燥。</p>
                <ul>
                    <li>每天喝够8-10杯水，保持身体水分</li>
                    <li>多喝温水，避免喝冷饮</li>
                    <li>可以适量饮用蜂蜜水、梨汤等润燥的饮品</li>
                    <li>多吃新鲜水果，补充维生素和水分</li>
                </ul>
            `;
        } else {
            season = '冬季';
            tip = `
                <h4>冬季饮水建议</h4>
                <p>冬季气温低，人体出汗少，容易忽略喝水，但实际上冬季更需要保持充足的水分。</p>
                <ul>
                    <li>每天喝够8杯水，保持身体水分平衡</li>
                    <li>多喝温水，有助于保暖和促进血液循环</li>
                    <li>可以适量饮用姜茶、红茶等温热的饮品</li>
                    <li>避免饮用过多咖啡和酒精，它们会加速水分流失</li>
                </ul>
            `;
        }
        
        return { season, tip };
    }

    getHealthTipsByTime() {
        const hour = new Date().getHours();
        let tips = [];
        
        if (hour >= 6 && hour < 9) {
            tips = [
                '早晨起床后喝一杯温水，有助于启动新陈代谢',
                '早餐前喝水可以促进消化',
                '早晨饮水有助于清醒大脑'
            ];
        } else if (hour >= 9 && hour < 12) {
            tips = [
                '工作间隙记得喝水，保持精力充沛',
                '上午饮水有助于提高工作效率',
                '避免等到口渴才喝水'
            ];
        } else if (hour >= 12 && hour < 14) {
            tips = [
                '饭前半小时喝水有助于消化',
                '午餐时适量饮水，但不要过量',
                '饭后一小时再喝水效果更好'
            ];
        } else if (hour >= 14 && hour < 17) {
            tips = [
                '下午容易疲劳，喝水可以提神醒脑',
                '工作间隙站起来活动并喝杯水',
                '下午茶时间可以选择健康的饮品'
            ];
        } else if (hour >= 17 && hour < 20) {
            tips = [
                '晚餐前适量喝水，有助于控制食量',
                '傍晚饮水有助于放松身心',
                '运动后记得及时补充水分'
            ];
        } else {
            tips = [
                '睡前2小时内避免大量饮水',
                '晚上可以少量喝水，但不要过量',
                '保持适量饮水有助于夜间身体代谢'
            ];
        }
        
        return tips;
    }
}

class ChallengeManager {
    constructor(storageManager, statisticsManager, errorHandler) {
        this.storage = storageManager;
        this.statistics = statisticsManager;
        this.errorHandler = errorHandler;
        this.activeChallenges = [];
        this.completedChallenges = [];
        this.initChallenges();
    }

    initChallenges() {
        this.availableChallenges = [
            {
                id: 'early-bird',
                title: '早起一杯水',
                description: '每天起床后1小时内喝一杯水',
                icon: '🌅',
                type: 'daily',
                duration: 7,
                reward: 50
            },
            {
                id: 'lemon-water',
                title: '柠檬水日',
                description: '全天喝柠檬水增加风味',
                icon: '🍋',
                type: 'single',
                duration: 1,
                reward: 20
            },
            {
                id: 'week-streak',
                title: '连续一周',
                description: '连续7天达成每日饮水目标',
                icon: '🔥',
                type: 'streak',
                duration: 7,
                reward: 100
            },
            {
                id: 'hydration-hero',
                title: '补水英雄',
                description: '单日喝够12杯水',
                icon: '🦸',
                type: 'single',
                duration: 1,
                reward: 30
            },
            {
                id: 'consistency-king',
                title: '坚持之王',
                description: '连续14天达成饮水目标',
                icon: '👑',
                type: 'streak',
                duration: 14,
                reward: 200
            }
        ];
        
        this.loadChallengesData();
    }

    loadChallengesData() {
        const challengesData = this.storage.load(this.storage.storageKeys.challengesData);
        if (challengesData) {
            this.activeChallenges = challengesData.active || [];
            this.completedChallenges = challengesData.completed || [];
        }
    }

    saveChallengesData() {
        this.storage.save(this.storage.storageKeys.challengesData, {
            active: this.activeChallenges,
            completed: this.completedChallenges
        });
    }

    acceptChallenge(challengeId) {
        const challenge = this.availableChallenges.find(c => c.id === challengeId);
        if (!challenge) return false;
        
        const activeChallenge = {
            ...challenge,
            startDate: new Date().toISOString(),
            progress: 0,
            total: challenge.duration
        };
        
        this.activeChallenges.push(activeChallenge);
        this.saveChallengesData();
        return true;
    }

    completeChallenge(challengeId) {
        const index = this.activeChallenges.findIndex(c => c.id === challengeId);
        if (index === -1) return false;
        
        const completedChallenge = {
            ...this.activeChallenges[index],
            completedDate: new Date().toISOString()
        };
        
        this.completedChallenges.push(completedChallenge);
        this.activeChallenges.splice(index, 1);
        this.saveChallengesData();
        return true;
    }

    updateChallengeProgress() {
        const today = new Date().toDateString();
        const todayStats = this.statistics.statsData[today];
        
        this.activeChallenges.forEach(challenge => {
            switch (challenge.type) {
                case 'daily':
                    this.updateDailyChallenge(challenge, todayStats);
                    break;
                case 'streak':
                    this.updateStreakChallenge(challenge);
                    break;
                case 'single':
                    this.updateSingleChallenge(challenge, todayStats);
                    break;
            }
        });
        
        this.saveChallengesData();
    }

    updateDailyChallenge(challenge, todayStats) {
        if (todayStats && todayStats.count > 0) {
            const firstDrinkTime = todayStats.drinkTimes && todayStats.drinkTimes.length > 0 
                ? new Date(todayStats.drinkTimes[0]) 
                : null;
            
            if (firstDrinkTime) {
                const wakeTime = new Date();
                wakeTime.setHours(8, 0, 0, 0);
                const hoursSinceWake = (firstDrinkTime - wakeTime) / (1000 * 60 * 60);
                
                if (hoursSinceWake <= 1) {
                    challenge.progress = Math.min(challenge.progress + 1, challenge.total);
                }
            }
        }
    }

    updateStreakChallenge(challenge) {
        const analysis = this.statistics.analyzeHabits();
        challenge.progress = Math.min(analysis.currentStreak, challenge.total);
    }

    updateSingleChallenge(challenge, todayStats) {
        if (todayStats && todayStats.count >= 12) {
            challenge.progress = challenge.total;
        }
    }

    getAvailableChallenges() {
        return this.availableChallenges.filter(challenge => 
            !this.activeChallenges.some(active => active.id === challenge.id) &&
            !this.completedChallenges.some(completed => completed.id === challenge.id)
        );
    }

    getActiveChallenges() {
        return this.activeChallenges;
    }

    getCompletedChallenges() {
        return this.completedChallenges;
    }

    getChallengeProgress(challengeId) {
        const challenge = this.activeChallenges.find(c => c.id === challengeId);
        if (!challenge) return null;
        
        return {
            progress: challenge.progress,
            total: challenge.total,
            percentage: Math.round((challenge.progress / challenge.total) * 100)
        };
    }
}

class SmartReminderManager {
    constructor(statisticsManager, waterCalculator, errorHandler) {
        this.statistics = statisticsManager;
        this.calculator = waterCalculator;
        this.errorHandler = errorHandler;
        this.userPatterns = {};
        this.optimalTimes = [];
        this.loadPatterns();
    }

    loadPatterns() {
        const savedPatterns = localStorage.getItem('smartReminderPatterns');
        if (savedPatterns) {
            this.userPatterns = JSON.parse(savedPatterns);
        }
    }

    savePatterns() {
        localStorage.setItem('smartReminderPatterns', JSON.stringify(this.userPatterns));
    }

    analyzeUserBehavior() {
        const analysis = this.statistics.analyzeHabits();
        const hourlyDrinks = analysis.hourlyDrinks;
        
        const peakHours = [];
        hourlyDrinks.forEach((count, hour) => {
            if (count > 0) {
                peakHours.push({ hour, count });
            }
        });
        
        peakHours.sort((a, b) => b.count - a.count);
        this.optimalTimes = peakHours.slice(0, 5).map(item => item.hour);
        
        this.userPatterns = {
            optimalTimes: this.optimalTimes,
            averageDailyWater: analysis.averageCount,
            regularityScore: analysis.regularityScore,
            bestTime: analysis.bestTime,
            lastUpdated: new Date().toISOString()
        };
        
        this.savePatterns();
    }

    calculateOptimalInterval(baseInterval, currentHour, weatherData = null, userActivity = null) {
        let interval = baseInterval;
        
        const isOptimalTime = this.optimalTimes.includes(currentHour);
        const timeOfDay = this.getTimeOfDay(currentHour);
        
        if (isOptimalTime) {
            interval *= 0.7;
        } else if (timeOfDay === 'night') {
            interval *= 1.5;
        } else if (timeOfDay === 'evening') {
            interval *= 1.2;
        }
        
        if (weatherData) {
            if (weatherData.temperature > 30) {
                interval *= 0.7;
            } else if (weatherData.temperature > 25) {
                interval *= 0.85;
            } else if (weatherData.temperature < 10) {
                interval *= 1.1;
            }
            
            if (weatherData.humidity < 30) {
                interval *= 0.9;
            } else if (weatherData.humidity > 70) {
                interval *= 1.1;
            }
        }
        
        if (userActivity) {
            switch (userActivity) {
                case 'exercise':
                    interval *= 0.6;
                    break;
                case 'work':
                    interval *= 0.8;
                    break;
                case 'rest':
                    interval *= 1.2;
                    break;
            }
        }
        
        return Math.max(15, Math.min(120, interval)) * 60000;
    }

    getTimeOfDay(hour) {
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        return 'night';
    }

    getNextOptimalReminderTime() {
        const now = new Date();
        const currentHour = now.getHours();
        
        const futureOptimalTimes = this.optimalTimes.filter(hour => hour > currentHour);
        
        if (futureOptimalTimes.length > 0) {
            return futureOptimalTimes[0];
        }
        
        return this.optimalTimes[0] || currentHour + 1;
    }

    getPersonalizedAdvice() {
        const analysis = this.statistics.analyzeHabits();
        const advice = [];
        
        if (analysis.averageCount < 6) {
            advice.push({
                type: 'warning',
                message: '您的饮水量偏低，建议设置更频繁的提醒'
            });
        }
        
        if (analysis.regularityScore < 60) {
            advice.push({
                type: 'suggestion',
                message: '您的饮水习惯不太规律，建议固定饮水时间'
            });
        }
        
        if (this.optimalTimes.length > 0) {
            const bestTime = this.optimalTimes[0];
            advice.push({
                type: 'info',
                message: `您最常在${bestTime}:00饮水，这是您的最佳饮水时间`
            });
        }
        
        return advice;
    }

    updatePattern(drinkHour) {
        if (!this.userPatterns.hourlyDistribution) {
            this.userPatterns.hourlyDistribution = {};
        }
        
        if (!this.userPatterns.hourlyDistribution[drinkHour]) {
            this.userPatterns.hourlyDistribution[drinkHour] = 0;
        }
        
        this.userPatterns.hourlyDistribution[drinkHour]++;
        this.savePatterns();
    }

    getReminderSchedule(baseInterval, weatherData = null) {
        const schedule = [];
        const now = new Date();
        let currentTime = new Date(now);
        
        for (let i = 0; i < 8; i++) {
            const hour = currentTime.getHours();
            const interval = this.calculateOptimalInterval(baseInterval, hour, weatherData);
            
            currentTime = new Date(currentTime.getTime() + interval);
            
            schedule.push({
                time: currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                hour: currentTime.getHours(),
                interval: Math.round(interval / 60000)
            });
        }
        
        return schedule;
    }
}

class WaterCalculator {
    constructor(errorHandler) {
        this.errorHandler = errorHandler;
    }

    calculateRecommendedWater(weight, activityLevel, weatherData = null) {
        try {
            this.errorHandler.validateInput(weight, '体重', {
                required: true,
                type: 'number',
                min: 30,
                max: 200
            });
            
            this.errorHandler.validateInput(activityLevel, '活动水平', {
                required: true,
                type: 'string'
            });
            
            let baseWater = weight * 0.03;
            
            const activityMultiplier = {
                'sedentary': 1.0,
                'lightly': 1.2,
                'moderately': 1.5,
                'very': 1.8,
                'extra': 2.0
            };
            
            if (!activityMultiplier[activityLevel]) {
                activityLevel = 'moderately';
            }
            
            baseWater *= activityMultiplier[activityLevel];
            
            if (weatherData) {
                if (weatherData.temperature > 25) {
                    baseWater *= (1 + (weatherData.temperature - 25) / 50);
                }
                if (weatherData.humidity < 40) {
                    baseWater *= 1.1;
                }
            }
            
            const cups = Math.round(baseWater * 4);
            const ml = Math.round(baseWater * 1000);
            
            return {
                cups,
                ml,
                baseWater
            };
        } catch (error) {
            this.errorHandler.handleError(error, this.errorHandler.errorTypes.CALCULATION, {
                method: 'calculateRecommendedWater',
                weight,
                activityLevel
            });
            return { cups: 8, ml: 2000, baseWater: 2 };
        }
    }

    calculateSmartInterval(baseInterval, activeHours, currentHour, weatherData = null) {
        try {
            this.errorHandler.validateInput(baseInterval, '基础间隔', {
                required: true,
                type: 'number',
                min: 15,
                max: 120
            });
            
            this.errorHandler.validateInput(currentHour, '当前小时', {
                required: true,
                type: 'number',
                min: 0,
                max: 23
            });
            
            let interval = baseInterval;
            
            if (activeHours && activeHours.includes(currentHour)) {
                interval = Math.max(20, interval * 0.7);
            } else {
                interval = Math.min(120, interval * 1.3);
            }
            
            if (weatherData && weatherData.temperature > 30) {
                interval = Math.max(15, interval * 0.8);
            }
            
            return interval * 60000;
        } catch (error) {
            this.errorHandler.handleError(error, this.errorHandler.errorTypes.CALCULATION, {
                method: 'calculateSmartInterval',
                baseInterval,
                currentHour
            });
            return baseInterval * 60000;
        }
    }
}

class ThemeManager {
    constructor(storageManager, errorHandler) {
        this.storage = storageManager;
        this.errorHandler = errorHandler;
        this.isDarkTheme = false;
        this.initTheme();
    }

    initTheme() {
        this.isDarkTheme = this.loadTheme();
        this.updateThemeUI();
    }

    loadTheme() {
        const theme = this.storage.load(this.storage.storageKeys.theme);
        return theme === 'dark';
    }

    saveTheme(isDark) {
        this.storage.save(this.storage.storageKeys.theme, isDark ? 'dark' : 'light');
    }

    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        this.saveTheme(this.isDarkTheme);
        this.updateThemeUI();
        return this.isDarkTheme;
    }

    updateThemeUI() {
        const body = document.body;
        const themeBtn = document.getElementById('theme-btn');
        
        if (themeBtn) {
            const themeIcon = themeBtn.querySelector('i');
            if (themeIcon) {
                if (this.isDarkTheme) {
                    body.classList.add('dark-theme');
                    themeIcon.className = 'fas fa-sun fa-lg';
                } else {
                    body.classList.remove('dark-theme');
                    themeIcon.className = 'fas fa-moon fa-lg';
                }
            }
        }
    }
}

class WaterReminder {
    constructor() {
        this.interval = 60;
        this.waterCount = 0;
        this.waterGoal = 8;
        this.isRunning = false;
        this.reminderInterval = null;
        this.countdownInterval = null;
        this.remainingTime = this.interval * 60;
        
        this.weight = 60;
        this.activityLevel = 'moderately';
        this.soundEffect = 'water';
        this.location = '北京';
        this.weatherData = null;
        this.smartReminderEnabled = false;
        this.drinkPattern = {};
        this.activeHours = [];
        
        this.errorHandler = new ErrorHandler();
        this.initializeManagers();
        this.initializeDOMElements();
        this.bindEvents();
        this.initData();
        this.updateUI();
        
        // 纯前端本地模式：数据始终保存在浏览器 localStorage
    }

    initializeManagers() {
        this.storage = new StorageManager(this.errorHandler);
        this.statistics = new StatisticsManager(this.storage, this.errorHandler);
        this.achievements = new AchievementManager(this.storage, this.statistics, this.errorHandler);
        this.challenges = new ChallengeManager(this.storage, this.statistics, this.errorHandler);
        this.healthMonitor = new HealthMonitor(this.statistics, this.errorHandler);
        this.calculator = new WaterCalculator(this.errorHandler);
        this.smartReminder = new SmartReminderManager(this.statistics, this.calculator, this.errorHandler);
        this.theme = new ThemeManager(this.storage, this.errorHandler);
    }

    initializeDOMElements() {
        this.waterStatsElement = document.getElementById('water-stats');
        this.countdownElement = document.getElementById('countdown');
        this.drinkBtn = document.getElementById('drink-btn');
        this.decreaseBtn = document.getElementById('decrease-btn');
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.settingsBtn = document.getElementById('settings-btn');
        this.statsBtn = document.getElementById('stats-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.shareBtn = document.getElementById('share-btn');
        this.themeBtn = document.getElementById('theme-btn');
        this.exportBtn = document.getElementById('export-btn');
        
        this.settingsModal = new bootstrap.Modal(document.getElementById('settings-modal'));
        this.notificationModal = new bootstrap.Modal(document.getElementById('notification-modal'));
        this.goalModal = new bootstrap.Modal(document.getElementById('goal-modal'));
        this.statsModal = new bootstrap.Modal(document.getElementById('stats-modal'));
        
        this.weeklyStatsElement = document.getElementById('weekly-stats');
        this.monthlyStatsElement = document.getElementById('monthly-stats');
        this.overallStatsElement = document.getElementById('overall-stats');
        this.seasonalTipElement = document.getElementById('seasonal-tip');
        this.waterProgress = document.getElementById('water-progress');
        this.progressPercent = document.getElementById('progress-percent');
        
        this.intervalInput = document.getElementById('interval-input');
        this.goalInput = document.getElementById('goal-input');
        this.weightInput = document.getElementById('weight-input');
        this.activityLevelInput = document.getElementById('activity-level');
        this.recommendedWaterElement = document.getElementById('recommended-water');
        this.locationInput = document.getElementById('location-input');
        this.weatherInfoElement = document.getElementById('weather-info');
        this.smartReminderCheckbox = document.getElementById('smart-reminder');
        this.saveSettingsBtn = document.getElementById('save-settings-btn');
        this.notificationDrinkBtn = document.getElementById('notification-drink-btn');
    }

    bindEvents() {
        this.drinkBtn.addEventListener('click', () => this.manualDrink());
        this.decreaseBtn.addEventListener('click', () => this.decreaseDrink());
        this.startBtn.addEventListener('click', () => this.startReminder());
        this.stopBtn.addEventListener('click', () => this.stopReminder());
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.statsBtn.addEventListener('click', () => this.openStats());
        this.shareBtn.addEventListener('click', () => this.shareAchievements());
        this.themeBtn.addEventListener('click', () => this.theme.toggleTheme());
        this.resetBtn.addEventListener('click', () => this.resetStats());
        this.exportBtn.addEventListener('click', () => this.exportData());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.notificationDrinkBtn.addEventListener('click', () => {
            this.manualDrink();
            this.notificationModal.hide();
        });
        this.locationInput.addEventListener('input', () => this.updateWeather());
    }

    initData() {
        const savedData = this.storage.load(this.storage.storageKeys.userData);
        if (savedData) {
            this.interval = savedData.interval || 60;
            this.waterCount = savedData.waterCount || 0;
            this.waterGoal = savedData.waterGoal || 8;
            this.isRunning = savedData.isRunning || false;
            this.weight = savedData.weight || 60;
            this.activityLevel = savedData.activityLevel || 'moderately';
            this.soundEffect = savedData.soundEffect || 'water';
            this.location = savedData.location || '北京';
            this.weatherData = savedData.weatherData || null;
            this.smartReminderEnabled = savedData.smartReminder || false;
            this.drinkPattern = savedData.drinkPattern || {};
        } else {
            this.weight = 60;
            this.activityLevel = 'moderately';
            this.soundEffect = 'water';
            this.location = '北京';
            this.weatherData = null;
            this.smartReminderEnabled = false;
            this.drinkPattern = {};
        }
        
        const lastDate = this.storage.load(this.storage.storageKeys.lastDate);
        const today = new Date().toDateString();
        if (lastDate !== today) {
            this.waterCount = 0;
            this.storage.save(this.storage.storageKeys.lastDate, today);
            this.saveData();
        }
        
        this.updateInputValues();
        this.calculateRecommendedWater();
        this.updateSeasonalTip();
        this.initPets();
        this.analyzeDrinkPattern();
        
        if (this.isRunning) {
            this.startReminder();
        }
    }

    updateInputValues() {
        if (this.intervalInput) this.intervalInput.value = this.interval;
        if (this.goalInput) this.goalInput.value = this.waterGoal;
        if (this.weightInput) this.weightInput.value = this.weight;
        if (this.activityLevelInput) this.activityLevelInput.value = this.activityLevel;
        if (this.locationInput) this.locationInput.value = this.location;
        if (this.smartReminderCheckbox) this.smartReminderCheckbox.checked = this.smartReminderEnabled;
    }

    saveData() {
        const data = {
            interval: this.interval,
            waterCount: this.waterCount,
            waterGoal: this.waterGoal,
            isRunning: this.isRunning,
            weight: this.weight,
            activityLevel: this.activityLevel,
            soundEffect: this.soundEffect,
            location: this.location,
            weatherData: this.weatherData,
            smartReminder: this.smartReminderEnabled,
            drinkPattern: this.drinkPattern
        };
        this.storage.save(this.storage.storageKeys.userData, data);
    }

    calculateRecommendedWater() {
        const result = this.calculator.calculateRecommendedWater(
            this.weight,
            this.activityLevel,
            this.weatherData
        );
        
        if (this.recommendedWaterElement) {
            this.recommendedWaterElement.textContent = `${result.cups} 杯 (约 ${result.ml}ml)`;
        }
        
        return result.cups;
    }

    updateUI() {
        this.updateWaterCups();
        this.updateCountdown();
        this.updatePets();
        this.updateProgress();
    }

    updateWaterCups() {
        if (!this.waterStatsElement) return;
        
        const existingCups = this.waterStatsElement.querySelectorAll('.water-cup');
        if (existingCups.length !== this.waterGoal) {
            this.waterStatsElement.innerHTML = '';
            for (let i = 1; i <= this.waterGoal; i++) {
                const cupElement = document.createElement('div');
                cupElement.className = `water-cup ${i <= this.waterCount ? 'filled' : 'empty'}`;
                cupElement.textContent = '🥤';
                this.waterStatsElement.appendChild(cupElement);
            }
        } else {
            existingCups.forEach((cup, index) => {
                const cupNumber = index + 1;
                if (cupNumber <= this.waterCount) {
                    cup.classList.remove('empty');
                    cup.classList.add('filled');
                } else {
                    cup.classList.remove('filled');
                    cup.classList.add('empty');
                }
            });
        }
        
        const goalCupsElement = document.getElementById('goal-cups');
        if (goalCupsElement) {
            goalCupsElement.textContent = `${this.waterGoal} 杯`;
        }
    }

    updateCountdown() {
        if (!this.countdownElement) return;
        
        const minutes = Math.floor(this.remainingTime / 60);
        const seconds = this.remainingTime % 60;
        this.countdownElement.textContent = `下次提醒: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateProgress() {
        if (!this.waterProgress || !this.progressPercent) return;
        
        const progress = Math.min((this.waterCount / this.waterGoal) * 100, 100);
        this.waterProgress.style.width = `${progress}%`;
        this.progressPercent.textContent = `${Math.round(progress)}%`;
    }

    initPets() {
        const petIcons = ['🐶', '🐱', '🐰', '🐻', '🐼', '🐨', '🐵', '🐔', '🐧', '🐸', '🐳', '🦊', '🐺', '🐮', '🐷'];
        
        for (let i = petIcons.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [petIcons[i], petIcons[j]] = [petIcons[j], petIcons[i]];
        }
        
        const petItems = document.querySelectorAll('.pet-item');
        petItems.forEach((petItem, index) => {
            if (index < this.waterGoal) {
                petItem.style.display = 'block';
                const petIcon = petItem.querySelector('.pet-icon');
                if (petIcon) {
                    petIcon.textContent = petIcons[index];
                }
            } else {
                petItem.style.display = 'none';
            }
        });
    }

    updatePets() {
        const petItems = document.querySelectorAll('.pet-item');
        petItems.forEach((petItem, index) => {
            const level = index + 1;
            const petIcon = petItem.querySelector('.pet-icon');
            const petLabel = petItem.querySelector('.pet-label');
            const petCover = petItem.querySelector('.pet-cover');
            
            if (this.waterCount >= level) {
                if (petIcon) {
                    petIcon.classList.remove('locked');
                    petIcon.classList.add('unlocked');
                }
                if (petCover) {
                    petCover.classList.remove('locked');
                    petCover.classList.add('unlocked');
                }
                if (petLabel) {
                    petLabel.classList.remove('locked');
                    petLabel.classList.add('unlocked');
                    petLabel.textContent = '';
                }
            } else {
                if (petIcon) {
                    petIcon.classList.add('locked');
                    petIcon.classList.remove('unlocked');
                }
                if (petCover) {
                    petCover.classList.add('locked');
                    petCover.classList.remove('unlocked');
                }
                if (petLabel) {
                    petLabel.classList.add('locked');
                    petLabel.classList.remove('unlocked');
                    petLabel.textContent = '';
                }
            }
        });
    }

    updateSeasonalTip() {
        if (!this.seasonalTipElement) return;
        
        const { tip } = this.healthMonitor.getSeasonalAdvice();
        this.seasonalTipElement.innerHTML = tip;
    }

    analyzeDrinkPattern() {
        const hourCounts = Object.entries(this.drinkPattern)
            .map(([hour, count]) => ({ hour: parseInt(hour), count }))
            .sort((a, b) => b.count - a.count);
        
        this.activeHours = hourCounts.slice(0, 3).map(item => item.hour);
    }

    manualDrink() {
        this.waterCount++;
        
        const now = new Date();
        const hour = now.getHours();
        
        this.updateDrinkPattern(hour);
        this.statistics.recordDrinkTime(now.toISOString());
        this.statistics.recordDailyStats(this.waterCount, this.waterGoal);
        
        this.saveData();
        this.updateUI();
        
        const newAchievements = this.achievements.checkAchievements();
        if (newAchievements.length > 0) {
            this.showAchievementUnlocked(newAchievements);
        }
        
        this.challenges.updateChallengeProgress();
        
        if (this.waterCount >= this.waterGoal) {
            this.showGoalAchieved();
        }
    }

    decreaseDrink() {
        if (this.waterCount > 0) {
            this.waterCount--;
            this.statistics.removeLastDrinkTime();
            this.statistics.recordDailyStats(this.waterCount, this.waterGoal);
            this.saveData();
            this.updateUI();
        }
    }

    updateDrinkPattern(hour) {
        if (!this.drinkPattern[hour]) {
            this.drinkPattern[hour] = 0;
        }
        this.drinkPattern[hour]++;
        this.saveData();
    }

    startReminder() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.saveData();
            this.updateUI();
            
            let interval = this.interval * 60000;
            
            if (this.smartReminderEnabled) {
                const currentHour = new Date().getHours();
                interval = this.smartReminder.calculateOptimalInterval(
                    this.interval,
                    currentHour,
                    this.weatherData
                );
            }
            
            this.reminderInterval = setInterval(() => {
                this.showNotification();
            }, interval);
            
            this.startCountdown();
        }
    }

    stopReminder() {
        this.isRunning = false;
        this.saveData();
        
        if (this.reminderInterval) {
            clearInterval(this.reminderInterval);
            this.reminderInterval = null;
        }
        
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    startCountdown() {
        this.remainingTime = this.interval * 60;
        
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        this.countdownInterval = setInterval(() => {
            if (this.remainingTime > 0) {
                this.remainingTime--;
                this.updateCountdown();
            } else {
                this.remainingTime = this.interval * 60;
            }
        }, 1000);
    }

    showNotification() {
        this.playSound();
        if (this.notificationModal) {
            this.notificationModal.show();
        }
    }

    playSound() {
        if (this.soundEffect === 'none') return;
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        switch (this.soundEffect) {
            case 'water':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
                break;
            case 'bell':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
                break;
            case 'notification':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
                break;
        }
    }

    showGoalAchieved() {
        if (this.goalModal) {
            this.goalModal.show();
        }
    }

    showAchievementUnlocked(achievements) {
        achievements.forEach(achievement => {
            const notification = document.createElement('div');
            notification.className = 'achievement-notification';
            notification.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-info">
                    <h4>成就解锁!</h4>
                    <p>${achievement.title}</p>
                    <p class="achievement-description">${achievement.description}</p>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '1';
            }, 100);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 500);
            }, 3000);
        });
    }

    openSettings() {
        this.updateInputValues();
        this.calculateRecommendedWater();
        if (this.settingsModal) {
            this.settingsModal.show();
        }
    }

    saveSettings() {
        const newInterval = parseInt(this.intervalInput.value);
        const newGoal = parseInt(this.goalInput.value);
        const newWeight = parseInt(this.weightInput.value);
        const newActivityLevel = this.activityLevelInput.value;
        const newSoundEffect = this.soundEffectSelect ? this.soundEffectSelect.value : this.soundEffect;
        const newLocation = this.locationInput.value;
        const newSmartReminder = this.smartReminderCheckbox.checked;
        
        if (newInterval > 0 && newGoal > 0 && newGoal <= 15 && newWeight >= 30 && newWeight <= 200) {
            this.interval = newInterval;
            this.waterGoal = newGoal;
            this.weight = newWeight;
            this.activityLevel = newActivityLevel;
            this.soundEffect = newSoundEffect;
            this.location = newLocation || '北京';
            this.smartReminderEnabled = newSmartReminder;
            this.saveData();
            this.calculateRecommendedWater();
            this.initPets();
            this.updateUI();
            
            if (this.isRunning) {
                this.stopReminder();
                this.startReminder();
            }
            
            if (this.settingsModal) {
                this.settingsModal.hide();
            }
        } else if (newGoal > 15) {
            window.AppUI.toast('每日喝水目标不能超过15杯，喝太多水对身体不好', 'warning');
        } else if (newWeight < 30 || newWeight > 200) {
            window.AppUI.toast('体重必须在30-200kg之间', 'warning');
        }
    }

    openStats() {
        this.updateStatsUI();
        if (this.statsModal) {
            this.statsModal.show();
        }
    }

    updateStatsUI() {
        this.updateWeeklyStats();
        this.updateMonthlyStats();
        this.updateOverallStats();
        this.updateTimeDistribution();
        this.updateHabitsAnalysis();
        this.updateHealthMonitoring();
    }

    updateWeeklyStats() {
        if (!this.weeklyStatsElement) return;
        
        const stats = this.statistics.getWeeklyStats();
        
        this.weeklyStatsElement.innerHTML = `
            <div class="stats-item">
                <span class="stats-label">跟踪天数</span>
                <span class="stats-value">${stats.daysTracked} 天</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">总饮水量</span>
                <span class="stats-value">${stats.totalCount} 杯</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">平均每日饮水量</span>
                <span class="stats-value">${stats.averageCount} 杯</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">平均每日目标</span>
                <span class="stats-value">${stats.averageGoal} 杯</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">完成率</span>
                <span class="stats-value">${stats.completionRate}%</span>
            </div>
        `;
    }

    updateMonthlyStats() {
        if (!this.monthlyStatsElement) return;
        
        const stats = this.statistics.getMonthlyStats();
        
        this.monthlyStatsElement.innerHTML = `
            <div class="stats-item">
                <span class="stats-label">跟踪天数</span>
                <span class="stats-value">${stats.daysTracked} 天</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">总饮水量</span>
                <span class="stats-value">${stats.totalCount} 杯</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">平均每日饮水量</span>
                <span class="stats-value">${stats.averageCount} 杯</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">平均每日目标</span>
                <span class="stats-value">${stats.averageGoal} 杯</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">完成率</span>
                <span class="stats-value">${stats.completionRate}%</span>
            </div>
        `;
    }

    updateOverallStats() {
        if (!this.overallStatsElement) return;
        
        const stats = this.statistics.getOverallStats();
        
        this.overallStatsElement.innerHTML = `
            <div class="stats-item">
                <span class="stats-label">总跟踪天数</span>
                <span class="stats-value">${stats.daysTracked} 天</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">总饮水量</span>
                <span class="stats-value">${stats.totalCount} 杯</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">平均每日饮水量</span>
                <span class="stats-value">${stats.averageCount} 杯</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">平均每日目标</span>
                <span class="stats-value">${stats.averageGoal} 杯</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">完成率</span>
                <span class="stats-value">${stats.completionRate}%</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">最佳饮水日</span>
                <span class="stats-value">${stats.bestDay} 杯 (${stats.bestDayDate})</span>
            </div>
        `;
    }

    updateTimeDistribution() {
        const today = new Date().toDateString();
        const todayData = this.statistics.statsData[today];
        const drinkTimes = todayData && todayData.drinkTimes ? todayData.drinkTimes : [];
        
        this.generateTimeDistributionChart(drinkTimes);
        this.displayDrinkTimesList(drinkTimes);
    }

    generateTimeDistributionChart(drinkTimes) {
        const timeChartElement = document.getElementById('time-chart');
        if (!timeChartElement) return;
        
        timeChartElement.innerHTML = '';
        
        if (drinkTimes.length === 0) {
            timeChartElement.innerHTML = '<p class="text-center">今日暂无饮水记录</p>';
            return;
        }
        
        const hours = Array.from({length: 24}, (_, i) => i);
        const drinkCounts = new Array(24).fill(0);
        
        drinkTimes.forEach(timeStr => {
            const time = new Date(timeStr);
            const hour = time.getHours();
            drinkCounts[hour]++;
        });
        
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 300;
        timeChartElement.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hours.map(h => `${h}:00`),
                datasets: [{
                    label: '饮水量',
                    data: drinkCounts,
                    backgroundColor: 'rgba(30, 136, 229, 0.6)',
                    borderColor: 'rgba(30, 136, 229, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: '今日饮水时间分布'
                    }
                }
            }
        });
    }

    displayDrinkTimesList(drinkTimes) {
        const drinkTimesListElement = document.getElementById('drink-times-list');
        if (!drinkTimesListElement) return;
        
        if (drinkTimes.length === 0) {
            drinkTimesListElement.innerHTML = '<p class="text-center">今日暂无饮水记录</p>';
            return;
        }
        
        const sortedDrinkTimes = drinkTimes.sort((a, b) => new Date(a) - new Date(b));
        
        let html = '<h5>今日饮水时间</h5><ul class="list-group">';
        sortedDrinkTimes.forEach((timeStr, index) => {
            const time = new Date(timeStr);
            const formattedTime = time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            html += `<li class="list-group-item">${index + 1}. ${formattedTime}</li>`;
        });
        html += '</ul>';
        
        drinkTimesListElement.innerHTML = html;
    }

    updateHabitsAnalysis() {
        const habitsElement = document.getElementById('habits-analysis');
        if (!habitsElement) return;
        
        if (!this.statistics.statsData || Object.keys(this.statistics.statsData).length === 0) {
            habitsElement.innerHTML = '<p class="text-center">暂无数据可分析</p>';
            return;
        }
        
        const analysis = this.statistics.analyzeHabits();
        
        let html = '';
        
        html += `
            <div class="habit-item ${analysis.averageCount >= analysis.averageGoal ? 'suggestion' : 'warning'}">
                <h5>平均每日饮水量</h5>
                <p>您平均每天喝 ${analysis.averageCount} 杯水，目标为 ${analysis.averageGoal} 杯。</p>
                <p>${analysis.averageCount >= analysis.averageGoal ? '👍 很好！您的饮水习惯很健康。' : '⚠️ 建议增加饮水量，达到每日目标。'}</p>
            </div>
        `;
        
        html += `
            <div class="habit-item ${analysis.regularityScore >= 70 ? 'suggestion' : 'warning'}">
                <h5>饮水规律性</h5>
                <p>您的饮水规律性评分为 ${analysis.regularityScore} 分。</p>
                <p>${this.getRegularityAdvice(analysis.regularityScore)}</p>
            </div>
        `;
        
        html += `
            <div class="habit-item suggestion">
                <h5>最佳饮水时段</h5>
                <p>您最常在 ${analysis.bestTime} 时段饮水。</p>
                <p>建议：${this.getTimeAdvice(analysis.bestTime)}</p>
            </div>
        `;
        
        html += `
            <div class="habit-item ${analysis.trend >= 0 ? 'suggestion' : 'warning'}">
                <h5>完成率趋势</h5>
                <p>最近一周的完成率趋势：${analysis.trend >= 0 ? '上升' : '下降'}。</p>
                <p>${analysis.trend >= 0 ? '👍 很好！您的饮水习惯在改善。' : '⚠️ 建议调整饮水习惯，提高完成率。'}</p>
            </div>
        `;
        
        html += `
            <div class="habit-item ${analysis.currentStreak >= 3 ? 'suggestion' : 'warning'}">
                <h5>连续达成天数</h5>
                <p>您已连续 ${analysis.currentStreak} 天达成饮水目标。</p>
                <p>${this.getStreakAdvice(analysis.currentStreak)}</p>
            </div>
        `;
        
        habitsElement.innerHTML = html;
    }

    getRegularityAdvice(score) {
        if (score >= 80) {
            return '👍 很好！您的饮水习惯非常规律，请继续保持。';
        } else if (score >= 60) {
            return '👌 不错！您的饮水习惯比较规律，可以进一步提高。';
        } else if (score >= 40) {
            return '⚠️ 您的饮水习惯需要改善，建议制定固定的饮水计划。';
        } else {
            return '🔴 您的饮水习惯不太规律，强烈建议制定饮水计划并坚持执行。';
        }
    }

    getTimeAdvice(time) {
        switch (time) {
            case '早晨':
                return '早晨饮水有助于启动新陈代谢，是很好的习惯。建议继续在早晨喝1-2杯水。';
            case '下午':
                return '下午饮水有助于保持精力，建议在工作间隙适当饮水。';
            case '晚上':
                return '晚上饮水有助于放松，但睡前1-2小时不宜大量饮水。';
            case '深夜':
                return '深夜饮水可能影响睡眠质量，建议调整饮水时间到白天。';
            default:
                return '保持规律的饮水时间对健康很重要。';
        }
    }

    getStreakAdvice(streak) {
        if (streak >= 7) {
            return '🎉 太棒了！您已连续一周达成目标，继续保持！';
        } else if (streak >= 3) {
            return '👍 很好！您已连续几天达成目标，继续保持。';
        } else if (streak >= 1) {
            return '💪 继续努力，争取连续达成目标。';
        } else {
            return '📅 从今天开始，努力达成每日饮水目标吧！';
        }
    }

    updateHealthMonitoring() {
        const healthElement = document.getElementById('health-monitoring');
        if (!healthElement) return;
        
        if (!this.statistics.statsData || Object.keys(this.statistics.statsData).length === 0) {
            healthElement.innerHTML = '<p class="text-center">暂无数据可分析</p>';
            return;
        }
        
        const healthData = this.healthMonitor.analyzeHealthData();
        
        const riskClass = healthData.dehydrationRisk === '低' ? 'risk-low' : 
                         healthData.dehydrationRisk === '中' ? 'risk-medium' : 'risk-high';
        
        let html = '';
        
        html += `
            <div class="health-card">
                <h4>🥤 脱水风险评估</h4>
                <div class="dehydration-risk ${riskClass}">
                    <h3>${healthData.dehydrationRisk}风险</h3>
                    <p>${healthData.dehydrationMessage}</p>
                </div>
            </div>
        `;
        
        html += `
            <div class="health-card">
                <h4>📊 健康统计</h4>
                <div class="health-stats">
                    <div class="health-stat-item">
                        <h5>平均每日饮水量</h5>
                        <div class="value">${healthData.averageDailyWater} 杯</div>
                    </div>
                    <div class="health-stat-item">
                        <h5>目标达成率</h5>
                        <div class="value">${healthData.goalCompletionRate}%</div>
                    </div>
                    <div class="health-stat-item">
                        <h5>连续达标天数</h5>
                        <div class="value">${healthData.currentStreak} 天</div>
                    </div>
                    <div class="health-stat-item">
                        <h5>本周饮水量</h5>
                        <div class="value">${healthData.weeklyWater} 杯</div>
                    </div>
                </div>
            </div>
        `;
        
        html += `
            <div class="health-card">
                <h4>💡 健康建议</h4>
                <div class="health-tips">
                    <h5>饮水建议</h5>
                    <ul>
                        ${healthData.healthTips.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
        
        healthElement.innerHTML = html;
    }

    updateWeather() {
        const location = this.locationInput.value || '北京';
        if (this.weatherInfoElement) {
            this.weatherInfoElement.textContent = '加载天气中...';
        }
        
        setTimeout(() => {
            const weatherData = this.getMockWeatherData(location);
            this.weatherData = weatherData;
            
            if (this.weatherInfoElement) {
                this.weatherInfoElement.innerHTML = `
                    <strong>当前天气：</strong>${weatherData.temperature}°C，${weatherData.description}<br>
                    <strong>湿度：</strong>${weatherData.humidity}%<br>
                    <strong>风速：</strong>${weatherData.windSpeed}km/h
                `;
            }
            
            this.calculateRecommendedWater();
            this.saveData();
        }, 500);
    }

    getMockWeatherData(location) {
        const weatherConditions = [
            { temperature: 25, description: '晴', humidity: 45, windSpeed: 10 },
            { temperature: 30, description: '高温', humidity: 60, windSpeed: 5 },
            { temperature: 18, description: '多云', humidity: 55, windSpeed: 8 },
            { temperature: 12, description: '凉爽', humidity: 65, windSpeed: 12 }
        ];
        
        const seed = location.length + new Date().getDate();
        const index = seed % weatherConditions.length;
        return weatherConditions[index];
    }

    shareAchievements() {
        const stats = this.achievements.calculateAchievementStats();
        const unlockedCount = this.achievements.getUnlockedCount();
        const totalCount = this.achievements.getTotalCount();
        
        const shareText = `我在喝水提醒应用中已经解锁了 ${unlockedCount}/${totalCount} 个成就！\n\n` +
                         `累计饮水量: ${stats.totalDrinks} 杯\n` +
                         `最长连续天数: ${stats.currentStreak} 天\n` +
                         `最大日饮水量: ${stats.maxDailyDrinks} 杯\n\n` +
                         `一起来保持健康的饮水习惯吧！💧`;
        
        if (navigator.share) {
            navigator.share({
                title: '我的饮水成就',
                text: shareText,
                url: window.location.href
            })
            .catch(err => {
                this.fallbackShare(shareText);
            });
        } else {
            this.fallbackShare(shareText);
        }
    }

    fallbackShare(shareText) {
        navigator.clipboard.writeText(shareText)
            .then(() => {
                window.AppUI.toast('分享内容已复制到剪贴板，您可以粘贴到社交媒体中！', 'success');
            })
            .catch(err => {
                console.error('复制失败:', err);
                const shareModal = document.createElement('div');
                shareModal.className = 'share-modal';
                shareModal.innerHTML = `
                    <div class="share-modal-content">
                        <h4>分享我的饮水成就</h4>
                        <textarea class="form-control" rows="6">${shareText}</textarea>
                        <div class="share-buttons">
                            <button class="btn btn-primary" id="copy-share-btn">复制内容</button>
                            <button class="btn btn-secondary" id="close-share-btn">关闭</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(shareModal);
                
                document.getElementById('copy-share-btn').addEventListener('click', () => {
                    const textarea = shareModal.querySelector('textarea');
                    textarea.select();
                    document.execCommand('copy');
                    window.AppUI.toast('分享内容已复制到剪贴板！', 'success');
                });
                
                document.getElementById('close-share-btn').addEventListener('click', () => {
                    document.body.removeChild(shareModal);
                });
            });
    }

    resetStats() {
        window.AppUI.confirm('确定要重置喝水统计吗？', () => {
            this.waterCount = 0;
            this.saveData();
            this.updateUI();
            window.AppUI.toast('统计数据已重置', 'success');
        }, '重置');
    }

    exportData() {
        const csvContent = this.statistics.exportData();
        if (!csvContent) {
            window.AppUI.toast('暂无数据可导出', 'info');
            return;
        }
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `饮水数据_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new WaterReminder();
});