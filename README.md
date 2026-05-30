# 일본어 일단마스터 (Mobile App)

이 프로젝트는 `일본어학습도우미` 풀스택 웹 앱을 래핑(Wrapping)하여 모바일 네이티브 푸시 알림과 하이브리드 기능을 제공하는 React Native 기반 모바일 애플리케이션입니다.

## 📋 기술 스택 및 주요 버전 (Tech Stack & Versions)

이 프로젝트(Mobile Repo)에서 사용된 핵심 기술과 패키지 버전입니다:

* **Framework**: React Native (`0.81.5`)
* **Expo SDK**: Expo (`~54.0.0`)
* **WebView**: `react-native-webview` (`13.15.0`)
* **Push Notifications**: `expo-notifications` (`~0.32.17`)
* **Styling**: `tailwindcss` (`^3.3.2`), `nativewind` (`^2.0.11`)

> **참고**: 백엔드 서버 및 프론트엔드 웹 UI 코드(React, Node.js, MongoDB)는 별도의 웹 레포지토리(`일본어학습도우미`)에서 관리됩니다.

## 🚀 실행 방법 (How to run)

### 1. 패키지 설치
```bash
npm install
```

### 2. 로컬 실행
```bash
npm start
```
위 명령어를 통해 Expo 개발 서버를 띄울 수 있습니다. 안드로이드 기기에서는 `npx expo run:android`를 사용하여 컴파일된 개발 빌드(Development Build)를 생성하셔야 백그라운드 푸시 알림을 정상적으로 테스트할 수 있습니다.

## 🔑 환경 변수
(해당 프로젝트는 현재 환경 변수를 직접 사용하지 않고, 웹뷰를 통해 웹 서버와 브릿지로 통신합니다.)
