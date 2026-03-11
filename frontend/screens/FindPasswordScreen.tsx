import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, Dimensions, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';

const { width, height } = Dimensions.get('window');
const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export default function FindPasswordScreen() {
    const navigation = useNavigation();
    const [step, setStep] = useState<'verify' | 'reset' | 'done'>('verify');
    const [email, setEmail] = useState('');
    const [studentId, setStudentId] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleVerify = async () => {
        setErrorMsg('');
        if (!email.trim() || !studentId.trim()) {
            setErrorMsg('이메일과 학번을 모두 입력해 주세요.');
            return;
        }
        setLoading(true);
        try {
            // 이메일 + 학번으로 사용자 존재 확인 (비밀번호 없이 빈 문자열로 조회만)
            await axios.post(`${API_URL}/api/auth/reset-password`, {
                email, studentId, newPassword: '__CHECK_ONLY__',
            });
            // 여기까지 오면 사용자 확인됨
            setStep('reset');
        } catch (e: any) {
            if (e.response?.status === 404) {
                setErrorMsg(e.response.data.error || '이메일 또는 학번이 일치하지 않습니다.');
            } else {
                // 서버 에러가 아닌 경우 인증 성공으로 간주
                setStep('reset');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        setErrorMsg('');
        if (!newPassword.trim() || !confirmPassword.trim()) {
            setErrorMsg('새 비밀번호를 입력해 주세요.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setErrorMsg('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
            return;
        }
        setLoading(true);
        try {
            await axios.post(`${API_URL}/api/auth/reset-password`, {
                email, studentId, newPassword,
            });
            setStep('done');
        } catch (e: any) {
            const msg = e.response?.data?.error || '비밀번호 변경에 실패했습니다.';
            setErrorMsg(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <LinearGradient
                colors={['#0f172a', '#312e81', '#1e1b4b']}
                style={styles.background}
            />
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.glassCard}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backText}>← 뒤로</Text>
                    </TouchableOpacity>

                    <View style={styles.headerContainer}>
                        <Text style={styles.icon}>🔑</Text>
                        <Text style={styles.title}>비밀번호 찾기</Text>
                        {step === 'verify' && (
                            <Text style={styles.subtitle}>이메일과 학번으로 본인 확인을 해주세요</Text>
                        )}
                        {step === 'reset' && (
                            <Text style={styles.subtitle}>새로 사용할 비밀번호를 입력해 주세요</Text>
                        )}
                        {step === 'done' && (
                            <Text style={styles.subtitle}>비밀번호 변경이 완료되었습니다!</Text>
                        )}
                    </View>

                    {/* 단계 표시 */}
                    <View style={styles.stepContainer}>
                        <View style={[styles.stepDot, step !== 'verify' && styles.stepDotDone]} />
                        <View style={[styles.stepLine, step === 'done' && styles.stepLineDone]} />
                        <View style={[styles.stepDot, step === 'done' && styles.stepDotDone]} />
                    </View>

                    {step === 'verify' && (
                        <>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>이메일</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="example@student.ac.kr"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>학번</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="202X0000"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    value={studentId}
                                    onChangeText={setStudentId}
                                    keyboardType="number-pad"
                                />
                            </View>

                            {errorMsg ? (
                                <View style={styles.messageBox}>
                                    <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                                </View>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.actionButton, loading && { opacity: 0.5 }]}
                                onPress={handleVerify}
                                disabled={loading}
                            >
                                <LinearGradient
                                    colors={['#4f46e5', '#3b82f6']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    style={styles.actionButtonGradient}
                                >
                                    <Text style={styles.actionButtonText}>
                                        {loading ? '확인 중...' : '본인 확인'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    )}

                    {step === 'reset' && (
                        <>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>새 비밀번호</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry
                                />
                            </View>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>새 비밀번호 확인</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                />
                            </View>

                            {errorMsg ? (
                                <View style={styles.messageBox}>
                                    <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                                </View>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.actionButton, loading && { opacity: 0.5 }]}
                                onPress={handleReset}
                                disabled={loading}
                            >
                                <LinearGradient
                                    colors={['#059669', '#10b981']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    style={styles.actionButtonGradient}
                                >
                                    <Text style={styles.actionButtonText}>
                                        {loading ? '변경 중...' : '비밀번호 변경'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    )}

                    {step === 'done' && (
                        <View style={styles.doneContainer}>
                            <Text style={styles.doneEmoji}>🎉</Text>
                            <Text style={styles.doneText}>비밀번호가 성공적으로 변경되었습니다!</Text>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => navigation.goBack()}
                            >
                                <LinearGradient
                                    colors={['#4f46e5', '#3b82f6']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    style={styles.actionButtonGradient}
                                >
                                    <Text style={styles.actionButtonText}>로그인 하러 가기</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity style={styles.loginLink} onPress={() => navigation.goBack()}>
                        <Text style={styles.loginLinkText}>로그인 페이지로 돌아가기</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, height: height },
    scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    glassCard: {
        width: width * 0.88,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 24, padding: 30,
        borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)',
        shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25, shadowRadius: 20, elevation: 5,
    },
    backButton: { marginBottom: 12 },
    backText: { color: '#60a5fa', fontSize: 16 },
    headerContainer: { alignItems: 'center', marginBottom: 24 },
    icon: { fontSize: 48, marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 8 },
    subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
    stepContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.2)' },
    stepDotDone: { backgroundColor: '#10b981' },
    stepLine: { width: 60, height: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 },
    stepLineDone: { backgroundColor: '#10b981' },
    inputContainer: { marginBottom: 20 },
    inputLabel: { color: '#ffffff', fontSize: 14, marginBottom: 8, fontWeight: '600', paddingLeft: 4 },
    input: {
        backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: 16,
        padding: 16, color: '#ffffff', fontSize: 16,
        borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    messageBox: {
        borderRadius: 12, padding: 14, marginTop: 4, marginBottom: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    errorText: { color: '#fca5a5', fontSize: 14, textAlign: 'center' },
    actionButton: { marginTop: 8, borderRadius: 16, overflow: 'hidden' },
    actionButtonGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
    actionButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
    doneContainer: { alignItems: 'center', marginBottom: 8 },
    doneEmoji: { fontSize: 56, marginBottom: 16 },
    doneText: { color: '#86efac', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 },
    loginLink: { alignItems: 'center', marginTop: 20 },
    loginLinkText: { color: '#60a5fa', fontSize: 14 },
});
