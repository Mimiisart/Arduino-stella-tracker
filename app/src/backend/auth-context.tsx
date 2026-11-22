/**
 * Accounts: sign up (name + email + password + consent), sign in, sign out,
 * rename, and "Delete my data". Accounts are optional: Find My ID, alerts and
 * the map all work without one; community finding will need one.
 *
 * Names are stored in the `profiles` table, never next to location data
 * (see backend/supabase/schema.sql).
 */
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

export type Profile = {
  displayName: string;
  consentedAt: string;
  campusId: number | null;
};

type AuthValue = {
  ready: boolean; // false until the saved session has been loaded
  session: Session | null;
  email: string | null;
  profile: Profile | null;
  /** True for campus admins (may add rooms and places). */
  isAdmin: boolean;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    campusId: number | null;
  }) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  rename: (name: string) => Promise<void>;
  /** Save which university the signed-in person is at. */
  setProfileCampus: (campusId: number) => Promise<void>;
  deleteMyData: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/** Turn Supabase's error messages into plain, actionable sentences. */
export function friendlyAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password don’t match. Try again.';
  if (m.includes('email not confirmed')) return 'Confirm your email first: open the link we sent you, then sign in.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'There’s already an account with that email. Sign in instead.';
  if (m.includes('password') && (m.includes('6') || m.includes('weak') || m.includes('short')))
    return 'Use a password of at least 6 characters.';
  if (m.includes('invalid') && m.includes('email')) return 'That email address doesn’t look right.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Wait a minute and try again.';
  if (m.includes('network') || m.includes('fetch'))
    return 'No internet connection. Check your connection and try again.';
  return msg || 'Something went wrong. Try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  // The loaded profile, tagged with whose it is, so a signed-out or different
  // user never sees a stale name.
  const [loaded, setLoaded] = useState<{
    userId: string;
    profile: Profile | null;
  } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Load the profile for the signed-in person, creating it on first sign-in
  // from the name they gave at sign-up (kept in their account metadata, which
  // also covers projects where email confirmation delays the first session).
  const userId = session?.user.id ?? null;
  const profile = loaded && loaded.userId === userId ? loaded.profile : null;
  const [adminFor, setAdminFor] = useState<string | null>(null);
  const isAdmin = !!userId && adminFor === userId;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase.rpc('am_i_admin').then(({ data }) => {
      if (alive && data === true) setAdminFor(userId);
    });
    return () => {
      alive = false;
    };
  }, [userId]);
  const pendingName = String(session?.user.user_metadata?.display_name ?? '').trim();
  const pendingCampus = Number(session?.user.user_metadata?.campus_id) || null;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, consented_at, campus_id')
        .eq('id', userId)
        .maybeSingle();
      let row = data;
      if (!row) {
        if (pendingName) {
          const created = await supabase
            .from('profiles')
            .insert({
              id: userId,
              display_name: pendingName,
              campus_id: pendingCampus,
            })
            .select('display_name, consented_at, campus_id')
            .single();
          row = created.data;
        }
      }
      if (alive)
        setLoaded({
          userId,
          profile: row
            ? {
                displayName: row.display_name,
                consentedAt: row.consented_at,
                campusId: row.campus_id ?? null,
              }
            : null,
        });
    })();
    return () => {
      alive = false;
    };
  }, [userId, pendingName, pendingCampus]);

  const signUp = useCallback(
    async ({
      name,
      email,
      password,
      campusId,
    }: {
      name: string;
      email: string;
      password: string;
      campusId: number | null;
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim(), campus_id: campusId } },
      });
      if (error) throw error;
      return { needsConfirmation: !data.session };
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const rename = useCallback(
    async (name: string) => {
      if (!userId) return;
      const displayName = name.trim();
      const { error } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', userId);
      if (error) throw error;
      setLoaded((l) =>
        l && l.userId === userId && l.profile ? { userId, profile: { ...l.profile, displayName } } : l,
      );
    },
    [userId],
  );

  const setProfileCampus = useCallback(
    async (campusId: number) => {
      if (!userId) return;
      const { error } = await supabase.from('profiles').update({ campus_id: campusId }).eq('id', userId);
      if (error) throw error;
      setLoaded((l) => (l && l.userId === userId && l.profile ? { userId, profile: { ...l.profile, campusId } } : l));
    },
    [userId],
  );

  const deleteMyData = useCallback(async () => {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setLoaded(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      session,
      email: session?.user.email ?? null,
      profile,
      isAdmin,
      signUp,
      signIn,
      signOut,
      rename,
      setProfileCampus,
      deleteMyData,
    }),
    [ready, session, profile, isAdmin, signUp, signIn, signOut, rename, setProfileCampus, deleteMyData],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
