import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Platform, Animated, PanResponder, Alert } from 'react-native';
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

const SwipeableWrap = ({ children, onPin, isPinned }: { children: React.ReactNode, onPin: () => void, isPinned: boolean }) => {
    const translateX = useRef(new Animated.Value(0)).current;

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10,
            onPanResponderMove: (_, gestureState) => {
                // 오른쪽으로 슬라이드해서 버튼 노출 (최대 80px)
                if (gestureState.dx > 0) {
                    translateX.setValue(Math.min(gestureState.dx, 80));
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx > 40) {
                    Animated.spring(translateX, { toValue: 80, useNativeDriver: true }).start();
                } else {
                    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
                }
            },
        })
    ).current;

    const closeSwipe = () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    };

    const handlePinClick = () => {
        onPin();
        closeSwipe();
    };

    // 액션 버튼의 X 좌표 계산 (카드가 밀리면 좌측에서 나타남)
    const actionTranslateX = translateX.interpolate({
        inputRange: [0, 80],
        outputRange: [-80, 0],
    });

    return (
        <View style={{ marginBottom: 14, overflow: 'hidden', borderRadius: 20 }}>
            {/* 1. 배경 액션 영역 (카드 밑 좌측에 배치, translateX로 숨겨둠) */}
            <Animated.View style={[styles.swipeBackground, {
                position: 'absolute',
                top: 0, left: 0, bottom: 0, width: 80,
                transform: [{ translateX: actionTranslateX }],
                zIndex: 10,
                backgroundColor: '#7dd3fc', // 연한 블루 계열 (사용자 이미지 참고)
            }]}>
                <TouchableOpacity style={styles.swipeActions} onPress={handlePinClick}>
                    <Text style={{ fontSize: 24 }}>📌</Text>
                    <Text style={{ color: '#0369a1', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                        {isPinned ? '해제' : '고정'}
                    </Text>
                </TouchableOpacity>
            </Animated.View>

            {/* 2. 카드 본체 (위에 배치) */}
            <Animated.View
                style={{ transform: [{ translateX }], zIndex: 5 }}
                {...panResponder.panHandlers}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => {
                        // @ts-ignore
                        if (translateX._value > 10) {
                            closeSwipe();
                        }
                    }}
                    style={{ backgroundColor: 'transparent' }}
                >
                    {children}
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

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

    const togglePin = async (workspaceId: string) => {
        console.log(`[FRONTEND] togglePin: wsId=${workspaceId}, userId=${userId}`);

        // Optimistic UI update
        setWorkspaces(prev => {
            const updated = prev.map(ws =>
                ws.id === workspaceId ? { ...ws, isPinned: !ws.isPinned } : ws
            );
            // Sort: isPinned desc, thenjoinedAt desc
            return [...updated].sort((a, b) => {
                if (a.isPinned !== b.isPinned) {
                    return a.isPinned ? -1 : 1;
                }
                // Same pinning status, sort by joinedAt (if exists) or id
                const timeA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
                const timeB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
                return timeB - timeA;
            });
        });

        try {
            const url = `${API_URL}/api/workspaces/${workspaceId}/pin`;
            const res = await axios.patch(url, { userId });
            console.log(`[FRONTEND] togglePin success:`, res.data);
            if (Platform.OS === 'android') {
                // Android doesn't have a built-in Toast in standard RN, but we can use Alert or console
                console.log(res.data.isPinned ? "팀방이 고정되었습니다." : "고정이 해제되었습니다.");
            }
        } catch (error: any) {
            console.error('Failed to toggle pin:', error);
            // Rollback on error
            fetchWorkspaces();
            const errorMsg = error.response?.data?.error || "고정 처리에 실패했습니다.";
            Alert.alert("오류", errorMsg);
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
                            <SwipeableWrap
                                key={ws.id}
                                onPin={() => togglePin(ws.id)}
                                isPinned={ws.isPinned}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.workspaceCard,
                                        ws.isPinned && styles.pinnedCard
                                    ]}
                                    onPress={() => navigation.navigate('Dashboard', { workspaceId: ws.id, workspaceName: ws.name, userId })}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.cardHeader}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                            <Text style={styles.workspaceName} numberOfLines={1}>
                                                {ws.name}
                                            </Text>
                                            {ws.isPinned && <Text style={styles.pinnedMark}>📌</Text>}
                                        </View>
                                        <View style={[styles.roleBadgeCompact, ws.role === 'LEADER' ? styles.leaderBadge : styles.memberBadge]}>
                                            <Text style={styles.roleTextCompact}>{ws.role === 'LEADER' ? '팀장' : '팀원'}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.workspaceSubject} numberOfLines={1}>{ws.subject}</Text>
                                    <View style={styles.cardFooter}>
                                        <Text style={styles.deadlineText}>
                                            {ws.deadline ? `📅 마감 ${new Date(ws.deadline).toISOString().split('T')[0]}` : '마감일 없음'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </SwipeableWrap>
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
        marginBottom: 0, // SwipeableWrap에서 제어
    },
    pinnedCard: {
        borderColor: '#38bdf8', // 더 진한 하늘색 테두리
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderWidth: 2, // 테두리 두께 강화
    },
    swipeBackground: {
        position: 'absolute',
        top: 0, right: 0, bottom: 0, width: 100,
        backgroundColor: '#6366f1', // 사진과 유사한 블루/퍼플 계열
        borderRadius: 20,
        overflow: 'hidden',
    },
    swipeActions: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    workspaceName: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 },
    pinnedMark: {
        fontSize: 16,
        marginLeft: 6,
    },
    roleBadgeCompact: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    roleTextCompact: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
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
