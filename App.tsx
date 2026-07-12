import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { InterstitialAd, TestIds, AdEventType } from 'react-native-google-mobile-ads';
import { classifyNavigationUrl, isTrustedAppUrl } from './urlPolicy';

SplashScreen.preventAutoHideAsync().catch(() => {});

const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-3940256099942544/1033173712'; // Replace with real ID before release
const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: true,
});

// 알림이 도착했을 때 어떻게 처리할지 설정 (앱이 켜져있을 때도 알림 띄우기)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const webviewRef = useRef<WebView>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);

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
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  // 웹뷰 초기 URL
  const [webViewUrl, setWebViewUrl] = useState('https://nihongo-gakushu.onrender.com');

  // 앱 실행 시 알림 권한 요청 및 푸시 클릭 리스너 등록
  useEffect(() => {
    async function setupNotifications() {
      try {
        if (Device.isDevice) {
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
              name: '기본 알림',
              importance: Notifications.AndroidImportance.HIGH,
            });
          }

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
        }

        // 콜드 스타트(앱이 완전히 꺼져있을 때)로 알림을 눌러서 켰을 경우 확인
        const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastNotificationResponse) {
          const data = lastNotificationResponse.notification.request.content.data;
          const targetItem = typeof data?.targetItem === 'string' ? data.targetItem : null;
          if (targetItem) {
            const type = typeof data.type === 'string' ? data.type : 'vocab';
            const level = typeof data.level === 'string' ? data.level : 'N5';
            const params = `?targetItem=${encodeURIComponent(targetItem)}&type=${encodeURIComponent(type)}&level=${encodeURIComponent(level)}`;
            setWebViewUrl(`https://nihongo-gakushu.onrender.com${params}`);
          }
        }
      } catch (error) {
        console.log('알림 설정 중 에러 발생:', error);
      }
    }
    setupNotifications();

    // 앱이 백그라운드나 포그라운드에 켜져 있을 때 알림을 클릭했을 때 발생하는 이벤트 리스너
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      const targetItem = typeof data?.targetItem === 'string' ? data.targetItem : null;
      if (targetItem) {
        console.log("푸시 알림 클릭 감지 (딥링크):", data);

        const type = typeof data.type === 'string' ? data.type : 'vocab';
        const level = typeof data.level === 'string' ? data.level : 'N5';
        const params = `?targetItem=${encodeURIComponent(targetItem)}&type=${encodeURIComponent(type)}&level=${encodeURIComponent(level)}`;
        const newUrl = `https://nihongo-gakushu.onrender.com${params}`;
        
        // URL을 변경하여 웹뷰가 해당 딥링크로 로드/리로드 되도록 함
        setWebViewUrl(newUrl);

        // 혹시 모르니 postMessage도 쏴줌
        if (webviewRef.current) {
          const messageStr = JSON.stringify({
            type: 'DEEP_LINK_STUDY',
            payload: data
          });
          webviewRef.current.injectJavaScript(`
            window.postMessage(${messageStr}, '*');
            true;
          `);
        }
      }
    });

    return () => {
      responseListener.remove();
    };
  }, []);

  // 광고 로딩 상태 관리 및 로드
  useEffect(() => {
    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      setAdLoaded(true);
    });

    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setAdLoaded(false);
      interstitial.load(); // 닫히면 바로 다음 광고 미리 로드
    });

    interstitial.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
    };
  }, []);

  // 웹에서 보낸 메시지(nativeBridge) 수신 처리
  const onMessage = async (event: WebViewMessageEvent) => {
    if (!isTrustedAppUrl(event.nativeEvent.url, __DEV__)) {
      console.warn('[Native] 신뢰할 수 없는 페이지의 메시지를 차단했습니다:', event.nativeEvent.url);
      return;
    }

    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
        throw new Error('올바르지 않은 메시지 형식입니다.');
      }

      if (data.type === 'SCHEDULE_NOTIFICATION') {
        const { title, body, seconds } = data.payload || {};
        const isValidPayload =
          typeof title === 'string' && title.length > 0 && title.length <= 100 &&
          typeof body === 'string' && body.length > 0 && body.length <= 500 &&
          typeof seconds === 'number' && Number.isFinite(seconds) &&
          seconds >= 1 && seconds <= 60 * 60 * 24 * 30;

        if (!isValidPayload) {
          throw new Error('올바르지 않은 알림 예약 정보입니다.');
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            title: title,
            body: body,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
          },
        });

        console.log(`[Native] 알림 예약 완료: ${seconds}초 뒤`);
      } else if (data.type === 'GET_EXPO_TOKEN') {
        // 웹에서 토큰을 요청했을 때 응답
        if (webviewRef.current) {
          const serializedToken = JSON.stringify(expoPushToken || '');
          webviewRef.current.injectJavaScript(`
            window.receiveExpoToken && window.receiveExpoToken(${serializedToken});
            true;
          `);
        }
      } else if (data.type === 'EXIT_APP') {
        // 웹 브라우저가 홈 화면일 때 종료 요청을 보냅니다.
        setExitModalVisible(true);
      } else if (data.type === 'SHOW_INTERSTITIAL_AD') {
        if (adLoaded) {
          interstitial.show();
        } else {
          console.log('[Native] 전면 광고가 아직 로드되지 않았습니다.');
          // 아직 로드되지 않았다면 강제로 로드 요청
          interstitial.load();
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
        backgroundColor: '#f8fafc'
      }}>
        <StatusBar style="dark" />
        <WebView
          ref={webviewRef}
          source={{ uri: webViewUrl }}
          onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
          onLoadEnd={() => {
            SplashScreen.hideAsync().catch(() => {});
          }}
          onMessage={onMessage}
          injectedJavaScriptBeforeContentLoaded={injectedJS}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          bounces={false}
          overScrollMode="never"
          style={{ flex: 1 }}
          onShouldStartLoadWithRequest={(request) => {
            const policy = classifyNavigationUrl(request.url, __DEV__);
            if (policy === 'internal') return true;

            if (policy === 'external' && request.isTopFrame !== false) {
              Linking.canOpenURL(request.url)
                .then((supported) => supported && Linking.openURL(request.url))
                .catch((err) => {
                  console.error('[Native] Failed to open external URL:', err);
                });
            } else if (policy === 'blocked') {
              console.warn('[Native] 위험하거나 올바르지 않은 URL을 차단했습니다:', request.url);
            }

            return false;
          }}
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
        <Modal
          animationType="fade"
          transparent={true}
          visible={exitModalVisible}
          onRequestClose={() => setExitModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', borderRadius: 28, padding: 32, width: '100%', maxWidth: 340, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 }}>
              <View style={{ width: 64, height: 64, backgroundColor: '#fff7ed', borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#ffedd5' }}>
                <Text style={{ fontSize: 28, color: '#f97316', fontWeight: 'bold' }}>!</Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 12, textAlign: 'center' }}>
                학습을 마치고 앱을 종료하시겠습니까?
              </Text>
              <View style={{ flexDirection: 'row', width: '100%', gap: 12, marginTop: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 16, backgroundColor: '#f1f5f9', borderRadius: 16, alignItems: 'center' }}
                  onPress={() => setExitModalVisible(false)}
                >
                  <Text style={{ color: '#475569', fontWeight: '700', fontSize: 16 }}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 16, backgroundColor: '#f59e0b', borderRadius: 16, alignItems: 'center', shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                  onPress={() => BackHandler.exitApp()}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>확인</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
