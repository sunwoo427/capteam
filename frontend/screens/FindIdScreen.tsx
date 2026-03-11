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

export default function FindIdScreen() {
    const navigation = useNavigation();
    const [name, setName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const handleFind = async () => {
        setErrorMsg('');
        setResult(null);

        if (!name.trim() || !studentId.trim()) {
            setErrorMsg('이름과 학번을 모두 입력해 주세요.');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/auth/find-email`, { name, studentId });
            setResult(res.data.maskedEmail);
        } catch (e: any) {
            const msg = e.response?.data?.error || '조회에 실패했습니다. 다시 시도해 주세요.';
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
                        <Text style={styles.icon}>🔍</Text>
                        <Text style={styles.title}>아이디 찾기</Text>
                        <Text style={styles.subtitle}>이름과 학번으로 가입한 이메일을 찾습니다</Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>이름</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="홍길동"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={name}
                            onChangeText={setName}
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

                    {result ? (
                        <View style={[styles.messageBox, styles.successBox]}>
                            <Text style={styles.successLabel}>✅ 가입된 이메일</Text>
                            <Text style={styles.resultEmail}>{result}</Text>
                            <Text style={styles.hintText}>이 이메일로 로그인해 주세요</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={[styles.findButton, loading && { opacity: 0.5 }]}
                        onPress={handleFind}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={['#4f46e5', '#3b82f6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.findButtonGradient}
                        >
                            <Text style={styles.findButtonText}>
                                {loading ? '조회 중...' : '이메일 찾기'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

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
        borderRadius: 24,
        padding: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 5,
    },
    backButton: { marginBottom: 12 },
    backText: { color: '#60a5fa', fontSize: 16 },
    headerContainer: { alignItems: 'center', marginBottom: 30 },
    icon: { fontSize: 48, marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 8 },
    subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
    inputContainer: { marginBottom: 20 },
    inputLabel: { color: '#ffffff', fontSize: 14, marginBottom: 8, fontWeight: '600', paddingLeft: 4 },
    input: {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: 16, padding: 16, color: '#ffffff', fontSize: 16,
        borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    messageBox: {
        borderRadius: 12, padding: 14, marginTop: 4, marginBottom: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    successBox: {
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
        borderColor: 'rgba(34, 197, 94, 0.4)',
        alignItems: 'center',
    },
    errorText: { color: '#fca5a5', fontSize: 14, textAlign: 'center' },
    successLabel: { color: '#86efac', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
    resultEmail: { color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
    hintText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 8 },
    findButton: { marginTop: 8, borderRadius: 16, overflow: 'hidden' },
    findButtonGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
    findButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
    loginLink: { alignItems: 'center', marginTop: 20 },
    loginLinkText: { color: '#60a5fa', fontSize: 14 },
});
