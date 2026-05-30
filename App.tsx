import React, { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
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
  const [expoPushToken, setExpoPushToken] = React.useState<string | null>(null);

  // 안드로이드 뒤로가기 버튼 처리
  useEffect(() => {
    const onBackPress = () => {
      if (webviewRef.current) {
        webviewRef.current.goBack();
        return true; // 기본 뒤로가기 액션(앱 종료) 방지
      }
      return false;
    };
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, []);

  // 앱 실행 시 알림 권한 요청
  useEffect(() => {
    async function requestPermissions() {
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

        try {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
          const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
          setExpoPushToken(tokenData.data);
          console.log('Expo Push Token 발급 완료:', tokenData.data);
        } catch (error) {
          console.log('토큰 발급 실패 (가상 기기이거나 설정 문제일 수 있음):', error);
        }
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
        backgroundColor: '#f8fafc',
        paddingTop: Platform.OS === 'android' ? require('react-native').StatusBar.currentHeight : 0
      }}>
        <StatusBar style="auto" />
        <WebView
          ref={webviewRef}
          source={{ uri: 'https://nihongo-gakushu.onrender.com' }}
          onMessage={onMessage}
          injectedJavaScriptBeforeContentLoaded={injectedJS}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          bounces={false}
          overScrollMode="never"
          style={{ flex: 1 }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
