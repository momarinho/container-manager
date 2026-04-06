import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { Colors } from "../constants/Colors";

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator color={Colors.primary} size="large" />
    </View>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      const route = isAuthenticated ? "/(tabs)" : "/login";
      router.replace(route);
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="container/[id]"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AppContent />
        <StatusBar style="auto" />
      </AuthProvider>
    </ThemeProvider>
  );
}
