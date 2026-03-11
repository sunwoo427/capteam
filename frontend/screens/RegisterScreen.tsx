import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Dimensions, Alert, ScrollView, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import axios from 'axios';

const DEPARTMENTS = [
    "컴퓨터공학과", "소프트웨어융합보안학과", "AI전공", "정보통신학과",
    "건축디자인학과", "건축공학과", "건설시스템공학과", "유아교육과",
    "사회복지학과", "경영학과", "행정학과", "경찰학과", "군사학과",
    "호텔관광경영학과", "호텔조리학과", "외식사업학과", "항공서비스학과",
    "디자인학과", "스포츠마케팅학과", "체육학과", "보건행정학과"
];
const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [studentId, setStudentId] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [department, setDepartment] = useState('');
    const [isDepartmentModalVisible, setDepartmentModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleRegister = async () => {
        setErrorMsg('');
        setSuccessMsg('');

        if (!name.trim() || !email.trim() || !studentId.trim() || !password.trim() || !passwordConfirm.trim() || !department.trim()) {
            setErrorMsg('모든 정보를 입력해 주세요.');
            return;
        }

        if (password !== passwordConfirm) {
            setErrorMsg('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API_URL}/api/auth/register`, {
                name,
                email,
                studentId,
                password,
                department,
            });

            setSuccessMsg('회원가입 성공! 로그인 페이지로 이동합니다.');
            setTimeout(() => {
                navigation.replace('Login');
            }, 1500);
        } catch (e: any) {
            const msg = e.response?.data?.error || '회원가입에 실패했습니다. 다시 시도해 주세요.';
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
                pointerEvents="none"
            />
            <View style={styles.glassCard}>
                <View style={styles.headerContainer}>
                    <Text style={styles.title}>회원가입</Text>
                    <Text style={styles.subtitle}>경동대학교 재학생 회원가입</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
                        <Text style={styles.inputLabel}>학과 선택</Text>
                        <TouchableOpacity
                            style={styles.input}
                            onPress={() => setDepartmentModalVisible(true)}
                        >
                            <Text style={department ? styles.inputText : styles.placeholderText}>
                                {department || '소속 학과를 선택하세요'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>비밀번호</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>비밀번호 확인</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            secureTextEntry
                            value={passwordConfirm}
                            onChangeText={setPasswordConfirm}
                        />
                    </View>

                    {errorMsg ? (
                        <View style={styles.messageBox}>
                            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                        </View>
                    ) : null}

                    {successMsg ? (
                        <View style={[styles.messageBox, styles.successBox]}>
                            <Text style={styles.successText}>✅ {successMsg}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={[styles.registerButton, loading && { opacity: 0.5 }]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={['#4f46e5', '#3b82f6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.registerButtonGradient}
                        >
                            <Text style={styles.registerButtonText}>
                                {loading ? '처리 중...' : '가입하기'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.footerContainer}>
                        <Text style={styles.footerText}>이미 계정이 있으신가요? </Text>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.loginText}>로그인</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>

            {/* 학과 선택 모달 */}
            <Modal
                visible={isDepartmentModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setDepartmentModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>학과 선택</Text>
                        <ScrollView style={styles.modalList} showsVerticalScrollIndicator={true}>
                            {DEPARTMENTS.map((dept, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.modalItem}
                                    onPress={() => {
                                        setDepartment(dept);
                                        setDepartmentModalVisible(false);
                                    }}
                                >
                                    <Text style={styles.modalItemText}>{dept}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setDepartmentModalVisible(false)}
                        >
                            <Text style={styles.modalCloseText}>닫기</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}



const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    background: { position: 'absolute', left: 0, right: 0, top: 0, height },
    glassCard: {
        width: width * 0.88,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 24, padding: 30,
        borderWidth: 1, borderColor: 'rgba(255, 255, 0, 0)',
    },
    scrollContent: { paddingBottom: 20 },
    headerContainer: { marginBottom: 36, alignItems: 'center' },
    title: { fontSize: 36, fontWeight: '800', color: '#ffffff', marginBottom: 8 },
    subtitle: { fontSize: 16, color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' },
    inputContainer: { marginBottom: 20 },
    inputLabel: { color: '#ffffff', fontSize: 14, marginBottom: 8, fontWeight: '600', paddingLeft: 4 },
    input: {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: 16, padding: 16, color: '#ffffff', fontSize: 16,
        borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
        height: 55, justifyContent: 'center'
    },
    inputText: { color: '#ffffff', fontSize: 16 },
    placeholderText: { color: 'rgba(255,255,255,0.4)', fontSize: 16 },
    registerButton: { marginTop: 10, borderRadius: 16, overflow: 'hidden' },
    registerButtonGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
    registerButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
    footerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 20 },
    footerText: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 },
    loginText: { color: '#60a5fa', fontSize: 14, fontWeight: 'bold' },
    // Modal Styles
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
    },
    modalContent: {
        width: '85%', height: '60%', backgroundColor: '#1e293b', borderRadius: 20, padding: 24, paddingBottom: 16,
    },
    modalTitle: {
        fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 16, textAlign: 'center'
    },
    modalList: { flex: 1, marginBottom: 16 },
    modalItem: {
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)'
    },
    modalItemText: { color: '#f8fafc', fontSize: 16, textAlign: 'center' },
    modalCloseButton: {
        backgroundColor: '#3b82f6', padding: 14, borderRadius: 12, alignItems: 'center',
    },
    modalCloseText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    messageBox: {
        borderRadius: 12,
        padding: 14,
        marginTop: 8,
        marginBottom: 4,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    successBox: {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        borderColor: 'rgba(34, 197, 94, 0.4)',
    },
    errorText: { color: '#fca5a5', fontSize: 14, textAlign: 'center' },
    successText: { color: '#86efac', fontSize: 14, textAlign: 'center', fontWeight: 'bold' },
});
