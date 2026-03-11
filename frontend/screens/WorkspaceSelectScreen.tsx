import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';

type RootStackParamList = {
    Login: undefined;
    WorkspaceSelect: { userId: string };
    CreateWorkspace: { userId: string };
    JoinWorkspace: { userId: string };
    Dashboard: { workspaceId: string; workspaceName: string; userId: string };
};

const { width } = Dimensions.get('window');

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export default function WorkspaceSelectScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'WorkspaceSelect'>>();
    const userId = route.params?.userId ?? '';
    const [workspaces, setWorkspaces] = useState<any[]>([]);

    const fetchWorkspaces = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/workspaces/user/${userId}`);
            setWorkspaces(res.data);
        } catch (error) {
            console.error('Failed to fetch workspaces:', error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchWorkspaces();
        }, [])
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0f172a', '#1e1b4b', '#0f172a']} style={styles.background} />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={styles.greeting}>TeamSync</Text>
                            <Text style={styles.subtitle}>참여 중인 팀 프로젝트</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.logoutButton}
                            onPress={() => navigation.replace('Login')}
                        >
                            <Text style={styles.logoutText}>로그아웃</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {workspaces.length > 0 ? (
                        workspaces.map((ws) => (
                            <TouchableOpacity
                                key={ws.id}
                                style={styles.workspaceCard}
                                onPress={() => navigation.navigate('Dashboard', { workspaceId: ws.id, workspaceName: ws.name, userId })}
                            >
                                <View style={styles.cardHeader}>
                                    <Text style={styles.workspaceName}>{ws.name}</Text>
                                    <View style={[styles.roleBadge, ws.role === 'LEADER' ? styles.leaderBadge : styles.memberBadge]}>
                                        <Text style={styles.roleText}>{ws.role === 'LEADER' ? '팀장' : '팀원'}</Text>
                                    </View>
                                </View>
                                <Text style={styles.workspaceSubject}>{ws.subject}</Text>
                                <View style={styles.cardFooter}>
                                    <Text style={styles.deadlineText}>
                                        {ws.deadline ? `📅 마감 ${new Date(ws.deadline).toISOString().split('T')[0]}` : '마감일 없음'}
                                    </Text>
                                    <Text style={styles.enterText}>입장 →</Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>참여 중인 팀방이 없습니다.</Text>
                            <Text style={styles.emptySubText}>아래에서 새 방을 만들거나 참가해 보세요!</Text>
                        </View>
                    )}

                    {/* 방 만들기 / 참가하기 버튼 */}
                    <View style={styles.actionsContainer}>
                        <TouchableOpacity
                            style={styles.createButton}
                            onPress={() => navigation.navigate('CreateWorkspace', { userId })}
                        >
                            <LinearGradient colors={['#4f46e5', '#6d28d9']} style={styles.buttonGradient}>
                                <Text style={styles.buttonIcon}>＋</Text>
                                <Text style={styles.buttonText}>새 팀방 만들기</Text>
                                <Text style={styles.buttonDesc}>팀장으로 프로젝트를 시작합니다</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.joinButton}
                            onPress={() => navigation.navigate('JoinWorkspace', { userId })}
                        >
                            <Text style={styles.buttonIcon}>🔗</Text>
                            <Text style={styles.buttonText}>초대 코드로 참가</Text>
                            <Text style={styles.buttonDescDark}>팀장에게 받은 코드를 입력합니다</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    safeArea: { flex: 1 },
    header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    greeting: { fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5 },
    subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
    logoutButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    logoutText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
    scrollContent: { padding: 24, paddingBottom: 60 },
    workspaceCard: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 20, padding: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
        marginBottom: 14,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    workspaceName: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 },
    roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    leaderBadge: { backgroundColor: 'rgba(99,102,241,0.4)' },
    memberBadge: { backgroundColor: 'rgba(100,116,139,0.4)' },
    roleText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    workspaceSubject: { color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 14 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    deadlineText: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
    enterText: { color: '#60a5fa', fontSize: 14, fontWeight: '600' },
    emptyContainer: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
    emptySubText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8 },
    actionsContainer: { marginTop: 8, gap: 12 },
    createButton: { borderRadius: 20, overflow: 'hidden' },
    buttonGradient: { padding: 20 },
    joinButton: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 20, padding: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    },
    buttonIcon: { fontSize: 24, marginBottom: 6 },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
    buttonDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
    buttonDescDark: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
});
