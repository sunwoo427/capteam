import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Platform, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import axios from 'axios';

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
    const [newTaskAssignee, setNewTaskAssignee] = useState<string | null>(null);
    const [addingTask, setAddingTask] = useState(false);

    const createTask = async () => {
        if (!newTaskTitle.trim()) return;
        setAddingTask(true);
        try {
            await axios.post(`${API_URL}/api/workspaces/${workspaceId}/tasks`, {
                title: newTaskTitle.trim(),
                description: newTaskDesc.trim() || null,
                points: parseInt(newTaskPoints) || 1,
                deadline: newTaskDeadline.trim() || null,
                assignedToId: newTaskAssignee || null,
                createdById: USER_ID,
            });
            const res = await axios.get(`${API_URL}/api/workspaces/${workspaceId}`);
            setWorkspace(res.data);
            setAddTaskModalVisible(false);
            setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskPoints('1'); setNewTaskDeadline(''); setNewTaskAssignee(null);
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
        const created = new Date(workspace.createdAt).getTime();
        const deadline = new Date(workspace.deadline).getTime();
        const now = new Date().getTime();

        if (now >= deadline) {
            progressPercent = 100;
            const pastDays = Math.floor((now - deadline) / (1000 * 60 * 60 * 24));
            dDayText = pastDays === 0 ? 'D-Day' : `D+${pastDays}`;
        } else {
            const total = deadline - created;
            const elapsed = now - created;
            progressPercent = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));

            const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
            dDayText = `D-${daysLeft}`;
        }
    }

    const handleLeaveWorkspace = () => {
        const currentUserMember = workspace?.members?.find((m: any) => m.userId === USER_ID);
        const isLeader = currentUserMember?.role === 'LEADER';
        const userName = currentUserMember?.user?.name || '사용자';

        if (isLeader) {
            setConfirmDetails({
                title: "팀장 권한 양도",
                message: `현재 ${userName}님은 팀장입니다.\n팀장 권한을 양도하시겠습니까?\n(아니오 클릭 시 팀방이 삭제됩니다.)`,
                confirmText: "예",
                cancelText: "아니오",
                onConfirm: () => {
                    setConfirmVisible(false);
                    setTimeout(() => setDelegationModalVisible(true), 100); // small delay to allow modal transition
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
                    setDelegationModalVisible(false);
                    leaveWorkspaceAction();
                } catch (error) {
                    console.error('Failed to delegate role:', error);
                    if (Platform.OS === 'web') window.alert("팀장 권한 위임에 실패했습니다.");
                    else Alert.alert("오류", "팀장 권한 위임에 실패했습니다.");
                }
            },
            onCancel: () => {
                setConfirmVisible(false);
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
                    <TouchableOpacity onPress={handleLeaveWorkspace} style={styles.leaveButton}>
                        <Text style={styles.leaveButtonText}>나가기</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                    <View style={styles.glassCard}>
                        <Text style={styles.cardTitle}>전체 진행률</Text>
                        <View style={styles.progressHeader}>
                            <Text style={styles.progressPercent}>{dDayText}</Text>
                            <Text style={styles.progressValue}>{progressPercent}% (시간 경과)</Text>
                        </View>
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>팀원 목록</Text>
                    <View style={styles.glassCard}>
                        {workspace?.members?.map((member: any, index: number) => (
                            <View key={member.id} style={styles.rankRow}>
                                <Text style={styles.rankIcon}>{index === 0 ? '👑' : '👤'}</Text>
                                <View style={styles.rankInfo}>
                                    <Text style={styles.rankName}>{member.user?.name || '알 수 없음'}</Text>
                                    <Text style={styles.rankPoints}>{member.role === 'LEADER' ? '팀장' : '팀원'}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

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
                        workspace.tasks.map((task: any) => (
                            <TouchableOpacity key={task.id} style={styles.taskCard}>
                                <View style={styles.taskStatusContainer}>
                                    <View style={styles.statusDotInProgress} />
                                    <Text style={styles.taskStatusText}>{task.status}</Text>
                                </View>
                                <Text style={styles.taskTitle}>{task.title}</Text>
                                {task.description ? (
                                    <Text style={styles.taskDesc}>{task.description}</Text>
                                ) : null}
                                <View style={styles.taskFooter}>
                                    <Text style={styles.taskDeadline}>
                                        {task.deadline ? `마감일: ${new Date(task.deadline).toLocaleDateString()}` : '마감일 없음'}
                                    </Text>
                                    <View style={styles.pointsBadge}>
                                        <Text style={styles.pointsText}>{task.points} pts</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))
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

                            <Text style={styles.taskInputLabel}>담당자 배정</Text>
                            <View style={styles.assigneeRow}>
                                {/* '없음' 칩 */}
                                <TouchableOpacity
                                    style={[
                                        styles.assigneeChip,
                                        newTaskAssignee === null && styles.assigneeChipSelected,
                                    ]}
                                    onPress={() => setNewTaskAssignee(null)}
                                >
                                    <Text style={[
                                        styles.assigneeChipText,
                                        newTaskAssignee === null && styles.assigneeChipTextSelected,
                                    ]}>없음</Text>
                                </TouchableOpacity>

                                {/* 팀원 칩 목록 */}
                                {workspace?.members?.map((m: any) => (
                                    <TouchableOpacity
                                        key={m.userId}
                                        style={[
                                            styles.assigneeChip,
                                            newTaskAssignee === m.userId && styles.assigneeChipSelected,
                                        ]}
                                        onPress={() => setNewTaskAssignee(m.userId)}
                                    >
                                        <Text style={[
                                            styles.assigneeChipText,
                                            newTaskAssignee === m.userId && styles.assigneeChipTextSelected,
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
                                    <TextInput
                                        style={styles.taskInput}
                                        placeholder="YYYY-MM-DD"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                        value={newTaskDeadline}
                                        onChangeText={setNewTaskDeadline}
                                    />
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
                            <TouchableOpacity style={styles.confirmCancelButton} onPress={confirmDetails.onCancel}>
                                <Text style={styles.confirmCancelText}>{confirmDetails.cancelText}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmOkButton} onPress={confirmDetails.onConfirm}>
                                <Text style={styles.confirmOkText}>{confirmDetails.confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
});
