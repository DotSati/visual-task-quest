import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

const SESSION_CHECK_INTERVAL = 60 * 1000; // Check every minute
const SESSION_MAX_AGE_MS = 10 * 24 * 60 * 60 * 1000; // 10 days in milliseconds
const SESSION_STORAGE_KEY = 'sb-pmfhygfkzgtsyzbauzeo-auth-token';

export const useSessionManager = () => {
  const navigate = useNavigate();
  const lastCheckRef = useRef<number>(Date.now());

  const clearExpiredSession = useCallback(async () => {
    try {
      // Get current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error);
        return;
      }

      if (!session) {
        // No session exists, clean up any stale storage
        cleanupLocalStorage();
        return;
      }

      // Check if session token has expired based on exp claim
      const tokenPayload = parseJwt(session.access_token);
      if (tokenPayload && tokenPayload.exp) {
        const expiryTime = tokenPayload.exp * 1000; // Convert to milliseconds
        const now = Date.now();

        if (now >= expiryTime) {
          console.log('Session expired, cleaning up...');
          await handleExpiredSession();
          return;
        }

        // Also check if session is older than 10 days based on issued_at
        if (tokenPayload.iat) {
          const issuedAt = tokenPayload.iat * 1000;
          const sessionAge = now - issuedAt;
          
          if (sessionAge >= SESSION_MAX_AGE_MS) {
            console.log('Session exceeded 10-day limit, cleaning up...');
            await handleExpiredSession();
            return;
          }
        }

        // Warn user if session is about to expire (within 1 hour)
        const timeUntilExpiry = expiryTime - now;
        if (timeUntilExpiry < 60 * 60 * 1000 && timeUntilExpiry > 0) {
          toast({
            title: "Session Expiring Soon",
            description: "Your session will expire in less than an hour. Please save your work.",
            variant: "destructive",
          });
        }
      }
    } catch (err) {
      console.error('Error checking session:', err);
    }
  }, []);

  const handleExpiredSession = useCallback(async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clean up local storage
      cleanupLocalStorage();

      toast({
        title: "Session Expired",
        description: "Your session has expired. Please log in again.",
        variant: "destructive",
      });

      // Redirect to auth page
      navigate('/auth');
    } catch (err) {
      console.error('Error handling expired session:', err);
      // Force cleanup even if signOut fails
      cleanupLocalStorage();
      navigate('/auth');
    }
  }, [navigate]);

  // Parse JWT token to get expiry info
  const parseJwt = (token: string): { exp?: number; iat?: number } | null => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  // Clean up all auth-related items from localStorage
  const cleanupLocalStorage = () => {
    try {
      // Remove Supabase auth token
      localStorage.removeItem(SESSION_STORAGE_KEY);
      
      // Remove any other Supabase-related storage items
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log('Cleaned up expired session data from localStorage');
    } catch (err) {
      console.error('Error cleaning localStorage:', err);
    }
  };

  useEffect(() => {
    // Initial session check
    clearExpiredSession();

    // Set up periodic session check
    const intervalId = setInterval(() => {
      const now = Date.now();
      // Prevent duplicate checks within short timeframe
      if (now - lastCheckRef.current >= SESSION_CHECK_INTERVAL - 1000) {
        lastCheckRef.current = now;
        clearExpiredSession();
      }
    }, SESSION_CHECK_INTERVAL);

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Session token refreshed');
      } else if (event === 'SIGNED_OUT') {
        cleanupLocalStorage();
      }
    });

    // Handle visibility change - check session when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearExpiredSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearExpiredSession]);

  return {
    checkSession: clearExpiredSession,
    handleExpiredSession,
  };
};
