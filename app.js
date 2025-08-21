// 전역 변수
let socket;
let currentUser = {
    username: '',
    latitude: null,
    longitude: null
};
let nearbyUsers = [];
let locationWatchId = null;

// DOM 요소들
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const usernameInput = document.getElementById('username');
const startChatBtn = document.getElementById('startChatBtn');
const locationStatus = document.getElementById('locationStatus');
const currentUsername = document.getElementById('currentUsername');
const locationText = document.getElementById('locationText');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const backBtn = document.getElementById('backBtn');
const nearbyUsersBtn = document.getElementById('nearbyUsersBtn');
const nearbyCount = document.getElementById('nearbyCount');
const refreshLocationBtn = document.getElementById('refreshLocationBtn');
const nearbyUsersModal = document.getElementById('nearbyUsersModal');
const nearbyUsersList = document.getElementById('nearbyUsersList');
const closeModalBtn = document.getElementById('closeModalBtn');
const toast = document.getElementById('toast');

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    getCurrentLocation();
});

// 앱 초기화
function initializeApp() {
    // Socket.IO 연결
    socket = io();
    
    // Socket 이벤트 리스너 설정
    setupSocketListeners();
    
    // 사용자 이름 입력 필드 이벤트
    usernameInput.addEventListener('input', validateForm);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && startChatBtn.disabled === false) {
            startChat();
        }
    });
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 채팅 시작 버튼
    startChatBtn.addEventListener('click', startChat);
    
    // 뒤로가기 버튼
    backBtn.addEventListener('click', () => {
        showScreen(loginScreen);
        disconnectFromChat();
    });
    
    // 메시지 전송
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 근처 사용자 버튼
    nearbyUsersBtn.addEventListener('click', showNearbyUsersModal);
    
    // 위치 새로고침
    refreshLocationBtn.addEventListener('click', refreshLocation);
    
    // 모달 닫기
    closeModalBtn.addEventListener('click', hideNearbyUsersModal);
    nearbyUsersModal.addEventListener('click', (e) => {
        if (e.target === nearbyUsersModal) {
            hideNearbyUsersModal();
        }
    });
}

// Socket.IO 이벤트 리스너 설정
function setupSocketListeners() {
    // 연결 성공
    socket.on('connect', () => {
        console.log('서버에 연결되었습니다.');
        showToast('서버에 연결되었습니다.', 'success');
    });
    
    // 연결 해제
    socket.on('disconnect', () => {
        console.log('서버와의 연결이 끊어졌습니다.');
        showToast('서버와의 연결이 끊어졌습니다.', 'error');
    });
    
    // 근처 사용자 목록 수신
    socket.on('nearbyUsers', (users) => {
        nearbyUsers = users;
        updateNearbyCount();
        console.log('📋 근처 사용자 목록 수신:', users);
        console.log(`👥 총 ${users.length}명의 근처 사용자`);
        
        if (users.length === 0) {
            showToast('근처에 다른 사용자가 없습니다.', 'info');
        } else {
            showToast(`${users.length}명의 근처 사용자를 발견했습니다!`, 'success');
        }
    });
    
    // 새 사용자 참가
    socket.on('userJoined', (user) => {
        addUserJoinedMessage(user.username);
        showToast(`${user.username}님이 참가했습니다.`, 'info');
    });
    
    // 사용자 퇴장
    socket.on('userLeft', (user) => {
        addUserLeftMessage(user.username);
        showToast(`${user.username}님이 나갔습니다.`, 'info');
    });
    
    // 새 메시지 수신
    socket.on('newMessage', (messageData) => {
        console.log('📨 새 메시지 수신:', messageData);
        // 기존 환영 메시지 제거
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        addMessage(messageData, false);
        showToast(`${messageData.senderName}님의 메시지`, 'info');
    });
    
    // 메시지 전송 확인
    socket.on('messageSent', (messageData) => {
        console.log('✅ 메시지 전송 확인:', messageData);
        // 기존 환영 메시지 제거
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        addMessage(messageData, true);
    });
    
    // 사용자 위치 업데이트
    socket.on('userLocationUpdated', (user) => {
        console.log(`${user.username}의 위치가 업데이트되었습니다.`);
    });
    
    // 최근 메시지 수신
    socket.on('recentMessages', (messages) => {
        console.log('📨 최근 메시지 수신:', messages);
        
        if (messages.length > 0) {
            // 기존 환영 메시지 제거
            const welcomeMessage = messagesContainer.querySelector('.welcome-message');
            if (welcomeMessage) {
                welcomeMessage.remove();
            }
            
            // 최근 메시지들을 시간순으로 표시
            messages.forEach(messageData => {
                const isOwnMessage = messageData.senderId === socket.id;
                addMessage(messageData, isOwnMessage);
            });
            
            showToast(`최근 대화 ${messages.length}개를 불러왔습니다.`, 'info');
        }
    });
}

