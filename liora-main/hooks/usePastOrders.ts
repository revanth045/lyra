import { useState, useEffect, useCallback } from 'react';
import { PastOrder } from '../types';
import { uid } from '../utils/uid';

const LOCAL_STORAGE_KEY = 'liora-past-orders';

export const usePastOrders = () => {
    const [pastOrders, setPastOrders] = useState<PastOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (stored) {
                setPastOrders(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to parse past orders from localStorage", e);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addOrder = useCallback((order: Omit<PastOrder, 'id'>) => {
        setPastOrders(prev => {
            const newOrder: PastOrder = { ...order, id: uid() };
            const newOrders = [newOrder, ...prev];
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newOrders));
            } catch (e) {
                console.error("Failed to save past orders to localStorage", e);
            }
            return newOrders;
        });
    }, []);

    return { pastOrders, addOrder, isLoading };
};
