import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export default function JoinWorkspaceScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const userId = route.params?.userId ?? '';
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleJoin = async () => {
        if (code.trim().length !== 6) {
            Alert.alert('입력 오류', '6자리 초대 코드를 정확히 입력해 주세요.');
            return;
        }
        setLoading(true);
        try {
            await axios.post(`${API_URL}/api/workspaces/join`, { inviteCode: code, userId });
            Alert.alert('참가 완료!', `코드 [${code}] 방에 성공적으로 참가했습니다.`);
            navigation.goBack();
        } catch (e: any) {
            const msg = e.response?.data?.error || '잘못된 코드이거나 이미 참가한 방입니다.';
            Alert.alert('오류', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.background} />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.inner}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backButtonText}>← 뒤로</Text>
                    </TouchableOpacity>

                    <View style={styles.iconContainer}>
                        <Text style={styles.icon}>🔗</Text>
                    </View>

                    <Text style={styles.title}>초대 코드 입력</Text>
                    <Text style={styles.subtitle}>팀장에게 받은 6자리 코드를 입력하면{'\n'}해당 팀방에 바로 참가할 수 있습니다.</Text>

                    <View style={styles.codeInputWrapper}>
                        <TextInput
                            style={styles.codeInput}
                            placeholder="예: AB4XY2"
                            placeholderTextColor="rgba(255,255,255,0.25)"
                            value={code}
                            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            maxLength={6}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            textAlign="center"
                        />
                        {code.length > 0 && (
                            <View style={styles.codeLength}>
                                <Text style={styles.codeLengthText}>{code.length} / 6</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[styles.joinButton, (loading || code.length !== 6) && styles.joinButtonDisabled]}
                        onPress={handleJoin}
                        disabled={loading || code.length !== 6}
                    >
                        <LinearGradient colors={['#4f46e5', '#3b82f6']} style={styles.buttonGradient}>
                            <Text style={styles.joinText}>
                                {loading ? '참가 중...' : '팀방 참가하기'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    safeArea: { flex: 1 },
    inner: { flex: 1, padding: 24, justifyContent: 'center' },
    backButton: { position: 'absolute', top: 24, left: 24 },
    backButtonText: { color: '#60a5fa', fontSize: 16 },
    iconContainer: { alignItems: 'center', marginBottom: 20 },
    icon: { fontSize: 56 },
    title: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 12 },
    subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
    codeInputWrapper: { position: 'relative', marginBottom: 32 },
    codeInput: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 20, padding: 20,
        color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: 10,
        borderWidth: 1.5, borderColor: 'rgba(99,102,241,0.5)',
    },
    codeLength: { position: 'absolute', bottom: -24, right: 4 },
    codeLengthText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
    joinButton: { borderRadius: 18, overflow: 'hidden' },
    joinButtonDisabled: { opacity: 0.4 },
    buttonGradient: { paddingVertical: 18, alignItems: 'center' },
    joinText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
