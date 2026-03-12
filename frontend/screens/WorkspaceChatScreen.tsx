import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput,
    TouchableOpacity, KeyboardAvoidingView, Platform,
    Modal, ScrollView, Image, ActivityIndicator, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import * as ImagePicker from 'expo-image-picker';
// expo-av가 네이티브 모듈 에러를 일으킬 수 있으므로 조건부 로드 시도
let Video: any = null;
let ResizeMode: any = { CONTAIN: 'contain' };
try {
    const expoAV = require('expo-av');
    Video = expoAV.Video;
    ResizeMode = expoAV.ResizeMode;
} catch (e) {
    console.warn('Native module ExponentAV not found. Video playback will be disabled.');
}
import { RootStackParamList } from '../App';

const API_URL = Platform.OS === 'web' ? 'http://localhost:3000' : 'http://10.0.2.2:3000';

type Message = {
    id: string;
    userId: string;
    user: { id: string; name: string; avatarUrl: string | null };
    content: string;
    type: 'TEXT' | 'IMAGE' | 'VIDEO';
    fileUrl?: string;
    createdAt: string;
    readReceipts: { user: { id: string; name: string } }[];
};

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

export default function WorkspaceChatScreen() {
    const navigation = useNavigation();
    const route = useRoute<ChatScreenRouteProp>();
    const { workspaceId, workspaceName, userId: CURRENT_USER_ID } = route.params;

    const flatListRef = useRef<FlatList>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [totalMembers, setTotalMembers] = useState(3); // 임시

    const socketRef = useRef<Socket | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchMetadata();
        loadMessages();

        socketRef.current = io(API_URL);
        const socket = socketRef.current;

        socket.emit('join_room', workspaceId);

        socket.on('new_message', (msg: Message) => {
            setMessages(prev => [...prev, msg]);
            if (msg.userId !== CURRENT_USER_ID) {
                socket.emit('mark_read', { messageId: msg.id, userId: CURRENT_USER_ID, workspaceId });
            }
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        });

        socket.on('read_update', (data: { messageId: string, reader: any }) => {
            setMessages(prev => prev.map(m => {
                if (m.id === data.messageId) {
                    const currentReceipts = m.readReceipts || [];
                    const alreadyRead = currentReceipts.some((r) => r.user.id === data.reader.id);
                    if (!alreadyRead) {
                        return { ...m, readReceipts: [...currentReceipts, { user: data.reader }] };
                    }
                }
                return m;
            }));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const fetchMetadata = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/workspaces/${workspaceId}`);
            setTotalMembers(res.data.members?.length || 3);
        } catch (e) {
            console.error(e);
        }
    };

    const loadMessages = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/workspaces/${workspaceId}/chat`);
            setMessages(res.data);

            res.data.forEach((m: Message) => {
                const currentReceipts = m.readReceipts || [];
                const unreadByMe = m.userId !== CURRENT_USER_ID && !currentReceipts.some((r) => r.user.id === CURRENT_USER_ID);
                if (unreadByMe) markAsRead(m.id);
            });
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 300);
        } catch (error) {
            console.error(error);
        }
    };

    const markAsRead = (messageId: string) => {
        socketRef.current?.emit('mark_read', { messageId, userId: CURRENT_USER_ID, workspaceId });
    };

    const sendMessage = (customData?: { type: 'IMAGE' | 'VIDEO'; fileUrl: string }) => {
        if (!inputText.trim() && !customData) return;

        const payload = customData ? {
            workspaceId,
            userId: CURRENT_USER_ID,
            content: customData.type === 'IMAGE' ? '(사진)' : '(동영상)',
            type: customData.type,
            fileUrl: customData.fileUrl
        } : {
            workspaceId,
            userId: CURRENT_USER_ID,
            content: inputText.trim(),
            type: 'TEXT'
        };

        socketRef.current?.emit('send_message', payload);
        if (!customData) setInputText('');
    };

    const handlePickMedia = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                quality: 0.7,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setUploading(true);

                const fileUrl = await uploadFile(asset.uri);
                const type = asset.type === 'video' ? 'VIDEO' : 'IMAGE';

                if (type === 'VIDEO' && !Video) {
                    Alert.alert('알림', '현재 환경에서는 동영상 전송/재생이 지원되지 않습니다. (Expo Go 업데이트 필요)');
                    return;
                }

                sendMessage({ type, fileUrl });
            }
        } catch (e) {
            console.error('[PICK_MEDIA] error:', e);
            Alert.alert('오류', '미디어를 선택하는 중 오류가 발생했습니다.');
        } finally {
            setUploading(false);
        }
    };

    const uploadFile = async (uri: string): Promise<string> => {
        const formData = new FormData();
        const filename = uri.split('/').pop() || 'upload.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        if (Platform.OS === 'web') {
            // 웹 환경에서는 URI에서 블롭(Blob)을 직접 추출해야 함
            const response = await fetch(uri);
            const blob = await response.blob();
            formData.append('file', blob, filename);
        } else {
            // 모바일 환경 (Android/iOS)
            // @ts-ignore
            formData.append('file', {
                uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
                name: filename,
                type,
            });
        }

        const res = await axios.post(`${API_URL}/api/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        return res.data.fileUrl;
    };

    const toggleMute = async () => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        try {
            await axios.put(`${API_URL}/api/workspaces/${workspaceId}/mute`, {
                userId: CURRENT_USER_ID,
                isMuted: newMuted
            });
        } catch (e) {
            console.error(e);
            setIsMuted(!newMuted); // revert
        }
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
        // 서버에서 받아온 멤버 수에서 본인을 제외한 수(totalMembers - 1)와 현재 메시지의 읽음 개수를 비교
        const readCount = item.readReceipts ? item.readReceipts.length : 0;
        const unreadCount = Math.max(0, (totalMembers - 1) - readCount);

        return (
            <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
                {!isMe && (
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.user?.name?.[0] || '?'}</Text>
                    </View>
                )}
                <View style={styles.bubbleWrapper}>
                    {!isMe && <Text style={styles.senderName}>{item.user?.name || '알 수 없음'}</Text>}
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
                            {item.type === 'IMAGE' && item.fileUrl ? (
                                <Image
                                    source={{ uri: `${API_URL}${item.fileUrl}` }}
                                    style={styles.messageImage}
                                    resizeMode="cover"
                                />
                            ) : item.type === 'VIDEO' && item.fileUrl ? (
                                Video ? (
                                    <Video
                                        source={{ uri: `${API_URL}${item.fileUrl}` }}
                                        style={styles.messageVideo}
                                        useNativeControls
                                        resizeMode={ResizeMode.CONTAIN}
                                        isLooping={false}
                                    />
                                ) : (
                                    <View style={[styles.messageVideo, { backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>동영상 재생 불가{"\n"}(모듈 없음)</Text>
                                    </View>
                                )
                            ) : (
                                <Text style={styles.bubbleText}>{item.content}</Text>
                            )}
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
                        <Text style={styles.headerSub}>{workspaceName}</Text>
                    </View>
                    <TouchableOpacity onPress={toggleMute} style={styles.muteButton}>
                        <Text style={styles.muteIcon}>{isMuted ? '🔕' : '🔔'}</Text>
                        <Text style={styles.muteLabel}>{isMuted ? '알림끔' : '알림켬'}</Text>
                    </TouchableOpacity>
                </View>

                {/* 메시지 목록 */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
                        <TouchableOpacity style={styles.attachButton} onPress={handlePickMedia} disabled={uploading}>
                            {uploading ? (
                                <ActivityIndicator size="small" color="#60a5fa" />
                            ) : (
                                <Text style={styles.attachIcon}>+</Text>
                            )}
                        </TouchableOpacity>
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
                            onPress={() => sendMessage()}
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
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
    },
    messageVideo: {
        width: 200,
        height: 150,
        borderRadius: 12,
    },
    attachButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        marginBottom: 2,
    },
    attachIcon: {
        color: '#60a5fa',
        fontSize: 24,
        fontWeight: '700',
    },
    timestamp: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 },
    timestampRight: { textAlign: 'right' },
    timestampLeft: { textAlign: 'left' },
    unreadBadgeMe: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
    unreadBadgeOther: { color: '#f59e0b', fontSize: 12, fontWeight: '700' },
    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end',
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
