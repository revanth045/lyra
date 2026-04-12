
import { useState, useEffect, useCallback } from 'react';
import { StoredUserProfile } from '../types';

const LOCAL_STORAGE_KEY = 'liora-user-profile';

export const useUserProfile = () => {
    const [profile, setProfile] = useState<StoredUserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const storedProfile = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedProfile) {
                setProfile(JSON.parse(storedProfile));
            }
        } catch (e) {
            console.error("Failed to parse user profile from localStorage", e);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const saveProfile = useCallback((newProfile: StoredUserProfile) => {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProfile));
            setProfile(newProfile);
        } catch (e) {
            console.error("Failed to save user profile to localStorage", e);
        }
    }, []);

    const clearProfile = useCallback(() => {
        try {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setProfile(null);
        } catch (e) {
            console.error("Failed to clear user profile from localStorage", e);
        }
    }, []);

    const updateAiPreferences = useCallback((prefs: Partial<NonNullable<StoredUserProfile['aiPreferences']>>) => {
        setProfile(currentProfile => {
            if (!currentProfile) return null;
            const newProfile: StoredUserProfile = { 
                ...currentProfile, 
                aiPreferences: {
                    ...(currentProfile.aiPreferences || { tone: 'friendly', style: 'classic' }),
                    ...prefs
                } 
            };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProfile));
            } catch (e) {
                console.error("Failed to save AI preferences to localStorage", e);
            }
            return newProfile;
        });
    }, []);

    return { profile, saveProfile, clearProfile, isLoading, updateAiPreferences };
};
