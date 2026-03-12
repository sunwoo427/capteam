import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Platform, ActivityIndicator, Alert, Modal, TextInput, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import DateTimePicker from '@react-native-community/datetimepicker';

type RootStackParamList = {
    Dashboard: { workspaceId: string; workspaceName: string; userId: string };
};

const { width, height } = Dimensions.get('window');
const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export default function DashboardScreen() {
    const route = useRoute<RouteProp<RootStackParamList, 'Dashboard'>>();
    const navigation = useNavigation<any>();
    // 로그인된 유저 ID (route params에서 받아옴)
    const { workspaceId, workspaceName, userId } = route.params || {};
    const USER_ID = userId ?? '';
    const [workspace, setWorkspace] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isDelegationModalVisible, setDelegationModalVisible] = useState(false);

    // 안 읽은 채팅 개수
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const socketRef = React.useRef<Socket | null>(null);

    // Pull to Refresh state
    const [refreshing, setRefreshing] = useState(false);

    // Custom Confirm Modal State for Web Compatibility
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmDetails, setConfirmDetails] = useState({
        title: '',
        message: '',
        confirmText: '확인',
        cancelText: '취소',
        onConfirm: () => { },
        onCancel: () => { }
    });

    // 태스크 추가 모달 state
    const [isAddTaskModalVisible, setAddTaskModalVisible] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [newTaskPoints, setNewTaskPoints] = useState('1');
    const [newTaskDeadline, setNewTaskDeadline] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
    const [addingTask, setAddingTask] = useState(false);

    // 기여도 통계 state
    const [statsData, setStatsData] = useState<{ stats: { userId: string; name: string; points: number; percent: number }[]; totalPoints: number } | null>(null);
    const [sharingStat, setSharingStat] = useState(false);

    // 설정 모달 state
    const [isSettingsVisible, setSettingsVisible] = useState(false);
    const [editingName, setEditingName] = useState('');
    const [editingDeadline, setEditingDeadline] = useState('');
    const [editingNotice, setEditingNotice] = useState(''); // [NEW] 공지사항 수정 state
    const [showSettingsDatePicker, setShowSettingsDatePicker] = useState(false);

    // [NEW] 팀장 여부 확인 변수
    const currentUserMember = workspace?.members?.find((m: any) => m.userId === USER_ID);
    const isLeader = currentUserMember?.role === 'LEADER';

    const toggleAssignee = (userId: string) => {
        setNewTaskAssignees(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (selectedDate) {
            const dateString = selectedDate.toISOString().split('T')[0];
            setNewTaskDeadline(dateString);
        }
    };

    const createTask = async () => {
        if (!newTaskTitle.trim()) return;
        setAddingTask(true);
        try {
            await axios.post(`${API_URL}/api/workspaces/${workspaceId}/tasks`, {
                title: newTaskTitle.trim(),
                description: newTaskDesc.trim() || null,
                points: parseInt(newTaskPoints) || 1,
                deadline: newTaskDeadline.trim() || null,
                assignedToIds: newTaskAssignees,
                createdById: USER_ID,
            });
            const res = await axios.get(`${API_URL}/api/workspaces/${workspaceId}`);
            setWorkspace(res.data);
            setAddTaskModalVisible(false);
            setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskPoints('1'); setNewTaskDeadline(''); setNewTaskAssignees([]);
        } catch (e: any) {
            const msg = e.response?.data?.error || '태스크 추가에 실패했습니다.';
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert('오류', msg);
        } finally {
            setAddingTask(false);
        }
    };

    useEffect(() => {
        const fetchWorkspace = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/workspaces/${workspaceId}`);
                setWorkspace(res.data);
            } catch (error) {
                console.error('Failed to fetch workspace:', error);
            } finally {
                setLoading(false);
            }
        };

        if (workspaceId) {
            fetchWorkspace();
        }
    }, [workspaceId]);

    // 화면 포커스 시 및 소켓 연동을 통한 최신 "안 읽음 수" 관리
    useFocusEffect(
        React.useCallback(() => {
            const fetchUnreadCount = async () => {
                if (!workspaceId || !USER_ID) return;
                try {
                    const res = await axios.get(`${API_URL}/api/workspaces/${workspaceId}/chat/unread`, {
                        params: { userId: USER_ID }
                    });
                    setUnreadChatCount(res.data.unreadCount || 0);
                } catch (e) {
                    console.error('Failed to fetch unread chat count:', e);
                }
            };
            fetchUnreadCount();

            // Socket.io 연동 (대시보드 체류 시 실시간 알람 배지 업데이트)
            socketRef.current = io(API_URL);
            const socket = socketRef.current;
            socket.emit('join_room', workspaceId);

            socket.on('new_message', (msg: any) => {
                if (msg.userId !== USER_ID) {
                    setUnreadChatCount(prev => prev + 1);
                }
            });

            socket.on('role_delegated', async (msg: any) => {
                // 팀장 위임 알림 (본인이 새로운 팀장이 된 경우)
                if (msg.workspaceId === workspaceId) {
                    // 정보 최신화
                    try {
                        const res = await axios.get(`${API_URL}/api/workspaces/${workspaceId}`);
                        setWorkspace(res.data);
                    } catch (e) {
                        console.error('Failed to sync workspace after delegation:', e);
                    }

                    if (msg.newLeaderId === USER_ID) {
                        if (Platform.OS === 'web') window.alert(`📢 [${msg.workspaceName}] 팀방의 팀장으로 위임되었습니다!`);
                        else Alert.alert('권한 위임 알림', `📢 [${msg.workspaceName}] 팀방의 팀장으로 위임되었습니다!`);
                    }
                }
            });

            return () => {
                socket.disconnect();
            };
        }, [workspaceId, USER_ID])
    );

    const completeTask = async (taskId: string, taskTitle: string) => {
        // 1. 완료 여부 확인 연십
        const doComplete = async () => {
            try {
                await axios.put(`${API_URL}/api/workspaces/${workspaceId}/tasks/${taskId}/complete`, {
                    userId: USER_ID
                });
                const res = await axios.get(`${API_URL}/api/workspaces/${workspaceId}`);
                setWorkspace(res.data);

                // 2. 완료 후 성공 메시지
                setConfirmDetails({
                    title: '✅ 반영 완료!',
                    message: `"${taskTitle}" 태스크가 \n\n반영이 완료되었습니다!`,
                    confirmText: '확인',
                    cancelText: '',
                    onConfirm: () => setConfirmVisible(false),
                    onCancel: () => setConfirmVisible(false),
                });
                setConfirmVisible(true);
            } catch (e: any) {
                const msg = e.response?.data?.error || '태스크 완료 전송에 실패했습니다.';
                if (Platform.OS === 'web') window.alert(msg);
                else Alert.alert('오류', msg);
            }
        };

        // 먼저 확인 다이얼로그 보여주기
        setConfirmDetails({
            title: '태스크 완료 확인',
            message: `"${taskTitle}"

이 태스크를 완료하셨습니까?`,
            confirmText: '예, 완료했어요',
            cancelText: '아니요',
            onConfirm: () => {
                setConfirmVisible(false);
                doComplete();
            },
            onCancel: () => setConfirmVisible(false),
        });
        setConfirmVisible(true);
    };

    const fetchStats = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/workspaces/${workspaceId}/stats`);
            setStatsData(res.data);
        } catch (e) {
            console.error('Failed to fetch stats:', e);
        }
    };

    const shareStatToChat = async () => {
        if (!statsData || !socketRef.current) return;
        setSharingStat(true);

        const lines = statsData.stats.map((s, i) => {
            const medal = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
            return `${medal} ${s.name}: ${s.points}pts (${s.percent}%)`;
        }).join('\n');

        const message = `📊 [팀 프로젝트 완료 기여도 결과]\n${lines}\n\n✅ 총 달성: ${statsData.totalPoints}pts`;

        socketRef.current.emit('send_message', {
            workspaceId,
            userId: USER_ID,
            content: message
        });
        setSharingStat(false);
        if (Platform.OS === 'web') window.alert('채팅방에 기여도 결과를 공유했습니다!');
        else Alert.alert('공유 완료', '채팅방에 기여도 결과를 공유했습니다!');
    };

    const updateWorkspace = async () => {
        try {
            await axios.patch(`${API_URL}/api/workspaces/${workspaceId}`, {
                userId: USER_ID,
                name: editingName || undefined,
                deadline: editingDeadline || null, // 빈 값이면 null 전송 (삭제 허용)
                notice: editingNotice, // 빈 값도 전송 (삭제 허용)
            });
            const res = await axios.get(`${API_URL}/api/workspaces/${workspaceId}`);
            setWorkspace(res.data);
            setSettingsVisible(false); // 모달 닫기
            if (Platform.OS === 'web') window.alert('팀방 정보가 수정되었습니다!');
            else Alert.alert('완료', '팀방 정보가 수정되었습니다!');
        } catch (e: any) {
            const msg = e.response?.data?.error || '수정에 실패했습니다.';
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert('오류', msg);
        }
    };

    const regenerateInvite = async () => {
        try {
            const res = await axios.post(`${API_URL}/api/workspaces/${workspaceId}/regenerate-invite`, { userId: USER_ID });
            const re = await axios.get(`${API_URL}/api/workspaces/${workspaceId}`);
            setWorkspace(re.data);
            if (Platform.OS === 'web') window.alert(`새 초대코드: ${res.data.inviteCode}`);
            else Alert.alert('초대코드 재발급', `새 초대코드: ${res.data.inviteCode}`);
        } catch (e: any) {
            const msg = e.response?.data?.error || '재발급에 실패했습니다.';
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert('오류', msg);
        }
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            const [workspaceRes, unreadRes] = await Promise.all([
                axios.get(`${API_URL}/api/workspaces/${workspaceId}`),
                axios.get(`${API_URL}/api/workspaces/${workspaceId}/chat/unread`, {
                    params: { userId: USER_ID }
                })
            ]);
            setWorkspace(workspaceRes.data);
            setUnreadChatCount(unreadRes.data.unreadCount || 0);
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
        } finally {
            setRefreshing(false);
        }
    }, [workspaceId, USER_ID]);

    const kickMember = (targetUserId: string, targetName: string) => {
        setSettingsVisible(false); // 설정 모달 먼저 닫기 (중첩 모달 이슈 방지)
        setConfirmDetails({
            title: '팀원 내보내기',
            message: `${targetName}님을 팀방에서\n내보내시겠습니까?`,
            confirmText: '내보내기',
            cancelText: '취소',
            onConfirm: async () => {
                setConfirmVisible(false);
                try {
                    await axios.delete(`${API_URL}/api/workspaces/${workspaceId}/kick/${targetUserId}`, {
                        data: { userId: USER_ID }
                    });
                    const res = await axios.get(`${API_URL}/api/workspaces/${workspaceId}`);
                    setWorkspace(res.data);
                } catch (e: any) {
                    const msg = e.response?.data?.error || '내보내기에 실패했습니다.';
                    if (Platform.OS === 'web') window.alert(msg);
                    else Alert.alert('오류', msg);
                }
            },
            onCancel: () => {
                setConfirmVisible(false);
                setSettingsVisible(true); // 취소 시 다시 설정 모달 열기
            },
        });
        setConfirmVisible(true);
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }]}>
                <ActivityIndicator size="large" color="#60a5fa" />
            </View>
        );
    }

    // 진행률 / D-Day 계산
    let progressPercent = 0;
    let dDayText = '마감일 없음';

    if (workspace?.deadline && workspace?.createdAt) {
        const now = new Date().getTime();
        const deadline = new Date(workspace.deadline).getTime();

        if (now >= deadline) {
            const pastDays = Math.floor((now - deadline) / (1000 * 60 * 60 * 24));
            dDayText = pastDays === 0 ? 'D-Day' : `D+${pastDays}`;
        } else {
            const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
            dDayText = `D-${daysLeft}`;
        }
    }

    // 새 진행률 계산: DONE 상태인 태스크의 배점(points) 총합 (최대 100%)
    if (workspace?.tasks && Array.isArray(workspace.tasks)) {
        const totalDonePoints = workspace.tasks
            .filter((t: any) => t.status === 'DONE')
            .reduce((sum: number, t: any) => sum + (t.points || 0), 0);

        progressPercent = Math.min(100, totalDonePoints); // Max 100
    }

    const handleLeaveWorkspace = () => {
        const userName = currentUserMember?.user?.name || '사용자';

        if (isLeader) {
            setConfirmDetails({
                title: "팀장 권한 양도",
                message: `현재 ${userName}님은 팀장입니다.\n팀장 권한을 양도하시겠습니까?\n(아니오 클릭 시 팀방이 삭제됩니다.)`,
                confirmText: "예",
                cancelText: "아니오",
                onConfirm: () => {
                    setConfirmVisible(false);
                    setTimeout(() => setSettingsVisible(true), 100); // small delay to allow modal transition
                },
                onCancel: async () => {
                    setConfirmVisible(false);
                    try {
                        await axios.delete(`${API_URL}/api/workspaces/${workspaceId}`);
                        if (Platform.OS === 'web') window.alert("팀방이 삭제되었습니다.");
                        else Alert.alert("알림", "팀방이 삭제되었습니다.");
                        navigation.goBack();
                    } catch (error) {
                        console.error('Failed to delete workspace:', error);
                        if (Platform.OS === 'web') window.alert("팀방 삭제에 실패했습니다.");
                        else Alert.alert("오류", "팀방 삭제에 실패했습니다.");
                    }
                }
            });
            setConfirmVisible(true);
        } else {
            setConfirmDetails({
                title: "팀방 나가기",
                message: `${workspace?.name || workspaceName} 방을 나가시겠습니까?`,
                confirmText: "나가기",
                cancelText: "취소",
                onConfirm: () => {
                    setConfirmVisible(false);
                    leaveWorkspaceAction();
                },
                onCancel: () => {
                    setConfirmVisible(false);
                }
            });
            setConfirmVisible(true);
        }
    };

    const leaveWorkspaceAction = async () => {
        try {
            await axios.delete(`${API_URL}/api/workspaces/${workspaceId}/leave/${USER_ID}`);
            if (Platform.OS === 'web') window.alert("팀방에서 성공적으로 나갔습니다.");
            else Alert.alert("알림", "팀방에서 성공적으로 나갔습니다.");
            navigation.goBack();
        } catch (error) {
            console.error('Failed to leave workspace:', error);
            if (Platform.OS === 'web') window.alert("팀방 나가기에 실패했습니다.");
            else Alert.alert("오류", "팀방 나가기에 실패했습니다.");
        }
    };

    const handleDelegate = (targetMember: any) => {
        setSettingsVisible(false); // 설정 모달 먼저 닫기
        setConfirmDetails({
            title: "권한 위임",
            message: `선택하신 사람은 ${targetMember.user?.name}님 입니다.\n팀장 권한을 위임하시겠습니까?`,
            confirmText: "예",
            cancelText: "아니오",
            onConfirm: async () => {
                setConfirmVisible(false);
                try {
                    await axios.post(`${API_URL}/api/workspaces/${workspaceId}/delegate`, {
                        fromUserId: USER_ID,
                        toUserId: targetMember.userId
                    });

                    // 위임 성공 후 정보 갱신 (팀방에서 나가지 않음)
                    const res = await axios.get(`${API_URL}/api/workspaces/${workspaceId}`);
                    setWorkspace(res.data);

                    if (Platform.OS === 'web') window.alert(`${targetMember.user?.name}님께 팀장 권한이 위임되었습니다.`);
                    else Alert.alert("완료", `${targetMember.user?.name}님께 팀장 권한이 위임되었습니다.`);
                } catch (error) {
                    console.error('Failed to delegate role:', error);
                    if (Platform.OS === 'web') window.alert("팀장 권한 위임에 실패했습니다.");
                    else Alert.alert("오류", "팀장 권한 위임에 실패했습니다.");
                }
            },
            onCancel: () => {
                setConfirmVisible(false);
                setSettingsVisible(true); // 취소 시 다시 설정 모달 열기
            }
        });
        setConfirmVisible(true);
    };

    const otherMembers = workspace?.members?.filter((m: any) => m.userId !== USER_ID) || [];

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0f172a', '#1e1b4b']}
                style={styles.background}
            />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← 목록</Text>
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.greeting}>안녕하세요!</Text>
                        <Text style={styles.projectTitle}>{workspace?.name || workspaceName}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {/* [NEW] 설정 버튼(톱니바퀴) - 팀장에게만 노출 */}
                        {isLeader && (
                            <TouchableOpacity
                                onPress={() => {
                                    setEditingName(workspace?.name || '');
                                    setEditingDeadline(workspace?.deadline ? new Date(workspace.deadline).toISOString().split('T')[0] : '');
                                    setEditingNotice(workspace?.notice || '');
                                    setSettingsVisible(true);
                                }}
                                style={styles.settingsButton}
                            >
                                <Text style={styles.settingsButtonText}>⚙️</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={handleLeaveWorkspace} style={styles.leaveButton}>
                            <Text style={styles.leaveButtonText}>나가기</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#6366f1"
                            colors={["#6366f1"]}
                        />
                    }
                >

                    {/* [NEW] 공지사항 섹션 - 대시보드 최상단 고정 */}
                    <View style={styles.noticeCard}>
                        <View style={styles.noticeHeader}>
                            <Text style={styles.noticeLabel}>📢 공지사항</Text>
                            {workspace?.updatedAt && (
                                <Text style={styles.noticeTime}>
                                    {new Date(workspace.updatedAt).toLocaleDateString()} 업데이트
                                </Text>
                            )}
                        </View>
                        <Text style={styles.noticeContent}>
                            {workspace?.notice || '등록된 공지사항이 없습니다. 팀장님은 설정에서 공지사항을 등록해 주세요!'}
                        </Text>
                    </View>

                    <View style={styles.glassCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={styles.cardTitle}>전체 진행률</Text>
                            <Text style={[styles.progressPercent, { color: '#818cf8', fontSize: 13 }]}>{dDayText}</Text>
                        </View>
                        <View style={styles.progressHeader}>
                            <Text style={styles.progressPercent}>{progressPercent}%</Text>
                            <Text style={styles.progressValue}>(달성도)</Text>
                        </View>
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>팀원 목록</Text>
                    <View style={styles.glassCard}>
                        {workspace?.members?.map((member: any, index: number) => (
                            <View key={member.id} style={styles.rankRow}>
                                <Text style={styles.rankIcon}>{member.role === 'LEADER' ? '👑' : '👤'}</Text>
                                <View style={styles.rankInfo}>
                                    <Text style={styles.rankName}>{member.user?.name || '알 수 없음'}</Text>
                                    <Text style={styles.rankPoints}>{member.role === 'LEADER' ? '팀장' : '팀원'}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* 기여도 통계 섹션 (달성도 100% 시 자동 노출) */}
                    {progressPercent >= 100 && (
                        <View style={styles.glassCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <Text style={styles.cardTitle}>🏆 팀 기여도 통계</Text>
                                <TouchableOpacity
                                    style={styles.statsFetchButton}
                                    onPress={fetchStats}
                                >
                                    <Text style={styles.statsFetchButtonText}>통계 계산</Text>
                                </TouchableOpacity>
                            </View>

                            {statsData ? (
                                <>
                                    {statsData.stats.map((s, i) => {
                                        const medal = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
                                        return (
                                            <View key={s.userId} style={{ marginBottom: 12 }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                                                        {medal} {s.name}
                                                    </Text>
                                                    <Text style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: 14 }}>
                                                        {s.points}pts ({s.percent}%)
                                                    </Text>
                                                </View>
                                                <View style={styles.statsBarBg}>
                                                    <View style={[styles.statsBarFill, { width: `${s.percent}%` }]} />
                                                </View>
                                            </View>
                                        );
                                    })}
                                    <TouchableOpacity
                                        style={[styles.completeButton, { marginTop: 12, alignSelf: 'stretch', alignItems: 'center', backgroundColor: '#6366f1' }]}
                                        onPress={shareStatToChat}
                                        disabled={sharingStat}
                                    >
                                        <Text style={styles.completeButtonText}>
                                            {sharingStat ? '공유 중...' : '📤 채팅방에 결과 공유하기'}
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingVertical: 12 }}>
                                    위의 "통계 계산" 버튼을 눌러 기여도를 확인하세요!
                                </Text>
                            )}
                        </View>
                    )}

                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.sectionTitle}>진행 중인 태스크</Text>
                        {workspace?.members?.find((m: any) => m.userId === USER_ID)?.role === 'LEADER' && (
                            <TouchableOpacity
                                style={styles.addTaskButton}
                                onPress={() => setAddTaskModalVisible(true)}
                            >
                                <Text style={styles.addTaskButtonText}>＋ 태스크 추가</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {workspace?.tasks && workspace.tasks.length > 0 ? (
                        // 완료 안 된 태스크가 먼저, DONE은 낙었을 때
                        [...workspace.tasks]
                            .sort((a: any, b: any) => {
                                if (a.status === 'DONE' && b.status !== 'DONE') return 1;
                                if (a.status !== 'DONE' && b.status === 'DONE') return -1;
                                return 0;
                            })
                            .map((task: any) => {
                                const isDone = task.status === 'DONE';
                                return (
                                    <TouchableOpacity key={task.id} style={[styles.taskCard, isDone && styles.taskCardDone]}>
                                        <View style={styles.taskStatusContainer}>
                                            <View style={[styles.statusDotInProgress, isDone && { backgroundColor: '#10b981' }]} />
                                            <Text style={[styles.taskStatusText, isDone && { color: '#10b981' }]}>{isDone ? '완료' : task.status}</Text>
                                            {isDone && (
                                                <View style={styles.doneBadge}>
                                                    <Text style={styles.doneBadgeText}>✔ 완료됨</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={[styles.taskTitle, isDone && { color: 'rgba(255,255,255,0.45)', textDecorationLine: 'line-through' }]}>{task.title}</Text>
                                        {task.description ? (
                                            <Text style={styles.taskDesc}>{task.description}</Text>
                                        ) : null}
                                        {task.assignees && task.assignees.length > 0 && (
                                            <View style={styles.assigneesContainer}>
                                                <Text style={styles.assigneesLabel}>담당자:</Text>
                                                <Text style={styles.assigneesText}>
                                                    {task.assignees.map((a: any) => a.user?.name).join(', ')}
                                                </Text>
                                            </View>
                                        )}
                                        <View style={styles.taskFooter}>
                                            <View>
                                                <Text style={styles.taskDeadline}>
                                                    {task.deadline ? `마감일: ${new Date(task.deadline).toLocaleDateString()}` : '마감일 없음'}
                                                </Text>
                                                <View style={[styles.pointsBadge, isDone && { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.4)' }]}>
                                                    <Text style={[styles.pointsText, isDone && { color: '#10b981' }]}>{task.points} pts</Text>
                                                </View>
                                            </View>
                                            {workspace?.members?.find((m: any) => m.userId === USER_ID)?.role === 'LEADER' && !isDone && (
                                                <TouchableOpacity
                                                    style={styles.completeButton}
                                                    onPress={() => completeTask(task.id, task.title)}
                                                >
                                                    <Text style={styles.completeButtonText}>완료</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                    ) : (
                        <View style={[styles.glassCard, { alignItems: 'center', paddingVertical: 40 }]}>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                                진행 중인 태스크가 없습니다.{'\n'}
                                {workspace?.members?.find((m: any) => m.userId === USER_ID)?.role === 'LEADER'
                                    ? '위의 버튼으로 태스크를 추가해 보세요!'
                                    : '팀장이 태스크를 추가할 수 있습니다.'}
                            </Text>
                        </View>
                    )}

                </ScrollView>
            </SafeAreaView>

            {/* 태스크 추가 모달 (팀장 전용) */}
            <Modal
                visible={isAddTaskModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setAddTaskModalVisible(false)}
            >
                <View style={styles.taskModalOverlay}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={() => setAddTaskModalVisible(false)}
                    />
                    <View style={styles.taskModalSheet}>
                        {/* 핸들 바 */}
                        <View style={styles.taskModalHandle} />
                        <Text style={styles.taskModalTitle}>✏️  새 태스크 추가</Text>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: 12 }}
                        >
                            <Text style={styles.taskInputLabel}>태스크 제목 *</Text>
                            <TextInput
                                style={styles.taskInput}
                                placeholder="예: 발표자료 제작"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={newTaskTitle}
                                onChangeText={setNewTaskTitle}
                            />

                            <Text style={styles.taskInputLabel}>설명 (선택)</Text>
                            <TextInput
                                style={[styles.taskInput, styles.taskInputMulti]}
                                placeholder="세부 내용을 입력하세요"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={newTaskDesc}
                                onChangeText={setNewTaskDesc}
                                multiline
                                textAlignVertical="top"
                            />

                            <Text style={styles.taskInputLabel}>담당자 배정 (다중 선택 가능)</Text>
                            <View style={styles.assigneeRow}>
                                {/* '없음' 칩 */}
                                <TouchableOpacity
                                    style={[
                                        styles.assigneeChip,
                                        newTaskAssignees.length === 0 && styles.assigneeChipSelected,
                                    ]}
                                    onPress={() => setNewTaskAssignees([])}
                                >
                                    <Text style={[
                                        styles.assigneeChipText,
                                        newTaskAssignees.length === 0 && styles.assigneeChipTextSelected,
                                    ]}>선택 안함</Text>
                                </TouchableOpacity>

                                {/* 팀원 칩 목록 */}
                                {workspace?.members?.map((m: any) => (
                                    <TouchableOpacity
                                        key={m.userId}
                                        style={[
                                            styles.assigneeChip,
                                            newTaskAssignees.includes(m.userId) && styles.assigneeChipSelected,
                                        ]}
                                        onPress={() => toggleAssignee(m.userId)}
                                    >
                                        <Text style={[
                                            styles.assigneeChipText,
                                            newTaskAssignees.includes(m.userId) && styles.assigneeChipTextSelected,
                                        ]}>
                                            {m.role === 'LEADER' ? '👑 ' : '👤 '}
                                            {m.user?.name || '팀원'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.taskInputRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.taskInputLabel}>마감일</Text>
                                    {Platform.OS === 'web' ? (
                                        <input
                                            type="date"
                                            value={newTaskDeadline}
                                            onChange={(e) => setNewTaskDeadline(e.target.value)}
                                            style={{
                                                backgroundColor: 'rgba(255,255,255,0.06)',
                                                borderRadius: 14,
                                                padding: '14px 16px',
                                                color: '#fff',
                                                fontSize: 15,
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                outline: 'none',
                                                width: '100%',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    ) : (
                                        <>
                                            <TouchableOpacity
                                                style={styles.taskInput}
                                                onPress={() => setShowDatePicker(true)}
                                            >
                                                <Text style={{ color: newTaskDeadline ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 15 }}>
                                                    {newTaskDeadline || '날짜 선택...'}
                                                </Text>
                                            </TouchableOpacity>
                                            {showDatePicker && (
                                                <DateTimePicker
                                                    value={newTaskDeadline ? new Date(newTaskDeadline) : new Date()}
                                                    mode="date"
                                                    display="default"
                                                    onChange={handleDateChange}
                                                />
                                            )}
                                        </>
                                    )}
                                </View>
                                <View style={{ width: 12 }} />
                                <View style={{ width: 80 }}>
                                    <Text style={styles.taskInputLabel}>배점</Text>
                                    <TextInput
                                        style={styles.taskInput}
                                        placeholder="1"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                        value={newTaskPoints}
                                        onChangeText={setNewTaskPoints}
                                        keyboardType="number-pad"
                                    />
                                </View>
                            </View>

                            <View style={styles.taskModalButtons}>
                                <TouchableOpacity
                                    style={styles.taskModalCancelBtn}
                                    onPress={() => setAddTaskModalVisible(false)}
                                >
                                    <Text style={styles.taskModalCancelText}>취소</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.taskModalConfirmBtn, (!newTaskTitle.trim() || addingTask) && { opacity: 0.45 }]}
                                    onPress={createTask}
                                    disabled={!newTaskTitle.trim() || addingTask}
                                >
                                    <LinearGradient
                                        colors={['#4f46e5', '#3b82f6']}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                        style={styles.taskModalConfirmGradient}
                                    >
                                        <Text style={styles.taskModalConfirmText}>
                                            {addingTask ? '추가 중...' : '＋  추가하기'}
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>


            {/* 위임 모달 */}
            <Modal
                visible={isDelegationModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setDelegationModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>팀장 권한 양도</Text>
                        <Text style={styles.modalSubtitle}>권한을 위임할 팀원을 선택해주세요.</Text>

                        {otherMembers.length === 0 ? (
                            <Text style={styles.noMembersText}>본인 외에 팀원이 없습니다.</Text>
                        ) : (
                            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
                                {otherMembers.map((member: any) => (
                                    <View key={member.id} style={styles.modalMemberRow}>
                                        <Text style={styles.modalMemberName}>{member.user?.name || '알 수 없음'}</Text>
                                        <TouchableOpacity
                                            style={styles.delegateButton}
                                            onPress={() => handleDelegate(member)}
                                        >
                                            <Text style={styles.delegateButtonText}>팀장위임</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        )}

                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setDelegationModalVisible(false)}
                        >
                            <Text style={styles.modalCloseText}>닫기</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 범용 확인 모달 (Alert 대체용) */}
            <Modal
                visible={confirmVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setConfirmVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmModalContainer}>
                        <Text style={styles.confirmModalTitle}>{confirmDetails.title}</Text>
                        <Text style={styles.confirmModalMessage}>{confirmDetails.message}</Text>
                        <View style={styles.confirmButtonRow}>
                            {!!confirmDetails.cancelText && (
                                <TouchableOpacity style={styles.confirmCancelButton} onPress={confirmDetails.onCancel}>
                                    <Text style={styles.confirmCancelText}>{confirmDetails.cancelText}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.confirmOkButton} onPress={confirmDetails.onConfirm}>
                                <Text style={styles.confirmOkText}>{confirmDetails.confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 설정 모달 (팀장 전용) */}
            <Modal
                visible={isSettingsVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSettingsVisible(false)}
            >
                <View style={styles.taskModalOverlay}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={() => setSettingsVisible(false)}
                    />
                    <View style={styles.taskModalSheet}>
                        <View style={styles.taskModalHandle} />
                        <Text style={styles.taskModalTitle}>⚙️ 팀방 설정</Text>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: 32 }}
                        >
                            <Text style={styles.settingsSectionTitle}>📌 기본 정보 수정</Text>

                            <Text style={styles.taskInputLabel}>팀방 이름</Text>
                            <TextInput
                                style={styles.taskInput}
                                value={editingName}
                                onChangeText={setEditingName}
                                placeholder="팀방 이름을 입력하세요"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                            />

                            <Text style={styles.taskInputLabel}>📢 공지사항</Text>
                            <TextInput
                                style={[styles.taskInput, { height: 80 }]}
                                value={editingNotice}
                                onChangeText={setEditingNotice}
                                placeholder="팀원들에게 알릴 공지사항을 입력하세요"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                multiline
                                textAlignVertical="top"
                            />

                            <View style={{ marginTop: 18 }}>
                                <Text style={styles.taskInputLabel}>마감일</Text>
                                {Platform.OS === 'web' ? (
                                    <input
                                        type="date"
                                        value={editingDeadline}
                                        onChange={(e) => setEditingDeadline(e.target.value)}
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.06)',
                                            borderRadius: 14,
                                            padding: '14px 16px',
                                            color: '#fff',
                                            fontSize: 15,
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            outline: 'none',
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            style={styles.taskInput}
                                            onPress={() => setShowSettingsDatePicker(true)}
                                        >
                                            <Text style={{ color: editingDeadline ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 15 }}>
                                                {editingDeadline || '날짜 선택...'}
                                            </Text>
                                        </TouchableOpacity>
                                        {showSettingsDatePicker && (
                                            <DateTimePicker
                                                value={editingDeadline ? new Date(editingDeadline) : new Date()}
                                                mode="date"
                                                display="default"
                                                onChange={(event, date) => {
                                                    setShowSettingsDatePicker(false);
                                                    if (date) setEditingDeadline(date.toISOString().split('T')[0]);
                                                }}
                                            />
                                        )}
                                    </>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[styles.completeButton, { marginTop: 24, alignSelf: 'stretch', backgroundColor: '#4f46e5' }]}
                                onPress={updateWorkspace}
                            >
                                <Text style={styles.completeButtonText}>정보 저장하기</Text>
                            </TouchableOpacity>

                            <View style={styles.settingsDivider} />

                            <Text style={styles.settingsSectionTitle}>🔑 초대 코드 관리</Text>
                            <View style={styles.inviteCodeContainer}>
                                <View style={styles.inviteCodeBox}>
                                    <Text style={styles.inviteCodeLabel}>현재 코드</Text>
                                    <Text style={styles.inviteCodeText}>{workspace?.inviteCode}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.regenerateButton}
                                    onPress={regenerateInvite}
                                >
                                    <Text style={styles.regenerateButtonText}>재발급</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.settingsDivider} />

                            <Text style={styles.settingsSectionTitle}>👥 팀원 관리</Text>
                            {workspace?.members?.map((member: any) => (
                                <View key={member.id} style={styles.settingsMemberRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.settingsMemberName}>
                                            {member.user?.name} {member.role === 'LEADER' && '👑'}
                                        </Text>
                                        <Text style={styles.settingsMemberEmail}>{member.user?.email}</Text>
                                    </View>
                                    {member.userId !== USER_ID && (
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            <TouchableOpacity
                                                style={styles.memberActionBtn}
                                                onPress={() => handleDelegate(member)}
                                            >
                                                <Text style={styles.memberActionBtnText}>위임</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.memberActionBtn, { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)' }]}
                                                onPress={() => kickMember(member.userId, member.user?.name)}
                                            >
                                                <Text style={[styles.memberActionBtnText, { color: '#ef4444' }]}>내보내기</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* 채팅 진입 FAB */}
            <TouchableOpacity
                style={styles.chatFab}
                onPress={() => {
                    setUnreadChatCount(0);
                    navigation.navigate('Chat', { workspaceId, workspaceName, userId: USER_ID });
                }}
            >
                <Text style={styles.chatFabText}>💬</Text>
                {unreadChatCount > 0 && (
                    <View style={styles.chatBadge}>
                        <Text style={styles.chatBadgeText}>
                            {unreadChatCount > 99 ? '99+' : unreadChatCount}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: {
        position: 'absolute',
        left: 0, right: 0, top: 0, bottom: 0,
    },
    safeArea: { flex: 1 },
    header: {
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    backButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
    },
    backButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    leaveButton: {
        padding: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.5)',
    },
    leaveButtonText: {
        color: '#ef4444',
        fontWeight: 'bold',
    },
    greeting: {
        fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 4,
    },
    projectTitle: {
        fontSize: 22, fontWeight: 'bold', color: '#fff',
    },
    avatarPlaceholder: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarText: {
        fontSize: 20, fontWeight: 'bold', color: '#fff',
    },
    scrollContent: {
        padding: 24, paddingBottom: 100,
    },
    sectionTitle: {
        fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 24, marginBottom: 12,
    },
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 24, padding: 24,
        borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)',
        marginBottom: 10,
    },
    cardTitle: {
        fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 16,
    },
    progressHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12,
    },
    progressPercent: {
        fontSize: 32, fontWeight: '800', color: '#60a5fa',
    },
    progressValue: {
        fontSize: 16, color: '#fff', fontWeight: 'bold', marginBottom: 4,
    },
    progressBarContainer: {
        height: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6, overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%', backgroundColor: '#60a5fa', borderRadius: 6,
    },
    rankRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    },
    myRankHighlight: {
        backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, marginHorizontal: -12,
    },
    rankIcon: {
        fontSize: 20, width: 60,
    },
    rankInfo: {
        flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    rankName: {
        color: '#fff', fontSize: 16, fontWeight: '500',
    },
    rankPoints: {
        color: '#94a3b8', fontSize: 14, fontWeight: '600',
    },
    taskCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20, padding: 20,
        borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 12,
    },
    taskStatusContainer: {
        flexDirection: 'row', alignItems: 'center', marginBottom: 10,
    },
    statusDotInProgress: {
        width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6', marginRight: 8,
    },
    statusDotReview: {
        width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', marginRight: 8,
    },
    taskStatusText: {
        color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600',
    },
    taskTitle: {
        color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16,
    },
    taskFooter: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    taskDeadline: {
        color: 'rgba(255,255,255,0.5)', fontSize: 12,
    },
    pointsBadge: {
        backgroundColor: 'rgba(96, 165, 250, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    },
    pointsText: {
        color: '#60a5fa', fontSize: 13, fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
    },
    modalContainer: {
        width: '85%', backgroundColor: '#1e293b', borderRadius: 20, padding: 24, alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 20, textAlign: 'center',
    },
    noMembersText: {
        fontSize: 15, color: '#94a3b8', marginVertical: 20,
    },
    modalMemberRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
        width: '100%',
    },
    modalMemberName: {
        fontSize: 16, color: '#fff', fontWeight: '500',
    },
    delegateButton: {
        backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    },
    delegateButtonText: {
        color: '#fff', fontSize: 13, fontWeight: 'bold',
    },
    modalCloseButton: {
        marginTop: 20, paddingVertical: 10, paddingHorizontal: 24,
        backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10,
    },
    modalCloseText: {
        color: '#fff', fontSize: 16, fontWeight: 'bold',
    },
    // Confirm Modal Styles
    confirmModalContainer: {
        width: '80%', maxWidth: 400, backgroundColor: '#1e293b', borderRadius: 16, padding: 24, alignItems: 'center',
    },
    confirmModalTitle: {
        fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 12, textAlign: 'center'
    },
    confirmModalMessage: {
        fontSize: 15, color: '#cbd5e1', marginBottom: 24, textAlign: 'center', lineHeight: 22
    },
    confirmButtonRow: {
        flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12
    },
    confirmCancelButton: {
        flex: 1, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, alignItems: 'center'
    },
    confirmCancelText: {
        color: '#fff', fontSize: 15, fontWeight: '600'
    },
    confirmOkButton: {
        flex: 1, paddingVertical: 12, backgroundColor: '#3b82f6', borderRadius: 10, alignItems: 'center'
    },
    confirmOkText: {
        color: '#fff', fontSize: 15, fontWeight: '600'
    },
    // ─── 태스크 섹션 헤더 ───
    sectionTitleRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12,
    },
    addTaskButton: {
        backgroundColor: 'rgba(79,70,229,0.25)',
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.6)',
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
    },
    addTaskButtonText: {
        color: '#a5b4fc', fontSize: 13, fontWeight: '700',
    },
    taskDesc: {
        color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 4, marginBottom: 4,
    },
    assigneesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 8,
    },
    assigneesLabel: {
        color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginRight: 6,
    },
    assigneesText: {
        color: '#fff', fontSize: 13,
    },
    // ─── 공용 인풋 스타일 ───
    taskInputLabel: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 13, fontWeight: '600',
        marginTop: 18, marginBottom: 8,
        letterSpacing: 0.3,
    },
    taskInput: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        paddingHorizontal: 16, paddingVertical: 14,
        color: '#fff', fontSize: 15,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    // ─── 태스크 추가 모달 (바텀 시트) ───
    taskModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    taskModalSheet: {
        backgroundColor: '#1e293b',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingBottom: 32,
        paddingTop: 12,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 20,
    },
    taskModalHandle: {
        width: 40, height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    taskModalTitle: {
        fontSize: 20, fontWeight: '800', color: '#fff',
        marginBottom: 8,
    },
    taskInputRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    taskInputMulti: {
        height: 88,
    },
    taskModalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    taskModalCancelBtn: {
        flex: 1,
        paddingVertical: 15,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    taskModalCancelText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16, fontWeight: '600',
    },
    taskModalConfirmBtn: {
        flex: 2, borderRadius: 14, overflow: 'hidden',
    },
    taskModalConfirmGradient: {
        paddingVertical: 15, alignItems: 'center',
    },
    taskModalConfirmText: {
        color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5,
    },
    // ─── 담당자 칩 ───
    assigneeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    assigneeChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    assigneeChipSelected: {
        backgroundColor: 'rgba(99,102,241,0.35)',
        borderColor: '#818cf8',
    },
    assigneeChipText: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 13, fontWeight: '600',
    },
    assigneeChipTextSelected: {
        color: '#c7d2fe',
    },
    chatFab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#4f46e5',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 5,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    chatFabText: {
        fontSize: 26,
    },
    chatBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#ef4444',
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#0f172a',
        paddingHorizontal: 4,
    },
    chatBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    completeButton: {
        backgroundColor: '#10b981',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    completeButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    taskCardDone: {
        opacity: 0.7,
        borderColor: 'rgba(16,185,129,0.25)',
    },
    doneBadge: {
        marginLeft: 8,
        backgroundColor: 'rgba(16,185,129,0.2)',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.5)',
    },
    doneBadgeText: {
        color: '#10b981',
        fontSize: 11,
        fontWeight: 'bold',
    },
    statsFetchButton: {
        backgroundColor: 'rgba(99,102,241,0.2)',
        borderWidth: 1,
        borderColor: '#6366f1',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
    },
    statsFetchButtonText: {
        color: '#818cf8',
        fontWeight: 'bold',
        fontSize: 12,
    },
    statsBarBg: {
        height: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 5,
        overflow: 'hidden',
    },
    statsBarFill: {
        height: 10,
        backgroundColor: '#6366f1',
        borderRadius: 5,
    },
    // ─── 설정 & 공지사항 추가 스타일 ───
    settingsButton: {
        width: 40, height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    settingsButtonText: {
        fontSize: 20,
    },
    noticeCard: {
        backgroundColor: 'rgba(96, 165, 250, 0.12)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(96, 165, 250, 0.3)',
        marginBottom: 20,
    },
    noticeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    noticeLabel: {
        color: '#60a5fa',
        fontSize: 14,
        fontWeight: 'bold',
    },
    noticeTime: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
    },
    noticeContent: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 22,
    },
    settingsSectionTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 24,
        marginBottom: 8,
    },
    settingsDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 24,
    },
    inviteCodeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
    },
    inviteCodeBox: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    inviteCodeLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        marginBottom: 4,
    },
    inviteCodeText: {
        color: '#60a5fa',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    regenerateButton: {
        backgroundColor: 'rgba(96, 165, 250, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(96, 165, 250, 0.4)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    regenerateButtonText: {
        color: '#60a5fa',
        fontWeight: 'bold',
        fontSize: 14,
    },
    settingsMemberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    settingsMemberName: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    settingsMemberEmail: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        marginTop: 2,
    },
    memberActionBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    memberActionBtnText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
    },
});
