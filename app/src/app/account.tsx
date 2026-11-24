import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { friendlyAuthError, useAuth } from '@/backend/auth-context';
import { Button, Icon, ScreenHeader, T } from '@/components/minitag/ui';
import { F, R } from '@/constants/minitag';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

type Mode = 'signup' | 'signin';

/** Create an account (name, email, password, consent) or sign in. */
export default function AccountScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'signin' ? 'signin' : 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSentTo, setConfirmSentTo] = useState<string | null>(null);

  const signup = mode === 'signup';
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const canSubmit = signup
    ? name.trim().length > 0 && emailOk && password.length >= 6 && consent
    : emailOk && password.length > 0;

  const submit = async () => {
    setError(null);
    if (!canSubmit) {
      setError(
        signup && !consent
          ? 'Tick the box to agree to the privacy notice.'
          : !emailOk
            ? 'Enter a valid email address.'
            : signup && password.length < 6
              ? 'Use a password of at least 6 characters.'
              : 'Fill in every field.',
      );
      return;
    }
    setBusy(true);
    try {
      if (signup) {
        const { needsConfirmation } = await auth.signUp({ name, email, password });
        if (needsConfirmation) {
          setConfirmSentTo(email.trim());
          return;
        }
      } else {
        await auth.signIn(email, password);
      }
      router.back();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  if (confirmSentTo) {
    return (
      <View style={[s.page, { flex: 1, paddingBottom: insets.bottom + 24, justifyContent: 'center' }]}>
        <View style={s.mailIcon}>
          <Icon name="envelope.badge" size={36} color={p.link} />
        </View>
        <T variant="title" style={{ textAlign: 'center' }}>
          Check your email
        </T>
        <T variant="body" style={{ color: p.muted, textAlign: 'center' }}>
          We sent a confirmation link to {confirmSentTo}. Open it on this phone, then come back and sign in.
        </T>
        <Button
          title="I’ve confirmed, sign in"
          onPress={() => {
            setConfirmSentTo(null);
            switchMode('signin');
          }}
        />
        <Button title="Close" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: p.ground }}
        contentContainerStyle={[s.page, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Account" backLabel="Cancel" chevron={false} onBack={() => router.back()} />

        <View>
          <T variant="title">{signup ? 'Create your account' : 'Welcome back'}</T>
          <T variant="body" style={{ color: p.muted, marginTop: 8 }}>
            {signup
              ? 'An account lets other MiniTag users help find your tag. Beeping and alerts work without one.'
              : 'Sign in with the email and password you used before.'}
          </T>
        </View>

        <View style={s.segment} accessibilityRole="tablist">
          {(['signup', 'signin'] as Mode[]).map((m) => {
            const on = m === mode;
            return (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => switchMode(m)}
                style={[s.segmentItem, on && { backgroundColor: p.primary }]}>
                <Text style={[s.segmentText, { color: on ? p.onPrimary : p.ink }]}>
                  {m === 'signup' ? 'Create account' : 'Sign in'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {signup && (
          <Field label="Your name" nativeID="nameLabel">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Miracle"
              placeholderTextColor={p.muted}
              keyboardAppearance={p.mode}
              autoComplete="name"
              textContentType="name"
              maxLength={60}
              accessibilityLabelledBy="nameLabel"
              accessibilityLabel="Your name"
              style={s.input}
            />
          </Field>
        )}

        <Field label="Email" nativeID="emailLabel">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="name@school.edu"
            placeholderTextColor={p.muted}
            keyboardAppearance={p.mode}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            accessibilityLabelledBy="emailLabel"
            accessibilityLabel="Email"
            style={s.input}
          />
        </Field>

        <Field label="Password" nativeID="passwordLabel">
          <View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={signup ? 'At least 6 characters' : 'Your password'}
              placeholderTextColor={p.muted}
              keyboardAppearance={p.mode}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={signup ? 'new-password' : 'current-password'}
              textContentType={signup ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={submit}
              accessibilityLabelledBy="passwordLabel"
              accessibilityLabel="Password"
              style={[s.input, { paddingRight: 52 }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              style={s.eye}>
              <Icon name={showPassword ? 'eye.slash' : 'eye'} size={20} color={p.muted} />
            </Pressable>
          </View>
        </Field>

        {signup && (
          <>
            <View style={s.notice}>
              <Text style={s.noticeTitle}>Privacy notice</Text>
              <Text style={s.noticeBody}>
                <Text style={s.noticeStrong}>We store:</Text> your name and email, to give you an account.{'\n'}
                <Text style={s.noticeStrong}>We never store:</Text> your location, or anything linking your name to
                where your tag has been. Sightings of your tag are anonymous.{'\n'}
                <Text style={s.noticeStrong}>Your choice:</Text> delete your account and data any time in Settings.
              </Text>
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              onPress={() => setConsent((v) => !v)}
              style={s.consentRow}>
              <View style={[s.checkbox, consent && { backgroundColor: p.primary, borderColor: p.primary }]}>
                {consent && <Icon name="checkmark" size={13} color={p.onPrimary} weight="heavy" />}
              </View>
              <Text style={s.consentText}>I’ve read the privacy notice and agree to MiniTag storing my name and email.</Text>
            </Pressable>
          </>
        )}

        {error && (
          <T variant="body" style={{ color: p.dangerInk }} accessibilityLiveRegion="assertive">
            {error}
          </T>
        )}

        <Button title={signup ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, nativeID, children }: { label: string; nativeID: string; children: React.ReactNode }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View>
      <Text style={s.label} nativeID={nativeID}>
        {label}
      </Text>
      {children}
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    page: { paddingHorizontal: 20, paddingTop: 12, gap: 14 },
    segment: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 16,
      padding: 4,
    },
    segmentItem: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    segmentText: { fontFamily: F.bodySemibold, fontSize: 15 },
    label: { fontFamily: F.bodySemibold, fontSize: 13, color: p.muted, marginBottom: 6 },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: p.inputBorder,
      borderRadius: R.tile,
      paddingHorizontal: 16,
      fontFamily: F.bodyMedium,
      fontSize: 17,
      color: p.ink,
      backgroundColor: p.surface,
    },
    eye: { position: 'absolute', right: 8, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' },
    notice: { backgroundColor: p.primarySoft, borderRadius: 16, padding: 14, gap: 6 },
    noticeTitle: { fontFamily: F.bodySemibold, fontSize: 14, color: p.ink },
    noticeBody: { fontFamily: F.body, fontSize: 13, lineHeight: 20, color: p.ink },
    noticeStrong: { fontFamily: F.bodySemibold },
    consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44, paddingVertical: 4 },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: p.inputBorder,
      backgroundColor: p.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    consentText: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: p.ink, flex: 1 },
    mailIcon: {
      alignSelf: 'center',
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: p.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
