import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { friendlyAuthError, useAuth } from '@/backend/auth-context';
import { Button, Icon, CancelButton, Row, Section, T, SheetHeader } from '@/components/minitag/ui';
import { useCampus } from '@/features/campus';
import { F } from '@/constants/minitag';
import { usePalette, useThemedStyles } from '@/theme/theme-context';
import type { Palette } from '@/theme/themes';

type Mode = 'signup' | 'signin';

/** Create an account (name, email, password, consent) or sign in. */
export default function AccountScreen() {
  const p = usePalette();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const campus = useCampus();
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
    ? name.trim().length > 0 && !!campus.campus && emailOk && password.length >= 6 && consent
    : emailOk && password.length > 0;

  const submit = async () => {
    setError(null);
    if (!canSubmit) {
      setError(
        signup && !campus.campus
          ? 'Choose your university.'
          : signup && !consent
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
        const { needsConfirmation } = await auth.signUp({
          name,
          email,
          password,
          campusId: campus.campus?.id ?? null,
        });
        if (needsConfirmation) {
          setConfirmSentTo(email.trim());
          return;
        }
      } else {
        await auth.signIn(email, password);
        // Their saved university loads with their profile; ask only if there is none anywhere.
        if (!campus.campus) {
          router.replace('/choose-campus');
          return;
        }
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
      <View
        style={[
          s.page,
          {
            flex: 1,
            paddingBottom: insets.bottom + 24,
            justifyContent: 'center',
          },
        ]}>
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
        <SheetHeader title="Account" left={<CancelButton onPress={() => router.back()} />} />

        <View>
          <T variant="title">{signup ? 'Create your account' : 'Welcome back'}</T>
          <T variant="body" style={{ color: p.muted, marginTop: 8 }}>
            {signup
              ? 'An account lets other MiTag users help find your tag. Beeping and alerts work without one.'
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
          <Section header="University" style={{ marginBottom: 0 }}>
            <Row
              icon="building.columns.fill"
              title={campus.campus?.name ?? 'Choose Your University'}
              subtitle={campus.campus ? (campus.campus.area ?? undefined) : 'Needed for your campus map'}
              onPress={() => router.push('/choose-campus')}
            />
          </Section>
        )}

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
              <View
                style={[
                  s.checkbox,
                  consent && {
                    backgroundColor: p.primary,
                    borderColor: p.primary,
                  },
                ]}>
                {consent && <Icon name="checkmark" size={13} color={p.onPrimary} weight="heavy" />}
              </View>
              <Text style={s.consentText}>
                I’ve read the privacy notice and agree to MiTag storing my name and email.
              </Text>
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
    page: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
    segment: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: p.disabledBg,
      borderRadius: 9,
      padding: 2,
    },
    segmentItem: {
      flex: 1,
      minHeight: 32,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentText: { ...F.bodySemibold, fontSize: 13 },
    label: {
      ...F.body,
      fontSize: 13,
      color: p.muted,
      textTransform: 'uppercase',
      marginLeft: 16,
      marginBottom: 7,
    },
    input: {
      minHeight: 44,
      borderRadius: 10,
      borderCurve: 'continuous',
      paddingHorizontal: 16,
      ...F.body,
      fontSize: 17,
      color: p.ink,
      backgroundColor: p.surface,
    },
    eye: {
      position: 'absolute',
      right: 8,
      top: 0,
      bottom: 0,
      width: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notice: {
      backgroundColor: p.surface,
      borderRadius: 12,
      borderCurve: 'continuous',
      padding: 16,
      gap: 6,
    },
    noticeTitle: { ...F.bodySemibold, fontSize: 15, color: p.ink },
    noticeBody: { ...F.body, fontSize: 15, lineHeight: 20, color: p.muted },
    noticeStrong: { ...F.bodySemibold },
    consentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      minHeight: 44,
      paddingVertical: 4,
    },
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
    consentText: {
      ...F.body,
      fontSize: 15,
      lineHeight: 20,
      color: p.ink,
      flex: 1,
    },
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
