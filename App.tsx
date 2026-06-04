import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Alert, Modal, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';

// 알림이 도착했을 때 어떻게 처리할지 설정 (앱이 켜져있을 때도 알림 띄우기)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const webviewRef = useRef<WebView>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  // 안드로이드 뒤로가기 버튼 처리
  useEffect(() => {
    const onBackPress = () => {

      if (webviewRef.current) {
        // 웹앱 쪽에 뒤로가기 버튼이 눌렸다는 이벤트를 전달합니다.
        webviewRef.current.injectJavaScript(`
          window.dispatchEvent(new CustomEvent('hardwareBackPress'));
          true;
        `);
        return true; // 일단 네이티브의 기본 뒤로가기(종료) 동작을 막습니다.
      }
      return false;
    };
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, []);

  // 앱 실행 시 알림 권한 요청
  useEffect(() => {
    async function requestPermissions() {
      try {
        if (Device.isDevice) {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus !== 'granted') {
            console.log('푸시 알림 권한이 거부되었습니다.');
            return;
          }

          const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
          const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
          setExpoPushToken(tokenData.data);
          console.log('Expo Push Token 발급 완료:', tokenData.data);
        }
      } catch (error) {
        console.log('알림 설정 중 에러 발생:', error);
      }
    }
    requestPermissions();
  }, []);

  // 웹에서 보낸 메시지(nativeBridge) 수신 처리
  const onMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'SCHEDULE_NOTIFICATION') {
        const { title, body, seconds } = data.payload;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: title,
            body: body,
            sound: true,
          },
          trigger: { seconds: seconds },
        });

        console.log(`[Native] 알림 예약 완료: ${seconds}초 뒤`);
      } else if (data.type === 'GET_EXPO_TOKEN') {
        // 웹에서 토큰을 요청했을 때 응답
        if (webviewRef.current) {
          webviewRef.current.injectJavaScript(`
            window.receiveExpoToken && window.receiveExpoToken('${expoPushToken || ""}');
            true;
          `);
        }
      } else if (data.type === 'EXIT_APP') {
        // 웹 브라우저가 홈 화면일 때 종료 요청을 보냅니다.
        Alert.alert('앱 종료', '앱을 종료하시겠습니까?', [
          { text: '취소', style: 'cancel' },
          { text: '확인', style: 'destructive', onPress: () => BackHandler.exitApp() }
        ]);
      }
    } catch (error) {
      console.error('[Native] 메시지 파싱 에러:', error);
    }
  };

  const injectedJS = `
    window.isReactNative = true;
    true;
  `;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{
        flex: 1,
        backgroundColor: '#f8fafc'
      }}>
        <StatusBar style="dark" />
        <WebView
          ref={webviewRef}
          source={{ uri: 'https://nihongo-gakushu.onrender.com' }}
          onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
          onMessage={onMessage}
          injectedJavaScriptBeforeContentLoaded={injectedJS}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          bounces={false}
          overScrollMode="never"
          style={{ flex: 1 }}
          renderError={() => (
            <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12, color: '#334155' }}>네트워크 오류</Text>
              <Text style={{ fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 30, lineHeight: 24 }}>
                인터넷 연결이 끊어졌습니다.{'\n'}연결 상태를 확인하고 다시 시도해주세요.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#f43f5e', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10, width: '100%', maxWidth: 300, alignItems: 'center' }}
                onPress={() => {
                  webviewRef.current?.reload();
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
