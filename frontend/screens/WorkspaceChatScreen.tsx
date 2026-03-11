import React, { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput,
    TouchableOpacity, KeyboardAvoidingView, Platform,
    Modal, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const CURRENT_USER_ID = 'me';

// 더미 채팅 데이터 (추후 Socket.io + API 연동)
const DUMMY_MESSAGES = [
    {
        id: '1', userId: 'user1', userName: '박미니', content: '안녕하세요 팀원 여러분!',
        createdAt: '2026-03-10T10:00:00Z',
        readReceipts: [{ user: { id: 'me', name: '김미니' } }, { user: { id: 'user2', name: '최미니' } }],
    },
    {
        id: '2', userId: 'me', userName: '김미니', content: '안녕하세요! 이번 주 태스크 분배 어떻게 할까요?',
        createdAt: '2026-03-10T10:02:00Z',
        readReceipts: [{ user: { id: 'user1', name: '박미니' } }, { user: { id: 'user2', name: '최미니' } }],
    },
    {
        id: '3', userId: 'user2', userName: '최미니', content: '저는 백엔드 API 담당할게요 👍',
        createdAt: '2026-03-10T10:05:00Z',
        readReceipts: [{ user: { id: 'user1', name: '박미니' } }],
    },
    {
        id: '4', userId: 'user1', userName: '박미니', content: '그럼 저는 UI 디자인 쪽으로 가겠습니다!',
        createdAt: '2026-03-10T10:06:00Z',
        readReceipts: [],
    },
];

type Message = typeof DUMMY_MESSAGES[0];

export default function WorkspaceChatScreen() {
    const navigation = useNavigation();
    const flatListRef = useRef<FlatList>(null);
    const [messages, setMessages] = useState(DUMMY_MESSAGES);
    const [inputText, setInputText] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    const sendMessage = () => {
        if (!inputText.trim()) return;
        const newMsg: Message = {
            id: Date.now().toString(),
            userId: CURRENT_USER_ID,
            userName: '김미니',
            content: inputText.trim(),
            createdAt: new Date().toISOString(),
            readReceipts: [],
        };
        setMessages(prev => [...prev, newMsg]);
        setInputText('');
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const toggleMute = () => {
        setIsMuted(prev => !prev);
        // 실제 API: PUT /api/workspaces/:id/mute { userId, isMuted: !isMuted }
    };

    const openReceiptSheet = (msg: Message) => {
        setSelectedMsg(msg);
        setShowReceiptModal(true);
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.userId === CURRENT_USER_ID;
        const unreadCount = 3 - item.readReceipts.length; // 총 멤버 3명 기준 (예시)

        return (
            <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
                {!isMe && (
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.userName[0]}</Text>
                    </View>
                )}
                <View style={styles.bubbleWrapper}>
                    {!isMe && <Text style={styles.senderName}>{item.userName}</Text>}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                        {isMe && (
                            <TouchableOpacity onPress={() => openReceiptSheet(item)}>
                                <Text style={styles.unreadBadgeMe}>
                                    {unreadCount > 0 ? `${unreadCount} 안 읽음` : '모두 읽음 ✓'}
                                </Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            onLongPress={() => openReceiptSheet(item)}
                            style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}
                        >
                            <Text style={styles.bubbleText}>{item.content}</Text>
                        </TouchableOpacity>
                        {!isMe && (
                            <TouchableOpacity onPress={() => openReceiptSheet(item)}>
                                <Text style={styles.unreadBadgeOther}>
                                    {unreadCount > 0 ? `${unreadCount}` : ''}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={[styles.timestamp, isMe ? styles.timestampRight : styles.timestampLeft]}>
                        {formatTime(item.createdAt)}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0f172a', '#1e1b4b']} style={styles.background} />
            <SafeAreaView style={styles.safeArea}>
                {/* 헤더 */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backBtn}>←</Text>
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>팀 채팅</Text>
                        <Text style={styles.headerSub}>졸업작품 캡스톤</Text>
                    </View>
                    <TouchableOpacity onPress={toggleMute} style={styles.muteButton}>
                        <Text style={styles.muteIcon}>{isMuted ? '🔕' : '🔔'}</Text>
                        <Text style={styles.muteLabel}>{isMuted ? '알림끔' : '알림켬'}</Text>
                    </TouchableOpacity>
                </View>

                {/* 메시지 목록 */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={0}
                >
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={item => item.id}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.messageList}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    />

                    {/* 입력창 */}
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="메시지를 입력하세요..."
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                            onPress={sendMessage}
                            disabled={!inputText.trim()}
                        >
                            <LinearGradient colors={['#4f46e5', '#3b82f6']} style={styles.sendGradient}>
                                <Text style={styles.sendIcon}>↑</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* 읽음 확인 바텀시트 모달 */}
            <Modal visible={showReceiptModal} transparent animationType="slide" onRequestClose={() => setShowReceiptModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowReceiptModal(false)}>
                    <View style={styles.receiptSheet}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>읽은 사람</Text>
                        {selectedMsg && selectedMsg.readReceipts.length > 0 ? (
                            <ScrollView>
                                {selectedMsg.readReceipts.map((r, i) => (
                                    <View key={i} style={styles.receiptRow}>
                                        <View style={styles.receiptAvatar}>
                                            <Text style={styles.receiptAvatarText}>{r.user.name[0]}</Text>
                                        </View>
                                        <Text style={styles.receiptName}>{r.user.name}</Text>
                                        <Text style={styles.receiptCheck}>✓ 읽음</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        ) : (
                            <Text style={styles.noReceipt}>아직 읽은 사람이 없습니다.</Text>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    backBtn: { color: '#60a5fa', fontSize: 22, marginRight: 8 },
    headerCenter: { flex: 1 },
    headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
    muteButton: { alignItems: 'center' },
    muteIcon: { fontSize: 20 },
    muteLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10 },
    messageList: { padding: 16, paddingBottom: 8 },
    messageRow: { marginBottom: 16 },
    messageRowLeft: { flexDirection: 'row', alignItems: 'flex-end' },
    messageRowRight: { flexDirection: 'row-reverse', alignItems: 'flex-end' },
    avatar: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(99,102,241,0.4)',
        justifyContent: 'center', alignItems: 'center', marginRight: 8,
    },
    avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    bubbleWrapper: { maxWidth: '72%' },
    senderName: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 4, marginLeft: 2 },
    bubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
    bubbleMe: { backgroundColor: '#4f46e5', borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: 'rgba(255,255,255,0.1)', borderBottomLeftRadius: 4 },
    bubbleText: { color: '#fff', fontSize: 15, lineHeight: 22 },
    timestamp: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 },
    timestampRight: { textAlign: 'right' },
    timestampLeft: { textAlign: 'left' },
    unreadBadgeMe: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
    unreadBadgeOther: { color: '#f59e0b', fontSize: 12, fontWeight: '700' },
    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end', gap: 10,
        paddingHorizontal: 16, paddingVertical: 10,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    },
    input: {
        flex: 1, backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12,
        color: '#fff', fontSize: 15, maxHeight: 100,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    sendButton: { borderRadius: 22, overflow: 'hidden' },
    sendButtonDisabled: { opacity: 0.4 },
    sendGradient: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    receiptSheet: {
        backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, minHeight: 220,
    },
    sheetHandle: {
        width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2, alignSelf: 'center', marginBottom: 20,
    },
    sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
    receiptRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    receiptAvatar: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(99,102,241,0.4)',
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    receiptAvatarText: { color: '#fff', fontWeight: '700' },
    receiptName: { flex: 1, color: '#fff', fontSize: 15 },
    receiptCheck: { color: '#34d399', fontSize: 13, fontWeight: '600' },
    noReceipt: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 20 },
});
