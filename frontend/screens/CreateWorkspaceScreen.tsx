import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export default function CreateWorkspaceScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const userId = route.params?.userId ?? '';
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [deadline, setDeadline] = useState('');
    const [loading, setLoading] = useState(false);
    const [createdCode, setCreatedCode] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!name.trim()) {
            Alert.alert('입력 오류', '팀방 이름을 입력해 주세요.');
            return;
        }
        setLoading(true);
        try {
            // 실제 API 연동
            const res = await axios.post(`${API_URL}/api/workspaces`, { name, subject, deadline, leaderId: userId });
            setCreatedCode(res.data.inviteCode);
        } catch (e) {
            Alert.alert('오류', '팀방 생성에 실패했습니다. 서버를 확인해 주세요.');
        } finally {
            setLoading(false);
        }
    };

    if (createdCode) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.background} />
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.successContainer}>
                        <Text style={styles.successEmoji}>🎉</Text>
                        <Text style={styles.successTitle}>팀방이 개설되었어요!</Text>
                        <Text style={styles.successSub}>팀원들에게 아래 코드를 공유하세요</Text>
                        <View style={styles.codeBox}>
                            <Text style={styles.codeText}>{createdCode}</Text>
                        </View>
                        <Text style={styles.codeHint}>이 코드는 팀원들이 방에 참가할 때 사용합니다.</Text>
                        <TouchableOpacity style={styles.confirmButton} onPress={() => navigation.goBack()}>
                            <LinearGradient colors={['#4f46e5', '#3b82f6']} style={styles.buttonGradient}>
                                <Text style={styles.confirmButtonText}>확인했어요 ✓</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.background} />
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backButtonText}>← 뒤로</Text>
                    </TouchableOpacity>

                    <View style={styles.titleContainer}>
                        <Text style={styles.screenTitle}>새 팀방 만들기</Text>
                        <Text style={styles.screenSubtitle}>팀장으로서 프로젝트를 시작합니다</Text>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>팀방 이름 *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="예: 졸업작품 캡스톤 디자인"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>프로젝트 주제</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="예: IoT 기반 스마트 홈 시스템"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={subject}
                                onChangeText={setSubject}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>마감 기한</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="예: 2026-06-30"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={deadline}
                                onChangeText={setDeadline}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                        onPress={handleCreate}
                        disabled={loading}
                    >
                        <LinearGradient colors={['#4f46e5', '#6d28d9']} style={styles.buttonGradient}>
                            <Text style={styles.submitText}>
                                {loading ? '생성 중...' : '팀방 만들기 ＋'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    safeArea: { flex: 1 },
    scrollContent: { padding: 24, paddingBottom: 60 },
    backButton: { marginBottom: 16 },
    backButtonText: { color: '#60a5fa', fontSize: 16 },
    titleContainer: { marginBottom: 28 },
    screenTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 6 },
    screenSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)' },
    card: {
        backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 24,
        padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 24,
    },
    inputGroup: { marginBottom: 20 },
    label: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
    input: {
        backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 14,
        padding: 16, color: '#fff', fontSize: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    submitButton: { borderRadius: 18, overflow: 'hidden' },
    submitButtonDisabled: { opacity: 0.5 },
    buttonGradient: { paddingVertical: 18, alignItems: 'center' },
    submitText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    // Success view
    successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    successEmoji: { fontSize: 60, marginBottom: 20 },
    successTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 10, textAlign: 'center' },
    successSub: { fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 30, textAlign: 'center' },
    codeBox: {
        backgroundColor: 'rgba(99,102,241,0.2)', borderRadius: 20,
        paddingVertical: 24, paddingHorizontal: 40,
        borderWidth: 2, borderColor: '#6366f1', marginBottom: 16,
    },
    codeText: { fontSize: 40, fontWeight: '900', color: '#a5b4fc', letterSpacing: 10 },
    codeHint: { color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', marginBottom: 40 },
    confirmButton: { width: '100%', borderRadius: 18, overflow: 'hidden' },
    confirmButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