// 현재 위치 가져오기
function getCurrentLocation() {
    if (!navigator.geolocation) {
        updateLocationStatus('이 브라우저는 위치 정보를 지원하지 않습니다.', 'error');
        return;
    }
    
    updateLocationStatus('위치 정보를 가져오는 중...', 'loading');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            currentUser.latitude = latitude;
            currentUser.longitude = longitude;
            
            updateLocationStatus('위치 정보를 성공적으로 가져왔습니다.', 'success');
            updateLocationText(latitude, longitude);
            validateForm();
            
            // 위치 추적 시작
            startLocationTracking();
        },
        (error) => {
            let errorMessage = '위치 정보를 가져올 수 없습니다.';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = '위치 정보 접근이 거부되었습니다.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = '위치 정보를 사용할 수 없습니다.';
                    break;
                case error.TIMEOUT:
                    errorMessage = '위치 정보 요청 시간이 초과되었습니다.';
                    break;
            }
            updateLocationStatus(errorMessage, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5분
        }
    );
}

// 위치 추적 시작
function startLocationTracking() {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
    }
    
    locationWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            currentUser.latitude = latitude;
            currentUser.longitude = longitude;
            
            updateLocationText(latitude, longitude);
            
            // 채팅 중이면 서버에 위치 업데이트 전송
            if (socket && socket.connected) {
                socket.emit('updateLocation', { latitude, longitude });
            }
        },
        (error) => {
            console.error('위치 추적 오류:', error);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000 // 30초
        }
    );
}

// 위치 새로고침
function refreshLocation() {
    getCurrentLocation();
    showToast('위치 정보를 새로고침했습니다.', 'info');
}

// 위치 상태 업데이트
function updateLocationStatus(message, type) {
    locationStatus.textContent = message;
    locationStatus.className = type;
}

// 위치 텍스트 업데이트
function updateLocationText(latitude, longitude) {
    locationText.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

// 폼 유효성 검사
function validateForm() {
    const username = usernameInput.value.trim();
    const hasLocation = currentUser.latitude !== null && currentUser.longitude !== null;
    
    startChatBtn.disabled = !username || !hasLocation;
}

// 채팅 시작
function startChat() {
    const username = usernameInput.value.trim();
    if (!username || !currentUser.latitude || !currentUser.longitude) {
        showToast('닉네임과 위치 정보가 필요합니다.', 'error');
        return;
    }
    
    currentUser.username = username;
    
    // 서버에 사용자 등록
    socket.emit('register', {
        username: currentUser.username,
        latitude: currentUser.latitude,
        longitude: currentUser.longitude
    });
    
    // 채팅 화면으로 전환
    showScreen(chatScreen);
    currentUsername.textContent = currentUser.username;
    
    // 메시지 입력 필드에 포커스
    messageInput.focus();
    
    showToast('채팅에 참가했습니다!', 'success');
}

// 채팅 연결 해제
function disconnectFromChat() {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
    
    // 입력 필드 초기화
    usernameInput.value = '';
    messageInput.value = '';
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <i class="fas fa-hand-wave"></i>
            <h3>환영합니다!</h3>
            <p>근처 30m 내의 사람들과 대화를 시작하세요.</p>
            <p>메시지를 입력하고 Enter를 누르거나 전송 버튼을 클릭하세요.</p>
        </div>
    `;
    
    nearbyUsers = [];
    updateNearbyCount();
    
    showToast('채팅에서 나갔습니다.', 'info');
}

// 메시지 전송
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    socket.emit('sendMessage', { message });
    messageInput.value = '';
}

// 메시지 추가
function addMessage(messageData, isSent) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = messageData.message;
    
    const messageInfo = document.createElement('div');
    messageInfo.className = 'message-info';
    
    const senderName = document.createElement('span');
    senderName.className = 'sender-name';
    senderName.textContent = messageData.senderName;
    
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = formatTime(messageData.timestamp);
    
    messageInfo.appendChild(senderName);
    messageInfo.appendChild(timestamp);
    
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(messageInfo);
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// 사용자 참가 메시지 추가
function addUserJoinedMessage(username) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'user-joined';
    messageDiv.textContent = `${username}님이 참가했습니다.`;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// 사용자 퇴장 메시지 추가
function addUserLeftMessage(username) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'user-left';
    messageDiv.textContent = `${username}님이 나갔습니다.`;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// 근처 사용자 수 업데이트
function updateNearbyCount() {
    nearbyCount.textContent = nearbyUsers.length;
}

// 근처 사용자 모달 표시
function showNearbyUsersModal() {
    nearbyUsersList.innerHTML = '';
    
    if (nearbyUsers.length === 0) {
        nearbyUsersList.innerHTML = '<p style="text-align: center; color: #666;">근처에 다른 사용자가 없습니다.</p>';
    } else {
        nearbyUsers.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            
            userItem.innerHTML = `
                <div class="user-info-modal">
                    <div class="user-name">${user.username}</div>
                    <div class="user-distance">${user.distance}m 거리</div>
                </div>
            `;
            
            nearbyUsersList.appendChild(userItem);
        });
    }
    
    nearbyUsersModal.classList.add('active');
}

// 근처 사용자 모달 숨기기
function hideNearbyUsersModal() {
    nearbyUsersModal.classList.remove('active');
}

// 화면 전환
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// 스크롤을 맨 아래로
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 시간 포맷팅
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // 1분 이내
        return '방금 전';
    } else if (diff < 3600000) { // 1시간 이내
        return `${Math.floor(diff / 60000)}분 전`;
    } else {
        return date.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

// 토스트 메시지 표시
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
    }
});

// 온라인/오프라인 상태 감지
window.addEventListener('online', () => {
    showToast('인터넷 연결이 복구되었습니다.', 'success');
});

window.addEventListener('offline', () => {
    showToast('인터넷 연결이 끊어졌습니다.', 'error');
});
