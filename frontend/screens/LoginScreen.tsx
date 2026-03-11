import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Dimensions, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';

type RootStackParamList = {
    Login: undefined;
    Register: undefined;
    FindId: undefined;
    FindPassword: undefined;
    WorkspaceSelect: { userId: string };
    Dashboard: { workspaceId: string; workspaceName: string };
};

const { width, height } = Dimensions.get('window');
const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export default function LoginScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("오류", "이메일과 비밀번호를 입력해주세요.");
            return;
        }

        try {
            // 백엔드 로그인 API 호출 (현재 비밀번호 검증은 생략하고 이메일만 확인 중)
            const res = await axios.post(`${API_URL}/api/auth/login`, { email });

            if (res.status === 200) {
                const userId = res.data.id;
                navigation.replace('WorkspaceSelect', { userId });
            }
        } catch (error) {
            console.error('Login failed:', error);
            Alert.alert("로그인 실패", "이메일 또는 비밀번호가 올바르지 않거나 등록되지 않은 사용자입니다.");
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
            <View style={styles.glassCard}>
                <View style={styles.headerContainer}>
                    <Text style={styles.title}>TeamSync</Text>
                    <Text style={styles.subtitle}>팀 프로젝트 평가 시스템</Text>
                </View>

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
                    <Text style={styles.inputLabel}>비밀번호</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                    <LinearGradient
                        colors={['#4f46e5', '#3b82f6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.loginButtonGradient}
                    >
                        <Text style={styles.loginButtonText}>로그인</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.footerContainer}>
                    <Text style={styles.footerText}>계정이 없으신가요? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                        <Text style={styles.signupText}>회원가입</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.helpContainer}>
                    <TouchableOpacity onPress={() => navigation.navigate('FindId')}>
                        <Text style={styles.helpText}>아이디 찾기</Text>
                    </TouchableOpacity>
                    <Text style={styles.helpDivider}> | </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('FindPassword')}>
                        <Text style={styles.helpText}>비밀번호 찾기</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: height,
    },
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
    headerContainer: {
        marginBottom: 40,
        alignItems: 'center',
    },
    title: {
        fontSize: 40,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: 1,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '500',
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        color: '#ffffff',
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '600',
        paddingLeft: 4,
    },
    input: {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: 16,
        padding: 16,
        color: '#ffffff',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    loginButton: {
        marginTop: 10,
        borderRadius: 16,
        overflow: 'hidden',
    },
    loginButtonGradient: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loginButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    footerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
    footerText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 14,
    },
    signupText: {
        color: '#60a5fa',
        fontSize: 14,
        fontWeight: 'bold',
    },
    helpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
    },
    helpText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 13,
    },
    helpDivider: {
        color: 'rgba(255, 255, 255, 0.3)',
        fontSize: 13,
        marginHorizontal: 4,
    },
});
