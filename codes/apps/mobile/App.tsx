import { getUiText, getUiTextList, type UiTextKey } from "../../packages/i18n/src/ui";
import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Button, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import * as Speech from 'expo-speech';
import * as Linking from 'expo-linking';
import QRCode from 'react-native-qrcode-svg';
import type { Language, PatientSession, PatientJourney, Registration, PublishedContent, VisitHistory, NarrationText } from '../../packages/contracts/src/api-types';

const API = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.2.2:5047').replace(/\/$/, '');
type Tab = 'prepare' | 'ticket' | 'journey' | 'content' | 'history';
type AuthMode = 'login' | 'register' | null;
const SESSION_KEY = 'hospital.patient.session';

function PatientApp() {
  const [session, setSession] = useState<PatientSession | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [lang, setLang] = useState<Language>('vi');
  const [tab, setTab] = useState<Tab>('prepare');
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [condition, setCondition] = useState('');
  const [booking, setBooking] = useState('');
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [answer, setAnswer] = useState('');
  const [ticket, setTicket] = useState('');
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [visitId, setVisitId] = useState('');
  const [journey, setJourney] = useState<PatientJourney | null>(null);
  const [content, setContent] = useState<PublishedContent | null>(null);
  const [followUp, setFollowUp] = useState<{recommendationVi?:string; recommendationEn?:string} | null>(null);
  const [assistance, setAssistance] = useState<{id:string; description:string; status:number; resolution?:string}[]>([]);
  const [externalAccount, setExternalAccount] = useState('');
  const [externalPassword, setExternalPassword] = useState('');
  const continuation = useRef('');
  const [history, setHistory] = useState<VisitHistory[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; titleVi: string; titleEn: string }[]>([]);
  const [help, setHelp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [stale, setStale] = useState(false);
  const generation = useRef(0);
  const tr = (key: UiTextKey) => getUiText(lang, key);

  async function call<T>(path: string, method = 'GET', body?: unknown, credential = session?.token): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: 'Bearer ' + credential } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      if (!response.ok) {
        if (response.status === 401) { Speech.stop(); setSession(null); setJourney(null); setContent(null); setHistory([]); setNotifications([]); setAssistance([]); setAuthMode('login'); }
        throw new Error(data?.message || data?.error || tr("request_denied") + ` (${response.status})`);
      }
      return data as T;
    } finally { clearTimeout(timeout); }
  }
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function saveSession(value: PatientSession) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value));
    setSession(value); setAuthMode(null); setPassword('');
    if(value.user){setName(value.user.fullName);setPhone(value.user.phoneNumber || '');}
  }
  async function refresh() {
    if (!session) return;
    const version = generation.current;
    try {
      if (visitId) {
        const current = await call<PatientJourney>('/api/journey/' + visitId);
        if (generation.current === version) { setJourney(current); setStale(false); }
      }
      if (registration?.requestId) {
        const current = await call<Registration>('/api/registration/request/' + registration.requestId);
        if (generation.current === version) setRegistration({ ...current, requestId: current.id });
      }
      const currentNotices = await call<typeof notifications>('/api/notifications');
      if (generation.current === version) setNotifications(currentNotices);
      const requests = await call<typeof assistance>('/api/patient/assistance');
      if (generation.current === version) setAssistance(requests);
    } catch (e) { if (generation.current === version) { setStale(true); setError(e instanceof Error ? e.message : String(e)); } }
  }
  useEffect(() => {
    Promise.all([SecureStore.getItemAsync(SESSION_KEY), SecureStore.getItemAsync('hospital.patient.context')]).then(async ([stored, context]) => {
      if (stored) {
        const value = JSON.parse(stored) as PatientSession;
        await call('/api/auth/me', 'GET', undefined, value.token);
        setSession(value);
      }
      if (context) { const value = JSON.parse(context); setVisitId(value.visitId || ''); setLang(value.lang || 'vi'); if (value.visitId) setTab('journey'); if (value.registration) setRegistration(value.registration); }
    }).catch(e => setError(e.message)).finally(() => setRestoring(false));
    function accept(url: string) {
      const parsed = Linking.parse(url);
      const code = typeof parsed.queryParams?.ticket === 'string' ? parsed.queryParams.ticket : parsed.hostname === 'ticket' ? parsed.path : null;
      if (code) { setTicket(code); setTab('ticket'); }
    }
    Linking.getInitialURL().then(url => { if (url) accept(url); });
    const link = Linking.addEventListener('url', event => accept(event.url));
    return () => { link.remove(); Speech.stop(); };
  }, []);
  useEffect(() => {
    generation.current++; Speech.stop(); setContent(null); setFollowUp(null); setHistory([]);
    if (!restoring) SecureStore.setItemAsync('hospital.patient.context', JSON.stringify({ visitId, lang, registration })).catch(e => setError(e.message));
  }, [visitId, lang, session]);
  useEffect(() => {
    if (registration && !restoring) SecureStore.setItemAsync('hospital.patient.context', JSON.stringify({ visitId, lang, registration })).catch(e => setError(e.message));
  }, [registration?.requestId]);
  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 5000);
    const app = AppState.addEventListener('change', state => { if (state === 'active') refresh(); else Speech.stop(); });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (scanning) { setScanning(false); return true; }
      if (authMode && session) { setAuthMode(null); return true; }
      if (tab !== 'journey' && journey) { setTab('journey'); return true; }
      return false;
    });
    return () => { clearInterval(poll); app.remove(); back.remove(); };
  }, [visitId, session, registration?.requestId, tab, scanning, authMode]);
  useEffect(() => {
    let live = true; setContent(null);
    const load = async () => {
      if (!session || !visitId || tab !== 'content') return;
      try {
        const data = await call<PublishedContent>('/api/content/diagnosis/' + visitId + '?lang=' + lang);
        if (live) { setContent(previous => { if (previous?.id !== data.id) Speech.stop(); return data; }); }
      } catch(e) { if (live && !(e as Error).message.includes('404')) setError((e as Error).message); }
      try { const data = await call<typeof followUp>('/api/patient/follow-up/' + visitId); if (live) setFollowUp(data); }
      catch(e) { if (live && !(e as Error).message.includes('404')) setError((e as Error).message); }
    };
    load(); const poll = setInterval(load, 5000);
    if (session && tab === 'history') call<VisitHistory[]>('/api/patient/visits').then(data => { if (live) setHistory(data); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; clearInterval(poll); };
  }, [tab, visitId, lang, session]);

  async function authenticate(mode: 'login' | 'register') {
    const previousGuest = continuation.current || session?.guestToken;
    const result = await call<PatientSession>(mode === 'login' ? '/api/auth/login' : previousGuest ? '/api/auth/register-convert-guest' : '/api/auth/register', 'POST',
      mode === 'login' ? { email, password } : previousGuest ? { guestToken: previousGuest, register: { email, password, fullName: name, phoneNumber: phone, language: lang } } : { email, password, fullName: name, phoneNumber: phone, language: lang });
    if (result.user?.role !== 'Patient') throw new Error(tr("staff_accounts_use_the_web_workspace"));
    const linked = mode === 'login' && previousGuest ? await call<PatientSession>('/api/auth/convert-guest', 'POST', { guestToken: previousGuest }, result.token) : result;
    if (!previousGuest) { setJourney(null); setRegistration(null); }
    await saveSession(linked);
    continuation.current = '';
  }
  async function redeem(value: string) {
    let code = value.trim();
    if (code.includes('?ticket=')) code = decodeURIComponent(code.split('?ticket=')[1].split('&')[0]);
    const data = await call<PatientJourney>('/api/journey/redeem-ticket', 'POST', { qrToken: code });
    setVisitId(data.visitId); setJourney(data); setTab('journey'); setScanning(false);
  }
  async function narrate(section: 'diagnosis' | 'care') {
    if (!content) return;
    const text = await call<NarrationText>(`/api/content/audio/${content.id}?section=${section}&lang=${lang}`);
    const voices = await Speech.getAvailableVoicesAsync();
    const voice = voices.find(v => v.language.startsWith(text.language));
    if (!voice) throw new Error(tr("no_matching_voice_readable_text_remains_available"));
    await Speech.stop();
    Speech.speak(text.text, { language: text.language, voice: voice.identifier, onError: () => setError(tr("audio_unavailable_please_read_the_text")) });
  }
  const field = (label: string, value: string, change: (value: string) => void, secret = false) => <View style={styles.field}>
    <Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={value} onChangeText={change} secureTextEntry={secret} autoCapitalize="none" />
  </View>;
  const button = (label: string, work: () => Promise<void>) => <View style={styles.button}><Button title={label} disabled={busy} onPress={() => action(work)} /></View>;
  const section = (title: string, children: React.ReactNode) => <View style={styles.card}><Text style={styles.heading}>{title}</Text>{children}</View>;
  if (restoring) return <SafeAreaView><Text>{tr("restoring_session")}</Text></SafeAreaView>;
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><Text style={styles.title}>{tr("hospital_patient_guide")}</Text><Button title={getUiText(lang,"ti_ng_vi_t")} onPress={() => setLang(lang === 'vi' ? 'en' : 'vi')} /></View>
        {error !== '' && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {notice !== '' && <Text accessibilityLiveRegion="polite">{notice}</Text>}
        {stale && <Text style={styles.error}>{tr("information_may_be_stale_reconnect_and_refresh")}</Text>}
        {busy && <Text accessibilityLiveRegion="polite">{tr("working")}</Text>}
        {(!session || authMode) ? section(tr("patient_access"), <>
          {field('Email', email, setEmail)}{field(tr("password"), password, setPassword, true)}
          {authMode === 'register' && <>{field(tr("full_name"), name, setName)}{field(tr("phone"), phone, setPhone)}</>}
          {button(authMode === 'register' ? tr("register") : tr("sign_in"), () => authenticate(authMode || 'login'))}
          <Button title={authMode === 'register' ? tr("already_have_an_account") : tr("create_account")} onPress={() => setAuthMode(authMode === 'register' ? 'login' : 'register')} />
          {session ? <Button title={tr("back_skip")} onPress={() => setAuthMode(null)} /> : button(tr("continue_as_guest"), async () => {
            const value = await call<PatientSession>('/api/auth/guest', 'POST', { language: lang }); setVisitId(''); setJourney(null); setRegistration(null); await saveSession(value);
          })}
          <Text>{tr("guest_records_are_stored_on_the_server_registration_is_optional")}</Text>
        </>) : <>
          <View style={styles.tabs}>{(['prepare', 'ticket', 'journey', 'content', 'history'] as Tab[]).map((item, i) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.selected]}><Text>{(getUiTextList(lang,["reception","ticket","journey","doctor","history"]))[i]}</Text></Pressable>)}</View>
          {tab === 'prepare' && section(tr("prepare_reception"), <>
            {session.user && <>
              {field(tr("hospital_appointment_account_optional"), externalAccount, setExternalAccount)}
              {field(tr("appointment_password"), externalPassword, setExternalPassword, true)}
              {button(tr("verify_appointment_identity"), async () => {
                await call('/api/appointments/link', 'POST', {externalAccount,password:externalPassword}); setExternalPassword('');
                const appointments = await call<{appointmentId:string; patientName:string; phoneNumber:string; notes:string}[]>('/api/appointments');
                if (appointments[0]) { setBooking(appointments[0].appointmentId); setName(appointments[0].patientName); setPhone(appointments[0].phoneNumber); setCondition(appointments[0].notes); }
                setNotice(tr("simulated_appointment_source_linked"));
              })}
              {button(tr("save_profile"), async () => { const user = await call<PatientSession['user']>('/api/patient/profile','PUT',{fullName:name || session.user?.fullName,phoneNumber:phone || session.user?.phoneNumber,language:lang}); await saveSession({...session,user}); setNotice(tr("profile_saved")); })}
            </>}
            {registration ? <><QRCode value={registration.receptionQrToken} size={200} /><Text selectable>{registration.receptionQrToken}</Text><Text>{(getUiTextList(lang,["awaiting_reception","information_needed","information_supplied","confirmed","rejected"]))[registration.status]}</Text>
              {registration.staffQuestion && <><Text>{registration.staffQuestion}</Text>{field(tr("supplement_answer"), answer, setAnswer)}{button(tr("send"), async () => { await call(`/api/registration/request/${registration.requestId}/supplement-answer`, 'POST', { answer }); await refresh(); })}</>}
              <Button title={tr("prepare_a_new_attendance")} onPress={() => setRegistration(null)} />
            </> : <>
              {field(tr("full_name"), name, setName)}{field(tr("phone"), phone, setPhone)}{field(tr("reason_for_visit"), condition, setCondition)}
              {field(tr("booking_reference_if_available"), booking, setBooking)}
              {button(tr("prepare_reception_request"), async () => {
                const result = await call<Registration>('/api/registration/request', 'POST', { source: booking ? 0 : 1, appointmentId: booking || null, fullName: name, phoneNumber: phone, conditionDescription: condition, preferredLanguage: lang });
                setRegistration(result);
              })}
            </>}
            <Text>{tr("preparation_creates_no_visit_reception_verifies_attendance_and_is")}</Text>
          </>)}
          {tab === 'ticket' && section(tr("activate_examination_ticket"), <>
            {field(tr("ticket_code"), ticket, setTicket)}{button(tr("activate_resume"), () => redeem(ticket))}
            <Button title={tr("scan_qr")} onPress={async () => { const result = permission?.granted ? permission : await requestPermission(); if (result.granted) setScanning(true); else setError(tr("camera_permission_denied_enter_the_code_instead")); }} />
            {scanning && <CameraView style={{ height: 300 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => { setScanning(false); action(() => redeem(data)); }} />}
            <Text>{tr("use_the_original_guest_session_or_owning_account_ask_reception_fo")}</Text>
          </>)}
          {tab === 'journey' && section(tr("current_journey"), journey ? <>
            <Text>{tr("visit")}: {journey.visitStatus === 1 ? tr("closed") : tr("active")}</Text>
            <Text>{tr("journey")}: {(getUiTextList(lang,["pending_activation","active_2","completed"]))[journey.journeyStatus]}</Text>
            <Text style={styles.heading}>{lang === 'vi' ? journey.nextActionVi : journey.nextActionEn}</Text>
            <Text>{lang === 'vi' ? journey.destinationVi : journey.destinationEn}</Text>
            <Text>{journey.journeyStatus === 2 ? tr("journey_completed") : journey.waitOrProceed === 'Wait' ? tr("please_wait") : tr("please_proceed")}</Text>
            <Text>{journey.queueTicket} {journey.queueUpdatedAt && new Date(journey.queueUpdatedAt + (journey.queueUpdatedAt.endsWith('Z') ? '' : 'Z')).toLocaleString()}</Text>
            {button(tr("listen"), async () => { await Speech.stop(); Speech.speak(lang === 'vi' ? journey.nextActionVi : journey.nextActionEn, { language: getUiText(lang,"en_us"), onError: () => setError(tr("audio_unavailable_you_can_still_read_the_instruction")) }); })}
            <Button title={tr("stop")} onPress={() => Speech.stop()} />
            <Button title={tr("navigate")} onPress={() => setNotice((lang === 'vi' ? journey.destinationVi : journey.destinationEn) + '\n' + tr("detailed_route_unavailable_staff_can_help"))} />
            {journey.canCompletePharmacy && button(tr("complete_pharmacy_guidance"), async () => { await call(`/api/journey/${visitId}/complete-pharmacy`, 'POST'); await refresh(); })}
            {journey.steps.map(step => <View key={step.id} style={styles.step}><Text>{lang === 'vi' ? step.destinationVi : step.destinationEn}</Text><Text>{(getUiTextList(lang,["waiting","ready","in_progress","completed_2","skipped","cancelled"]))[step.status]}</Text></View>)}
            {!session.user && button(tr("link_account_optional"), async () => { const claim = await call<{continuationToken:string}>('/api/auth/guest-continuation','POST',{returnTarget:'/visit/'+visitId}); continuation.current = claim.continuationToken; setAuthMode('register'); })}
          </> : <Text>{tr("scan_a_ticket_or_open_history_to_resume")}</Text>)}
          {tab === 'content' && section(tr("published_doctor_information"), content ? <>
            <Text>{content.doctorName} · v{content.version} · {content.publishedAt}</Text><Text>{tr("content_language")}: {content.language}{content.isFallback ? tr("source_fallback") : ''}</Text>
            <Text style={styles.heading}>{tr("diagnosis_and_explanation")}</Text><Text>{content.diagnosis}</Text><Text>{content.explanation}</Text>{button(tr("listen_to_diagnosis_replay"), () => narrate('diagnosis'))}
            <Text style={styles.heading}>{tr("care_instructions")}</Text><Text>{content.careInstructions}</Text>{button(tr("listen_to_care_replay"), () => narrate('care'))}
            <Button title={tr("stop")} onPress={() => Speech.stop()} />
          </> : <Text>{tr("no_published_content_for_this_visit_yet")}</Text>)}
          {tab === 'content' && followUp && section(tr("follow_up_recommendation_no_booking"), <><Text>{lang === 'en' ? followUp.recommendationEn || followUp.recommendationVi : followUp.recommendationVi || followUp.recommendationEn}</Text>{button(tr("book_a_later_attendance"), async () => { const handoff=await call<{available:boolean;url?:string}>(`/api/patient/follow-up/${visitId}/booking`);if(handoff.available&&handoff.url)await Linking.openURL(handoff.url);else setNotice(tr("contact_reception_to_book_a_later_attendance")); })}</>)}
          {tab === 'history' && section(tr("visit_history"), history.length ? history.map(visit => <View key={visit.visitId} style={styles.step}><Text>{visit.ticketNumber} · {lang === 'vi' ? visit.departmentVi : visit.departmentEn}</Text><Button title={tr("open_visit")} onPress={() => { setVisitId(visit.visitId); setTab('journey'); }} /></View>) : <Text>{tr("no_visits_yet")}</Text>)}
          {section(tr("assistance"), <>{field(tr("help_needed"), help, setHelp)}{button(tr("request_assistance"), async () => { await call('/api/assistance', 'POST', { visitId: visitId || null, category: 'Patient help', description: help }); setNotice(tr("assistance_requested")); })}</>)}
          {notifications.map(item => <Text key={item.id}>{lang === 'vi' ? item.titleVi : item.titleEn}</Text>)}
          {assistance.map(item => <Text key={item.id}>{item.description} · {(getUiTextList(lang,["requested","acknowledged","resolved","escalated"]))[item.status]} {item.resolution}</Text>)}
          {!session.user && <Text selectable>{tr("session_reference_for_reception_recovery")}: {session.guestSessionId}</Text>}
          {button(tr("refresh_retry"), refresh)}
          {button(tr("sign_out"), async () => { generation.current++; await Speech.stop(); await SecureStore.deleteItemAsync(SESSION_KEY); await SecureStore.deleteItemAsync('hospital.patient.context'); setSession(null); setVisitId(''); setJourney(null); setContent(null); setRegistration(null); setHistory([]); setNotifications([]); })}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export default function App() { return <SafeAreaProvider><PatientApp /></SafeAreaProvider>; }
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f1f5f9' }, container: { padding: 16, gap: 12 }, header: { gap: 12 }, title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  heading: { fontSize: 19, fontWeight: '600', color: '#164e63', marginVertical: 8 }, card: { backgroundColor: 'white', padding: 18, borderRadius: 16, gap: 8 },
  field: { gap: 6, marginVertical: 6 }, label: { fontSize: 16 }, input: { borderWidth: 1, borderColor: '#94a3b8', borderRadius: 8, padding: 12, fontSize: 17, minHeight: 48 },
  button: { marginVertical: 6 }, tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tab: { padding: 12, backgroundColor: '#e2e8f0', borderRadius: 10 }, selected: { backgroundColor: '#a5f3fc' },
  error: { color: '#991b1b', backgroundColor: '#fee2e2', padding: 12 }, step: { borderTopWidth: 1, borderColor: '#e2e8f0', paddingVertical: 12, gap: 6 }
});
